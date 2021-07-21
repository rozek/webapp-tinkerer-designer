var WAD = (function (exports, webappTinkererRuntime) {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    function create_animation(node, from, fn, params) {
        if (!from)
            return noop;
        const to = node.getBoundingClientRect();
        if (from.left === to.left && from.right === to.right && from.top === to.top && from.bottom === to.bottom)
            return noop;
        const { delay = 0, duration = 300, easing = identity, 
        // @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
        start: start_time = now() + delay, 
        // @ts-ignore todo:
        end = start_time + duration, tick = noop, css } = fn(node, { from, to }, params);
        let running = true;
        let started = false;
        let name;
        function start() {
            if (css) {
                name = create_rule(node, 0, 1, duration, delay, easing, css);
            }
            if (!delay) {
                started = true;
            }
        }
        function stop() {
            if (css)
                delete_rule(node, name);
            running = false;
        }
        loop(now => {
            if (!started && now >= start_time) {
                started = true;
            }
            if (started && now >= end) {
                tick(1, 0);
                stop();
            }
            if (!running) {
                return false;
            }
            if (started) {
                const p = now - start_time;
                const t = 0 + 1 * easing(p / duration);
                tick(t, 1 - t);
            }
            return true;
        });
        start();
        tick(0, 1);
        return stop;
    }
    function fix_position(node) {
        const style = getComputedStyle(node);
        if (style.position !== 'absolute' && style.position !== 'fixed') {
            const { width, height } = style;
            const a = node.getBoundingClientRect();
            node.style.position = 'absolute';
            node.style.width = width;
            node.style.height = height;
            add_transform(node, a);
        }
    }
    function add_transform(node, a) {
        const b = node.getBoundingClientRect();
        if (a.left !== b.left || a.top !== b.top) {
            const style = getComputedStyle(node);
            const transform = style.transform === 'none' ? '' : style.transform;
            node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function fix_and_outro_and_destroy_block(block, lookup) {
        block.f();
        outro_and_destroy_block(block, lookup);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    let currentAppletList$2 = [];

      const AppletList = readable(currentAppletList$2, (set) => {
        function updateAppletList () {
          let newAppletList = webappTinkererRuntime.AppletPeersInDocument()
            .map((AppletPeer) => webappTinkererRuntime.VisualForElement(AppletPeer))
            .filter((Applet) => Applet.mayBeDesigned);
          if (webappTinkererRuntime.ValuesDiffer(currentAppletList$2,newAppletList)) {
            currentAppletList$2 = newAppletList;
            set(newAppletList);
          }

          setTimeout(updateAppletList, 300);
        }

        if (
          (document.readyState === 'complete') ||
          (document.readyState === 'interactive')
        ) {
          updateAppletList();
        } else {
          window.addEventListener('DOMContentLoaded', updateAppletList);
        }

        return () => {}
      });

    let currentAppletList$1     = [];
      let currentlyChosenApplet$5 = undefined;

      const chosenAppletStore = writable(undefined);   // for subscription management

    /**** keep track of changes in "AppletList" ****/

      AppletList.subscribe((newAppletList) => {      // implements a "derived" store
        currentAppletList$1 = newAppletList;
        if (
          (currentlyChosenApplet$5 != null) &&
          (newAppletList.indexOf(currentlyChosenApplet$5) < 0)
        ) {
          currentlyChosenApplet$5 = undefined;
          chosenAppletStore.set(undefined);
        }
      });

    /**** validate changes to "chosenApplet" ****/

      function setChosenApplet (Applet) {
        if (                   // "Applet" must be in the list of designable applets
          (Applet != null) &&
          (currentAppletList$1.indexOf(Applet) < 0)
        ) {
          Applet = undefined;
        }

        if (currentlyChosenApplet$5 !== Applet) {
          currentlyChosenApplet$5 = Applet;
          chosenAppletStore.set(Applet);
        }
      }

    /**** export an explicitly implemented store ****/

      const chosenApplet = {
        subscribe: (Subscription) => chosenAppletStore.subscribe(Subscription),
        set:       setChosenApplet
      };

    /*
      export WAD_MessageType   = 'info' | 'warning' | 'error'
      export WAD_Message       = WAT_Textline
      export WAD_MessageSource = WAT_Name | WAT_Visual | undefined
    */
      const initialMessageState = {
        MessageType:'info', Message:'', MessageSource:undefined
      };

      let currentlyChosenApplet$4 = undefined;
      let currentMessageState = Object.assign({}, initialMessageState);

      const MessageStateStore = writable(currentMessageState);   // subscription mgmt
      const MessageStateSet   = new WeakMap();      // applet-specific Message states

    /**** keep track of changes in "chosenApplet" ****/

      chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
        if (currentlyChosenApplet$4 !== newChosenApplet) {
          currentlyChosenApplet$4 = newChosenApplet;

          if (currentlyChosenApplet$4 == null) {
            currentMessageState = Object.assign({}, initialMessageState);
          } else {
            if (MessageStateSet.has(currentlyChosenApplet$4)) {
              currentMessageState = MessageStateSet.get(currentlyChosenApplet$4);
            } else {
              currentMessageState = Object.assign({}, initialMessageState);
              MessageStateSet.set(currentlyChosenApplet$4,currentMessageState);
            }
            MessageStateStore.set(currentMessageState);
          }
        }
      });

    /**** validate changes to "MessageState" ****/

      function setMessageState (newMessageState) {
        if (currentlyChosenApplet$4 !== null) {
          if (webappTinkererRuntime.ValuesDiffer(currentMessageState,newMessageState)) {
            currentMessageState = Object.assign({}, newMessageState);
            MessageStateSet.set(currentlyChosenApplet$4,newMessageState);
            MessageStateStore.set(newMessageState);
          }
        }
      }

    /**** clearInfo, clearWarning, clearError ****/

      function clearInfo () {
        if (currentMessageState.MessageType === 'info') {
          setMessageState(initialMessageState);
        }
      }

      function clearWarning () {
        if (currentMessageState.MessageType !== 'error') {
          setMessageState(initialMessageState);
        }
      }

      function clearError () {
        setMessageState(initialMessageState);
      }

    /**** showInfo, showWarning, showError ****/

      function showInfo (Message, MessageSource) {
        if (currentMessageState.MessageType === 'info') {
          setMessageState({ MessageType:'info', Message, MessageSource });
        }
      }

      function showWarning (Message, MessageSource) {
        if (currentMessageState.MessageType !== 'error') {
          setMessageState({ MessageType:'warning', Message, MessageSource });
        }
      }

      function showError (Message, MessageSource) {
        setMessageState({ MessageType:'error', Message, MessageSource });
      }

    /**** export an explicitly implemented store ****/

      const MessageState = {
        subscribe: (Callback) => MessageStateStore.subscribe(Callback),
        clearInfo, clearWarning, clearError, showInfo, showWarning, showError
      };

    function styleInject(css, ref) {
      if ( ref === void 0 ) ref = {};
      var insertAt = ref.insertAt;

      if (!css || typeof document === 'undefined') { return; }

      var head = document.head || document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      style.type = 'text/css';

      if (insertAt === 'top') {
        if (head.firstChild) {
          head.insertBefore(style, head.firstChild);
        } else {
          head.appendChild(style);
        }
      } else {
        head.appendChild(style);
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
    }

    var css_248z$7 = ".WAD-MessageView.svelte-1dfvlfz{display:block;position:relative;overflow:hidden;height:34px;line-height:34px;text-align:left;border:none;border-top:solid 1px var(--normal-color);padding:0px 34px 0px 4px;white-space:nowrap;text-overflow:ellipsis\n  }.info.svelte-1dfvlfz{color:var(--info-color) }.warning.svelte-1dfvlfz{color:var(--warning-color) }.error.svelte-1dfvlfz{color:#FF4500 }";
    styleInject(css_248z$7,{"insertAt":"top"});

    /* src/MessageView.svelte generated by Svelte v3.38.3 */

    function create_fragment$a(ctx) {
    	let div;
    	let t_value = /*$MessageState*/ ctx[0].Message + "";
    	let t;

    	return {
    		c() {
    			div = element("div");
    			t = text(t_value);
    			attr(div, "class", "WAD-MessageView svelte-1dfvlfz");
    			attr(div, "style", `--normal-color:${normalColor};` + `--info-color:${normalColor}; --warning-color:${hoveredColor$1}`);
    			toggle_class(div, "info", /*$MessageState*/ ctx[0].MessageType === "info");
    			toggle_class(div, "warning", /*$MessageState*/ ctx[0].MessageType === "warning");
    			toggle_class(div, "error", /*$MessageState*/ ctx[0].MessageType === "error");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$MessageState*/ 1 && t_value !== (t_value = /*$MessageState*/ ctx[0].Message + "")) set_data(t, t_value);

    			if (dirty & /*$MessageState*/ 1) {
    				toggle_class(div, "info", /*$MessageState*/ ctx[0].MessageType === "info");
    			}

    			if (dirty & /*$MessageState*/ 1) {
    				toggle_class(div, "warning", /*$MessageState*/ ctx[0].MessageType === "warning");
    			}

    			if (dirty & /*$MessageState*/ 1) {
    				toggle_class(div, "error", /*$MessageState*/ ctx[0].MessageType === "error");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    const normalColor = "#969696";
    const hoveredColor$1 = "#FFEC2E";

    function instance$a($$self, $$props, $$invalidate) {
    	let $MessageState;
    	component_subscribe($$self, MessageState, $$value => $$invalidate(0, $MessageState = $$value));
    	return [$MessageState];
    }

    class MessageView extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});
    	}
    }

    var css_248z$6 = ".WAD-Button.svelte-jo91fp{height:28px;border:solid 1px #303030;border-radius:4px;background-image:linear-gradient(180deg, #808080,#404040 70%);background-image:-webkit-linear-gradient(270deg, #808080,#404040 70%);color:#B4B4B4;font-size:inherit;font-weight:bold}.WAD-Button.svelte-jo91fp:hover:not(:disabled){border-color:#FFEC2E;color:#FFEC2E}.WAD-Button.svelte-jo91fp:active{background-image:linear-gradient(0deg, #808080,#404040 70%);background-image:-webkit-linear-gradient(90deg, #808080,#404040 70%)}.WAD-Button[active=\"true\"].svelte-jo91fp{color:#7FFF00}.WAD-Button.svelte-jo91fp:disabled{opacity:0.3}";
    styleInject(css_248z$6,{"insertAt":"top"});

    /* src/Button.svelte generated by Svelte v3.38.3 */

    function fallback_block$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("(Button)");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$9(ctx) {
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);
    	const default_slot_or_fallback = default_slot || fallback_block$1();
    	let button_levels = [/*$$restProps*/ ctx[0]];
    	let button_data = {};

    	for (let i = 0; i < button_levels.length; i += 1) {
    		button_data = assign(button_data, button_levels[i]);
    	}

    	return {
    		c() {
    			button = element("button");
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    			set_attributes(button, button_data);
    			toggle_class(button, "WAD-Button", true);
    			toggle_class(button, "svelte-jo91fp", true);
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], !current ? -1 : dirty, null, null);
    				}
    			}

    			set_attributes(button, button_data = get_spread_update(button_levels, [dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]]));
    			toggle_class(button, "WAD-Button", true);
    			toggle_class(button, "svelte-jo91fp", true);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$9($$self, $$props, $$invalidate) {
    	const omit_props_names = ["active"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { active = false } = $$props;

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("active" in $$new_props) $$invalidate(1, active = $$new_props.active);
    		if ("$$scope" in $$new_props) $$invalidate(2, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, active, $$scope, slots, click_handler];
    }

    class Button extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { active: 1 });
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function flip(node, animation, params = {}) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        const scaleX = animation.from.width / node.clientWidth;
        const scaleY = animation.from.height / node.clientHeight;
        const dx = (animation.from.left - animation.to.left) / scaleX;
        const dy = (animation.from.top - animation.to.top) / scaleY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;
        return {
            delay,
            duration: is_function(duration) ? duration(d) : duration,
            easing,
            css: (_t, u) => `transform: ${transform} translate(${u * dx}px, ${u * dy}px);`
        };
    }

    //----------------------------------------------------------------------------//
    //                        JavaScript Interface Library                        //
    //----------------------------------------------------------------------------//
    /**** get a reference to the "global" object ****/
    var global$2 = /*#__PURE__*/ Function('return this')();
    // see https://stackoverflow.com/questions/3277182/how-to-get-the-global-object-in-javascript
    //------------------------------------------------------------------------------
    //--                             Object Functions                             --
    //------------------------------------------------------------------------------
    // allow methods from Object.prototype to be applied to "vanilla" objects
    /**** Object_hasOwnProperty ****/
    function Object_hasOwnProperty(Value, PropertyName) {
        return ((Value == null) || // let this method crash like its original
            ('hasOwnProperty' in Value) && (typeof Value.hasOwnProperty === 'function')
            ? Value.hasOwnProperty(PropertyName)
            : Object.prototype.hasOwnProperty.call(Value, PropertyName));
    }
    /**** throwError - simplifies construction of named errors ****/
    function throwError(Message) {
        var Match = /^([$a-zA-Z][$a-zA-Z0-9]*):\s*(\S.+)\s*$/.exec(Message);
        if (Match == null) {
            throw new Error(Message);
        }
        else {
            var namedError = new Error(Match[2]);
            namedError.name = Match[1];
            throw namedError;
        }
    }
    /**** ValueIsBoolean ****/
    function ValueIsBoolean(Value) {
        return (typeof Value === 'boolean') || (Value instanceof Boolean);
    }
    /**** ValueIsNumber ****/
    function ValueIsNumber(Value) {
        return (typeof Value === 'number') || (Value instanceof Number);
    }
    /**** ValueIsFiniteNumber (pure "isFinite" breaks on objects) ****/
    function ValueIsFiniteNumber(Value) {
        return ((typeof Value === 'number') || (Value instanceof Number)) && isFinite(Value.valueOf());
    }
    /**** ValueIsInteger ****/
    function ValueIsInteger(Value) {
        if ((typeof Value !== 'number') && !(Value instanceof Number)) {
            return false;
        }
        Value = Value.valueOf();
        return isFinite(Value) && (Math.round(Value) === Value);
    }
    /**** ValueIsOrdinal ****/
    function ValueIsOrdinal(Value) {
        if ((typeof Value !== 'number') && !(Value instanceof Number)) {
            return false;
        }
        Value = Value.valueOf();
        return isFinite(Value) && (Math.round(Value) === Value) && (Value >= 0);
    }
    /**** ValueIsString ****/
    function ValueIsString(Value) {
        return (typeof Value === 'string') || (Value instanceof String);
    }
    /**** ValueIs[Non]EmptyString ****/
    var emptyStringPattern = /^\s*$/;
    function ValueIsNonEmptyString(Value) {
        return ((typeof Value === 'string') || (Value instanceof String)) && !emptyStringPattern.test(Value.valueOf());
    }
    /**** ValueIsFunction ****/
    function ValueIsFunction(Value) {
        return (typeof Value === 'function');
    }
    /**** ValueIsObject ****/
    function ValueIsObject(Value) {
        return (Value != null) && (typeof Value === 'object');
    }
    /**** ValueIsPlainObject ****/
    function ValueIsPlainObject(Value) {
        return ((Value != null) && (typeof Value === 'object') &&
            (Object.getPrototypeOf(Value) === Object.prototype));
    }
    /**** ValueIsArray ****/
    var ValueIsArray = Array.isArray;
    /**** ValueIsList ("dense" array) ****/
    function ValueIsList(Value, minLength, maxLength) {
        if (ValueIsArray(Value)) {
            for (var i = 0, l = Value.length; i < l; i++) {
                if (Value[i] === undefined) {
                    return false;
                }
            }
            if (minLength != null) {
                if (Value.length < minLength) {
                    return false;
                }
            }
            if (maxLength != null) {
                if (Value.length > maxLength) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
    /**** ValueIsListSatisfying ****/
    function ValueIsListSatisfying(Value, Validator, minLength, maxLength) {
        if (ValueIsArray(Value)) {
            try {
                for (var i = 0, l = Value.length; i < l; i++) {
                    if (Validator(Value[i]) == false) {
                        return false;
                    }
                }
                if (minLength != null) {
                    if (Value.length < minLength) {
                        return false;
                    }
                }
                if (maxLength != null) {
                    if (Value.length > maxLength) {
                        return false;
                    }
                }
                return true;
            }
            catch (Signal) { /* nop */ }
        }
        return false;
    }
    /**** ValueIsOneOf ****/
    function ValueIsOneOf(Value, ValueList) {
        return (ValueList.indexOf(Value) >= 0);
    } // no automatic unboxing of boxed values and vice-versa!
    /**** ValueIsColor ****/
    function ValueIsColor(Value) {
        return ValueIsString(Value) && (ColorSet.hasOwnProperty(Value) ||
            /^#[a-fA-F0-9]{6}$/.test(Value) ||
            /^#[a-fA-F0-9]{8}$/.test(Value) ||
            /^rgb\([0-9]+,\s*[0-9]+,\s*[0-9]+\)$/.test(Value) || // not perfect
            /^rgba\([0-9]+,\s*[0-9]+,\s*[0-9]+,([01]|[0]?[.][0-9]+)\)$/.test(Value) // dto.
        );
    }
    //------------------------------------------------------------------------------
    //--                      Argument Validation Functions                       --
    //------------------------------------------------------------------------------
    var rejectNil = false;
    var acceptNil = true;
    /**** validatedArgument ****/
    function validatedArgument(Description, Argument, ValueIsValid, NilIsAcceptable, Expectation) {
        if (Argument == null) {
            if (NilIsAcceptable) {
                return Argument;
            }
            else {
                throwError("MissingArgument: no " + escaped(Description) + " given");
            }
        }
        else {
            if (ValueIsValid(Argument)) {
                switch (true) {
                    case Argument instanceof Boolean:
                    case Argument instanceof Number:
                    case Argument instanceof String:
                        return Argument.valueOf(); // unboxes any primitives
                    default:
                        return Argument;
                }
            }
            else {
                throwError("InvalidArgument: the given " + escaped(Description) + " is no valid " + escaped(Expectation));
            }
        }
    }
    /**** ValidatorForClassifier ****/
    function ValidatorForClassifier(Classifier, NilIsAcceptable, Expectation) {
        var Validator = function (Description, Argument) {
            return validatedArgument(Description, Argument, Classifier, NilIsAcceptable, Expectation);
        };
        var ClassifierName = Classifier.name;
        if ((ClassifierName != null) && /^ValueIs/.test(ClassifierName)) {
            var ValidatorName = ClassifierName.replace(// derive name from validator
            /^ValueIs/, NilIsAcceptable ? 'allow' : 'expect');
            return FunctionWithName(Validator, ValidatorName);
        }
        else {
            return Validator; // without any specific name
        }
    }
    /**** FunctionWithName (works with older JS engines as well) ****/
    function FunctionWithName(originalFunction, desiredName) {
        if (originalFunction == null) {
            throwError('MissingArgument: no function given');
        }
        if (typeof originalFunction !== 'function') {
            throwError('InvalidArgument: the given 1st Argument is not a JavaScript function');
        }
        if (desiredName == null) {
            throwError('MissingArgument: no desired name given');
        }
        if ((typeof desiredName !== 'string') && !(desiredName instanceof String)) {
            throwError('InvalidArgument: the given desired name is not a string');
        }
        if (originalFunction.name === desiredName) {
            return originalFunction;
        }
        try {
            Object.defineProperty(originalFunction, 'name', { value: desiredName });
            if (originalFunction.name === desiredName) {
                return originalFunction;
            }
        }
        catch (signal) { /* ok - let's take the hard way */ }
        var renamed = new Function('originalFunction', 'return function ' + desiredName + ' () {' +
            'return originalFunction.apply(this,Array.prototype.slice.apply(arguments))' +
            '}');
        return renamed(originalFunction);
    } // also works with older JavaScript engines
    /**** allow/expect[ed]Boolean ****/
    var allowBoolean = /*#__PURE__*/ ValidatorForClassifier(ValueIsBoolean, acceptNil, 'boolean value'), allowedBoolean = allowBoolean;
    /**** allow/expect[ed]FiniteNumber ****/
    var allowFiniteNumber = /*#__PURE__*/ ValidatorForClassifier(ValueIsFiniteNumber, acceptNil, 'finite numeric value'), allowedFiniteNumber = allowFiniteNumber;
    var expectInteger = /*#__PURE__*/ ValidatorForClassifier(ValueIsInteger, rejectNil, 'integral numeric value');
    /**** allow[ed]IntegerInRange ****/
    function allowIntegerInRange(Description, Argument, minValue, maxValue) {
        return (Argument == null
            ? Argument
            : expectedIntegerInRange(Description, Argument, minValue, maxValue));
    }
    var allowedIntegerInRange = allowIntegerInRange;
    /**** expect[ed]IntegerInRange ****/
    function expectIntegerInRange(Description, Argument, minValue, maxValue) {
        expectInteger(Description, Argument);
        if (isNaN(Argument)) {
            throwError("InvalidArgument: the given " + escaped(Description) + " is not-a-number");
        }
        if ((minValue != null) && isFinite(minValue)) {
            if ((maxValue != null) && isFinite(maxValue)) {
                if ((Argument < minValue) || (Argument > maxValue)) {
                    throw new RangeError("the given " + escaped(Description) + " (" + Argument + ") is outside " +
                        ("the allowed range (" + minValue + "..." + maxValue + ")"));
                }
            }
            else {
                if (Argument < minValue) {
                    throw new RangeError("the given " + escaped(Description) + " is below the allowed " +
                        ("minimum (" + Argument + " < " + minValue + ")"));
                }
            }
        }
        else {
            if ((maxValue != null) && isFinite(maxValue)) {
                if (Argument > maxValue) {
                    throw new RangeError("the given " + escaped(Description) + " exceeds the allowed " +
                        ("maximum (" + Argument + " > " + maxValue + ")"));
                }
            }
        }
        return Argument.valueOf();
    }
    var expectedIntegerInRange = expectIntegerInRange;
    /**** allow/expect[ed]Ordinal ****/
    var allowOrdinal = /*#__PURE__*/ ValidatorForClassifier(ValueIsOrdinal, acceptNil, 'ordinal number'), allowedOrdinal = allowOrdinal;
    /**** allow/expect[ed]String ****/
    var allowString = /*#__PURE__*/ ValidatorForClassifier(ValueIsString, acceptNil, 'literal string'), allowedString = allowString;
    /**** allow/expect[ed]NonEmptyString ****/
    var allowNonEmptyString = /*#__PURE__*/ ValidatorForClassifier(ValueIsNonEmptyString, acceptNil, 'non-empty literal string'), allowedNonEmptyString = allowNonEmptyString;
    /**** allow/expect[ed]Function ****/
    var allowFunction = /*#__PURE__*/ ValidatorForClassifier(ValueIsFunction, acceptNil, 'JavaScript function'), allowedFunction = allowFunction;
    var expectObject = /*#__PURE__*/ ValidatorForClassifier(ValueIsObject, rejectNil, 'JavaScript object');
    /**** allow/expect[ed]PlainObject ****/
    var allowPlainObject = /*#__PURE__*/ ValidatorForClassifier(ValueIsPlainObject, acceptNil, '"plain" JavaScript object'), allowedPlainObject = allowPlainObject;
    /**** allow[ed]ListSatisfying ****/
    function allowListSatisfying(Description, Argument, Validator, Expectation, minLength, maxLength) {
        return (Argument == null
            ? Argument
            : expectedListSatisfying(Description, Argument, Validator, Expectation, minLength, maxLength));
    }
    var allowedListSatisfying = allowListSatisfying;
    /**** expect[ed]ListSatisfying ****/
    function expectListSatisfying(Description, Argument, Validator, Expectation, minLength, maxLength) {
        if (Argument == null) {
            throwError("MissingArgument: no " + escaped(Description) + " given");
        }
        if (ValueIsListSatisfying(Argument, Validator, minLength, maxLength)) {
            return Argument;
        }
        else {
            throwError("InvalidArgument: the given " + escaped(Description) + " is " + (Expectation == null
                ? 'either not a list or contains invalid elements'
                : 'no ' + escaped(Expectation)));
        }
    }
    var expectedListSatisfying = expectListSatisfying;
    /**** expect[ed]InstanceOf ****/
    function expectInstanceOf(Description, Argument, constructor, Expectation) {
        if (Argument == null) {
            throwError("MissingArgument: no " + escaped(Description) + " given");
        }
        if (!(Argument instanceof constructor)) {
            throwError("InvalidArgument: the given " + escaped(Description) + " is no " + escaped(Expectation));
        }
        return Argument;
    }
    var expectColor = /*#__PURE__*/ ValidatorForClassifier(ValueIsColor, rejectNil, 'valid CSS color specification');
    /**** escaped - escapes all control characters in a given string ****/
    function escaped(Text) {
        var EscapeSequencePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?/g;
        var CtrlCharCodePattern = /[\x00-\x1f\x7f-\x9f]/g;
        return Text
            .replace(EscapeSequencePattern, function (Match) {
            return (Match === '\\' ? '\\\\' : Match);
        })
            .replace(CtrlCharCodePattern, function (Match) {
            switch (Match) {
                case '\0': return '\\0';
                case '\b': return '\\b';
                case '\f': return '\\f';
                case '\n': return '\\n';
                case '\r': return '\\r';
                case '\t': return '\\t';
                case '\v': return '\\v';
                default: {
                    var HexCode = Match.charCodeAt(0).toString(16);
                    return '\\x' + '00'.slice(HexCode.length) + HexCode;
                }
            }
        });
    }
    /**** quotable - makes a given string ready to be put in single/double quotes ****/
    function quotable(Text, Quote) {
        if (Quote === void 0) { Quote = '"'; }
        var EscSeqOrSglQuotePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?|'/g;
        var EscSeqOrDblQuotePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?|"/g;
        var CtrlCharCodePattern = /[\x00-\x1f\x7f-\x9f]/g;
        return Text
            .replace(Quote === "'" ? EscSeqOrSglQuotePattern : EscSeqOrDblQuotePattern, function (Match) {
            switch (Match) {
                case "'": return "\\'";
                case '"': return '\\"';
                case '\\': return '\\\\';
                default: return Match;
            }
        })
            .replace(CtrlCharCodePattern, function (Match) {
            switch (Match) {
                case '\0': return '\\0';
                case '\b': return '\\b';
                case '\f': return '\\f';
                case '\n': return '\\n';
                case '\r': return '\\r';
                case '\t': return '\\t';
                case '\v': return '\\v';
                default: {
                    var HexCode = Match.charCodeAt(0).toString(16);
                    return '\\x' + '00'.slice(HexCode.length) + HexCode;
                }
            }
        });
    }
    /**** quoted ****/
    function quoted(Text, Quote) {
        if (Quote === void 0) { Quote = '"'; }
        return Quote + quotable(Text, Quote) + Quote;
    }
    /**** ValuesDiffer ****/
    function ValuesDiffer(thisValue, otherValue, Mode) {
        if (thisValue === otherValue) {
            return false;
        }
        var thisType = typeof thisValue;
        if (thisType !== typeof otherValue) {
            return true;
        }
        /**** ArraysDiffer ****/
        function ArraysDiffer(thisArray, otherArray, Mode) {
            if (!Array.isArray(otherArray)) {
                return true;
            }
            if (thisArray.length !== otherArray.length) {
                return true;
            }
            for (var i = 0, l = thisArray.length; i < l; i++) {
                if (ValuesDiffer(thisArray[i], otherArray[i], Mode)) {
                    return true;
                }
            }
            return false;
        }
        /**** ObjectsDiffer ****/
        function ObjectsDiffer(thisObject, otherObject, Mode) {
            if (Object.getPrototypeOf(thisObject) !== Object.getPrototypeOf(otherObject)) {
                return true;
            }
            for (var key in thisObject) {
                if (!(key in otherObject)) {
                    return true;
                }
            }
            for (var key in otherObject) {
                if (!(key in thisObject)) {
                    return true;
                }
                if (ValuesDiffer(thisObject[key], otherObject[key], Mode)) {
                    return true;
                }
            }
            return false;
        }
        switch (thisType) {
            case 'undefined':
            case 'boolean':
            case 'string':
            case 'function': return true; // most primitives are compared using "==="
            case 'number': return ((isNaN(thisValue) !== isNaN(otherValue)) ||
                (Math.abs(thisValue - otherValue) > Number.EPSILON));
            case 'object':
                if (thisValue == null) {
                    return true;
                } // since "other_value" != null!
                if (otherValue == null) {
                    return true;
                } // since "this_value" != null!
                if ((Mode === 'by-value') && ((thisValue instanceof Boolean) ||
                    (thisValue instanceof Number) ||
                    (thisValue instanceof String))) {
                    return (thisValue.valueOf() !== otherValue.valueOf());
                }
                if (Array.isArray(thisValue)) {
                    return ArraysDiffer(thisValue, otherValue, Mode);
                }
                return (Mode === 'by-reference'
                    ? true // because (thisValue !== otherValue)
                    : ObjectsDiffer(thisValue, otherValue, Mode));
            default: return true; // unsupported property type
        }
        return true;
    }
    /**** ObjectIsEmpty ****/
    function ObjectIsEmpty(Candidate) {
        expectObject('candidate', Candidate);
        for (var Key in Candidate) {
            if (Object_hasOwnProperty(Candidate, Key)) {
                return false;
            }
        }
        return true;
    }
    /**** ObjectIsNotEmpty ****/
    function ObjectIsNotEmpty(Candidate) {
        return !ObjectIsEmpty(Candidate);
    }
    /**** constrained ****/
    function constrained(Value, Minimum, Maximum) {
        if (Minimum === void 0) { Minimum = -Infinity; }
        if (Maximum === void 0) { Maximum = Infinity; }
        return Math.max(Minimum, Math.min(Value, Maximum));
    }
    //------------------------------------------------------------------------------
    //--                             Color Utilities                              --
    //------------------------------------------------------------------------------
    // built-in color names (see http://www.w3.org/TR/SVG/types.html#ColorKeywords) ----
    var ColorSet = {
        transparent: 'rgba(0,0,0,0,0.0)',
        aliceblue: 'rgba(240,248,255,1.0)', lightpink: 'rgba(255,182,193,1.0)',
        antiquewhite: 'rgba(250,235,215,1.0)', lightsalmon: 'rgba(255,160,122,1.0)',
        aqua: 'rgba(0,255,255,1.0)', lightseagreen: 'rgba(32,178,170,1.0)',
        aquamarine: 'rgba(127,255,212,1.0)', lightskyblue: 'rgba(135,206,250,1.0)',
        azure: 'rgba(240,255,255,1.0)', lightslategray: 'rgba(119,136,153,1.0)',
        beige: 'rgba(245,245,220,1.0)', lightslategrey: 'rgba(119,136,153,1.0)',
        bisque: 'rgba(255,228,196,1.0)', lightsteelblue: 'rgba(176,196,222,1.0)',
        black: 'rgba(0,0,0,1.0)', lightyellow: 'rgba(255,255,224,1.0)',
        blanchedalmond: 'rgba(255,235,205,1.0)', lime: 'rgba(0,255,0,1.0)',
        blue: 'rgba(0,0,255,1.0)', limegreen: 'rgba(50,205,50,1.0)',
        blueviolet: 'rgba(138,43,226,1.0)', linen: 'rgba(250,240,230,1.0)',
        brown: 'rgba(165,42,42,1.0)', magenta: 'rgba(255,0,255,1.0)',
        burlywood: 'rgba(222,184,135,1.0)', maroon: 'rgba(128,0,0,1.0)',
        cadetblue: 'rgba(95,158,160,1.0)', mediumaquamarine: 'rgba(102,205,170,1.0)',
        chartreuse: 'rgba(127,255,0,1.0)', mediumblue: 'rgba(0,0,205,1.0)',
        chocolate: 'rgba(210,105,30,1.0)', mediumorchid: 'rgba(186,85,211,1.0)',
        coral: 'rgba(255,127,80,1.0)', mediumpurple: 'rgba(147,112,219,1.0)',
        cornflowerblue: 'rgba(100,149,237,1.0)', mediumseagreen: 'rgba(60,179,113,1.0)',
        cornsilk: 'rgba(255,248,220,1.0)', mediumslateblue: 'rgba(123,104,238,1.0)',
        crimson: 'rgba(220,20,60,1.0)', mediumspringgreen: 'rgba(0,250,154,1.0)',
        cyan: 'rgba(0,255,255,1.0)', mediumturquoise: 'rgba(72,209,204,1.0)',
        darkblue: 'rgba(0,0,139,1.0)', mediumvioletred: 'rgba(199,21,133,1.0)',
        darkcyan: 'rgba(0,139,139,1.0)', midnightblue: 'rgba(25,25,112,1.0)',
        darkgoldenrod: 'rgba(184,134,11,1.0)', mintcream: 'rgba(245,255,250,1.0)',
        darkgray: 'rgba(169,169,169,1.0)', mistyrose: 'rgba(255,228,225,1.0)',
        darkgreen: 'rgba(0,100,0,1.0)', moccasin: 'rgba(255,228,181,1.0)',
        darkgrey: 'rgba(169,169,169,1.0)', navajowhite: 'rgba(255,222,173,1.0)',
        darkkhaki: 'rgba(189,183,107,1.0)', navy: 'rgba(0,0,128,1.0)',
        darkmagenta: 'rgba(139,0,139,1.0)', oldlace: 'rgba(253,245,230,1.0)',
        darkolivegreen: 'rgba(85,107,47,1.0)', olive: 'rgba(128,128,0,1.0)',
        darkorange: 'rgba(255,140,0,1.0)', olivedrab: 'rgba(107,142,35,1.0)',
        darkorchid: 'rgba(153,50,204,1.0)', orange: 'rgba(255,165,0,1.0)',
        darkred: 'rgba(139,0,0,1.0)', orangered: 'rgba(255,69,0,1.0)',
        darksalmon: 'rgba(233,150,122,1.0)', orchid: 'rgba(218,112,214,1.0)',
        darkseagreen: 'rgba(143,188,143,1.0)', palegoldenrod: 'rgba(238,232,170,1.0)',
        darkslateblue: 'rgba(72,61,139,1.0)', palegreen: 'rgba(152,251,152,1.0)',
        darkslategray: 'rgba(47,79,79,1.0)', paleturquoise: 'rgba(175,238,238,1.0)',
        darkslategrey: 'rgba(47,79,79,1.0)', palevioletred: 'rgba(219,112,147,1.0)',
        darkturquoise: 'rgba(0,206,209,1.0)', papayawhip: 'rgba(255,239,213,1.0)',
        darkviolet: 'rgba(148,0,211,1.0)', peachpuff: 'rgba(255,218,185,1.0)',
        deeppink: 'rgba(255,20,147,1.0)', peru: 'rgba(205,133,63,1.0)',
        deepskyblue: 'rgba(0,191,255,1.0)', pink: 'rgba(255,192,203,1.0)',
        dimgray: 'rgba(105,105,105,1.0)', plum: 'rgba(221,160,221,1.0)',
        dimgrey: 'rgba(105,105,105,1.0)', powderblue: 'rgba(176,224,230,1.0)',
        dodgerblue: 'rgba(30,144,255,1.0)', purple: 'rgba(128,0,128,1.0)',
        firebrick: 'rgba(178,34,34,1.0)', red: 'rgba(255,0,0,1.0)',
        floralwhite: 'rgba(255,250,240,1.0)', rosybrown: 'rgba(188,143,143,1.0)',
        forestgreen: 'rgba(34,139,34,1.0)', royalblue: 'rgba(65,105,225,1.0)',
        fuchsia: 'rgba(255,0,255,1.0)', saddlebrown: 'rgba(139,69,19,1.0)',
        gainsboro: 'rgba(220,220,220,1.0)', salmon: 'rgba(250,128,114,1.0)',
        ghostwhite: 'rgba(248,248,255,1.0)', sandybrown: 'rgba(244,164,96,1.0)',
        gold: 'rgba(255,215,0,1.0)', seagreen: 'rgba(46,139,87,1.0)',
        goldenrod: 'rgba(218,165,32,1.0)', seashell: 'rgba(255,245,238,1.0)',
        gray: 'rgba(128,128,128,1.0)', sienna: 'rgba(160,82,45,1.0)',
        green: 'rgba(0,128,0,1.0)', silver: 'rgba(192,192,192,1.0)',
        greenyellow: 'rgba(173,255,47,1.0)', skyblue: 'rgba(135,206,235,1.0)',
        grey: 'rgba(128,128,128,1.0)', slateblue: 'rgba(106,90,205,1.0)',
        honeydew: 'rgba(240,255,240,1.0)', slategray: 'rgba(112,128,144,1.0)',
        hotpink: 'rgba(255,105,180,1.0)', slategrey: 'rgba(112,128,144,1.0)',
        indianred: 'rgba(205,92,92,1.0)', snow: 'rgba(255,250,250,1.0)',
        indigo: 'rgba(75,0,130,1.0)', springgreen: 'rgba(0,255,127,1.0)',
        ivory: 'rgba(255,255,240,1.0)', steelblue: 'rgba(70,130,180,1.0)',
        khaki: 'rgba(240,230,140,1.0)', tan: 'rgba(210,180,140,1.0)',
        lavender: 'rgba(230,230,250,1.0)', teal: 'rgba(0,128,128,1.0)',
        lavenderblush: 'rgba(255,240,245,1.0)', thistle: 'rgba(216,191,216,1.0)',
        lawngreen: 'rgba(124,252,0,1.0)', tomato: 'rgba(255,99,71,1.0)',
        lemonchiffon: 'rgba(255,250,205,1.0)', turquoise: 'rgba(64,224,208,1.0)',
        lightblue: 'rgba(173,216,230,1.0)', violet: 'rgba(238,130,238,1.0)',
        lightcoral: 'rgba(240,128,128,1.0)', wheat: 'rgba(245,222,179,1.0)',
        lightcyan: 'rgba(224,255,255,1.0)', white: 'rgba(255,255,255,1.0)',
        lightgoldenrodyellow: 'rgba(250,250,210,1.0)', whitesmoke: 'rgba(245,245,245,1.0)',
        lightgray: 'rgba(211,211,211,1.0)', yellow: 'rgba(255,255,0,1.0)',
        lightgreen: 'rgba(144,238,144,1.0)', yellowgreen: 'rgba(154,205,50,1.0)',
        lightgrey: 'rgba(211,211,211,1.0)',
    };

    //----------------------------------------------------------------------------//
    //                        Svelte Coordinate Conversion                        //
    //----------------------------------------------------------------------------//
    function fromViewportTo(System, originalPosition, Target) {
        switch (true) {
            case (originalPosition == null):
                throw new Error('no "Position" given');
            case (typeof originalPosition.left !== 'number') && !(originalPosition.left instanceof Number):
            case (typeof originalPosition.top !== 'number') && !(originalPosition.top instanceof Number):
                throw new Error('invalid "Position" given');
        }
        switch (System) {
            case null:
            case undefined:
                throw new Error('no coordinate system given');
            // @ts-ignore the following check is for non-TypeScript applications only
            case 'viewport':
                return { left: originalPosition.left, top: originalPosition.top };
            case 'document':
                return {
                    left: originalPosition.left + window.scrollX,
                    top: originalPosition.top + window.scrollY
                };
            case 'local':
                switch (true) {
                    case (Target == null):
                        throw new Error('no target element given');
                    case (Target instanceof Element):
                        var computedStyle = window.getComputedStyle(Target);
                        var leftOffset = parseFloat(computedStyle.borderLeftWidth);
                        var topOffset = parseFloat(computedStyle.borderTopWidth);
                        var TargetPositionInViewport = Target.getBoundingClientRect();
                        return {
                            left: originalPosition.left - TargetPositionInViewport.left - leftOffset,
                            top: originalPosition.top - TargetPositionInViewport.top - topOffset
                        };
                    default:
                        throw new Error('invalid target element given');
                }
            default:
                throw new Error('invalid coordinate system given');
        }
    }
    function fromDocumentTo(System, originalPosition, Target) {
        switch (true) {
            case (originalPosition == null):
                throw new Error('no "Position" given');
            case (typeof originalPosition.left !== 'number') && !(originalPosition.left instanceof Number):
            case (typeof originalPosition.top !== 'number') && !(originalPosition.top instanceof Number):
                throw new Error('invalid "Position" given');
        }
        switch (System) {
            case null:
            case undefined:
                throw new Error('no coordinate system given');
            case 'viewport':
                return {
                    left: originalPosition.left - window.scrollX,
                    top: originalPosition.top - window.scrollY
                };
            // @ts-ignore the following check is for non-TypeScript applications only
            case 'document':
                return { left: originalPosition.left, top: originalPosition.top };
            case 'local':
                switch (true) {
                    case (Target == null):
                        throw new Error('no target element given');
                    case (Target instanceof Element):
                        var computedStyle = window.getComputedStyle(Target);
                        var leftOffset = parseFloat(computedStyle.borderLeftWidth);
                        var topOffset = parseFloat(computedStyle.borderTopWidth);
                        var TargetPositionInViewport = Target.getBoundingClientRect();
                        return {
                            left: originalPosition.left + window.scrollX - TargetPositionInViewport.left - leftOffset,
                            top: originalPosition.top + window.scrollY - TargetPositionInViewport.top - topOffset
                        };
                    default:
                        throw new Error('invalid target element given');
                }
            default:
                throw new Error('invalid coordinate system given');
        }
    }
    function fromLocalTo(System, originalPosition, Source) {
        switch (true) {
            case (originalPosition == null):
                throw new Error('no "Position" given');
            case (typeof originalPosition.left !== 'number') && !(originalPosition.left instanceof Number):
            case (typeof originalPosition.top !== 'number') && !(originalPosition.top instanceof Number):
                throw new Error('invalid "Position" given');
        }
        var SourcePositionInViewport, leftPosition, topPosition;
        switch (true) {
            case (Source == null):
                throw new Error('no source element given');
            case (Source instanceof Element):
                var computedStyle = window.getComputedStyle(Source);
                var leftOffset = parseFloat(computedStyle.borderLeftWidth);
                var topOffset = parseFloat(computedStyle.borderTopWidth);
                SourcePositionInViewport = Source.getBoundingClientRect();
                leftPosition = SourcePositionInViewport.left + leftOffset;
                topPosition = SourcePositionInViewport.top + topOffset;
                break;
            default:
                throw new Error('invalid source element given');
        }
        switch (System) {
            case null:
            case undefined:
                throw new Error('no coordinate system given');
            case 'viewport':
                return {
                    left: originalPosition.left + leftPosition,
                    top: originalPosition.top + topPosition
                };
            case 'document':
                return {
                    left: originalPosition.left + leftPosition + window.scrollX,
                    top: originalPosition.top + topPosition + window.scrollY
                };
            // @ts-ignore the following check is for non-TypeScript applications only
            case 'local':
                return { left: originalPosition.left, top: originalPosition.top };
            default:
                throw new Error('invalid coordinate system given');
        }
    }
    var svelteCoordinateConversion = {
        fromViewportTo: fromViewportTo,
        fromDocumentTo: fromDocumentTo,
        fromLocalTo: fromLocalTo
    };

    //----------------------------------------------------------------------------//
    var Context = ( // make this package a REAL singleton
    '__DragAndDropActions' in global$2
        ? global$2.__DragAndDropActions
        : global$2.__DragAndDropActions = {});
    /**** parsedDraggableOptions ****/
    function parsedDraggableOptions(Options) {
        Options = allowedPlainObject('drag options', Options) || {};
        var Extras, relativeTo;
        var onlyFrom, neverFrom;
        var Dummy, DummyOffsetX, DummyOffsetY;
        var minX, minY, maxX, maxY;
        var Pannable;
        var PanSensorWidth, PanSensorHeight, PanSpeed;
        var onDragStart, onDragMove, onDragEnd, onDragCancel;
        Extras = Options.Extras;
        switch (true) {
            case (Options.relativeTo == null):
                relativeTo = 'parent';
                break;
            case (Options.relativeTo === 'parent'):
            case (Options.relativeTo === 'body'):
            case ValueIsNonEmptyString(Options.relativeTo):
            case (Options.relativeTo instanceof HTMLElement):
            case (Options.relativeTo instanceof SVGElement):
                //    case (Options.relativeTo instanceof MathMLElement):
                relativeTo = Options.relativeTo;
                break;
            default: throwError('InvalidArgument: invalid position reference given');
        }
        onlyFrom = allowedNonEmptyString('"onlyFrom" CSS selector', Options.onlyFrom);
        neverFrom = allowedNonEmptyString('"neverFrom" CSS selector', Options.neverFrom);
        switch (true) {
            case (Options.Dummy == null):
                Dummy = undefined;
                break;
            case (Options.Dummy === 'standard'):
            case (Options.Dummy === 'none'):
            case ValueIsNonEmptyString(Options.Dummy):
            case (Options.Dummy instanceof HTMLElement):
            case (Options.Dummy instanceof SVGElement):
            //    case (Options.Dummy instanceof MathMLElement):
            case ValueIsFunction(Options.Dummy):
                Dummy = Options.Dummy;
                break;
            default: throwError('InvalidArgument: invalid drag dummy specification given');
        }
        DummyOffsetX = allowedFiniteNumber('dummy x offset', Options.DummyOffsetX);
        DummyOffsetY = allowedFiniteNumber('dummy y offset', Options.DummyOffsetY);
        minX = allowedFiniteNumber('min. x position', Options.minX);
        if (minX == null) {
            minX = -Infinity;
        }
        minY = allowedFiniteNumber('min. y position', Options.minY);
        if (minY == null) {
            minY = -Infinity;
        }
        maxX = allowedFiniteNumber('max. x position', Options.maxX);
        if (maxX == null) {
            maxX = Infinity;
        }
        maxY = allowedFiniteNumber('max. y position', Options.maxY);
        if (maxY == null) {
            maxY = Infinity;
        }
        switch (true) {
            case (Options.Pannable == null):
                Pannable = undefined;
                break;
            case ValueIsNonEmptyString(Options.Pannable):
            case (Options.Pannable instanceof HTMLElement):
            case (Options.Pannable instanceof SVGElement):
                //    case (Options.Pannable instanceof MathMLElement):
                Pannable = Options.Pannable;
                break;
            default: throwError('InvalidArgument: invalid "Pannable" specification given');
        }
        PanSensorWidth = allowedOrdinal('panning sensor width', Options.PanSensorWidth);
        if (PanSensorWidth == null) {
            PanSensorWidth = 20;
        }
        PanSensorHeight = allowedOrdinal('panning sensor height', Options.PanSensorHeight);
        if (PanSensorHeight == null) {
            PanSensorHeight = 20;
        }
        PanSpeed = allowedOrdinal('panning speed', Options.PanSpeed);
        if (PanSpeed == null) {
            PanSpeed = 10;
        }
        if (ValueIsPosition(Options.onDragStart)) {
            var _a = Options.onDragStart, x_1 = _a.x, y_1 = _a.y;
            onDragStart = function () { return ({ x: x_1, y: y_1 }); };
        }
        else {
            onDragStart = allowedFunction('"onDragStart" handler', Options.onDragStart);
        }
        onDragMove = allowedFunction('"onDragMove" handler', Options.onDragMove);
        onDragEnd = allowedFunction('"onDragEnd" handler', Options.onDragEnd);
        return {
            Extras: Extras,
            relativeTo: relativeTo,
            onlyFrom: onlyFrom,
            neverFrom: neverFrom,
            Dummy: Dummy,
            DummyOffsetX: DummyOffsetX,
            DummyOffsetY: DummyOffsetY,
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY,
            Pannable: Pannable,
            PanSensorWidth: PanSensorWidth,
            PanSensorHeight: PanSensorHeight,
            PanSpeed: PanSpeed,
            // @ts-ignore we cannot validate given functions any further
            onDragStart: onDragStart,
            onDragMove: onDragMove,
            onDragEnd: onDragEnd,
            onDragCancel: onDragCancel
        };
    }
    /**** use:asDraggable={options} ****/
    function asDraggable(Element, Options) {
        var isDragged;
        var currentDraggableOptions;
        var PositionReference; // element with user coordinate system
        var ReferenceDeltaX, ReferenceDeltaY; // mouse -> user coord.s
        var PositioningWasDelayed; // workaround for prob. with "drag" events
        var DragImage;
        var initialPosition; // given in user coordinates
        var lastPosition; // dto.
        isDragged = false;
        currentDraggableOptions = parsedDraggableOptions(Options);
        /**** startDragging ****/
        function startDragging(originalEvent) {
            var Options = currentDraggableOptions;
            if (fromForbiddenElement(Element, Options, originalEvent)) {
                originalEvent.stopPropagation();
                originalEvent.preventDefault();
                return false;
            }
            PositionReference = PositionReferenceFor(Element, Options);
            var relativePosition = svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, PositionReference); // relative to reference element
            ReferenceDeltaX = ReferenceDeltaY = 0;
            initialPosition = { x: 0, y: 0 };
            if (Options.onDragStart == null) {
                initialPosition = { x: 0, y: 0 }; // given in user coordinates
            }
            else {
                try {
                    var StartPosition = Options.onDragStart(Options.Extras);
                    if (ValueIsPlainObject(StartPosition)) {
                        var x = allowedFiniteNumber('x start position', StartPosition.x);
                        var y = allowedFiniteNumber('y start position', StartPosition.y);
                        ReferenceDeltaX = x - relativePosition.left;
                        ReferenceDeltaY = y - relativePosition.top;
                        x = constrained(x, Options.minX, Options.maxX);
                        y = constrained(y, Options.minY, Options.maxY);
                        initialPosition = { x: x, y: y }; // given in user coordinates
                    }
                }
                catch (Signal) {
                    console.error('"onDragStart" handler failed', Signal);
                }
            }
            lastPosition = initialPosition;
            PositioningWasDelayed = false; // initializes workaround
            if (Options.Dummy == null) {
                Options.Dummy = 'none'; // this is the default for "use.asDraggable"
            }
            DragImage = DragImageFor(Element, Options);
            if ((DragImage != null) && (originalEvent.dataTransfer != null)) {
                var OffsetX = Options.DummyOffsetX;
                var OffsetY = Options.DummyOffsetY;
                if ((OffsetX == null) || (OffsetY == null)) {
                    var PositionInDraggable = svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element);
                    if (OffsetX == null) {
                        OffsetX = PositionInDraggable.left;
                    }
                    if (OffsetY == null) {
                        OffsetY = PositionInDraggable.top;
                    }
                }
                switch (true) {
                    case (Options.Dummy === 'none'):
                        originalEvent.dataTransfer.setDragImage(DragImage, 0, 0);
                        setTimeout(function () {
                            document.body.removeChild(DragImage);
                        }, 0);
                        break;
                    case ValueIsString(Options.Dummy):
                        originalEvent.dataTransfer.setDragImage(DragImage, OffsetX, OffsetY);
                        setTimeout(function () {
                            document.body.removeChild(DragImage.parentElement);
                        }, 0);
                        break;
                    default:
                        originalEvent.dataTransfer.setDragImage(DragImage, OffsetX, OffsetY);
                }
            }
            if (originalEvent.dataTransfer != null) {
                originalEvent.dataTransfer.effectAllowed = 'none';
            }
            isDragged = true;
            setTimeout(function () { return Element.classList.add('dragged'); }, 0);
            originalEvent.stopPropagation();
        }
        /**** continueDragging ****/
        function continueDragging(originalEvent) {
            if (!isDragged) {
                return false;
            }
            var Options = currentDraggableOptions;
            if ((originalEvent.screenX === 0) && (originalEvent.screenY === 0) &&
                !PositioningWasDelayed) {
                PositioningWasDelayed = true; // last "drag" event contains wrong coord.s
            }
            else {
                PositioningWasDelayed = false;
                performPanningFor('draggable', Element, Options, originalEvent.pageX, originalEvent.pageY);
                var relativePosition = svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, PositionReference); // relative to reference element
                var x = relativePosition.left + ReferenceDeltaX; // in user coordinates
                var y = relativePosition.top + ReferenceDeltaY;
                x = constrained(x, Options.minX, Options.maxX);
                y = constrained(y, Options.minY, Options.maxY);
                var dx = x - lastPosition.x; // calculated AFTER constraining x,y
                var dy = y - lastPosition.y; // dto.
                lastPosition = { x: x, y: y };
                invokeHandler('onDragMove', Options, x, y, dx, dy, Options.Extras);
            }
            originalEvent.stopPropagation();
        }
        /**** finishDragging ****/
        function finishDragging(originalEvent) {
            if (!isDragged) {
                return false;
            }
            //    continueDragging(originalEvent)           // NO! positions might be wrong!
            var Options = currentDraggableOptions;
            if (Options.onDragEnd != null) {
                var x = constrained(lastPosition.x, Options.minX, Options.maxX);
                var y = constrained(lastPosition.y, Options.minY, Options.maxY);
                var dx = x - lastPosition.x;
                var dy = y - lastPosition.y;
                invokeHandler('onDragEnd', Options, x, y, dx, dy, Options.Extras);
            }
            isDragged = false;
            Element.classList.remove('dragged');
            originalEvent.stopPropagation();
        }
        /**** updateDraggableOptions ****/
        function updateDraggableOptions(Options) {
            Options = parsedDraggableOptions(Options);
            if ((currentDraggableOptions.Extras == null) && (Options.Extras != null)) {
                currentDraggableOptions.Extras = Options.Extras;
            } // Extras may be set with delay, but remain constant afterwards
            currentDraggableOptions.Dummy = (Options.Dummy || currentDraggableOptions.Dummy);
            currentDraggableOptions.minX = Options.minX;
            currentDraggableOptions.minY = Options.minY;
            currentDraggableOptions.maxX = Options.maxX;
            currentDraggableOptions.maxY = Options.maxY;
            currentDraggableOptions.Pannable = Options.Pannable;
            currentDraggableOptions.PanSensorWidth = Options.PanSensorWidth;
            currentDraggableOptions.PanSensorHeight = Options.PanSensorHeight;
            currentDraggableOptions.PanSpeed = Options.PanSpeed;
            currentDraggableOptions.onDragStart = (Options.onDragStart || currentDraggableOptions.onDragStart); // may be used to update initial position for subsequent drags
        }
        Element.setAttribute('draggable', 'true');
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('dragstart', startDragging);
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('drag', continueDragging);
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('dragend', finishDragging);
        return { update: updateDraggableOptions };
    }
    /**** fromForbiddenElement ****/
    function fromForbiddenElement(Element, Options, originalEvent) {
        if ((Options.onlyFrom != null) || (Options.neverFrom != null)) {
            var x = originalEvent.clientX;
            var y = originalEvent.clientY;
            var touchedElement = document.elementFromPoint(x, y);
            //    elementFromPoint considers elements with "pointer-events" <> "none" only
            //    but sometimes, "pointer-events:none" is needed for proper operation
            touchedElement = innerElementOf(touchedElement, x, y);
            if (Options.onlyFrom != null) {
                var fromElement = touchedElement.closest(Options.onlyFrom);
                if ((Element !== fromElement) && !Element.contains(fromElement)) {
                    return true;
                }
            }
            if (Options.neverFrom != null) {
                var fromElement = touchedElement.closest(Options.neverFrom);
                if ((Element === fromElement) || Element.contains(fromElement)) {
                    return true;
                }
            }
        }
        return false;
    }
    /**** innerElementOf ****/
    function innerElementOf(Candidate, x, y) {
        var innerElements = Candidate.children;
        for (var i = 0, l = innerElements.length; i < l; i++) {
            var innerElement = innerElements[i];
            var Position = svelteCoordinateConversion.fromLocalTo('viewport', { left: 0, top: 0 }, innerElement);
            if ((x < Position.left) || (y < Position.top)) {
                continue;
            }
            if (x > Position.left + innerElement.offsetWidth - 1) {
                continue;
            }
            if (y > Position.top + innerElement.offsetHeight - 1) {
                continue;
            }
            return innerElementOf(innerElement, x, y);
        }
        return Candidate; // this is the innermost element at (x,y)
    }
    //-------------------------------------------------------------------------------
    //--               use:asDroppable={options} - "drag" and "drop"               --
    //-------------------------------------------------------------------------------
    var DropOperations = ['copy', 'move', 'link'];
    /**** parsedDroppableOptions ****/
    function parsedDroppableOptions(Options) {
        Options = allowedPlainObject('drop options', Options) || {};
        var Operations, DataToOffer;
        var onDropZoneEnter, onDropZoneHover, onDropZoneLeave;
        var onDropped;
        Operations = parsedOperations('list of allowed operations', Options.Operations, 'copy');
        DataToOffer = Object.assign({}, allowedPlainObject('data to be offered', Options.DataToOffer));
        if ('none' in DataToOffer)
            throwError('InvalidArgument: "none" is not a valid data type');
        onDropZoneEnter = allowedFunction('"onDropZoneEnter" handler', Options.onDropZoneEnter);
        onDropZoneHover = allowedFunction('"onDropZoneHover" handler', Options.onDropZoneHover);
        onDropZoneLeave = allowedFunction('"onDropZoneLeave" handler', Options.onDropZoneLeave);
        onDropped = allowedFunction('"onDropped" handler', Options.onDropped);
        return {
            Operations: Operations,
            DataToOffer: DataToOffer,
            // @ts-ignore we cannot validate given functions any further
            onDropZoneEnter: onDropZoneEnter,
            onDropZoneHover: onDropZoneHover,
            onDropZoneLeave: onDropZoneLeave,
            onDropped: onDropped
        };
    }
    /**** use:asDroppable={options} ****/
    function asDroppable(Element, Options) {
        var isDragged;
        var currentDraggableOptions;
        var currentDroppableOptions;
        var PositionReference; // element with user coordinate system
        var ReferenceDeltaX, ReferenceDeltaY; // mouse -> user coord.s
        var PositioningWasDelayed; // workaround for prob. with "drag" events
        var DragImage;
        var initialPosition; // given in user coordinates
        var lastPosition; // dto.
        var lastDropZoneElement;
        var lastDropZoneExtras;
        isDragged = false;
        currentDraggableOptions = parsedDraggableOptions(Options);
        currentDroppableOptions = parsedDroppableOptions(Options);
        /**** startDragging ****/
        function startDragging(originalEvent) {
            var Options = Object.assign({}, currentDraggableOptions, currentDroppableOptions);
            if (fromForbiddenElement(Element, Options, originalEvent)) {
                originalEvent.stopPropagation();
                originalEvent.preventDefault();
                return false;
            }
            PositionReference = PositionReferenceFor(Element, Options);
            var relativePosition = svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, PositionReference); // relative to reference element
            ReferenceDeltaX = ReferenceDeltaY = 0;
            initialPosition = { x: 0, y: 0 };
            if (Options.onDragStart == null) {
                initialPosition = { x: 0, y: 0 }; // given in user coordinates
            }
            else {
                try {
                    var StartPosition = Options.onDragStart(Options.Extras);
                    if (ValueIsPlainObject(StartPosition)) {
                        var x = allowedFiniteNumber('x start position', StartPosition.x);
                        var y = allowedFiniteNumber('y start position', StartPosition.y);
                        ReferenceDeltaX = x - relativePosition.left;
                        ReferenceDeltaY = y - relativePosition.top;
                        x = constrained(x, Options.minX, Options.maxX);
                        y = constrained(y, Options.minY, Options.maxY);
                        initialPosition = { x: x, y: y }; // given in user coordinates
                    }
                }
                catch (Signal) {
                    console.error('"onDragStart" handler failed', Signal);
                }
            }
            lastPosition = initialPosition;
            lastDropZoneElement = undefined;
            lastDropZoneExtras = undefined;
            PositioningWasDelayed = false; // initializes workaround
            if (Options.Dummy == null) {
                Options.Dummy = 'standard'; // this is the default for "use.asDroppable"
            }
            DragImage = DragImageFor(Element, Options);
            if ((DragImage != null) && (originalEvent.dataTransfer != null)) {
                var OffsetX = Options.DummyOffsetX;
                var OffsetY = Options.DummyOffsetY;
                if ((OffsetX == null) || (OffsetY == null)) {
                    var PositionInDraggable = svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element);
                    if (OffsetX == null) {
                        OffsetX = PositionInDraggable.left;
                    }
                    if (OffsetY == null) {
                        OffsetY = PositionInDraggable.top;
                    }
                }
                switch (true) {
                    case (Options.Dummy === 'none'):
                        originalEvent.dataTransfer.setDragImage(DragImage, 0, 0);
                        setTimeout(function () {
                            document.body.removeChild(DragImage);
                        }, 0);
                        break;
                    case ValueIsString(Options.Dummy):
                        originalEvent.dataTransfer.setDragImage(DragImage, OffsetX, OffsetY);
                        setTimeout(function () {
                            document.body.removeChild(DragImage.parentElement);
                        }, 0);
                        break;
                    default:
                        originalEvent.dataTransfer.setDragImage(DragImage, OffsetX, OffsetY);
                }
            }
            if (originalEvent.dataTransfer != null) {
                var allowedEffects = allowedEffectsFrom(Options.Operations);
                originalEvent.dataTransfer.effectAllowed = allowedEffects;
                if (ObjectIsNotEmpty(Options.DataToOffer)) {
                    for (var Type in Options.DataToOffer) {
                        if (Options.DataToOffer.hasOwnProperty(Type)) {
                            originalEvent.dataTransfer.setData(Type, Options.DataToOffer[Type]);
                        }
                    }
                }
            }
            Context.currentDroppableExtras = Options.Extras;
            Context.currentDropZoneExtras = undefined;
            Context.currentDropZonePosition = undefined;
            Context.currentDropZoneElement = undefined;
            Context.DroppableWasDropped = false;
            Context.currentDropOperation = undefined;
            Context.currentTypeTransferred = undefined;
            Context.currentDataTransferred = undefined;
            isDragged = true;
            setTimeout(function () { return Element.classList.add('dragged'); }, 0);
            originalEvent.stopPropagation();
        }
        /**** continueDragging ****/
        function continueDragging(originalEvent) {
            if (!isDragged) {
                return false;
            }
            var Options = Object.assign({}, currentDraggableOptions, currentDroppableOptions);
            if ((originalEvent.screenX === 0) && (originalEvent.screenY === 0) &&
                !PositioningWasDelayed) {
                PositioningWasDelayed = true; // last "drag" event contains wrong coord.s
            }
            else {
                PositioningWasDelayed = false;
                performPanningFor('draggable', Element, Options, originalEvent.pageX, originalEvent.pageY);
                var relativePosition = svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, PositionReference); // relative to reference element
                var x = relativePosition.left + ReferenceDeltaX; // in user coordinates
                var y = relativePosition.top + ReferenceDeltaY;
                x = constrained(x, Options.minX, Options.maxX);
                y = constrained(y, Options.minY, Options.maxY);
                var dx = x - lastPosition.x; // calculated AFTER constraining x,y
                var dy = y - lastPosition.y; // dto.
                lastPosition = { x: x, y: y };
                invokeHandler('onDragMove', Options, x, y, dx, dy, Options.Extras);
            }
            if (Context.currentDropZoneElement === lastDropZoneElement) {
                if (Context.currentDropZoneElement != null) {
                    invokeHandler('onDropZoneHover', Options, Context.currentDropZonePosition.x, Context.currentDropZonePosition.y, Context.currentDropZoneExtras, Options.Extras);
                }
            }
            else {
                if (Context.currentDropZoneElement == null) {
                    Element.classList.remove('droppable');
                    invokeHandler('onDropZoneLeave', Options, lastDropZoneExtras, Options.Extras);
                }
                else {
                    Element.classList.add('droppable');
                    invokeHandler('onDropZoneEnter', Options, Context.currentDropZonePosition.x, Context.currentDropZonePosition.y, lastDropZoneExtras, Options.Extras);
                }
                lastDropZoneElement = Context.currentDropZoneElement;
                lastDropZoneExtras = Context.currentDropZoneExtras;
            }
            originalEvent.stopPropagation();
        }
        /**** finishDragging ****/
        function finishDragging(originalEvent) {
            if (!isDragged) {
                return false;
            }
            //    continueDragging(originalEvent)           // NO! positions might be wrong!
            var Options = Object.assign({}, currentDraggableOptions, currentDroppableOptions);
            if (Context.DroppableWasDropped) {
                invokeHandler('onDropped', Options, Context.currentDropZonePosition.x, Context.currentDropZonePosition.y, Context.currentDropOperation, Context.currentTypeTransferred, Context.currentDataTransferred, Context.currentDropZoneExtras, Options.Extras);
                Context.currentDropZoneExtras = undefined;
                Context.currentDropZonePosition = undefined;
                Context.currentDropZoneElement = undefined;
                Context.DroppableWasDropped = false;
                Context.currentDropOperation = undefined;
                Context.currentTypeTransferred = undefined;
                Context.currentDataTransferred = undefined;
            }
            if (Options.onDragEnd != null) {
                var x = constrained(lastPosition.x, Options.minX, Options.maxX);
                var y = constrained(lastPosition.y, Options.minY, Options.maxY);
                var dx = x - lastPosition.x;
                var dy = y - lastPosition.y;
                invokeHandler('onDragEnd', Options, x, y, dx, dy, Options.Extras);
            }
            Context.currentDroppableExtras = undefined;
            isDragged = false;
            Element.classList.remove('dragged', 'droppable');
            originalEvent.stopPropagation();
        }
        /**** updateDraggableOptions ****/
        function updateDraggableOptions(Options) {
            Options = parsedDraggableOptions(Options);
            if ((currentDraggableOptions.Extras == null) && (Options.Extras != null)) {
                currentDraggableOptions.Extras = Options.Extras;
            } // Extras may be set with delay, but remain constant afterwards
            currentDraggableOptions.Dummy = (Options.Dummy || currentDraggableOptions.Dummy);
            currentDraggableOptions.minX = Options.minX;
            currentDraggableOptions.minY = Options.minY;
            currentDraggableOptions.maxX = Options.maxX;
            currentDraggableOptions.maxY = Options.maxY;
            currentDraggableOptions.Pannable = Options.Pannable;
            currentDraggableOptions.PanSensorWidth = Options.PanSensorWidth;
            currentDraggableOptions.PanSensorHeight = Options.PanSensorHeight;
            currentDraggableOptions.PanSpeed = Options.PanSpeed;
            currentDraggableOptions.onDragStart = (Options.onDragStart || currentDraggableOptions.onDragStart); // may be used to update initial position for subsequent drags
        }
        /**** updateDroppableOptions ****/
        function updateDroppableOptions(Options) {
            Options = parsedDroppableOptions(Options);
            currentDroppableOptions.Operations = Options.Operations;
            currentDroppableOptions.DataToOffer = Options.DataToOffer;
        }
        Element.setAttribute('draggable', 'true');
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('dragstart', startDragging);
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('drag', continueDragging);
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('dragend', finishDragging);
        return {
            update: function (Options) {
                updateDraggableOptions(Options);
                updateDroppableOptions(Options);
            }
        };
    }
    /**** parsedDropZoneOptions ****/
    function parsedDropZoneOptions(Options) {
        Options = allowedPlainObject('drop zone options', Options) || {};
        var Extras, TypesToAccept, HoldDelay;
        var Pannable;
        var PanSensorWidth, PanSensorHeight, PanSpeed;
        var onDroppableEnter, onDroppableMove, onDroppableLeave;
        var onDroppableHold, onDroppableRelease, onDrop;
        Extras = Options.Extras;
        allowPlainObject('data types to be accepted', Options.TypesToAccept);
        TypesToAccept = Object.create(null);
        if ((Options.TypesToAccept != null) && ('none' in Options.TypesToAccept))
            throwError('InvalidArgument: "none" is not a valid data type');
        for (var Type in Options.TypesToAccept) {
            if (Options.TypesToAccept.hasOwnProperty(Type)) {
                TypesToAccept[Type] = parsedOperations('list of accepted operations for type ' + quoted(Type), Options.TypesToAccept[Type]);
            }
        }
        HoldDelay = allowedIntegerInRange('min. time to hold', Options.HoldDelay, 0);
        switch (true) {
            case (Options.Pannable == null):
                Pannable = undefined;
                break;
            case (Options.Pannable === 'this'):
            case ValueIsNonEmptyString(Options.Pannable):
            case (Options.Pannable instanceof HTMLElement):
            case (Options.Pannable instanceof SVGElement):
                //    case (Options.Pannable instanceof MathMLElement):
                Pannable = Options.Pannable;
                break;
            default: throwError('InvalidArgument: invalid "Pannable" specification given');
        }
        PanSensorWidth = allowedOrdinal('panning sensor width', Options.PanSensorWidth);
        if (PanSensorWidth == null) {
            PanSensorWidth = 20;
        }
        PanSensorHeight = allowedOrdinal('panning sensor height', Options.PanSensorHeight);
        if (PanSensorHeight == null) {
            PanSensorHeight = 20;
        }
        PanSpeed = allowedOrdinal('panning speed', Options.PanSpeed);
        if (PanSpeed == null) {
            PanSpeed = 10;
        }
        onDroppableEnter = allowedFunction('"onDroppableEnter" handler', Options.onDroppableEnter);
        onDroppableMove = allowedFunction('"onDroppableMove" handler', Options.onDroppableMove);
        onDroppableLeave = allowedFunction('"onDroppableLeave" handler', Options.onDroppableLeave);
        onDroppableHold = allowedFunction('"onDroppableHold" handler', Options.onDroppableHold);
        onDroppableRelease = allowedFunction('"onDroppableRelease" handler', Options.onDroppableRelease);
        onDrop = allowedFunction('"onDrop" handler', Options.onDrop);
        return {
            Extras: Extras,
            TypesToAccept: TypesToAccept,
            HoldDelay: HoldDelay,
            Pannable: Pannable,
            PanSensorWidth: PanSensorWidth,
            PanSensorHeight: PanSensorHeight,
            PanSpeed: PanSpeed,
            // @ts-ignore we cannot validate given functions any further
            onDroppableEnter: onDroppableEnter,
            onDroppableMove: onDroppableMove,
            onDroppableLeave: onDroppableLeave,
            // @ts-ignore we cannot validate given functions any further
            onDroppableHold: onDroppableHold,
            onDroppableRelease: onDroppableRelease,
            onDrop: onDrop,
        };
    }
    /**** use:asDropZone={options} ****/
    function asDropZone(Element, Options) {
        var currentDropZoneOptions;
        currentDropZoneOptions = parsedDropZoneOptions(Options);
        /**** enteredByDroppable ****/
        function enteredByDroppable(originalEvent) {
            var Options = currentDropZoneOptions;
            performPanningFor('dropzone', Element, Options, originalEvent.pageX, originalEvent.pageY);
            var DropZonePosition = asPosition(svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element)); // relative to DropZone element
            if (ValueIsNumber(Options.HoldDelay) && (Options.HoldDelay > 0) &&
                (Context.HoldWasTriggeredForElement !== Element)) {
                startHoldTimer(DropZonePosition);
            }
            if ((originalEvent.dataTransfer == null) ||
                (originalEvent.dataTransfer.effectAllowed === 'none')) {
                return;
            }
            var wantedOperation = originalEvent.dataTransfer.dropEffect;
            if (wantedOperation === 'none') { // workaround for browser bug
                switch (originalEvent.dataTransfer.effectAllowed) {
                    case 'copy':
                    case 'move':
                    case 'link':
                        wantedOperation = originalEvent.dataTransfer.effectAllowed;
                        break;
                    default:
                        wantedOperation = undefined;
                }
            }
            var TypesToAccept = Options.TypesToAccept;
            var offeredTypeList = originalEvent.dataTransfer.types.filter(function (Type) {
                return (Type in TypesToAccept) &&
                    (TypesToAccept[Type] !== '');
            } // "getData" is not available here
            ); // cannot use "originalEvent.dataTransfer.dropEffect" due to browser bug
            if (offeredTypeList.length === 0) {
                return;
            }
            var accepted = ResultOfHandler('onDroppableEnter', Options, DropZonePosition.x, DropZonePosition.y, wantedOperation, offeredTypeList, Context.currentDroppableExtras, Options.Extras);
            if (accepted === false) { // i.e. explicit "false" result required
                return;
            }
            else {
                Context.currentDropZoneExtras = Options.Extras;
                Context.currentDropZoneElement = Element;
                Context.currentDropZonePosition = DropZonePosition;
                Element.classList.add('hovered');
                originalEvent.preventDefault();
                originalEvent.stopPropagation();
            }
        }
        /**** hoveredByDroppable ****/
        // warning: I've already seen leftByDroppable followed by hoveredByDropable!
        function hoveredByDroppable(originalEvent) {
            var Options = currentDropZoneOptions;
            performPanningFor('dropzone', Element, Options, originalEvent.pageX, originalEvent.pageY);
            var DropZonePosition = asPosition(svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element)); // relative to DropZone element
            if (ValueIsNumber(Options.HoldDelay) && (Options.HoldDelay > 0) &&
                (Context.HoldWasTriggeredForElement !== Element)) {
                if (Context.HoldPosition == null) { // see above for reasoning
                    startHoldTimer(DropZonePosition);
                }
                else {
                    continueHoldTimer(DropZonePosition);
                }
            }
            if ((originalEvent.dataTransfer == null) ||
                (originalEvent.dataTransfer.effectAllowed === 'none') ||
                (Context.currentDropZoneElement != null) && (Context.currentDropZoneElement !== Element)) {
                Element.classList.remove('hovered');
                return;
            }
            // in some browsers, it may be that (currentDropZone !== Element)!
            var wantedOperation = originalEvent.dataTransfer.dropEffect;
            if (wantedOperation === 'none') { // workaround for browser bug
                switch (originalEvent.dataTransfer.effectAllowed) {
                    case 'copy':
                    case 'move':
                    case 'link':
                        wantedOperation = originalEvent.dataTransfer.effectAllowed;
                        break;
                    default:
                        wantedOperation = undefined;
                }
            }
            var TypesToAccept = Options.TypesToAccept;
            var offeredTypeList = originalEvent.dataTransfer.types.filter(function (Type) {
                return (Type in TypesToAccept) &&
                    (TypesToAccept[Type] !== '');
            } // "getData" is not available here
            ); // cannot use "originalEvent.dataTransfer.dropEffect" due to browser bug
            if (offeredTypeList.length === 0) {
                if (Context.currentDropZoneElement === Element) {
                    Context.currentDropZoneExtras = undefined;
                    Context.currentDropZoneElement = undefined;
                    Context.currentDropZonePosition = undefined;
                }
                Element.classList.remove('hovered');
                return;
            }
            Context.currentDropZonePosition = DropZonePosition;
            var accepted = ResultOfHandler('onDroppableMove', Options, Context.currentDropZonePosition.x, Context.currentDropZonePosition.y, wantedOperation, offeredTypeList, Context.currentDroppableExtras, Options.Extras);
            if (accepted === false) { // i.e. explicit "false" result required
                Context.currentDropZoneExtras = undefined;
                Context.currentDropZoneElement = undefined;
                Context.currentDropZonePosition = undefined;
                Element.classList.remove('hovered');
            }
            else { // warning: sometimes (currentDropZone !== Element)!
                Context.currentDropZoneExtras = Options.Extras;
                Context.currentDropZoneElement = Element;
                //      Context.currentDropZonePosition has already been set before
                Element.classList.add('hovered');
                originalEvent.preventDefault(); // never allow default action!
                //      originalEvent.stopPropagation()
                return false; // special return value when drop seems acceptable
            }
        }
        /**** leftByDroppable ****/
        function leftByDroppable(originalEvent) {
            Element.classList.remove('hovered');
            Context.DropZonePanning = false;
            stopHoldTimer();
            var Options = currentDropZoneOptions;
            if (Context.currentDropZoneElement === Element) {
                if (Context.currentTypeTransferred == null) { // see explanation below
                    Context.currentDropZoneExtras = undefined;
                    Context.currentDropZoneElement = undefined;
                    Context.DroppableWasDropped = false;
                    Context.currentDropZonePosition = undefined;
                    Context.currentTypeTransferred = undefined;
                    Context.currentDataTransferred = undefined;
                    invokeHandler('onDroppableLeave', Options, Context.currentDroppableExtras, Options.Extras);
                } // swallow "dragleave" right after successful "drop"
                originalEvent.preventDefault();
                originalEvent.stopPropagation();
            }
        }
        /**** droppedByDroppable ****/
        function droppedByDroppable(originalEvent) {
            Element.classList.remove('hovered');
            Context.DropZonePanning = false;
            stopHoldTimer();
            if ((originalEvent.dataTransfer == null) ||
                (originalEvent.dataTransfer.effectAllowed === 'none') ||
                (Context.currentDropZoneElement !== Element)) {
                return;
            }
            //    originalEvent.preventDefault()
            originalEvent.stopPropagation();
            var Options = currentDropZoneOptions;
            var wantedOperation = originalEvent.dataTransfer.dropEffect;
            if (wantedOperation === 'none') { // workaround for browser bug
                switch (originalEvent.dataTransfer.effectAllowed) {
                    case 'copy':
                    case 'move':
                    case 'link':
                        wantedOperation = originalEvent.dataTransfer.effectAllowed;
                        break;
                    default:
                        wantedOperation = undefined;
                }
            }
            var TypesToAccept = Options.TypesToAccept;
            var offeredTypeList = originalEvent.dataTransfer.types.filter(function (Type) {
                return (Type in TypesToAccept) && ((wantedOperation == null) ||
                    (TypesToAccept[Type].indexOf(wantedOperation) >= 0));
            }); // cannot use "originalEvent.dataTransfer.dropEffect" due to browser bug
            if (offeredTypeList.length === 0) {
                Context.currentDropZoneExtras = undefined;
                Context.currentDropZonePosition = undefined;
                Context.DroppableWasDropped = false;
                Context.currentDropOperation = undefined;
                Context.currentTypeTransferred = undefined;
                Context.currentDataTransferred = undefined;
                invokeHandler('onDroppableLeave', Options, Context.currentDroppableExtras, Options.Extras);
                return;
            }
            Context.currentDropZonePosition = asPosition(svelteCoordinateConversion.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element)); // relative to DropZone element
            var offeredData = {};
            offeredTypeList.forEach(
            // @ts-ignore originalEvent.dataTransfer definitely exists
            function (Type) { return offeredData[Type] = originalEvent.dataTransfer.getData(Type); });
            var acceptedType = ResultOfHandler('onDrop', Options, Context.currentDropZonePosition.x, Context.currentDropZonePosition.y, wantedOperation, offeredData, Context.currentDroppableExtras, Options.Extras);
            switch (true) {
                case (acceptedType == null):
                    Context.DroppableWasDropped = true;
                    Context.currentDropOperation = wantedOperation;
                    Context.currentTypeTransferred = undefined;
                    Context.currentDataTransferred = undefined;
                    break;
                case ValueIsOneOf(acceptedType, offeredTypeList):
                    Context.DroppableWasDropped = true;
                    Context.currentDropOperation = wantedOperation;
                    Context.currentTypeTransferred = acceptedType;
                    Context.currentDataTransferred = offeredData[acceptedType];
                    break;
                default: // handler should return false in case of failure
                    Context.DroppableWasDropped = false;
                    Context.currentDropZoneExtras = undefined;
                    Context.currentDropZonePosition = undefined;
                    Context.currentDropOperation = undefined;
                    Context.currentTypeTransferred = undefined;
                    Context.currentDataTransferred = undefined;
                //        invokeHandler('onDroppableLeave', Options, currentDroppableExtras, Options.Extras)
            }
            Context.currentDropZoneElement = undefined;
        }
        /**** startHoldTimer ****/
        function startHoldTimer(DropZonePosition) {
            Context.HoldPosition = DropZonePosition;
            if (Context.HoldTimer != null) {
                clearTimeout(Context.HoldTimer);
            }
            Context.HoldTimer = setTimeout(triggerHold, Options.HoldDelay);
        }
        /**** continueHoldTimer ****/
        function continueHoldTimer(DropZonePosition) {
            var Offset = (Math.pow((Context.HoldPosition.x - DropZonePosition.x), 2) +
                Math.pow((Context.HoldPosition.y - DropZonePosition.y), 2));
            if (Offset > 25) {
                Context.HoldPosition = DropZonePosition;
                clearTimeout(Context.HoldTimer);
                Context.HoldTimer = setTimeout(triggerHold, Options.HoldDelay);
            }
        }
        /**** stopHoldTimer ****/
        function stopHoldTimer() {
            delete Context.HoldPosition;
            if (Context.HoldTimer != null) {
                clearTimeout(Context.HoldTimer);
                delete Context.HoldTimer;
            }
            delete Context.HoldWasTriggeredForElement;
        }
        /**** triggerHold ****/
        function triggerHold() {
            var DropZonePosition = ( // sometimes, there is no "enteredByDroppable"
            Context.currentDropZonePosition || Context.HoldPosition);
            delete Context.HoldPosition;
            delete Context.HoldTimer;
            Context.HoldWasTriggeredForElement = Element;
            invokeHandler('onDroppableHold', Options, DropZonePosition.x, DropZonePosition.y, Context.currentDroppableExtras, Options.Extras);
        }
        /**** updateDropZoneOptions ****/
        function updateDropZoneOptions(Options) {
            Options = parsedDropZoneOptions(Options);
            if ((currentDropZoneOptions.Extras == null) && (Options.Extras != null)) {
                currentDropZoneOptions.Extras = Options.Extras;
            } // Extras may be set with delay, but remain constant afterwards
            currentDropZoneOptions.TypesToAccept = Options.TypesToAccept;
            currentDropZoneOptions.HoldDelay = Options.HoldDelay;
            currentDropZoneOptions.Pannable = Options.Pannable;
            currentDropZoneOptions.PanSensorWidth = Options.PanSensorWidth;
            currentDropZoneOptions.PanSensorHeight = Options.PanSensorHeight;
            currentDropZoneOptions.PanSpeed = Options.PanSpeed;
        }
        Element.setAttribute('draggable', 'true');
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('dragenter', enteredByDroppable);
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('dragover', hoveredByDroppable);
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('dragleave', leftByDroppable);
        // @ts-ignore we know that the passed event is a DragEvent
        Element.addEventListener('drop', droppedByDroppable);
        return { update: updateDropZoneOptions };
    }
    /**** ValueIsPosition ****/
    function ValueIsPosition(Candidate) {
        return (ValueIsPlainObject(Candidate) &&
            ValueIsFiniteNumber(Candidate.x) && ValueIsFiniteNumber(Candidate.y));
    }
    /**** asPosition ****/
    function asPosition(Value) {
        return { x: Value.left, y: Value.top };
    }
    /**** PositionReferenceFor ****/
    function PositionReferenceFor(Element, Options) {
        var PositionReference;
        switch (true) {
            case (Options.relativeTo === 'parent'):
                PositionReference = Element.parentElement;
                break;
            case (Options.relativeTo === 'body'):
                PositionReference = document.body;
                break;
            case (Options.relativeTo instanceof HTMLElement):
            case (Options.relativeTo instanceof SVGElement):
                //    case (Options.relativeTo instanceof MathMLElement):
                PositionReference = Options.relativeTo;
                if ((PositionReference != document.body) &&
                    !document.body.contains(PositionReference))
                    throwError('InvalidArgument: the HTML element given as "relativeTo" option ' +
                        'is not part of this HTML document');
                break;
            default: // CSS selector
                PositionReference = Element.closest(Options.relativeTo);
        }
        return (PositionReference == null ? document.body : PositionReference);
    }
    /**** DragImageFor ****/
    function DragImageFor(Element, Options) {
        switch (true) {
            case (Options.Dummy === 'standard'):
                return undefined;
            case (Options.Dummy === 'none'):
                var invisibleDragImage = document.createElement('div');
                invisibleDragImage.setAttribute('style', 'display:block; position:absolute; width:1px; height:1px; ' +
                    'background:transparent; border:none; margin:0px; padding:0px; ' +
                    'cursor:auto');
                document.body.appendChild(invisibleDragImage);
                return invisibleDragImage;
            case ValueIsNonEmptyString(Options.Dummy): // may flicker shortly
                var auxiliaryElement = document.createElement('div');
                auxiliaryElement.style.display = 'block';
                auxiliaryElement.style.position = 'absolute';
                auxiliaryElement.style.left = (document.body.scrollWidth + 100) + 'px';
                document.body.appendChild(auxiliaryElement);
                auxiliaryElement.innerHTML = Options.Dummy;
                return auxiliaryElement.children[0];
            case (Options.Dummy instanceof HTMLElement):
            case (Options.Dummy instanceof SVGElement):
                //    case (Options.Dummy instanceof MathMLElement):
                return Options.Dummy;
            case ValueIsFunction(Options.Dummy):
                var Candidate = undefined;
                try {
                    Candidate = Options.Dummy(Options.Extras, Element);
                }
                catch (Signal) {
                    console.error('RuntimeError: creating draggable dummy failed', Signal);
                }
                if (Candidate != null) {
                    if ((Candidate instanceof HTMLElement) || (Candidate instanceof SVGElement)) {
                        return Candidate;
                    }
                    else {
                        console.error('InvalidArgument: the newly created draggable dummy is ' +
                            'neither an HTML nor an SVG element');
                    }
                }
        }
    }
    /**** performPanningFor ****/
    function performPanningFor(Type, Element, Options, xOnPage, yOnPage) {
        if ((Type === 'draggable') && Context.DropZonePanning) {
            return;
        }
        if ((Options.Pannable == null) ||
            ((Options.PanSensorWidth === 0) && (Options.PanSensorHeight === 0)) ||
            (Options.PanSpeed === 0)) {
            Context.DropZonePanning = false;
            return;
        }
        var pannableElement;
        switch (true) {
            case ValueIsNonEmptyString(Options.Pannable):
                pannableElement = Element.parentElement;
                if (pannableElement != null) {
                    pannableElement = pannableElement.closest(Options.Pannable);
                }
                break;
            case (Options.Pannable === 'this') && (Type === 'dropzone'):
                pannableElement = Element;
                break;
            case (Options.Pannable instanceof HTMLElement):
            case (Options.Pannable instanceof SVGElement):
                //        case (Options.Pannable instanceof MathMLElement):
                pannableElement = Options.Pannable;
        }
        if (pannableElement == null) {
            Context.DropZonePanning = false;
            return;
        }
        var _a = svelteCoordinateConversion.fromDocumentTo('local', { left: xOnPage, top: yOnPage }, pannableElement), xInPannable = _a.left, yInPannable = _a.top;
        if ((xInPannable >= 0) && (xInPannable < Options.PanSensorWidth)) {
            pannableElement.scrollLeft = Math.max(0, pannableElement.scrollLeft - Options.PanSpeed);
        }
        var PannableWidth = pannableElement.clientWidth; // w/o scrollbar
        if ((xInPannable >= PannableWidth - Options.PanSensorWidth) &&
            (xInPannable < PannableWidth)) {
            pannableElement.scrollLeft = Math.min(pannableElement.scrollLeft + Options.PanSpeed, pannableElement.scrollWidth - PannableWidth);
        }
        if ((yInPannable >= 0) && (yInPannable < Options.PanSensorHeight)) {
            pannableElement.scrollTop = Math.max(0, pannableElement.scrollTop - Options.PanSpeed);
        }
        var PannableHeight = pannableElement.clientHeight; // w/o scrollbar
        if ((yInPannable >= PannableHeight - Options.PanSensorHeight) &&
            (yInPannable < PannableHeight)) {
            pannableElement.scrollTop = Math.min(pannableElement.scrollTop + Options.PanSpeed, pannableElement.scrollHeight - PannableHeight);
        }
        Context.DropZonePanning = (Type === 'dropzone');
    }
    /**** parsedOperations ****/
    function parsedOperations(Description, Argument, Default) {
        if (Default === void 0) { Default = 'copy move link'; }
        var Operations = allowedString(Description, Argument) || Default;
        switch (Operations.trim()) {
            case 'all': return 'copy move link';
            case 'none': return '';
        }
        var OperationList = Operations.trim().replace(/\s+/g, ' ').split(' ');
        allowListSatisfying(Description, OperationList, function (Operation) { return ValueIsOneOf(Operation, DropOperations); });
        return OperationList.reduce(function (Result, Operation) { return (Result.indexOf(Operation) < 0 ? Result + Operation + ' ' : Result); }, ' ');
    }
    function allowedEffectsFrom(Operations) {
        var EffectIndex = ( // Horner's method
        (Operations.indexOf('move') < 0 ? 0 : 1) * 2 +
            (Operations.indexOf('link') < 0 ? 0 : 1)) * 2 +
            (Operations.indexOf('copy') < 0 ? 0 : 1);
        return [
            'none', 'copy', 'link', 'copyLink', 'move', 'copyMove', 'linkMove', 'all'
        ][EffectIndex];
    }
    /**** invokeHandler ****/
    function invokeHandler(Name, Options) {
        var Arguments = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            Arguments[_i - 2] = arguments[_i];
        }
        if (Options[Name] != null) {
            try {
                return Options[Name].apply(null, Arguments);
            }
            catch (Signal) {
                console.error(quoted(Name) + ' handler failed', Signal);
            }
        }
    }
    var ResultOfHandler = invokeHandler;

    //----------------------------------------------------------------------------//
    //                             Svelte Device Info                             //
    //----------------------------------------------------------------------------//
    var memoized = {};
    /**** DeviceIsMobile ****/
    // see https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
    function DeviceIsMobile() {
        var Result = false;
        (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4)))
            Result = true; })(navigator.userAgent || navigator.vendor || window['opera']);
        return Result;
    }
    /**** DeviceIsPhone ****/
    // see https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
    function DeviceIsPhone() {
        if (DeviceIsMobile()) {
            var ViewportWidth = window.innerWidth;
            var ViewportHeight = window.innerHeight;
            var smallerEdgeSize = Math.min(ViewportWidth, ViewportHeight);
            var largerEdgeSize = Math.max(ViewportWidth, ViewportHeight);
            return (smallerEdgeSize <= 480) && (largerEdgeSize <= 896);
        }
        else {
            return false;
        }
    }
    /**** DevicePointingAccuracy ****/
    // Internet Explorer and MS/Edge are NOT supported
    function MediaQuery(Query) {
        var MediaMatcher = (window.matchMedia ||
            // @ts-ignore
            window['webkitMatchmedia'] || window['mozMatchmedia'] || window['oMatchmedia']);
        return (MediaMatcher != null) && MediaMatcher(Query).matches;
    }
    function DocumentIsReady() {
        return ((document.readyState === 'interactive') ||
            (document.readyState === 'complete'));
    }
    /**** touch device without support for "pointer:coarse"? ****/
    function AppRunsOnLegacyTouchDevice() {
        if (memoized.AppRunsOnLegacyTouchDevice == null) {
            memoized.AppRunsOnLegacyTouchDevice = (!MediaQuery('(pointer:fine)') &&
                !MediaQuery('(pointer:coarse)') && !MediaQuery('-moz-touch-enabled') &&
                (('ontouchstart' in Window) || ((navigator.maxTouchPoints || 0) > 0) ||
                    (/touch|android|iphone|ipod|ipad/i).test(navigator.userAgent)));
        }
        return memoized.AppRunsOnLegacyTouchDevice;
    }
    /**** rewrite media query rules for legacy browsers on touch devices ****/
    function ListElement(List, Index) {
        return (typeof List.item === 'function' ? List.item(Index) : List[Index]);
    }
    function ListHasElementMatching(List, Pattern) {
        for (var i = 0, l = List.length; i < l; i++) {
            if (Pattern.test(ListElement(List, i))) {
                return true;
            }
        }
        return false;
    }
    function rewriteMediaQueriesOnLegacyTouchDevices() {
        if (memoized.MediaQueriesHaveBeenRewritten) {
            return;
        }
        if (AppRunsOnLegacyTouchDevice()) {
            if (DocumentIsReady()) {
                var Stylesheets = document.styleSheets; // reference, not copy
                for (var i = 0, l = Stylesheets.length; i < l; i++) {
                    var Rules = Stylesheets[i]['cssRules'] || Stylesheets[i]['rules'];
                    for (var j = 0, k = Rules.length; j < k; j++) {
                        var Rule = Rules[j];
                        if (Rule.type === CSSRule.MEDIA_RULE) {
                            if (ListHasElementMatching(Rule.media, /handheld/i)) {
                                var Media = Rule.media; // reference, not copy
                                Media.mediaText = Media.mediaText.replace('handheld', 'screen');
                            }
                        }
                    }
                }
                /**** rewrite media-dependent links for legacy browsers ****/
                var Links = document.getElementsByTagName('link');
                for (var i = 0, l = Links.length; i < l; i++) {
                    var Link = Links[i];
                    if ((/handheld/i).test(Link.media)) {
                        Link.media = Link.media.replace('handheld', 'screen');
                    }
                }
                memoized.MediaQueriesHaveBeenRewritten = true;
            }
            else {
                window.addEventListener('DOMContentLoaded', rewriteMediaQueriesOnLegacyTouchDevices);
            }
        }
    }
    function DevicePointingAccuracy() {
        if (memoized.DevicePointingAccuracy == null) {
            updateDevicePointingAccuracy();
            if (!DocumentIsReady() && !memoized.waitingForLoaded) {
                memoized.waitingForLoaded = true;
                window.addEventListener('DOMContentLoaded', updateDevicePointingAccuracy);
                // after document is loaded, classes will be applied as foreseen
            }
        }
        return memoized.DevicePointingAccuracy; // may change while running!
    }
    function updateDevicePointingAccuracy() {
        var updatedPointingAccuracy = 'fine';
        switch (true) {
            case MediaQuery('(pointer:none)'):
                updatedPointingAccuracy = 'none';
                break;
            case MediaQuery('(pointer:coarse)'):
            case MediaQuery('-moz-touch-enabled'):
            case AppRunsOnLegacyTouchDevice():
                updatedPointingAccuracy = 'coarse';
                break;
        }
        memoized.DevicePointingAccuracy = updatedPointingAccuracy;
        if (DocumentIsReady()) {
            var ClassList = document.body.classList; // reference, not copy
            if (((updatedPointingAccuracy === 'none') !== ClassList.contains('noPointer')) ||
                ((updatedPointingAccuracy === 'fine') !== ClassList.contains('finePointer')) ||
                ((updatedPointingAccuracy === 'coarse') !== ClassList.contains('coarsePointer'))) {
                document.body.classList.remove('noPointer', 'finePointer', 'coarsePointer');
                switch (updatedPointingAccuracy) {
                    case 'none':
                        document.body.classList.add('noPointer');
                        break;
                    case 'fine':
                        document.body.classList.add('finePointer');
                        break;
                    case 'coarse':
                        document.body.classList.add('coarsePointer');
                        break;
                }
            }
        }
    }
    /**** registerHandler ****/
    function registerHandler(Handler, onceOnly) {
        if (typeof Handler !== 'function') {
            throw new Error('handler function expected');
        }
        if (memoized.EventHandlerRegistry == null) {
            memoized.EventHandlerRegistry = [];
        }
        var EventHandlerRegistry = memoized.EventHandlerRegistry; // ref., not copy!
        for (var i = 0, l = EventHandlerRegistry.length; i < l; i++) {
            if (EventHandlerRegistry[i].Handler === Handler) {
                EventHandlerRegistry[i].onceOnly = onceOnly;
                return;
            }
        }
        EventHandlerRegistry.push({ Handler: Handler, onceOnly: onceOnly });
        if (EventHandlerRegistry.length === 1) {
            observePointingAccuracy();
        }
    }
    /**** unregisterHandler ****/
    function unregisterHandler(Handler) {
        if (memoized.EventHandlerRegistry == null) {
            memoized.EventHandlerRegistry = [];
        }
        var EventHandlerRegistry = memoized.EventHandlerRegistry; // ref., not copy!
        for (var i = 0, l = EventHandlerRegistry.length; i < l; i++) {
            if (EventHandlerRegistry[i].Handler === Handler) {
                EventHandlerRegistry.splice(i, 1);
                break;
            }
        }
        if (EventHandlerRegistry.length === 0) {
            unobservePointingAccuracy();
        }
    }
    /**** onPointingAccuracyChanged ****/
    function onPointingAccuracyChanged(Handler) {
        registerHandler(Handler, false);
    }
    /**** oncePointingAccuracyChanged ****/
    function oncePointingAccuracyChanged(Handler) {
        registerHandler(Handler, true);
    }
    /**** offPointingAccuracyChanged ****/
    function offPointingAccuracyChanged(Handler) {
        unregisterHandler(Handler);
    }
    /**** observePointingAccuracy (e.g., on "convertibles") ****/
    function observePointingAccuracy() {
        memoized.AccuracyPoller = setInterval(function () {
            var oldPointingAccuracy = DevicePointingAccuracy();
            updateDevicePointingAccuracy();
            if (DevicePointingAccuracy() !== oldPointingAccuracy) {
                invokeRegisteredHandlers();
            }
        }, 500);
    }
    /**** unobservePointingAccuracy ****/
    function unobservePointingAccuracy() {
        clearInterval(memoized.AccuracyPoller);
        memoized.AccuracyPoller = undefined;
    }
    /**** invokeRegisteredHandlers ****/
    function invokeRegisteredHandlers() {
        if (memoized.EventHandlerRegistry == null) {
            memoized.EventHandlerRegistry = [];
        }
        var EventHandlerRegistry = memoized.EventHandlerRegistry; // ref., not copy!
        for (var i = 0, l = EventHandlerRegistry.length; i < l; i++) {
            var _a = EventHandlerRegistry[i], Handler = _a.Handler, onceOnly = _a.onceOnly;
            try {
                Handler(DevicePointingAccuracy());
            }
            catch (Signal) {
                console.warn('PointingAccuracy observation function failed with', Signal);
            }
            if (onceOnly) {
                unregisterHandler(Handler);
            } // a bit inefficient, but DRY
        }
    }
    var svelteDeviceInfo = {
        get isMobile() { return DeviceIsMobile(); },
        get isPhone() { return DeviceIsPhone(); },
        get isTablet() { return DeviceIsMobile() && !DeviceIsPhone(); },
        get isLegacyTouchDevice() { return AppRunsOnLegacyTouchDevice(); },
        rewriteMediaQueriesOnLegacyTouchDevices: rewriteMediaQueriesOnLegacyTouchDevices,
        get PointingAccuracy() { return DevicePointingAccuracy(); },
        onPointingAccuracyChanged: onPointingAccuracyChanged,
        oncePointingAccuracyChanged: oncePointingAccuracyChanged,
        offPointingAccuracyChanged: offPointingAccuracyChanged,
        get observesPointingAccuracy() { return (memoized.AccuracyPoller != null); }
    };

    //----------------------------------------------------------------------------//
    //                        locally unique Id Generator                         //
    //----------------------------------------------------------------------------//
    var IdCounter = 0; // hidden in the closure of "nextId"
    function nextId() {
        return ++IdCounter;
    }
    /**** make global.nextId a real singleton ****/
    var global$1 = /*#__PURE__*/ Function('return this')();
    // see https://stackoverflow.com/questions/3277182/how-to-get-the-global-object-in-javascript
    if (typeof global$1.__nextId !== 'function') {
        global$1.__nextId = nextId;
    }
    /**** newUniqueId - the actually exported function ****/
    function newUniqueId() {
        return 'uid-' + global$1.__nextId();
    }

    var css_248z$5 = ".defaultListView.svelte-1tfuj23{display:inline-flex;flex-flow:column nowrap;position:relative;justify-content:flex-start;align-items:stretch;margin:0px;padding:0px;list-style:none}.withoutTextSelection.svelte-1tfuj23{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.defaultListView.svelte-1tfuj23>.ListItemView{display:block;position:relative;flex:0 0 auto;height:30px;line-height:30px;border:solid 1px transparent;margin:0px 2px 0px 2px;padding:0px 4px 0px 4px;list-style:none}.defaultListView.svelte-1tfuj23>.ListItemView > *{pointer-events:none}.defaultListView.svelte-1tfuj23:not(.transitioning)>.ListItemView:hover:not(.dragged){border:solid 1px }.defaultListView.svelte-1tfuj23:not(.transitioning)>.ListItemView.selected:not(.dragged){background:dodgerblue }.defaultListView.svelte-1tfuj23>.ListItemView.dragged{opacity:0.3 }.defaultListView.svelte-1tfuj23>.ListItemView.hovered:not(.dragged){border-top:solid 10px transparent }.defaultListView.svelte-1tfuj23>.AttachmentRegion{display:block;position:relative;flex:1 1 auto;min-height:20px;background:transparent;border:solid 1px transparent;margin:0px 2px 2px 2px;padding:0px;list-style:none}.defaultListView.svelte-1tfuj23>.AttachmentRegion.hovered{border:solid 1px }.defaultListView.svelte-1tfuj23>.Placeholder{display:flex;position:absolute;left:0px;top:0px;right:0px;height:100%;flex-flow:column nowrap;justify-content:center;align-items:center}";
    styleInject(css_248z$5,{"insertAt":"top"});

    /* node_modules/svelte-sortable-flat-list-view/dist/svelte-sortable-flat-list-view.svelte generated by Svelte v3.38.3 */

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[72] = list[i];
    	child_ctx[74] = i;
    	return child_ctx;
    }

    const get_default_slot_changes_1 = dirty => ({
    	Item: dirty[0] & /*List*/ 1,
    	Index: dirty[0] & /*List*/ 1
    });

    const get_default_slot_context_1 = ctx => ({
    	Item: /*Item*/ ctx[72],
    	Index: /*Index*/ ctx[74]
    });

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[72] = list[i];
    	child_ctx[74] = i;
    	return child_ctx;
    }

    const get_default_slot_changes = dirty => ({
    	Item: dirty[0] & /*List*/ 1,
    	Index: dirty[0] & /*List*/ 1
    });

    const get_default_slot_context = ctx => ({
    	Item: /*Item*/ ctx[72],
    	Index: /*Index*/ ctx[74]
    });

    // (71:4) {:else}
    function create_else_block_1(ctx) {
    	let li;
    	let raw_value = (/*Placeholder*/ ctx[5] || "(empty list)") + "";

    	return {
    		c() {
    			li = element("li");
    			toggle_class(li, "Placeholder", true);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			li.innerHTML = raw_value;
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*Placeholder*/ 32 && raw_value !== (raw_value = (/*Placeholder*/ ctx[5] || "(empty list)") + "")) li.innerHTML = raw_value;		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (63:4) {#if extendable}
    function create_if_block_3$2(ctx) {
    	let li;
    	let raw_value = (/*Placeholder*/ ctx[5] || "(empty list)") + "";
    	let asDropZone_action;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			li = element("li");
    			toggle_class(li, "Placeholder", true);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			li.innerHTML = raw_value;

    			if (!mounted) {
    				dispose = action_destroyer(asDropZone_action = asDropZone.call(null, li, {
    					Extras: { List: /*List*/ ctx[0], Item: undefined },
    					TypesToAccept: /*TypesAccepted*/ ctx[15],
    					onDroppableEnter: /*onDroppableEnter*/ ctx[26],
    					onDroppableMove: /*onDroppableMove*/ ctx[27],
    					onDrop: /*onDrop*/ ctx[29]
    				}));

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*Placeholder*/ 32 && raw_value !== (raw_value = (/*Placeholder*/ ctx[5] || "(empty list)") + "")) li.innerHTML = raw_value;
    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted*/ 32769) asDropZone_action.update.call(null, {
    				Extras: { List: /*List*/ ctx[0], Item: undefined },
    				TypesToAccept: /*TypesAccepted*/ ctx[15],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[26],
    				onDroppableMove: /*onDroppableMove*/ ctx[27],
    				onDrop: /*onDrop*/ ctx[29]
    			});
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (14:2) {#if (List.length > 0)}
    function create_if_block$5(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$3, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*sortable*/ ctx[1] || /*extendable*/ ctx[20] || /*shrinkable*/ ctx[19]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (50:4) {:else}
    function create_else_block(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value_1 = /*List*/ ctx[0];
    	const get_key = ctx => /*KeyOf*/ ctx[17](/*Item*/ ctx[72], /*Index*/ ctx[74]);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*isSelected, List, handleClick, TransitionStarted, KeyOf*/ 1075970113 | dirty[1] & /*TransitionEnded, $$scope*/ 4194305) {
    				each_value_1 = /*List*/ ctx[0];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block_1, each_1_anchor, get_each_context_1);
    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (15:4) {#if sortable || extendable || shrinkable}
    function create_if_block_1$3(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t;
    	let if_block_anchor;
    	let current;
    	let each_value = /*List*/ ctx[0];
    	const get_key = ctx => /*KeyOf*/ ctx[17](/*Item*/ ctx[72], /*Index*/ ctx[74]);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	let if_block = (/*sortable*/ ctx[1] || /*extendable*/ ctx[20]) && create_if_block_2$2(ctx);

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*onlyFrom, neverFrom, dynamicDummy, List, DataOffered, onDragStart, onDragEnd, onDropped, TypesAccepted, onDrop, onDroppableEnter, onDroppableMove, onDroppableLeave, HoldDelay, onDroppableHold, ListViewElement, PanSensorWidth, PanSensorHeight, PanSpeed, draggedItemList, isSelected, handleClick, TransitionStarted, KeyOf*/ 2145910721 | dirty[1] & /*TransitionEnded, $$scope*/ 4194305) {
    				each_value = /*List*/ ctx[0];
    				group_outros();
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].r();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t.parentNode, fix_and_outro_and_destroy_block, create_each_block$1, t, get_each_context$1);
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].a();
    				check_outros();
    			}

    			if (/*sortable*/ ctx[1] || /*extendable*/ ctx[20]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2$2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (58:31)  
    function fallback_block_1(ctx) {
    	let t_value = /*KeyOf*/ ctx[17](/*Item*/ ctx[72], /*Index*/ ctx[74]) + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*KeyOf, List*/ 131073 && t_value !== (t_value = /*KeyOf*/ ctx[17](/*Item*/ ctx[72], /*Index*/ ctx[74]) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (51:6) {#each List as Item,Index (KeyOf(Item,Index))}
    function create_each_block_1(key_1, ctx) {
    	let li;
    	let t;
    	let li_transition;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[54].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[53], get_default_slot_context_1);
    	const default_slot_or_fallback = default_slot || fallback_block_1(ctx);

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[56](/*Item*/ ctx[72], ...args);
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			li = element("li");
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    			t = space();
    			toggle_class(li, "ListItemView", true);
    			toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[72]));
    			this.first = li;
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);

    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(li, null);
    			}

    			append(li, t);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(li, "click", click_handler_1),
    					listen(li, "outrostart", /*TransitionStarted*/ ctx[30]),
    					listen(li, "outroend", /*TransitionEnded*/ ctx[31])
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*List*/ 1 | dirty[1] & /*$$scope*/ 4194304)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[53], !current ? [-1, -1, -1] : dirty, get_default_slot_changes_1, get_default_slot_context_1);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty[0] & /*KeyOf, List*/ 131073)) {
    					default_slot_or_fallback.p(ctx, !current ? [-1, -1, -1] : dirty);
    				}
    			}

    			if (dirty[0] & /*isSelected, List*/ 65) {
    				toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[72]));
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);

    			add_render_callback(() => {
    				if (!li_transition) li_transition = create_bidirectional_transition(li, scale, {}, true);
    				li_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot_or_fallback, local);
    			if (!li_transition) li_transition = create_bidirectional_transition(li, scale, {}, false);
    			li_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    			if (detaching && li_transition) li_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (36:31)  
    function fallback_block(ctx) {
    	let t_value = /*KeyOf*/ ctx[17](/*Item*/ ctx[72], /*Index*/ ctx[74]) + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*KeyOf, List*/ 131073 && t_value !== (t_value = /*KeyOf*/ ctx[17](/*Item*/ ctx[72], /*Index*/ ctx[74]) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (16:6) {#each List as Item,Index (KeyOf(Item,Index))}
    function create_each_block$1(key_1, ctx) {
    	let li;
    	let asDroppable_action;
    	let asDropZone_action;
    	let li_transition;
    	let rect;
    	let stop_animation = noop;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[54].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[53], get_default_slot_context);
    	const default_slot_or_fallback = default_slot || fallback_block(ctx);

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[55](/*Item*/ ctx[72], ...args);
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			li = element("li");
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    			toggle_class(li, "ListItemView", true);
    			toggle_class(li, "dragged", /*draggedItemList*/ ctx[18].indexOf(/*Item*/ ctx[72]) >= 0);
    			toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[72]));
    			this.first = li;
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);

    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(li, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(li, "click", click_handler),
    					action_destroyer(asDroppable_action = asDroppable.call(null, li, {
    						onlyFrom: /*onlyFrom*/ ctx[7],
    						neverFrom: /*neverFrom*/ ctx[8],
    						Dummy: /*dynamicDummy*/ ctx[22],
    						Extras: {
    							List: /*List*/ ctx[0],
    							Item: /*Item*/ ctx[72]
    						},
    						DataToOffer: /*DataOffered*/ ctx[14],
    						onDragStart: /*onDragStart*/ ctx[23],
    						onDragEnd: /*onDragEnd*/ ctx[24],
    						onDropped: /*onDropped*/ ctx[25]
    					})),
    					action_destroyer(asDropZone_action = asDropZone.call(null, li, {
    						Extras: {
    							List: /*List*/ ctx[0],
    							Item: /*Item*/ ctx[72]
    						},
    						TypesToAccept: /*TypesAccepted*/ ctx[15],
    						onDrop: /*onDrop*/ ctx[29],
    						onDroppableEnter: /*onDroppableEnter*/ ctx[26],
    						onDroppableMove: /*onDroppableMove*/ ctx[27],
    						onDroppableLeave: /*onDroppableLeave*/ ctx[28],
    						HoldDelay: /*HoldDelay*/ ctx[12],
    						onDroppableHold: /*onDroppableHold*/ ctx[13],
    						Pannable: /*ListViewElement*/ ctx[16],
    						PanSensorWidth: /*PanSensorWidth*/ ctx[9],
    						PanSensorHeight: /*PanSensorHeight*/ ctx[10],
    						PanSpeed: /*PanSpeed*/ ctx[11]
    					})),
    					listen(li, "outrostart", /*TransitionStarted*/ ctx[30]),
    					listen(li, "outroend", /*TransitionEnded*/ ctx[31])
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*List*/ 1 | dirty[1] & /*$$scope*/ 4194304)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[53], !current ? [-1, -1, -1] : dirty, get_default_slot_changes, get_default_slot_context);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty[0] & /*KeyOf, List*/ 131073)) {
    					default_slot_or_fallback.p(ctx, !current ? [-1, -1, -1] : dirty);
    				}
    			}

    			if (asDroppable_action && is_function(asDroppable_action.update) && dirty[0] & /*onlyFrom, neverFrom, List, DataOffered*/ 16769) asDroppable_action.update.call(null, {
    				onlyFrom: /*onlyFrom*/ ctx[7],
    				neverFrom: /*neverFrom*/ ctx[8],
    				Dummy: /*dynamicDummy*/ ctx[22],
    				Extras: {
    					List: /*List*/ ctx[0],
    					Item: /*Item*/ ctx[72]
    				},
    				DataToOffer: /*DataOffered*/ ctx[14],
    				onDragStart: /*onDragStart*/ ctx[23],
    				onDragEnd: /*onDragEnd*/ ctx[24],
    				onDropped: /*onDropped*/ ctx[25]
    			});

    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted, HoldDelay, onDroppableHold, ListViewElement, PanSensorWidth, PanSensorHeight, PanSpeed*/ 114177) asDropZone_action.update.call(null, {
    				Extras: {
    					List: /*List*/ ctx[0],
    					Item: /*Item*/ ctx[72]
    				},
    				TypesToAccept: /*TypesAccepted*/ ctx[15],
    				onDrop: /*onDrop*/ ctx[29],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[26],
    				onDroppableMove: /*onDroppableMove*/ ctx[27],
    				onDroppableLeave: /*onDroppableLeave*/ ctx[28],
    				HoldDelay: /*HoldDelay*/ ctx[12],
    				onDroppableHold: /*onDroppableHold*/ ctx[13],
    				Pannable: /*ListViewElement*/ ctx[16],
    				PanSensorWidth: /*PanSensorWidth*/ ctx[9],
    				PanSensorHeight: /*PanSensorHeight*/ ctx[10],
    				PanSpeed: /*PanSpeed*/ ctx[11]
    			});

    			if (dirty[0] & /*draggedItemList, List*/ 262145) {
    				toggle_class(li, "dragged", /*draggedItemList*/ ctx[18].indexOf(/*Item*/ ctx[72]) >= 0);
    			}

    			if (dirty[0] & /*isSelected, List*/ 65) {
    				toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[72]));
    			}
    		},
    		r() {
    			rect = li.getBoundingClientRect();
    		},
    		f() {
    			fix_position(li);
    			stop_animation();
    			add_transform(li, rect);
    		},
    		a() {
    			stop_animation();
    			stop_animation = create_animation(li, rect, flip, {});
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);

    			add_render_callback(() => {
    				if (!li_transition) li_transition = create_bidirectional_transition(li, scale, {}, true);
    				li_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot_or_fallback, local);
    			if (!li_transition) li_transition = create_bidirectional_transition(li, scale, {}, false);
    			li_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    			if (detaching && li_transition) li_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (40:6) {#if sortable || extendable}
    function create_if_block_2$2(ctx) {
    	let li;
    	let raw_value = (/*AttachmentRegion*/ ctx[4] || "") + "";
    	let asDropZone_action;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			li = element("li");
    			toggle_class(li, "AttachmentRegion", true);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			li.innerHTML = raw_value;

    			if (!mounted) {
    				dispose = action_destroyer(asDropZone_action = asDropZone.call(null, li, {
    					Extras: { List: /*List*/ ctx[0], Item: undefined },
    					TypesToAccept: /*TypesAccepted*/ ctx[15],
    					onDroppableEnter: /*onDroppableEnter*/ ctx[26],
    					onDroppableMove: /*onDroppableMove*/ ctx[27],
    					onDrop: /*onDrop*/ ctx[29],
    					HoldDelay: /*HoldDelay*/ ctx[12],
    					onDroppableHold: /*onDroppableHold*/ ctx[13]
    				}));

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*AttachmentRegion*/ 16 && raw_value !== (raw_value = (/*AttachmentRegion*/ ctx[4] || "") + "")) li.innerHTML = raw_value;
    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted, HoldDelay, onDroppableHold*/ 45057) asDropZone_action.update.call(null, {
    				Extras: { List: /*List*/ ctx[0], Item: undefined },
    				TypesToAccept: /*TypesAccepted*/ ctx[15],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[26],
    				onDroppableMove: /*onDroppableMove*/ ctx[27],
    				onDrop: /*onDrop*/ ctx[29],
    				HoldDelay: /*HoldDelay*/ ctx[12],
    				onDroppableHold: /*onDroppableHold*/ ctx[13]
    			});
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	let ul;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$5, create_if_block_3$2, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*List*/ ctx[0].length > 0) return 0;
    		if (/*extendable*/ ctx[20]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	let ul_levels = [
    		{ class: /*ClassNames*/ ctx[2] },
    		{ style: /*style*/ ctx[3] },
    		/*$$restProps*/ ctx[32]
    	];

    	let ul_data = {};

    	for (let i = 0; i < ul_levels.length; i += 1) {
    		ul_data = assign(ul_data, ul_levels[i]);
    	}

    	return {
    		c() {
    			ul = element("ul");
    			if_block.c();
    			set_attributes(ul, ul_data);
    			toggle_class(ul, "defaultListView", /*ClassNames*/ ctx[2] == null);
    			toggle_class(ul, "withoutTextSelection", true);
    			toggle_class(ul, "svelte-1tfuj23", true);
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);
    			if_blocks[current_block_type_index].m(ul, null);
    			/*ul_binding*/ ctx[57](ul);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(ul, null);
    			}

    			set_attributes(ul, ul_data = get_spread_update(ul_levels, [
    				(!current || dirty[0] & /*ClassNames*/ 4) && { class: /*ClassNames*/ ctx[2] },
    				(!current || dirty[0] & /*style*/ 8) && { style: /*style*/ ctx[3] },
    				dirty[1] & /*$$restProps*/ 2 && /*$$restProps*/ ctx[32]
    			]));

    			toggle_class(ul, "defaultListView", /*ClassNames*/ ctx[2] == null);
    			toggle_class(ul, "withoutTextSelection", true);
    			toggle_class(ul, "svelte-1tfuj23", true);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(ul);
    			if_blocks[current_block_type_index].d();
    			/*ul_binding*/ ctx[57](null);
    		}
    	};
    }



    function scale(Element, Options) {
    	const currentStyle = window.getComputedStyle(Element);

    	const currentTransform = currentStyle.transform === "none"
    	? ""
    	: currentStyle.transform;

    	return {
    		delay: 0,
    		duration: 300,
    		css: (t, u) => `transform: ${currentTransform} translateX(-${50 * u}%) scaleX(${t})`
    	};
    }

    function instance$8($$self, $$props, $$invalidate) {
    	const omit_props_names = [
    		"class","style","List","Key","SelectionLimit","AttachmentRegion","Placeholder","select","selectOnly","selectAll","selectRange","deselect","deselectAll","toggleSelectionOf","selectedItems","SelectionCount","isSelected","sortable","onlyFrom","neverFrom","onSortRequest","onSort","PanSensorWidth","PanSensorHeight","PanSpeed","Operations","DataToOffer","TypesToAccept","onOuterDropRequest","onDroppedOutside","onDropFromOutside","HoldDelay","onDroppableHold"
    	];

    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let privateKey = newUniqueId();
    	const dispatch = createEventDispatcher();
    	let ListViewElement; // will refer to the list view's DOM element

    	/**** common Attributes ****/
    	let { class: ClassNames = undefined } = $$props;

    	let { style = undefined } = $$props; // ...control styling
    	let { List } = $$props;
    	let { Key = undefined } = $$props;
    	let { SelectionLimit = undefined } = $$props;
    	let { AttachmentRegion = undefined } = $$props;
    	let { Placeholder = undefined } = $$props;
    	let KeyOf;

    	/**** Key Validation and quick Lookup ****/
    	let ItemSet;

    	function updateItemSet(...ArgumentsAreForReactivityOnly) {
    		ItemSet = Object.create(null);

    		List.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (ItemSet[Key] === Item) {
    					throwError("InvalidArgument: the given \"List\" contains the same item " + "multiple times");
    				} else {
    					throwError("InvalidArgument: the given \"Key\" does not produce unique keys " + "for every \"List\" item");
    				}
    			} else {
    				ItemSet[Key] = Item;
    			}
    		});
    	}

    	//----------------------------------------------------------------------------//
    	//                         Selection and Deselection                          //
    	//----------------------------------------------------------------------------//
    	let SelectionSet = new WeakMap(); // automatically "updates" on list changes

    	function select(...ItemList) {
    		let curSelectionCount = SelectionCount();

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (!SelectionSet.has(Item)) {
    					if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    						SelectionSet.set(Item, true);
    						curSelectionCount++;
    						dispatch("selected-item", Item);
    					}
    				}
    			} else {
    				throwError("InvalidArgument: one or multiple of the given items to select " + "are not part of the given \"List\"");
    			}
    		});

    		SelectionRangeBoundaryA = ItemList.length === 1 ? ItemList[0] : undefined;
    		SelectionRangeBoundaryB = undefined;
    		triggerRedraw();
    	}

    	function selectOnly(...ItemList) {
    		if (ValuesDiffer(selectedItems(), ItemList, "by-reference")) {
    			// not perfect...
    			deselectAll();

    			select(...ItemList);
    		} //    triggerRedraw()                                     // already done before
    	}

    	function selectAll() {
    		let curSelectionCount = SelectionCount();

    		List.forEach(Item => {
    			if (!SelectionSet.has(Item)) {
    				if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    					SelectionSet.set(Item, true);
    					curSelectionCount++;
    					dispatch("selected-item", Item);
    				}
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    		triggerRedraw();
    	}

    	let SelectionRangeBoundaryA;
    	let SelectionRangeBoundaryB;

    	function selectRange(RangeBoundary) {
    		if (SelectionRangeBoundaryA == null) {
    			select(RangeBoundary); // will also set SelectionRangeBoundaryA
    			return;
    		}

    		if (SelectionRangeBoundaryA === RangeBoundary) {
    			return;
    		}

    		if (SelectionRangeBoundaryB != null) {
    			deselectRange(SelectionRangeBoundaryB);
    		}

    		let IndexA = List.indexOf(SelectionRangeBoundaryA);
    		let IndexB = List.indexOf(RangeBoundary);
    		let firstIndex = Math.min(IndexA, IndexB);
    		let lastIndex = Math.max(IndexA, IndexB);
    		let curSelectionCount = SelectionCount();

    		for (let i = firstIndex; i <= lastIndex; i++) {
    			if (!SelectionSet.has(List[i])) {
    				if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    					SelectionSet.set(List[i], true);
    					dispatch("selected-item", List[i]);
    				}
    			}
    		}

    		SelectionRangeBoundaryB = RangeBoundary;
    		triggerRedraw();
    	}

    	/**** deselectRange (internal only) ****/
    	function deselectRange(RangeBoundary) {
    		let IndexA = List.indexOf(SelectionRangeBoundaryA);
    		let IndexB = List.indexOf(RangeBoundary);
    		let firstIndex = Math.min(IndexA, IndexB);
    		let lastIndex = Math.max(IndexA, IndexB);

    		for (let i = firstIndex; i <= lastIndex; i++) {
    			if (SelectionSet.has(List[i])) {
    				SelectionSet.delete(List[i]);
    				dispatch("deselected-item", List[i]);
    			}
    		}
    	}

    	function deselect(...ItemList) {
    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (SelectionSet.has(Item)) {
    					SelectionSet.delete(Item);
    					dispatch("deselected-item", Item);
    				}
    			} else {
    				throwError("InvalidArgument: one or multiple of the given items to deselect " + "are not part of the given \"List\"");
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    		triggerRedraw();
    	}

    	function deselectAll() {
    		List.forEach(Item => {
    			if (SelectionSet.has(Item)) {
    				SelectionSet.delete(Item);
    				dispatch("deselected-item", Item);
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    		triggerRedraw();
    	}

    	function toggleSelectionOf(...ItemList) {
    		SelectionRangeBoundaryA = undefined;
    		let ItemsToBeSelected = [];

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (SelectionSet.has(Item)) {
    					SelectionSet.delete(Item);
    					dispatch("deselected-item", Item);
    				} else {
    					ItemsToBeSelected.push(Item);
    				}
    			} else {
    				throwError("InvalidArgument: one or multiple of the given items to select " + "or deselect are not part of the given \"List\"");
    			}
    		});

    		let curSelectionCount = SelectionCount();

    		if (SelectionLimit != null) {
    			let maxToBeSelected = SelectionLimit - curSelectionCount;

    			if (maxToBeSelected < ItemsToBeSelected.length) {
    				ItemsToBeSelected.length = maxToBeSelected;
    			}
    		}

    		ItemsToBeSelected.forEach(Item => {
    			SelectionSet.set(Item, true);
    			dispatch("selected-item", Item);

    			if (ItemList.length === 1) {
    				SelectionRangeBoundaryA = Item;
    				SelectionRangeBoundaryB = undefined;
    			}
    		});

    		triggerRedraw();
    	}

    	function selectedItems() {
    		let Result = List.filter(Item => SelectionSet.has(Item));
    		return Result;
    	}

    	function SelectionCount() {
    		return List.reduce((Count, Item) => Count + (SelectionSet.has(Item) ? 1 : 0), 0);
    	}

    	function isSelected(Item) {
    		return SelectionSet.has(Item);
    	}

    	/**** handleClick ****/
    	function handleClick(Event, Item) {
    		switch (true) {
    			case Event.buttons === 0 && Event.button !== 0:
    				return;
    			case Event.buttons !== 0 && Event.buttons !== 1:
    				return;
    			case svelteDeviceInfo.PointingAccuracy === "coarse":
    				if (// special handling for touch devices to feel "familiar"
    				SelectionLimit === 1 && !isSelected(Item) && !Event.ctrlKey && !Event.metaKey && !Event.shiftKey) {
    					selectOnly(Item); // workaround
    					// ...for bug

    					break;
    				}
    			case Event.ctrlKey:
    			case Event.metaKey:
    				toggleSelectionOf(Item);
    				break;
    			case Event.shiftKey:
    				selectRange(Item);
    				break;
    			default:
    				selectOnly(Item);
    				break;
    		}
    	} //  Event.preventDefault()
    	//  Event.stopPropagation()

    	//----------------------------------------------------------------------------//
    	//                           Drag-and-Drop Handling                           //
    	//----------------------------------------------------------------------------//
    	let isDragging = false;

    	let draggedItemList = []; // needed for rendering ony
    	let { sortable = false } = $$props; // does this list view support "sorting"?
    	let { onlyFrom = undefined } = $$props;
    	let { neverFrom = undefined } = $$props;
    	let { onSortRequest = undefined } = $$props;
    	let { onSort = undefined } = $$props;
    	let { PanSensorWidth = undefined } = $$props;
    	let { PanSensorHeight = undefined } = $$props;
    	let { PanSpeed = undefined } = $$props;
    	let { Operations = undefined } = $$props;
    	let { DataToOffer = undefined } = $$props;
    	let { TypesToAccept = undefined } = $$props;
    	let { onOuterDropRequest = undefined } = $$props;
    	let { onDroppedOutside = undefined } = $$props;
    	let { onDropFromOutside = undefined } = $$props; // returns act. accepted type (if known)
    	let { HoldDelay = undefined } = $$props;
    	let { onDroppableHold = undefined } = $$props;
    	let DataOffered;
    	let TypesAccepted;

    	/**** parsedOperations ****/
    	function parsedOperations(Description, Argument, Default = "copy move link") {
    		let Operations = allowedString(Description, Argument) || Default;

    		switch (Operations.trim()) {
    			case "all":
    				return "copy move link";
    			case "none":
    				return "";
    		}

    		let OperationList = Operations.trim().replace(/\s+/g, " ").split(" ");
    		allowListSatisfying(Description, OperationList, Operation => ValueIsOneOf(Operation, DropOperations));

    		return OperationList.reduce(
    			(Result, Operation) => Result.indexOf(Operation) < 0
    			? Result + Operation + " "
    			: Result,
    			" "
    		);
    	}

    	/**** prepare for drag-and-drop ****/
    	function hasNonPrivateTypes(TypeSet) {
    		for (let Type in TypeSet) {
    			if (TypeSet.hasOwnProperty(Type) && Type !== privateKey) {
    				return true;
    			}
    		}

    		return false;
    	}

    	let shrinkable = false;
    	let extendable = false;

    	/**** ad-hoc Dummy Creation ****/
    	function dynamicDummy(DroppableExtras, Element) {
    		let auxiliaryElement = Element.cloneNode(true);
    		auxiliaryElement.style.display = "block";
    		auxiliaryElement.style.position = "absolute";
    		auxiliaryElement.style.left = document.body.scrollWidth + 100 + "px";
    		auxiliaryElement.style.width = Element.clientWidth + "px"; // not perfect
    		auxiliaryElement.style.height = Element.clientHeight + "px"; // dto.

    		if (draggedItemList.length > 1) {
    			// called after "onDragStart"
    			let Badge = document.createElement("div");

    			Badge.setAttribute("style", "display:block; position:absolute; " + "top:-10px; right:-10px; width:20px; height:20px; " + "background:red; color:white; " + "border:none; border-radius:10px; margin:0px; padding:0px 4px 0px 4px; " + "line-height:20px; text-align:center");
    			Badge.innerText = "+" + (draggedItemList.length - 1);
    			auxiliaryElement.appendChild(Badge);
    		}

    		document.body.appendChild(auxiliaryElement);

    		setTimeout(
    			() => {
    				document.body.removeChild(auxiliaryElement);
    			},
    			0
    		);

    		return auxiliaryElement;
    	}

    	/**** onDragStart ****/
    	function onDragStart(DroppableExtras) {
    		$$invalidate(52, isDragging = true);

    		if (!isSelected(DroppableExtras.Item)) {
    			selectOnly(DroppableExtras.Item);
    		}

    		$$invalidate(18, draggedItemList = DroppableExtras.ItemList = selectedItems());
    		return { x: 0, y: 0 };
    	}

    	/**** onDragEnd ****/
    	function onDragEnd(x, y, dx, dy, DroppableExtras) {
    		$$invalidate(52, isDragging = false);
    		delete DroppableExtras.ItemList;
    		$$invalidate(18, draggedItemList.length = 0, draggedItemList);
    	}

    	/**** onDropped ****/
    	function onDropped(
    		x,
    	y,
    	Operation,
    	TypeTransferred,
    	DataTransferred,
    	DropZoneExtras,
    	DroppableExtras
    	) {
    		let droppedHere = List === (DropZoneExtras && DropZoneExtras.List);

    		if (!droppedHere) {
    			if (onDroppedOutside == null) {
    				let droppedItems = DroppableExtras.ItemList;
    				let DroppableSet = SetOfItemsIn(droppedItems);

    				for (let i = List.length - 1; i >= 0; i--) {
    					let Key = KeyOf(List[i]);

    					if (Key in DroppableSet) {
    						List.splice(i, 1);
    					}
    				}

    				dispatch("removed-items", droppedItems.slice());
    				triggerRedraw();
    			} else {
    				try {
    					onDroppedOutside(x, y, Operation, TypeTransferred, DataTransferred, DropZoneExtras, DroppableExtras);
    				} catch(Signal) {
    					console.error("RuntimeError: callback \"onDroppedOutside\" failed", Signal);
    				} // no event to be dispatched (there is already the callback)

    				triggerRedraw(); // just to be on the safe side
    			}
    		}
    	}

    	/**** onDroppableEnter ****/
    	function onDroppableEnter(x, y, Operation, offeredTypeList, DroppableExtras, DropZoneExtras) {
    		if (List === (DroppableExtras && DroppableExtras.List) && List.indexOf(DroppableExtras.Item) >= 0 && // not a foreign item
    		DroppableExtras.ItemList.indexOf(DropZoneExtras.Item) >= 0) {

    			triggerRedraw();
    			return false;
    		}

    		let mayBeInsertedHere = true; // because dnd-action already checked a bit

    		if (List === (DroppableExtras && DroppableExtras.List)) {
    			// own elements
    			if (sortable) {
    				if (onSortRequest != null) {
    					try {
    						mayBeInsertedHere = onSortRequest(x, y, DroppableExtras, DropZoneExtras);
    					} catch(Signal) {
    						mayBeInsertedHere = false;
    						console.error("RuntimeError: callback \"onSortRequest\" failed", Signal);
    					}
    				}
    			} else {
    				// not sortable? then own list items may not be dropped here
    				mayBeInsertedHere = false;
    			}
    		} else {
    			// foreign elements want to be dropped here
    			if (onOuterDropRequest != null) {
    				try {
    					mayBeInsertedHere = onOuterDropRequest(x, y, Operation, offeredTypeList, DroppableExtras, DroppableExtras);
    				} catch(Signal) {
    					mayBeInsertedHere = false;
    					console.error("RuntimeError: callback \"onOuterDropRequest\" failed", Signal);
    				}
    			}
    		}

    		mayBeInsertedHere ? DropZoneExtras.Item : undefined;
    		triggerRedraw();
    		return mayBeInsertedHere && Operation !== "link";
    	}

    	/**** onDroppableMove ****/
    	const onDroppableMove = onDroppableEnter;

    	/**** onDroppableLeave ****/
    	function onDroppableLeave(DroppableExtras, DropZoneExtras) {
    	} //  triggerRedraw()

    	/**** onDrop ****/
    	function onDrop(x, y, Operation, DataOffered, DroppableExtras, DropZoneExtras) {

    		if (List === (DroppableExtras && DroppableExtras.List) && List.indexOf(DroppableExtras.Item) >= 0 && // not a foreign item
    		DroppableExtras.ItemList.indexOf(DropZoneExtras.Item) >= 0) {

    			triggerRedraw();
    			return "none";
    		}

    		if (List === (DroppableExtras && DroppableExtras.List)) {
    			// own elements
    			if (sortable) {
    				let droppedItems = DroppableExtras.ItemList;

    				if (onSort == null) {
    					let DroppableSet = SetOfItemsIn(droppedItems);

    					for (let i = List.length - 1; i >= 0; i--) {
    						let Key = KeyOf(List[i]);

    						if (Key in DroppableSet) {
    							List.splice(i, 1);
    						}
    					}

    					let InsertionIndex = List.indexOf(DropZoneExtras.Item);

    					if (InsertionIndex < 0) {
    						InsertionIndex = List.length;
    					} // for append

    					// @ts-ignore argument list of "apply" is known to be correct
    					List.splice.apply(List, [InsertionIndex, 0].concat(droppedItems));

    					dispatch("sorted-items", [droppedItems.slice(), InsertionIndex]);
    					triggerRedraw();
    				} else {
    					try {
    						onSort(DropZoneExtras.Item, droppedItems.slice());
    					} catch(Signal) {
    						console.error("RuntimeError: callback \"onSort\" failed", Signal);
    					} // no event to be dispatched (there is already the callback)

    					triggerRedraw(); // just to be on the safe side
    				}

    				return Operation; // should be 'move', but 'copy' gives better feedback
    			} else {
    				return "none";
    			}
    		} else {
    			// foreign elements want to be dropped here
    			if (onDropFromOutside == null) {
    				let ItemsToBeInserted = DroppableExtras && DroppableExtras.ItemList;

    				if (!ValueIsList(ItemsToBeInserted)) {
    					return "none";
    				}

    				let InsertionIndex = List.indexOf(DropZoneExtras.Item);

    				if (InsertionIndex < 0) {
    					InsertionIndex = List.length;
    				} // for "append"

    				// @ts-ignore argument list of "apply" is known to be correct
    				List.splice.apply(List, [InsertionIndex, 0].concat(ItemsToBeInserted));

    				dispatch("inserted-items", [ItemsToBeInserted.slice(), InsertionIndex]);
    				triggerRedraw();
    				return undefined; // accepted type is unknown
    			} else {
    				let acceptedType = undefined;

    				try {
    					acceptedType = onDropFromOutside(x, y, Operation, DataOffered, DroppableExtras, DropZoneExtras);
    				} catch(Signal) {
    					console.error("RuntimeError: callback \"onSort\" failed", Signal);
    				} // no event to be dispatched (there is already the callback)

    				triggerRedraw(); // just to be on the safe side
    				return acceptedType; // accepted type is unknown
    			}
    		}
    	}

    	/**** TransitionStarted ****/
    	function TransitionStarted() {
    		ListViewElement.classList.add("transitioning");
    	}

    	function TransitionEnded() {
    		ListViewElement.classList.remove("transitioning");
    	}

    	/**** SetOfItemsIn ****/
    	function SetOfItemsIn(ItemList) {
    		let ItemSet = Object.create(null);

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);
    			ItemSet[Key] = Item;
    		});

    		return ItemSet;
    	}

    	/**** triggerRedraw ****/
    	function triggerRedraw() {
    		$$invalidate(0, List);
    	}

    	const click_handler = (Item, Event) => handleClick(Event, Item);
    	const click_handler_1 = (Item, Event) => handleClick(Event, Item);

    	function ul_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			ListViewElement = $$value;
    			$$invalidate(16, ListViewElement);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(32, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(2, ClassNames = $$new_props.class);
    		if ("style" in $$new_props) $$invalidate(3, style = $$new_props.style);
    		if ("List" in $$new_props) $$invalidate(0, List = $$new_props.List);
    		if ("Key" in $$new_props) $$invalidate(33, Key = $$new_props.Key);
    		if ("SelectionLimit" in $$new_props) $$invalidate(34, SelectionLimit = $$new_props.SelectionLimit);
    		if ("AttachmentRegion" in $$new_props) $$invalidate(4, AttachmentRegion = $$new_props.AttachmentRegion);
    		if ("Placeholder" in $$new_props) $$invalidate(5, Placeholder = $$new_props.Placeholder);
    		if ("sortable" in $$new_props) $$invalidate(1, sortable = $$new_props.sortable);
    		if ("onlyFrom" in $$new_props) $$invalidate(7, onlyFrom = $$new_props.onlyFrom);
    		if ("neverFrom" in $$new_props) $$invalidate(8, neverFrom = $$new_props.neverFrom);
    		if ("onSortRequest" in $$new_props) $$invalidate(44, onSortRequest = $$new_props.onSortRequest);
    		if ("onSort" in $$new_props) $$invalidate(45, onSort = $$new_props.onSort);
    		if ("PanSensorWidth" in $$new_props) $$invalidate(9, PanSensorWidth = $$new_props.PanSensorWidth);
    		if ("PanSensorHeight" in $$new_props) $$invalidate(10, PanSensorHeight = $$new_props.PanSensorHeight);
    		if ("PanSpeed" in $$new_props) $$invalidate(11, PanSpeed = $$new_props.PanSpeed);
    		if ("Operations" in $$new_props) $$invalidate(46, Operations = $$new_props.Operations);
    		if ("DataToOffer" in $$new_props) $$invalidate(47, DataToOffer = $$new_props.DataToOffer);
    		if ("TypesToAccept" in $$new_props) $$invalidate(48, TypesToAccept = $$new_props.TypesToAccept);
    		if ("onOuterDropRequest" in $$new_props) $$invalidate(49, onOuterDropRequest = $$new_props.onOuterDropRequest);
    		if ("onDroppedOutside" in $$new_props) $$invalidate(50, onDroppedOutside = $$new_props.onDroppedOutside);
    		if ("onDropFromOutside" in $$new_props) $$invalidate(51, onDropFromOutside = $$new_props.onDropFromOutside);
    		if ("HoldDelay" in $$new_props) $$invalidate(12, HoldDelay = $$new_props.HoldDelay);
    		if ("onDroppableHold" in $$new_props) $$invalidate(13, onDroppableHold = $$new_props.onDroppableHold);
    		if ("$$scope" in $$new_props) $$invalidate(53, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*ClassNames*/ 4) {
    			allowNonEmptyString("\"class\" attribute", ClassNames);
    		}

    		if ($$self.$$.dirty[0] & /*style*/ 8) {
    			allowNonEmptyString("\"style\" attribute", style);
    		}

    		if ($$self.$$.dirty[0] & /*List*/ 1) {
    			$$invalidate(0, List = allowedListSatisfying("\"List\" attribute", List, ValueIsObject) || []);
    		}

    		if ($$self.$$.dirty[1] & /*Key*/ 4) {
    			switch (true) {
    				case Key == null:
    					$$invalidate(17, KeyOf = Item => String(Item));
    					break;
    				case ValueIsNonEmptyString(Key):
    					$$invalidate(17, KeyOf = Item => String(Item[Key]));
    					break;
    				case ValueIsFunction(Key):
    					$$invalidate(17, KeyOf = (Item, Index) => String(Key(Item, Index)));
    					break;
    				default:
    					throwError("InvalidArgument: the given \"Key\" attribute is neither " + "a non-empty string nor a function returning such a string");
    			}
    		}

    		if ($$self.$$.dirty[1] & /*SelectionLimit*/ 8) {
    			allowOrdinal("selection limit", SelectionLimit);
    		}

    		if ($$self.$$.dirty[0] & /*AttachmentRegion*/ 16) {
    			allowNonEmptyString("\"AttachmentRegion\" attribute", AttachmentRegion);
    		}

    		if ($$self.$$.dirty[0] & /*Placeholder*/ 32) {
    			allowNonEmptyString("\"Placeholder\" attribute", Placeholder);
    		}

    		if ($$self.$$.dirty[0] & /*List*/ 1 | $$self.$$.dirty[1] & /*Key*/ 4) {
    			updateItemSet(List, Key);
    		}

    		if ($$self.$$.dirty[0] & /*List*/ 1 | $$self.$$.dirty[1] & /*SelectionLimit*/ 8) {
    			if (SelectionLimit != null && SelectionCount() > SelectionLimit) {
    				let Count = 0;

    				List.forEach(Item => {
    					if (SelectionSet.has(Item)) {
    						Count++;

    						if (Count > SelectionLimit) {
    							deselect(Item);
    						}
    					}
    				});
    			} // decreasing the selection limit with an active selection is very bad style
    		}

    		if ($$self.$$.dirty[0] & /*sortable*/ 2) {
    			$$invalidate(1, sortable = allowedBoolean("\"sortable\" attribute", sortable) || false);
    		}

    		if ($$self.$$.dirty[0] & /*onlyFrom*/ 128) {
    			allowNonEmptyString("\"onlyFrom\" CSS selector list", onlyFrom);
    		}

    		if ($$self.$$.dirty[0] & /*neverFrom*/ 256) {
    			allowNonEmptyString("\"neverFrom\" CSS selector list", neverFrom);
    		}

    		if ($$self.$$.dirty[1] & /*onSortRequest*/ 8192) {
    			allowFunction("\"onSortRequest\" callback", onSortRequest);
    		}

    		if ($$self.$$.dirty[1] & /*onSort*/ 16384) {
    			allowFunction("\"onSort\" callback", onSort);
    		}

    		if ($$self.$$.dirty[0] & /*PanSensorWidth*/ 512) {
    			allowOrdinal("panning sensor width", PanSensorWidth);
    		}

    		if ($$self.$$.dirty[0] & /*PanSensorHeight*/ 1024) {
    			allowOrdinal("panning sensor height", PanSensorHeight);
    		}

    		if ($$self.$$.dirty[0] & /*PanSpeed*/ 2048) {
    			allowOrdinal("panning speed", PanSpeed);
    		}

    		if ($$self.$$.dirty[1] & /*Operations*/ 32768) {
    			parsedOperations("list of allowed operations", Operations);
    		}

    		if ($$self.$$.dirty[1] & /*DataToOffer*/ 65536) {
    			allowPlainObject("\"DataToOffer\" attribute", DataToOffer);
    		}

    		if ($$self.$$.dirty[1] & /*TypesToAccept*/ 131072) {
    			allowPlainObject("\"TypesToAccept\" attribute", TypesToAccept);
    		}

    		if ($$self.$$.dirty[1] & /*onOuterDropRequest*/ 262144) {
    			allowFunction("\"onOuterDropRequest\" callback", onOuterDropRequest);
    		}

    		if ($$self.$$.dirty[1] & /*onDroppedOutside*/ 524288) {
    			allowFunction("\"onDroppedOutside\" callback", onDroppedOutside);
    		}

    		if ($$self.$$.dirty[1] & /*onDropFromOutside*/ 1048576) {
    			allowFunction("\"onDropFromOutside\" callback", onDropFromOutside);
    		}

    		if ($$self.$$.dirty[0] & /*HoldDelay*/ 4096) {
    			allowIntegerInRange("\"HoldDelay\" attribute", HoldDelay, 0);
    		}

    		if ($$self.$$.dirty[0] & /*onDroppableHold*/ 8192) {
    			allowFunction("\"onDroppableHold\" callback", onDroppableHold);
    		}

    		if ($$self.$$.dirty[0] & /*DataOffered, sortable*/ 16386 | $$self.$$.dirty[1] & /*isDragging, DataToOffer*/ 2162688) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(14, DataOffered = Object.assign({}, DataToOffer));

    				if ("none" in DataOffered) throwError("InvalidArgument: \"none\" is not a valid data type");

    				// @ts-ignore "DataOffered" is definitely not undefined
    				if (sortable) {
    					$$invalidate(14, DataOffered[privateKey] = "", DataOffered);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*sortable*/ 2 | $$self.$$.dirty[1] & /*isDragging, TypesToAccept*/ 2228224) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(15, TypesAccepted = {});

    				if (TypesToAccept != null && "none" in TypesToAccept) throwError("InvalidArgument: \"none\" is not a valid data type");

    				for (let Type in TypesToAccept) {
    					if (TypesToAccept.hasOwnProperty(Type)) {
    						// @ts-ignore "TypesAccepted" is definitely not undefined
    						$$invalidate(15, TypesAccepted[Type] = parsedOperations("list of accepted operations for type " + quoted(Type), TypesToAccept[Type]), TypesAccepted);
    					}
    				}

    				// @ts-ignore "TypesAccepted" is definitely not undefined
    				if (sortable) {
    					$$invalidate(15, TypesAccepted[privateKey] = "copy move", TypesAccepted);
    				}
    			} // 'copy' because of the better visual feedback from native drag-and-drop
    		}

    		if ($$self.$$.dirty[0] & /*DataOffered, TypesAccepted*/ 49152 | $$self.$$.dirty[1] & /*isDragging*/ 2097152) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(19, shrinkable = hasNonPrivateTypes(DataOffered));

    				$$invalidate(20, extendable = hasNonPrivateTypes(TypesAccepted));
    			}
    		}
    	};

    	return [
    		List,
    		sortable,
    		ClassNames,
    		style,
    		AttachmentRegion,
    		Placeholder,
    		isSelected,
    		onlyFrom,
    		neverFrom,
    		PanSensorWidth,
    		PanSensorHeight,
    		PanSpeed,
    		HoldDelay,
    		onDroppableHold,
    		DataOffered,
    		TypesAccepted,
    		ListViewElement,
    		KeyOf,
    		draggedItemList,
    		shrinkable,
    		extendable,
    		handleClick,
    		dynamicDummy,
    		onDragStart,
    		onDragEnd,
    		onDropped,
    		onDroppableEnter,
    		onDroppableMove,
    		onDroppableLeave,
    		onDrop,
    		TransitionStarted,
    		TransitionEnded,
    		$$restProps,
    		Key,
    		SelectionLimit,
    		select,
    		selectOnly,
    		selectAll,
    		selectRange,
    		deselect,
    		deselectAll,
    		toggleSelectionOf,
    		selectedItems,
    		SelectionCount,
    		onSortRequest,
    		onSort,
    		Operations,
    		DataToOffer,
    		TypesToAccept,
    		onOuterDropRequest,
    		onDroppedOutside,
    		onDropFromOutside,
    		isDragging,
    		$$scope,
    		slots,
    		click_handler,
    		click_handler_1,
    		ul_binding
    	];
    }

    class Svelte_sortable_flat_list_view extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(
    			this,
    			options,
    			instance$8,
    			create_fragment$8,
    			safe_not_equal,
    			{
    				class: 2,
    				style: 3,
    				List: 0,
    				Key: 33,
    				SelectionLimit: 34,
    				AttachmentRegion: 4,
    				Placeholder: 5,
    				select: 35,
    				selectOnly: 36,
    				selectAll: 37,
    				selectRange: 38,
    				deselect: 39,
    				deselectAll: 40,
    				toggleSelectionOf: 41,
    				selectedItems: 42,
    				SelectionCount: 43,
    				isSelected: 6,
    				sortable: 1,
    				onlyFrom: 7,
    				neverFrom: 8,
    				onSortRequest: 44,
    				onSort: 45,
    				PanSensorWidth: 9,
    				PanSensorHeight: 10,
    				PanSpeed: 11,
    				Operations: 46,
    				DataToOffer: 47,
    				TypesToAccept: 48,
    				onOuterDropRequest: 49,
    				onDroppedOutside: 50,
    				onDropFromOutside: 51,
    				HoldDelay: 12,
    				onDroppableHold: 13
    			},
    			[-1, -1, -1]
    		);
    	}

    	get class() {
    		return this.$$.ctx[2];
    	}

    	set class(ClassNames) {
    		this.$set({ class: ClassNames });
    		flush();
    	}

    	get style() {
    		return this.$$.ctx[3];
    	}

    	set style(style) {
    		this.$set({ style });
    		flush();
    	}

    	get List() {
    		return this.$$.ctx[0];
    	}

    	set List(List) {
    		this.$set({ List });
    		flush();
    	}

    	get Key() {
    		return this.$$.ctx[33];
    	}

    	set Key(Key) {
    		this.$set({ Key });
    		flush();
    	}

    	get SelectionLimit() {
    		return this.$$.ctx[34];
    	}

    	set SelectionLimit(SelectionLimit) {
    		this.$set({ SelectionLimit });
    		flush();
    	}

    	get AttachmentRegion() {
    		return this.$$.ctx[4];
    	}

    	set AttachmentRegion(AttachmentRegion) {
    		this.$set({ AttachmentRegion });
    		flush();
    	}

    	get Placeholder() {
    		return this.$$.ctx[5];
    	}

    	set Placeholder(Placeholder) {
    		this.$set({ Placeholder });
    		flush();
    	}

    	get select() {
    		return this.$$.ctx[35];
    	}

    	get selectOnly() {
    		return this.$$.ctx[36];
    	}

    	get selectAll() {
    		return this.$$.ctx[37];
    	}

    	get selectRange() {
    		return this.$$.ctx[38];
    	}

    	get deselect() {
    		return this.$$.ctx[39];
    	}

    	get deselectAll() {
    		return this.$$.ctx[40];
    	}

    	get toggleSelectionOf() {
    		return this.$$.ctx[41];
    	}

    	get selectedItems() {
    		return this.$$.ctx[42];
    	}

    	get SelectionCount() {
    		return this.$$.ctx[43];
    	}

    	get isSelected() {
    		return this.$$.ctx[6];
    	}

    	get sortable() {
    		return this.$$.ctx[1];
    	}

    	set sortable(sortable) {
    		this.$set({ sortable });
    		flush();
    	}

    	get onlyFrom() {
    		return this.$$.ctx[7];
    	}

    	set onlyFrom(onlyFrom) {
    		this.$set({ onlyFrom });
    		flush();
    	}

    	get neverFrom() {
    		return this.$$.ctx[8];
    	}

    	set neverFrom(neverFrom) {
    		this.$set({ neverFrom });
    		flush();
    	}

    	get onSortRequest() {
    		return this.$$.ctx[44];
    	}

    	set onSortRequest(onSortRequest) {
    		this.$set({ onSortRequest });
    		flush();
    	}

    	get onSort() {
    		return this.$$.ctx[45];
    	}

    	set onSort(onSort) {
    		this.$set({ onSort });
    		flush();
    	}

    	get PanSensorWidth() {
    		return this.$$.ctx[9];
    	}

    	set PanSensorWidth(PanSensorWidth) {
    		this.$set({ PanSensorWidth });
    		flush();
    	}

    	get PanSensorHeight() {
    		return this.$$.ctx[10];
    	}

    	set PanSensorHeight(PanSensorHeight) {
    		this.$set({ PanSensorHeight });
    		flush();
    	}

    	get PanSpeed() {
    		return this.$$.ctx[11];
    	}

    	set PanSpeed(PanSpeed) {
    		this.$set({ PanSpeed });
    		flush();
    	}

    	get Operations() {
    		return this.$$.ctx[46];
    	}

    	set Operations(Operations) {
    		this.$set({ Operations });
    		flush();
    	}

    	get DataToOffer() {
    		return this.$$.ctx[47];
    	}

    	set DataToOffer(DataToOffer) {
    		this.$set({ DataToOffer });
    		flush();
    	}

    	get TypesToAccept() {
    		return this.$$.ctx[48];
    	}

    	set TypesToAccept(TypesToAccept) {
    		this.$set({ TypesToAccept });
    		flush();
    	}

    	get onOuterDropRequest() {
    		return this.$$.ctx[49];
    	}

    	set onOuterDropRequest(onOuterDropRequest) {
    		this.$set({ onOuterDropRequest });
    		flush();
    	}

    	get onDroppedOutside() {
    		return this.$$.ctx[50];
    	}

    	set onDroppedOutside(onDroppedOutside) {
    		this.$set({ onDroppedOutside });
    		flush();
    	}

    	get onDropFromOutside() {
    		return this.$$.ctx[51];
    	}

    	set onDropFromOutside(onDropFromOutside) {
    		this.$set({ onDropFromOutside });
    		flush();
    	}

    	get HoldDelay() {
    		return this.$$.ctx[12];
    	}

    	set HoldDelay(HoldDelay) {
    		this.$set({ HoldDelay });
    		flush();
    	}

    	get onDroppableHold() {
    		return this.$$.ctx[13];
    	}

    	set onDroppableHold(onDroppableHold) {
    		this.$set({ onDroppableHold });
    		flush();
    	}
    }

    let currentAppletList = [];

      const initialSelectionList = [];
      let   currentSelectionList = [];

      const SelectionListStore = writable(currentSelectionList); // subscription mgmt

    /**** keep track of changes in "AppletList" ****/

      AppletList.subscribe((newAppletList) => {      // implements a "derived" store
        currentAppletList = newAppletList;

        let newSelectionList = currentSelectionList.filter(
          (Applet) => (currentAppletList.indexOf(Applet) >= 0)
        );
        if (webappTinkererRuntime.ValuesDiffer(currentSelectionList,newSelectionList,'by-reference')) {
          currentSelectionList = newSelectionList;
          SelectionListStore.set(currentSelectionList);
        }
      });

    /**** select ****/

      function select (Applet) {
        let AppletIndex = currentSelectionList.indexOf(Applet);
        if ((AppletIndex < 0) && (currentAppletList.indexOf(Applet) >= 0)) {
          currentSelectionList = currentSelectionList.slice();
            currentSelectionList.push(Applet);
          SelectionListStore.set(currentSelectionList);
        }
      }

    /**** deselect ****/

      function deselect (Applet) {
        let AppletIndex = currentSelectionList.indexOf(Applet);
        if (AppletIndex >= 0) {
          currentSelectionList = currentSelectionList.slice();
            currentSelectionList.splice(AppletIndex,1);
          SelectionListStore.set(currentSelectionList);
        }
      }

    /**** clear ****/

      function clear (Applet) {
        if (currentSelectionList.length > 0) {
          currentSelectionList = initialSelectionList;
          SelectionListStore.set(currentSelectionList);
        }
      }

    /**** validate changes to "SelectionList" ****/

      function setSelectionList (newSelectionList) {
        if (webappTinkererRuntime.ValuesDiffer(currentSelectionList,newSelectionList,'by-reference')) {
          currentSelectionList = newSelectionList.slice();
          SelectionListStore.set(currentSelectionList);
        }
      }

    /**** export an explicitly implemented store ****/

      const selectedAppletList = {
        subscribe: (Subscription) => SelectionListStore.subscribe(Subscription),
        set:setSelectionList, select, deselect, clear
      };

    var css_248z$4 = ".WAD-AppletOverviewPane.svelte-1rlx4sl{display:flex;position:absolute;flex-flow:column nowrap;width:100%;height:100%;padding:4px}";
    styleInject(css_248z$4,{"insertAt":"top"});

    /* src/AppletOverviewPane.svelte generated by Svelte v3.38.3 */

    function create_default_slot$3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("design");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	let div1;
    	let div0;
    	let span;
    	let t1;
    	let button;
    	let t2;
    	let listview;
    	let current;
    	let mounted;
    	let dispose;

    	button = new Button({
    			props: {
    				disabled: /*$selectedAppletList*/ ctx[0].length === 0,
    				$$slots: { default: [create_default_slot$3] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*editSelection*/ ctx[3]);

    	listview = new Svelte_sortable_flat_list_view({
    			props: {
    				style: "flex:1 1 auto; border:solid 1px #969696; padding:2px",
    				List: /*$AppletList*/ ctx[1],
    				Key: func,
    				SelectionLimit: 1
    			}
    		});

    	listview.$on("selected-item", selectApplet);
    	listview.$on("deselected-item", deselectApplet);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			span.textContent = "designable Applets:";
    			t1 = space();
    			create_component(button.$$.fragment);
    			t2 = space();
    			create_component(listview.$$.fragment);
    			set_style(span, "flex", "1 1 auto");
    			set_style(span, "line-height", "24px");
    			set_style(div0, "display", "flex");
    			set_style(div0, "flex-flow", "row nowrap");
    			set_style(div0, "align-items", "flex-end");
    			set_style(div0, "padding", "0px");
    			set_style(div0, "padding-bottom", "2px");
    			set_style(div0, "height", "30px\n  ");
    			attr(div1, "class", "WAD-AppletOverviewPane svelte-1rlx4sl");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, span);
    			append(div0, t1);
    			mount_component(button, div0, null);
    			append(div1, t2);
    			mount_component(listview, div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen(div1, "dblclick", /*onDoubleClick*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			const button_changes = {};
    			if (dirty & /*$selectedAppletList*/ 1) button_changes.disabled = /*$selectedAppletList*/ ctx[0].length === 0;

    			if (dirty & /*$$scope*/ 16) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    			const listview_changes = {};
    			if (dirty & /*$AppletList*/ 2) listview_changes.List = /*$AppletList*/ ctx[1];
    			listview.$set(listview_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			transition_in(listview.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button.$$.fragment, local);
    			transition_out(listview.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			destroy_component(button);
    			destroy_component(listview);
    			mounted = false;
    			dispose();
    		}
    	};
    }



    function selectApplet(Event) {
    	selectedAppletList.select(Event.detail);
    }

    function deselectApplet(Event) {
    	selectedAppletList.deselect(Event.detail);
    }

    const func = (Applet, Index) => Applet.Id || "Applet #" + Index;

    function instance$7($$self, $$props, $$invalidate) {
    	let $selectedAppletList;
    	let $AppletList;
    	component_subscribe($$self, selectedAppletList, $$value => $$invalidate(0, $selectedAppletList = $$value));
    	component_subscribe($$self, AppletList, $$value => $$invalidate(1, $AppletList = $$value));

    	function onDoubleClick() {
    		let Applet = $selectedAppletList[0];
    		selectedAppletList.clear();
    		selectedAppletList.select(Applet);
    		chosenApplet.set(Applet);
    	}

    	function editSelection() {
    		let Applet = $selectedAppletList[0];

    		if (Applet != null) {
    			chosenApplet.set(Applet);
    		}
    	}

    	return [$selectedAppletList, $AppletList, onDoubleClick, editSelection];
    }

    class AppletOverviewPane extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});
    	}
    }

    //----------------------------------------------------------------------------//
    /**** tintedBitmapAsURL ****/
    function tintedBitmapAsURL(Bitmap, TintColor) {
        expectInstanceOf('bitmap', Bitmap, HTMLImageElement, 'HTML image element');
        expectColor('tint color', TintColor);
        if (!Bitmap.complete)
            throwError('InvalidArgument: the given bitmap has not yet been completely loaded');
        var Canvas = document.createElement('canvas');
        Canvas.width = Bitmap.width;
        Canvas.height = Bitmap.height;
        var Context = Canvas.getContext('2d');
        Context.drawImage(Bitmap, 0, 0);
        Context.globalCompositeOperation = 'source-in';
        Context.fillStyle = TintColor;
        Context.fillRect(0, 0, Bitmap.width, Bitmap.height);
        return Canvas.toDataURL('image/png');
    }

    var css_248z$3 = ".WAD-IconButton.svelte-gg0gm3{display:block;position:absolute;width:32px;height:32px;background:var(--normal-image-url)}.WAD-IconButton.svelte-gg0gm3:not([disabled]):hover,.WAD-IconButton[disabled=\"false\"].svelte-gg0gm3:hover{background:var(--hovered-image-url)}.WAD-IconButton.active.svelte-gg0gm3:not([disabled]):not(:hover),.WAD-IconButton.active[disabled=\"false\"].svelte-gg0gm3:not(:hover){background:var(--active-image-url)}.WAD-IconButton[disabled=\"true\"].svelte-gg0gm3{opacity:0.3 }";
    styleInject(css_248z$3,{"insertAt":"top"});

    /* src/IconButton.svelte generated by Svelte v3.38.3 */

    function create_fragment$6(ctx) {
    	let div;
    	let div_style_value;
    	let mounted;
    	let dispose;

    	let div_levels = [
    		/*$$restProps*/ ctx[6],
    		{
    			style: div_style_value = `--normal-image-url:url(${/*normalImageURL*/ ctx[2]});` + `--hovered-image-url:url(${/*active*/ ctx[0]
			? /*activeHoveredImageURL*/ ctx[5]
			: /*hoveredImageURL*/ ctx[3]});` + `--active-image-url:url(${/*activeImageURL*/ ctx[4]});` + /*style*/ ctx[1]
    		}
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	return {
    		c() {
    			div = element("div");
    			set_attributes(div, div_data);
    			toggle_class(div, "WAD-IconButton", true);
    			toggle_class(div, "active", /*active*/ ctx[0]);
    			toggle_class(div, "svelte-gg0gm3", true);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (!mounted) {
    				dispose = listen(div, "click", /*click_handler*/ ctx[10]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			set_attributes(div, div_data = get_spread_update(div_levels, [
    				dirty & /*$$restProps*/ 64 && /*$$restProps*/ ctx[6],
    				dirty & /*normalImageURL, active, activeHoveredImageURL, hoveredImageURL, activeImageURL, style*/ 63 && div_style_value !== (div_style_value = `--normal-image-url:url(${/*normalImageURL*/ ctx[2]});` + `--hovered-image-url:url(${/*active*/ ctx[0]
				? /*activeHoveredImageURL*/ ctx[5]
				: /*hoveredImageURL*/ ctx[3]});` + `--active-image-url:url(${/*activeImageURL*/ ctx[4]});` + /*style*/ ctx[1]) && { style: div_style_value }
    			]));

    			toggle_class(div, "WAD-IconButton", true);
    			toggle_class(div, "active", /*active*/ ctx[0]);
    			toggle_class(div, "svelte-gg0gm3", true);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }
    const hoveredColor = "#FFEC2E";
    const activeColor = "#7FFF00"; /* chartreuse */

    function instance$6($$self, $$props, $$invalidate) {
    	const omit_props_names = ["ImageURL","active","activeURL","style"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { ImageURL } = $$props; // bitmap as Data URL
    	let { active = false } = $$props;
    	let { activeURL = undefined } = $$props; // opt. image URL for active state
    	let { style = "" } = $$props; // since {...$$restProps} does not help here
    	let normalImageURL = ""; // just for the beginning
    	let hoveredImageURL = ""; // dto.
    	let activeImageURL = ""; // dto.
    	let activeHoveredImageURL = ""; // dto.
    	let auxImage;

    	function tintOriginalImage() {
    		$$invalidate(3, hoveredImageURL = tintedBitmapAsURL(auxImage, hoveredColor));

    		if (activeURL == null) {
    			$$invalidate(4, activeImageURL = tintedBitmapAsURL(auxImage, activeColor));
    			$$invalidate(5, activeHoveredImageURL = hoveredImageURL);
    			$$invalidate(9, auxImage = undefined);
    		} else {
    			$$invalidate(9, auxImage = document.createElement("img")); // new image element necessary
    			$$invalidate(9, auxImage.src = activeURL, auxImage);

    			if (auxImage.complete) {
    				// just in case
    				tintActiveImage();
    			} else {
    				auxImage.addEventListener("load", tintActiveImage);
    			}
    		}
    	}

    	function tintActiveImage() {
    		$$invalidate(4, activeImageURL = tintedBitmapAsURL(auxImage, activeColor));
    		$$invalidate(5, activeHoveredImageURL = tintedBitmapAsURL(auxImage, hoveredColor));
    		$$invalidate(9, auxImage = undefined);
    	}

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(6, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("ImageURL" in $$new_props) $$invalidate(7, ImageURL = $$new_props.ImageURL);
    		if ("active" in $$new_props) $$invalidate(0, active = $$new_props.active);
    		if ("activeURL" in $$new_props) $$invalidate(8, activeURL = $$new_props.activeURL);
    		if ("style" in $$new_props) $$invalidate(1, style = $$new_props.style);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*ImageURL, normalImageURL, auxImage*/ 644) {
    			{
    				switch (true) {
    					case ImageURL == null:
    						$$invalidate(2, normalImageURL = $$invalidate(3, hoveredImageURL = $$invalidate(4, activeImageURL = "")));
    					case ImageURL === normalImageURL:
    						// prevents multiple conversions
    						break;
    					default:
    						$$invalidate(2, normalImageURL = ImageURL);
    						$$invalidate(9, auxImage = document.createElement("img"));
    						$$invalidate(9, auxImage.src = ImageURL, auxImage);
    						if (auxImage.complete) {
    							// just in case
    							tintOriginalImage();
    						} else {
    							auxImage.addEventListener("load", tintOriginalImage);
    						}
    				}
    			}
    		}
    	};

    	return [
    		active,
    		style,
    		normalImageURL,
    		hoveredImageURL,
    		activeImageURL,
    		activeHoveredImageURL,
    		$$restProps,
    		ImageURL,
    		activeURL,
    		auxImage,
    		click_handler
    	];
    }

    class IconButton extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			ImageURL: 7,
    			active: 0,
    			activeURL: 8,
    			style: 1
    		});
    	}
    }

    const initialDialogOrder = { Dialogs:[], zIndexOf };

      let currentlyChosenApplet$3 = undefined;
      let currentDialogOrder = { Dialogs:[], zIndexOf };

      const DialogOrderStore = writable(currentDialogOrder);     // subscription mgmt
      const DialogOrderSet   = new WeakMap();        // applet-specific dialog orders

    /**** keep track of changes in "chosenApplet" ****/

      chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
        if (currentlyChosenApplet$3 !== newChosenApplet) {
          currentlyChosenApplet$3 = newChosenApplet;

          if (currentlyChosenApplet$3 == null) {
            currentDialogOrder = { Dialogs:initialDialogOrder.Dialogs.slice(), zIndexOf };
          } else {
            if (DialogOrderSet.has(currentlyChosenApplet$3)) {
              currentDialogOrder = DialogOrderSet.get(currentlyChosenApplet$3);
            } else {
              currentDialogOrder = { Dialogs:initialDialogOrder.Dialogs.slice(), zIndexOf };
              DialogOrderSet.set(currentlyChosenApplet$3,currentDialogOrder);
            }
            DialogOrderStore.set(currentDialogOrder);
          }
        }
      });

    /**** validate changes to "DialogOrder" ****/

      function setDialogOrder (newDialogOrder) {
        if (currentlyChosenApplet$3 !== null) {
          if (webappTinkererRuntime.ValuesDiffer(currentDialogOrder,newDialogOrder,'by-reference')) {
            currentDialogOrder = newDialogOrder;
            DialogOrderSet.set(currentlyChosenApplet$3,newDialogOrder);
            DialogOrderStore.set(newDialogOrder);
          }
        }
      }

    /**** open ****/

      function open (DialogElement) {
        if (
          (DialogElement != null) &&
          (currentDialogOrder.Dialogs.indexOf(DialogElement) < 0)
        ) {
          let Dialogs = currentDialogOrder.Dialogs.slice();
            Dialogs.push(DialogElement);
          setDialogOrder({ Dialogs, zIndexOf });
        }
      }

    /**** close ****/

      function close (DialogElement) {
        if (DialogElement != null) {
          let DialogIndex = currentDialogOrder.Dialogs.indexOf(DialogElement);
          if (DialogIndex >= 0) {
            let Dialogs = currentDialogOrder.Dialogs.slice();
              Dialogs.splice(DialogIndex,1);
            setDialogOrder({ Dialogs, zIndexOf });
          }
        }
      }

    /**** raise ****/

      function raise (DialogElement) {
        if (DialogElement != null) {
          let DialogIndex = currentDialogOrder.Dialogs.indexOf(DialogElement);
          if (DialogIndex >= 0) {
            let Dialogs = currentDialogOrder.Dialogs.slice();
              Dialogs.splice(DialogIndex,1);
              Dialogs.push(DialogElement);
            setDialogOrder({ Dialogs, zIndexOf });
          }
        }
      }

    /**** zIndexOf ****/

      function zIndexOf (DialogElement) {
        if (DialogElement != null) {
          let DialogIndex = currentDialogOrder.Dialogs.indexOf(DialogElement);
          if (DialogIndex >= 0) { return 1000000 + DialogIndex }
        }
        return 'auto'
      }

    /**** export an explicitly implemented store ****/

      const DialogOrder = {
        subscribe: (Callback) => DialogOrderStore.subscribe(Callback),
        open, close, raise, zIndexOf
      };

    var css_248z$2 = ".WAD-Dialog.svelte-1ijjqsp{display:flex;flex-flow:column nowrap;position:absolute;z-index:10000;overflow:hidden;border:solid 1px #454545;border-radius:8px;background-color:#555555;box-shadow:0px 0px 60px 0px rgba(0,0,0,0.5);font-family:\"Source Sans Pro\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:14px;line-height:normal;text-align:left;color:#CCCCCC;pointer-events:auto;-webkit-touch-callout:none;-ms-touch-action:none;touch-action:none;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;user-select:none}.WAD-Titlebar.svelte-1ijjqsp{display:flex;flex-flow:row nowrap;flex:0 0 auto;position:relative;overflow:hidden;height:24px;min-width:60px;min-height:24px;border-top-left-radius:7px;border-top-right-radius:7px;background-image:linear-gradient(180deg, rgb(128,128,128),rgb(64,64,64) 70%);background-image:-webkit-linear-gradient(270deg, rgb(128,128,128),rgb(64,64,64) 70%);background-clip:border-box;-webkit-background-clip:border-box;cursor:-webkit-grab;cursor:grab}.WAD-Title.svelte-1ijjqsp{display:inline-block;position:relative;flex:1 1 auto;padding:0px 4px 0px 4px;background-color:transparent;line-height:24px;color:#7FFF00}.WAD-CloseButton.svelte-1ijjqsp{display:inline-block;position:relative;flex:0 0 auto;width:24px;height:24px;background-color:transparent;background-image:url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAhElEQVRIS+2UQQ7AIAgE9bs8iO+24WBiDDIcStomenXdgVXsrXj1Yv92AJjwexGp6jXKExG3kIxm28F82EArhPZHcWnADFnNvQIQYALPyLvVXYSmxUsmSGSeAkSdkPk3AKURkTnNSRhR9BQfeaY0SLSPc5D5BjIanAP8LkFwAJjg/yO6AX98SBk+NsXnAAAAAElFTkSuQmCC\");cursor:pointer}.WAD-CloseButton.svelte-1ijjqsp:hover{width:24px;height:24px;background-color:transparent;background-image:url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAi0lEQVRIS+2UwQ2AMAwDmx2Yg/3nYA52aFUkUBU1ufCI4FG+CT7X1EhJfiRZvywAJvxdRPXc621PtmNqJLJjnmB8uYM0hOaPOStELTBCvJnWc7/BTGhmyIrwMkXXgCCeeAjQlywIif8DkBoRiVNP3IjSrykVieavipbyq6B+ROdYtKiQtbcAmGB6RA0CC0gZD0CxdwAAAABJRU5ErkJggg==\")}.WAD-ContentArea.svelte-1ijjqsp{display:inline-flex;flex-flow:column nowrap;flex:1 1 auto;position:relative;overflow:hidden;min-height:24px}.WAD-ContentArea.svelte-1ijjqsp textarea::-webkit-scrollbar{width:10px;height:10px }.WAD-ContentArea.svelte-1ijjqsp textarea::-webkit-scrollbar-thumb{background-color:#808080;border-radius:4px;-webkit-box-shadow:inset 0 0 6px rgba(0,0,0,0.5)}.WAD-ContentArea.svelte-1ijjqsp textarea::-webkit-scrollbar-track-piece{background-color:rgba(0,0,0,0.1) }.WAD-ContentArea.svelte-1ijjqsp textarea::-webkit-scrollbar-corner{background-color:rgba(0,0,0,0.1) }.WAD-ContentArea.svelte-1ijjqsp div::-webkit-scrollbar{width:10px;height:10px }.WAD-ContentArea.svelte-1ijjqsp div::-webkit-scrollbar-thumb{background-color:#808080;border-radius:4px;-webkit-box-shadow:inset 0 0 6px rgba(0,0,0,0.5)}.WAD-ContentArea.svelte-1ijjqsp div::-webkit-scrollbar-track-piece{background-color:rgba(0,0,0,0.1) }.WAD-ContentArea.svelte-1ijjqsp div::-webkit-scrollbar-corner{background-color:rgba(0,0,0,0.1) }.WAD-ResizeHandle.svelte-1ijjqsp{display:block;position:absolute;right:0px;bottom:0px;width:32px;height:32px;background-image:url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAiklEQVRYR+WUwQ3AIAwDm3UzUNZtxQ8hhBpIbGhZIKezsVzkJ4z7ZnaXu6oq/wSorVMMwAHqzNvOQQzQAUY/DWIADjBSXmDSd4AO4FnXb3TAozxlB+gAnsxTDMABVpSH7AAdYEX5mR2IVD5lgA4QmfmUAThApvJXO0AHyFS+ZweQyrsG6ADIzNtbD4OSoCHdTWtaAAAAAElFTkSuQmCC\");-webkit-touch-callout:none;-ms-touch-action:none;touch-action:none;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;user-select:none}.WAD-ResizeHandle.svelte-1ijjqsp:hover{background-image:url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAj0lEQVRYR+WU0Q2AIBBDvR2cw/3ncA53wPBHiCEeXFtQFriX11LbxM8U99N1pHzX9tP+CVBalxigA5SZ152jGJADtH4axQAdoKU8w8B3QA7gWddvdMCjHLIDcgBP5hADdIAR5SE7IAcYUb5mByKVdxmQA0Rm3mWADoBU/moH5ABI5XN2gKn80YAcgJl5fesG8FKgIRkBhjAAAAAASUVORK5CYII=\")}";
    styleInject(css_248z$2,{"insertAt":"top"});

    /* src/Dialog.svelte generated by Svelte v3.38.3 */

    function create_if_block$4(ctx) {
    	let div4;
    	let div2;
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let iconbutton;
    	let asDraggable_action;
    	let t2;
    	let div3;
    	let t3;
    	let div4_style_value;
    	let current;
    	let mounted;
    	let dispose;

    	iconbutton = new IconButton({
    			props: {
    				style: "width:24px; height:24px",
    				ImageURL: CloseButton_ImageURL
    			}
    		});

    	const default_slot_template = /*#slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);
    	let if_block = /*resizable*/ ctx[3] && create_if_block_1$2(ctx);

    	let div4_levels = [
    		/*$$restProps*/ ctx[11],
    		{
    			style: div4_style_value = "\n    left:" + (/*Applet*/ ctx[1].x + /*State*/ ctx[0].Offset.x) + "px; top:" + (/*Applet*/ ctx[1].y + /*State*/ ctx[0].Offset.y) + "px;\n    width:" + /*State*/ ctx[0].Width + "px; height:" + /*State*/ ctx[0].Height + "px;\n    z-index:" + /*$DialogOrder*/ ctx[5].zIndexOf(/*DialogElement*/ ctx[4]) + "\n  "
    		}
    	];

    	let div4_data = {};

    	for (let i = 0; i < div4_levels.length; i += 1) {
    		div4_data = assign(div4_data, div4_levels[i]);
    	}

    	return {
    		c() {
    			div4 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(/*Title*/ ctx[2]);
    			t1 = space();
    			div1 = element("div");
    			create_component(iconbutton.$$.fragment);
    			t2 = space();
    			div3 = element("div");
    			if (default_slot) default_slot.c();
    			t3 = space();
    			if (if_block) if_block.c();
    			attr(div0, "class", "WAD-Title svelte-1ijjqsp");
    			attr(div1, "class", "WAD-CloseButton svelte-1ijjqsp");
    			attr(div2, "class", "WAD-Titlebar svelte-1ijjqsp");
    			attr(div3, "class", "WAD-ContentArea svelte-1ijjqsp");
    			set_attributes(div4, div4_data);
    			toggle_class(div4, "WAD-Dialog", true);
    			toggle_class(div4, "svelte-1ijjqsp", true);
    		},
    		m(target, anchor) {
    			insert(target, div4, anchor);
    			append(div4, div2);
    			append(div2, div0);
    			append(div0, t0);
    			append(div2, t1);
    			append(div2, div1);
    			mount_component(iconbutton, div1, null);
    			append(div4, t2);
    			append(div4, div3);

    			if (default_slot) {
    				default_slot.m(div3, null);
    			}

    			append(div4, t3);
    			if (if_block) if_block.m(div4, null);
    			/*div4_binding*/ ctx[17](div4);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(div1, "click", /*closeDialog*/ ctx[10]),
    					action_destroyer(asDraggable_action = asDraggable.call(null, div2, {
    						relativeTo: document.body,
    						onDragStart: /*onDragStart*/ ctx[6],
    						onDragMove: /*onDragMove*/ ctx[7]
    					}))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (!current || dirty & /*Title*/ 4) set_data(t0, /*Title*/ ctx[2]);

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 32768)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[15], !current ? -1 : dirty, null, null);
    				}
    			}

    			if (/*resizable*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*resizable*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_1$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div4, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			set_attributes(div4, div4_data = get_spread_update(div4_levels, [
    				dirty & /*$$restProps*/ 2048 && /*$$restProps*/ ctx[11],
    				(!current || dirty & /*Applet, State, $DialogOrder, DialogElement*/ 51 && div4_style_value !== (div4_style_value = "\n    left:" + (/*Applet*/ ctx[1].x + /*State*/ ctx[0].Offset.x) + "px; top:" + (/*Applet*/ ctx[1].y + /*State*/ ctx[0].Offset.y) + "px;\n    width:" + /*State*/ ctx[0].Width + "px; height:" + /*State*/ ctx[0].Height + "px;\n    z-index:" + /*$DialogOrder*/ ctx[5].zIndexOf(/*DialogElement*/ ctx[4]) + "\n  ")) && { style: div4_style_value }
    			]));

    			toggle_class(div4, "WAD-Dialog", true);
    			toggle_class(div4, "svelte-1ijjqsp", true);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(iconbutton.$$.fragment, local);
    			transition_in(default_slot, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(iconbutton.$$.fragment, local);
    			transition_out(default_slot, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div4);
    			destroy_component(iconbutton);
    			if (default_slot) default_slot.d(detaching);
    			if (if_block) if_block.d();
    			/*div4_binding*/ ctx[17](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (175:4) {#if resizable}
    function create_if_block_1$2(ctx) {
    	let div;
    	let iconbutton;
    	let current;
    	let mounted;
    	let dispose;

    	iconbutton = new IconButton({
    			props: { ImageURL: ResizeHandle_ImageURL }
    		});

    	return {
    		c() {
    			div = element("div");
    			create_component(iconbutton.$$.fragment);
    			attr(div, "class", "WAD-ResizeHandle svelte-1ijjqsp");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(iconbutton, div, null);
    			current = true;

    			if (!mounted) {
    				dispose = action_destroyer(asDraggable.call(null, div, {
    					onDragStart: /*startResizing*/ ctx[8],
    					onDragMove: /*continueResizing*/ ctx[9]
    				}));

    				mounted = true;
    			}
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(iconbutton.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(iconbutton.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(iconbutton);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*Applet*/ ctx[1] != null && /*State*/ ctx[0].isVisible && create_if_block$4(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*Applet*/ ctx[1] != null && /*State*/ ctx[0].isVisible) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*Applet, State*/ 3) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }



    /**** normal CloseButton and ResizeHandle image as Data URL ****/
    let CloseButton_ImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAhElEQVRIS+2UQQ7AIAgE9bs8iO+24WBiDDIcStomenXdgVXsrXj1Yv92AJjwexGp6jXKExG3kIxm28F82EArhPZHcWnADFnNvQIQYALPyLvVXYSmxUsmSGSeAkSdkPk3AKURkTnNSRhR9BQfeaY0SLSPc5D5BjIanAP8LkFwAJjg/yO6AX98SBk+NsXnAAAAAElFTkSuQmCC";

    let ResizeHandle_ImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAiklEQVRYR+WUwQ3AIAwDm3UzUNZtxQ8hhBpIbGhZIKezsVzkJ4z7ZnaXu6oq/wSorVMMwAHqzNvOQQzQAUY/DWIADjBSXmDSd4AO4FnXb3TAozxlB+gAnsxTDMABVpSH7AAdYEX5mR2IVD5lgA4QmfmUAThApvJXO0AHyFS+ZweQyrsG6ADIzNtbD4OSoCHdTWtaAAAAAElFTkSuQmCC";

    function instance$5($$self, $$props, $$invalidate) {
    	const omit_props_names = [
    		"Applet","Title","resizable","minWidth","minHeight","State","PositionAroundPreferredPosition"
    	];

    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $DialogOrder;
    	component_subscribe($$self, DialogOrder, $$value => $$invalidate(5, $DialogOrder = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	const dispatch = createEventDispatcher();
    	let { Applet } = $$props;
    	let { Title } = $$props;
    	let { resizable = false } = $$props;
    	let { minWidth = 120 } = $$props;
    	let { minHeight = 80 } = $$props;
    	let { State } = $$props;
    	let { PositionAroundPreferredPosition } = $$props;
    	let DialogElement;

    	onMount(() => {
    		DialogElement.addEventListener("mousedown", Event => {
    			DialogOrder.raise(DialogElement);
    		});
    	});

    	/**** Event Handling ****/
    	function onDragStart() {
    		return State.Offset;
    	}

    	function onDragMove(x, y) {
    		$$invalidate(0, State.Offset = { x, y }, State);
    	}

    	function startResizing() {
    		return { x: State.Width, y: State.Height };
    	}

    	function continueResizing(x, y) {
    		$$invalidate(0, State.Width = Math.max(minWidth, x), State);
    		$$invalidate(0, State.Height = Math.max(minHeight, y), State);
    	}

    	function closeDialog() {
    		$$invalidate(0, State.isVisible = false, State);
    		dispatch("close");
    	}

    	function div4_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			DialogElement = $$value;
    			$$invalidate(4, DialogElement);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(11, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("Applet" in $$new_props) $$invalidate(1, Applet = $$new_props.Applet);
    		if ("Title" in $$new_props) $$invalidate(2, Title = $$new_props.Title);
    		if ("resizable" in $$new_props) $$invalidate(3, resizable = $$new_props.resizable);
    		if ("minWidth" in $$new_props) $$invalidate(12, minWidth = $$new_props.minWidth);
    		if ("minHeight" in $$new_props) $$invalidate(13, minHeight = $$new_props.minHeight);
    		if ("State" in $$new_props) $$invalidate(0, State = $$new_props.State);
    		if ("PositionAroundPreferredPosition" in $$new_props) $$invalidate(14, PositionAroundPreferredPosition = $$new_props.PositionAroundPreferredPosition);
    		if ("$$scope" in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*Applet, State, PositionAroundPreferredPosition*/ 16387) {
    			if (Applet != null && isNaN(State.Offset.x)) {
    				// requires "$:"
    				let GeometryOnDisplay = Applet.GeometryOnDisplay;

    				let PositionOnDisplay = PositionAroundPreferredPosition(State.Width, State.Height);

    				$$invalidate(0, State = Object.assign(Object.assign({}, State), {
    					Offset: {
    						x: PositionOnDisplay.x - GeometryOnDisplay.x,
    						y: PositionOnDisplay.y - GeometryOnDisplay.y
    					}
    				}));
    			}
    		}

    		if ($$self.$$.dirty & /*DialogElement, State*/ 17) {
    			if (DialogElement != null && State.isVisible) {
    				DialogOrder.open(DialogElement);
    			} else {
    				DialogOrder.close(DialogElement);
    			}
    		}
    	};

    	return [
    		State,
    		Applet,
    		Title,
    		resizable,
    		DialogElement,
    		$DialogOrder,
    		onDragStart,
    		onDragMove,
    		startResizing,
    		continueResizing,
    		closeDialog,
    		$$restProps,
    		minWidth,
    		minHeight,
    		PositionAroundPreferredPosition,
    		$$scope,
    		slots,
    		div4_binding
    	];
    }

    class Dialog extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			Applet: 1,
    			Title: 2,
    			resizable: 3,
    			minWidth: 12,
    			minHeight: 13,
    			State: 0,
    			PositionAroundPreferredPosition: 14
    		});
    	}
    }

    /*
      export type WAD_Mode = (
        'applet'|'master'|'card'|'overlay'|'component'|'import-export'|'search'
      )
      export type WAD_Pane = (
        'overview'|'selection-globals'|'selection-resources'|'selection-properties'|
        'selection-configuration'|'selection-script'|'selection-contents'
      )
    */
      const initialInspectorState = {
        isVisible:false, Offset:{ x:NaN,y:NaN }, Width:NaN,Height:NaN,
        Mode:'applet', Pane:'overview'
      };

      let currentlyChosenApplet$2 = undefined;
      let currentInspectorState = Object.assign({}, initialInspectorState);

      const InspectorStateStore = writable(currentInspectorState); // subscript. mgmt
      const InspectorStateSet   = new WeakMap();  // applet-specific Inspector states

    /**** keep track of changes in "chosenApplet" ****/

      chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
        if (currentlyChosenApplet$2 !== newChosenApplet) {
          currentlyChosenApplet$2 = newChosenApplet;

          if (currentlyChosenApplet$2 == null) {
            currentInspectorState = Object.assign({}, initialInspectorState);
          } else {
            if (InspectorStateSet.has(currentlyChosenApplet$2)) {
              currentInspectorState = InspectorStateSet.get(currentlyChosenApplet$2);
            } else {
              currentInspectorState = Object.assign({}, initialInspectorState);
              InspectorStateSet.set(currentlyChosenApplet$2,currentInspectorState);
            }
            InspectorStateStore.set(currentInspectorState);
          }
        }
      });

    /**** validate changes to "InspectorState" ****/

      function setInspectorState (newInspectorState) {
        if (currentlyChosenApplet$2 !== null) {
          if (webappTinkererRuntime.ValuesDiffer(currentInspectorState,newInspectorState)) {
            currentInspectorState = Object.assign({}, currentInspectorState, newInspectorState);
            InspectorStateSet.set(currentlyChosenApplet$2,currentInspectorState);
            InspectorStateStore.set(currentInspectorState);
          }
        }
      }

    /**** setMode ****/

      function setMode (newMode) {
        if (newMode != currentInspectorState.Mode) {
          let newPane;
            if ((newMode === 'import-export') || (newMode === 'search')) {
              newPane = undefined;
            } else {
              newPane = currentInspectorState.Pane || 'overview';
            }
          setInspectorState({ ...currentInspectorState, Mode:newMode, Pane:newPane });
        }
      }

    /**** setPane ****/

      function setPane (newPane) {
        if (newPane != currentInspectorState.Pane) {
          if ('import-export search'.indexOf(currentInspectorState.Mode) >= 0) {
            newPane = undefined;
          }
          setInspectorState({ ...currentInspectorState, Pane:newPane });
        }
      }

    /**** export an explicitly implemented store ****/

      const InspectorState = {
        subscribe: (Callback) => InspectorStateStore.subscribe(Callback),
        set:       setInspectorState,
        setMode, setPane
      };

    /* src/InspectorView.svelte generated by Svelte v3.38.3 */

    function create_if_block$3(ctx) {
    	let dialog;
    	let updating_State;
    	let current;

    	function dialog_State_binding(value) {
    		/*dialog_State_binding*/ ctx[17](value);
    	}

    	let dialog_props = {
    		class: "WAD-Inspector",
    		Applet: /*Applet*/ ctx[0],
    		Title: "WAT-Designer: Inspector",
    		resizable: true,
    		PositionAroundPreferredPosition: /*PositionAroundPreferredPosition*/ ctx[1],
    		minWidth: 300,
    		minHeight: 420,
    		$$slots: { default: [create_default_slot$2] },
    		$$scope: { ctx }
    	};

    	if (/*$InspectorState*/ ctx[2] !== void 0) {
    		dialog_props.State = /*$InspectorState*/ ctx[2];
    	}

    	dialog = new Dialog({ props: dialog_props });
    	binding_callbacks.push(() => bind(dialog, "State", dialog_State_binding));

    	return {
    		c() {
    			create_component(dialog.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(dialog, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const dialog_changes = {};
    			if (dirty & /*Applet*/ 1) dialog_changes.Applet = /*Applet*/ ctx[0];
    			if (dirty & /*PositionAroundPreferredPosition*/ 2) dialog_changes.PositionAroundPreferredPosition = /*PositionAroundPreferredPosition*/ ctx[1];

    			if (dirty & /*$$scope, $InspectorState*/ 262148) {
    				dialog_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_State && dirty & /*$InspectorState*/ 4) {
    				updating_State = true;
    				dialog_changes.State = /*$InspectorState*/ ctx[2];
    				add_flush_callback(() => updating_State = false);
    			}

    			dialog.$set(dialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(dialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(dialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(dialog, detaching);
    		}
    	};
    }

    // (111:6) {#if $InspectorState.Pane === 'overview'}
    function create_if_block_9(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$InspectorState*/ ctx[2].Mode === "applet" && create_if_block_10();

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (/*$InspectorState*/ ctx[2].Mode === "applet") {
    				if (if_block) {
    					if (dirty & /*$InspectorState*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_10();
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (112:8) {#if $InspectorState.Mode === 'applet'}
    function create_if_block_10(ctx) {
    	let appletoverviewpane;
    	let current;
    	appletoverviewpane = new AppletOverviewPane({});

    	return {
    		c() {
    			create_component(appletoverviewpane.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(appletoverviewpane, target, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(appletoverviewpane.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(appletoverviewpane.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(appletoverviewpane, detaching);
    		}
    	};
    }

    // (115:6) {#if $InspectorState.Pane === 'selection-globals'}
    function create_if_block_8(ctx) {
    	return { c: noop, m: noop, d: noop };
    }

    // (118:6) {#if $InspectorState.Pane === 'selection-resources'}
    function create_if_block_7(ctx) {
    	return { c: noop, m: noop, d: noop };
    }

    // (121:6) {#if $InspectorState.Pane === 'selection-properties'}
    function create_if_block_6(ctx) {
    	return { c: noop, m: noop, d: noop };
    }

    // (124:6) {#if $InspectorState.Pane === 'selection-configuration'}
    function create_if_block_5(ctx) {
    	return { c: noop, m: noop, d: noop };
    }

    // (127:6) {#if $InspectorState.Pane === 'selection-script'}
    function create_if_block_4(ctx) {
    	return { c: noop, m: noop, d: noop };
    }

    // (130:6) {#if $InspectorState.Pane === 'selection-contents'}
    function create_if_block_3$1(ctx) {
    	return { c: noop, m: noop, d: noop };
    }

    // (133:6) {#if $InspectorState.Mode === 'import-export'}
    function create_if_block_2$1(ctx) {
    	return { c: noop, m: noop, d: noop };
    }

    // (136:6) {#if $InspectorState.Mode === 'search'}
    function create_if_block_1$1(ctx) {
    	return { c: noop, m: noop, d: noop };
    }

    // (46:2) <Dialog class="WAD-Inspector" {Applet} Title="WAT-Designer: Inspector" resizable={true}     {PositionAroundPreferredPosition} bind:State={$InspectorState}     minWidth={300} minHeight={420}   >
    function create_default_slot$2(ctx) {
    	let div0;
    	let iconbutton0;
    	let t0;
    	let iconbutton1;
    	let t1;
    	let iconbutton2;
    	let t2;
    	let iconbutton3;
    	let t3;
    	let iconbutton4;
    	let t4;
    	let iconbutton5;
    	let t5;
    	let iconbutton6;
    	let t6;
    	let iconbutton7;
    	let t7;
    	let iconbutton8;
    	let t8;
    	let iconbutton9;
    	let t9;
    	let iconbutton10;
    	let t10;
    	let iconbutton11;
    	let t11;
    	let iconbutton12;
    	let t12;
    	let iconbutton13;
    	let t13;
    	let div1;
    	let t14;
    	let t15;
    	let t16;
    	let t17;
    	let t18;
    	let t19;
    	let t20;
    	let t21;
    	let t22;
    	let messageview;
    	let current;

    	iconbutton0 = new IconButton({
    			props: {
    				style: "left:10px;  top:0px",
    				ImageURL: AppletImageURL,
    				active: /*$InspectorState*/ ctx[2].Mode === "applet"
    			}
    		});

    	iconbutton0.$on("click", /*click_handler*/ ctx[3]);

    	iconbutton1 = new IconButton({
    			props: {
    				style: "left:50px;  top:0px",
    				ImageURL: MasterImageURL,
    				active: /*$InspectorState*/ ctx[2].Mode === "master"
    			}
    		});

    	iconbutton1.$on("click", /*click_handler_1*/ ctx[4]);

    	iconbutton2 = new IconButton({
    			props: {
    				style: "left:90px;  top:0px",
    				ImageURL: CardImageURL,
    				active: /*$InspectorState*/ ctx[2].Mode === "card"
    			}
    		});

    	iconbutton2.$on("click", /*click_handler_2*/ ctx[5]);

    	iconbutton3 = new IconButton({
    			props: {
    				style: "left:130px; top:0px",
    				ImageURL: OverlayImageURL,
    				active: /*$InspectorState*/ ctx[2].Mode === "overlay"
    			}
    		});

    	iconbutton3.$on("click", /*click_handler_3*/ ctx[6]);

    	iconbutton4 = new IconButton({
    			props: {
    				style: "left:170px; top:0px",
    				ImageURL: ComponentImageURL,
    				active: /*$InspectorState*/ ctx[2].Mode === "component"
    			}
    		});

    	iconbutton4.$on("click", /*click_handler_4*/ ctx[7]);

    	iconbutton5 = new IconButton({
    			props: {
    				style: "left:210px; top:0px",
    				ImageURL: ImportExportImageURL$1,
    				active: /*$InspectorState*/ ctx[2].Mode === "import-export"
    			}
    		});

    	iconbutton5.$on("click", /*click_handler_5*/ ctx[8]);

    	iconbutton6 = new IconButton({
    			props: {
    				style: "left:250px; top:0px",
    				ImageURL: SearchImageURL$1,
    				active: /*$InspectorState*/ ctx[2].Mode === "search"
    			}
    		});

    	iconbutton6.$on("click", /*click_handler_6*/ ctx[9]);

    	iconbutton7 = new IconButton({
    			props: {
    				style: "left:10px;  top:40px",
    				ImageURL: SelectionImageURL,
    				active: /*$InspectorState*/ ctx[2].Pane === "overview",
    				disabled: ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0
    			}
    		});

    	iconbutton7.$on("click", /*click_handler_7*/ ctx[10]);

    	iconbutton8 = new IconButton({
    			props: {
    				style: "left:50px;  top:40px",
    				ImageURL: SelectionGlobalsImageURL,
    				active: /*$InspectorState*/ ctx[2].Pane === "selection-globals",
    				disabled: ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0
    			}
    		});

    	iconbutton8.$on("click", /*click_handler_8*/ ctx[11]);

    	iconbutton9 = new IconButton({
    			props: {
    				style: "left:90px;  top:40px",
    				ImageURL: SelectionResourcesImageURL,
    				active: /*$InspectorState*/ ctx[2].Pane === "selection-resources",
    				disabled: ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0
    			}
    		});

    	iconbutton9.$on("click", /*click_handler_9*/ ctx[12]);

    	iconbutton10 = new IconButton({
    			props: {
    				style: "left:130px; top:40px",
    				ImageURL: SelectionPropertiesImageURL,
    				active: /*$InspectorState*/ ctx[2].Pane === "selection-properties",
    				disabled: ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0
    			}
    		});

    	iconbutton10.$on("click", /*click_handler_10*/ ctx[13]);

    	iconbutton11 = new IconButton({
    			props: {
    				style: "left:170px; top:40px",
    				ImageURL: SelectionConfigurationImageURL,
    				active: /*$InspectorState*/ ctx[2].Pane === "selection-configuration",
    				disabled: ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0
    			}
    		});

    	iconbutton11.$on("click", /*click_handler_11*/ ctx[14]);

    	iconbutton12 = new IconButton({
    			props: {
    				style: "left:210px; top:40px",
    				ImageURL: SelectionScriptImageURL,
    				active: /*$InspectorState*/ ctx[2].Pane === "selection-script",
    				disabled: ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0
    			}
    		});

    	iconbutton12.$on("click", /*click_handler_12*/ ctx[15]);

    	iconbutton13 = new IconButton({
    			props: {
    				style: "left:250px; top:40px",
    				ImageURL: SelectionContentsImageURL,
    				active: /*$InspectorState*/ ctx[2].Pane === "selection-contents",
    				disabled: ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0
    			}
    		});

    	iconbutton13.$on("click", /*click_handler_13*/ ctx[16]);
    	let if_block0 = /*$InspectorState*/ ctx[2].Pane === "overview" && create_if_block_9(ctx);
    	let if_block1 = /*$InspectorState*/ ctx[2].Pane === "selection-globals" && create_if_block_8();
    	let if_block2 = /*$InspectorState*/ ctx[2].Pane === "selection-resources" && create_if_block_7();
    	let if_block3 = /*$InspectorState*/ ctx[2].Pane === "selection-properties" && create_if_block_6();
    	let if_block4 = /*$InspectorState*/ ctx[2].Pane === "selection-configuration" && create_if_block_5();
    	let if_block5 = /*$InspectorState*/ ctx[2].Pane === "selection-script" && create_if_block_4();
    	let if_block6 = /*$InspectorState*/ ctx[2].Pane === "selection-contents" && create_if_block_3$1();
    	let if_block7 = /*$InspectorState*/ ctx[2].Mode === "import-export" && create_if_block_2$1();
    	let if_block8 = /*$InspectorState*/ ctx[2].Mode === "search" && create_if_block_1$1();
    	messageview = new MessageView({});

    	return {
    		c() {
    			div0 = element("div");
    			create_component(iconbutton0.$$.fragment);
    			t0 = space();
    			create_component(iconbutton1.$$.fragment);
    			t1 = space();
    			create_component(iconbutton2.$$.fragment);
    			t2 = space();
    			create_component(iconbutton3.$$.fragment);
    			t3 = space();
    			create_component(iconbutton4.$$.fragment);
    			t4 = space();
    			create_component(iconbutton5.$$.fragment);
    			t5 = space();
    			create_component(iconbutton6.$$.fragment);
    			t6 = space();
    			create_component(iconbutton7.$$.fragment);
    			t7 = space();
    			create_component(iconbutton8.$$.fragment);
    			t8 = space();
    			create_component(iconbutton9.$$.fragment);
    			t9 = space();
    			create_component(iconbutton10.$$.fragment);
    			t10 = space();
    			create_component(iconbutton11.$$.fragment);
    			t11 = space();
    			create_component(iconbutton12.$$.fragment);
    			t12 = space();
    			create_component(iconbutton13.$$.fragment);
    			t13 = space();
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t14 = space();
    			if (if_block1) if_block1.c();
    			t15 = space();
    			if (if_block2) if_block2.c();
    			t16 = space();
    			if (if_block3) if_block3.c();
    			t17 = space();
    			if (if_block4) if_block4.c();
    			t18 = space();
    			if (if_block5) if_block5.c();
    			t19 = space();
    			if (if_block6) if_block6.c();
    			t20 = space();
    			if (if_block7) if_block7.c();
    			t21 = space();
    			if (if_block8) if_block8.c();
    			t22 = space();
    			create_component(messageview.$$.fragment);
    			attr(div0, "name", "TabStrip");
    			set_style(div0, "display", "block");
    			set_style(div0, "position", "relative");
    			set_style(div0, "top", "2px");
    			set_style(div0, "height", "74px");
    			set_style(div0, "overflow", "visible");
    			set_style(div0, "border", "none");
    			set_style(div0, "border-bottom", "solid 1px #454545");
    			attr(div1, "name", "PaneArea");
    			set_style(div1, "display", "block");
    			set_style(div1, "position", "relative");
    			set_style(div1, "flex", "1 1 auto");
    			set_style(div1, "border", "none");
    			set_style(div1, "border-top", "solid 1px #969696");
    			set_style(div1, "border-bottom", "solid 1px #454545");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			mount_component(iconbutton0, div0, null);
    			append(div0, t0);
    			mount_component(iconbutton1, div0, null);
    			append(div0, t1);
    			mount_component(iconbutton2, div0, null);
    			append(div0, t2);
    			mount_component(iconbutton3, div0, null);
    			append(div0, t3);
    			mount_component(iconbutton4, div0, null);
    			append(div0, t4);
    			mount_component(iconbutton5, div0, null);
    			append(div0, t5);
    			mount_component(iconbutton6, div0, null);
    			append(div0, t6);
    			mount_component(iconbutton7, div0, null);
    			append(div0, t7);
    			mount_component(iconbutton8, div0, null);
    			append(div0, t8);
    			mount_component(iconbutton9, div0, null);
    			append(div0, t9);
    			mount_component(iconbutton10, div0, null);
    			append(div0, t10);
    			mount_component(iconbutton11, div0, null);
    			append(div0, t11);
    			mount_component(iconbutton12, div0, null);
    			append(div0, t12);
    			mount_component(iconbutton13, div0, null);
    			insert(target, t13, anchor);
    			insert(target, div1, anchor);
    			if (if_block0) if_block0.m(div1, null);
    			append(div1, t14);
    			if (if_block1) if_block1.m(div1, null);
    			append(div1, t15);
    			if (if_block2) if_block2.m(div1, null);
    			append(div1, t16);
    			if (if_block3) if_block3.m(div1, null);
    			append(div1, t17);
    			if (if_block4) if_block4.m(div1, null);
    			append(div1, t18);
    			if (if_block5) if_block5.m(div1, null);
    			append(div1, t19);
    			if (if_block6) if_block6.m(div1, null);
    			append(div1, t20);
    			if (if_block7) if_block7.m(div1, null);
    			append(div1, t21);
    			if (if_block8) if_block8.m(div1, null);
    			insert(target, t22, anchor);
    			mount_component(messageview, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const iconbutton0_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton0_changes.active = /*$InspectorState*/ ctx[2].Mode === "applet";
    			iconbutton0.$set(iconbutton0_changes);
    			const iconbutton1_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton1_changes.active = /*$InspectorState*/ ctx[2].Mode === "master";
    			iconbutton1.$set(iconbutton1_changes);
    			const iconbutton2_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton2_changes.active = /*$InspectorState*/ ctx[2].Mode === "card";
    			iconbutton2.$set(iconbutton2_changes);
    			const iconbutton3_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton3_changes.active = /*$InspectorState*/ ctx[2].Mode === "overlay";
    			iconbutton3.$set(iconbutton3_changes);
    			const iconbutton4_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton4_changes.active = /*$InspectorState*/ ctx[2].Mode === "component";
    			iconbutton4.$set(iconbutton4_changes);
    			const iconbutton5_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton5_changes.active = /*$InspectorState*/ ctx[2].Mode === "import-export";
    			iconbutton5.$set(iconbutton5_changes);
    			const iconbutton6_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton6_changes.active = /*$InspectorState*/ ctx[2].Mode === "search";
    			iconbutton6.$set(iconbutton6_changes);
    			const iconbutton7_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton7_changes.active = /*$InspectorState*/ ctx[2].Pane === "overview";
    			if (dirty & /*$InspectorState*/ 4) iconbutton7_changes.disabled = ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0;
    			iconbutton7.$set(iconbutton7_changes);
    			const iconbutton8_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton8_changes.active = /*$InspectorState*/ ctx[2].Pane === "selection-globals";
    			if (dirty & /*$InspectorState*/ 4) iconbutton8_changes.disabled = ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0;
    			iconbutton8.$set(iconbutton8_changes);
    			const iconbutton9_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton9_changes.active = /*$InspectorState*/ ctx[2].Pane === "selection-resources";
    			if (dirty & /*$InspectorState*/ 4) iconbutton9_changes.disabled = ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0;
    			iconbutton9.$set(iconbutton9_changes);
    			const iconbutton10_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton10_changes.active = /*$InspectorState*/ ctx[2].Pane === "selection-properties";
    			if (dirty & /*$InspectorState*/ 4) iconbutton10_changes.disabled = ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0;
    			iconbutton10.$set(iconbutton10_changes);
    			const iconbutton11_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton11_changes.active = /*$InspectorState*/ ctx[2].Pane === "selection-configuration";
    			if (dirty & /*$InspectorState*/ 4) iconbutton11_changes.disabled = ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0;
    			iconbutton11.$set(iconbutton11_changes);
    			const iconbutton12_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton12_changes.active = /*$InspectorState*/ ctx[2].Pane === "selection-script";
    			if (dirty & /*$InspectorState*/ 4) iconbutton12_changes.disabled = ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0;
    			iconbutton12.$set(iconbutton12_changes);
    			const iconbutton13_changes = {};
    			if (dirty & /*$InspectorState*/ 4) iconbutton13_changes.active = /*$InspectorState*/ ctx[2].Pane === "selection-contents";
    			if (dirty & /*$InspectorState*/ 4) iconbutton13_changes.disabled = ("import-export search").indexOf(/*$InspectorState*/ ctx[2].Mode) >= 0;
    			iconbutton13.$set(iconbutton13_changes);

    			if (/*$InspectorState*/ ctx[2].Pane === "overview") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*$InspectorState*/ 4) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_9(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div1, t14);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*$InspectorState*/ ctx[2].Pane === "selection-globals") {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_8();
    					if_block1.c();
    					if_block1.m(div1, t15);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*$InspectorState*/ ctx[2].Pane === "selection-resources") {
    				if (if_block2) ; else {
    					if_block2 = create_if_block_7();
    					if_block2.c();
    					if_block2.m(div1, t16);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*$InspectorState*/ ctx[2].Pane === "selection-properties") {
    				if (if_block3) ; else {
    					if_block3 = create_if_block_6();
    					if_block3.c();
    					if_block3.m(div1, t17);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*$InspectorState*/ ctx[2].Pane === "selection-configuration") {
    				if (if_block4) ; else {
    					if_block4 = create_if_block_5();
    					if_block4.c();
    					if_block4.m(div1, t18);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*$InspectorState*/ ctx[2].Pane === "selection-script") {
    				if (if_block5) ; else {
    					if_block5 = create_if_block_4();
    					if_block5.c();
    					if_block5.m(div1, t19);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (/*$InspectorState*/ ctx[2].Pane === "selection-contents") {
    				if (if_block6) ; else {
    					if_block6 = create_if_block_3$1();
    					if_block6.c();
    					if_block6.m(div1, t20);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}

    			if (/*$InspectorState*/ ctx[2].Mode === "import-export") {
    				if (if_block7) ; else {
    					if_block7 = create_if_block_2$1();
    					if_block7.c();
    					if_block7.m(div1, t21);
    				}
    			} else if (if_block7) {
    				if_block7.d(1);
    				if_block7 = null;
    			}

    			if (/*$InspectorState*/ ctx[2].Mode === "search") {
    				if (if_block8) ; else {
    					if_block8 = create_if_block_1$1();
    					if_block8.c();
    					if_block8.m(div1, null);
    				}
    			} else if (if_block8) {
    				if_block8.d(1);
    				if_block8 = null;
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(iconbutton0.$$.fragment, local);
    			transition_in(iconbutton1.$$.fragment, local);
    			transition_in(iconbutton2.$$.fragment, local);
    			transition_in(iconbutton3.$$.fragment, local);
    			transition_in(iconbutton4.$$.fragment, local);
    			transition_in(iconbutton5.$$.fragment, local);
    			transition_in(iconbutton6.$$.fragment, local);
    			transition_in(iconbutton7.$$.fragment, local);
    			transition_in(iconbutton8.$$.fragment, local);
    			transition_in(iconbutton9.$$.fragment, local);
    			transition_in(iconbutton10.$$.fragment, local);
    			transition_in(iconbutton11.$$.fragment, local);
    			transition_in(iconbutton12.$$.fragment, local);
    			transition_in(iconbutton13.$$.fragment, local);
    			transition_in(if_block0);
    			transition_in(messageview.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(iconbutton0.$$.fragment, local);
    			transition_out(iconbutton1.$$.fragment, local);
    			transition_out(iconbutton2.$$.fragment, local);
    			transition_out(iconbutton3.$$.fragment, local);
    			transition_out(iconbutton4.$$.fragment, local);
    			transition_out(iconbutton5.$$.fragment, local);
    			transition_out(iconbutton6.$$.fragment, local);
    			transition_out(iconbutton7.$$.fragment, local);
    			transition_out(iconbutton8.$$.fragment, local);
    			transition_out(iconbutton9.$$.fragment, local);
    			transition_out(iconbutton10.$$.fragment, local);
    			transition_out(iconbutton11.$$.fragment, local);
    			transition_out(iconbutton12.$$.fragment, local);
    			transition_out(iconbutton13.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(messageview.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			destroy_component(iconbutton0);
    			destroy_component(iconbutton1);
    			destroy_component(iconbutton2);
    			destroy_component(iconbutton3);
    			destroy_component(iconbutton4);
    			destroy_component(iconbutton5);
    			destroy_component(iconbutton6);
    			destroy_component(iconbutton7);
    			destroy_component(iconbutton8);
    			destroy_component(iconbutton9);
    			destroy_component(iconbutton10);
    			destroy_component(iconbutton11);
    			destroy_component(iconbutton12);
    			destroy_component(iconbutton13);
    			if (detaching) detach(t13);
    			if (detaching) detach(div1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (if_block6) if_block6.d();
    			if (if_block7) if_block7.d();
    			if (if_block8) if_block8.d();
    			if (detaching) detach(t22);
    			destroy_component(messageview, detaching);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$InspectorState*/ ctx[2].isVisible && create_if_block$3(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*$InspectorState*/ ctx[2].isVisible) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$InspectorState*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }




    /**** normal IconButton images as Data URLs ****/
    let AppletImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA8UlEQVRYR+1XQQ7DIAxrv8uD+G4nKqXKsqQhpoEetsMmsYXYxvHovi1+7Yv7b+8BUGs9ZqpRSjnJn2+tOS3MAkE90wBIRSXBNADUWGvY1KX1VAAWW37UKQA0L9Ga9fmoByQA2ZQbPl0Brfl0ANx0NN4S2KNH4GVKugkJgMXcHUPLRHJjLbatuSfpu4Io4mJPbi/S1SnwZlY2HfkPCQPgjGScemy1780cuAuPdAUQJmjNjwLoRiN17SivIBrZCK19DwAeNCibaN3XnTBarAFG75Twtdy78/WS+gOAFLAeYhAfhAD0Pj1FgIQA9Bor8rvlAD4fTngwzU/HXwAAAABJRU5ErkJggg==";

    let MasterImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABY0lEQVRYR82Xaw7CMAyD2XV3oF0XVKSg4NlOuoeAf7DSfnGdx5bHjz/L2fO3bXvGHuu6Tu83/YcMPA7Phx6BuRQA4TrKHAbA6Mdh7Lf4XcHcBuBg8rXtAOIelaHyPY+oYh3zA3uG674A8kNlMARjxsN9ApQF9wHAjfJiJafKCBUIg30DsD84NVjtiPXd6GNdCaDcnu8/gFBiBZODngZQJmRK5rsf3mGq3gqAWXAJQC4sLCPYoajE1BW4Cuf6AvPFIQXOAGBmtAEwzcJAHeerhoS9oEzDLKFquViK3XdVb3ZZ4AqTU4BF2OkVJQC2U1YFWat1zWmXBcxoqhl1ALqHj72+mpHL60qJTltmvpLt2JkwH5blryJnStOBBF1fKaNqRQeIjmRV/6+GEOYTtaecCR0Ea7MsRdU1ZkA7lCoINSOwObJS878BuuaaWYf+KN8LcAJiVc/ViOp9sQRwle+KZz8HeAHatLA/TmjFBQAAAABJRU5ErkJggg==";
    let CardImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABBElEQVRYR+2WQRLEIAgEk+/6IL+7Wx5IEQPMkBi9ZE/ZUqGZUXHfFv/2xfm3D4BWoNb6y9hVSqFiw0k6MRu0rWHnugCSWAKhoHo+mquVvAD0iWUyCirj3nrPvgMALYwArDEUT4BOAJFvWQCtXPv2Yp8suJMEWYNApgF4IOYmtOTyfGaPm96EOtZ0gL4Q8x5gqmW974/fUgALOrwJtb968ajqmzrTADzosBlZVY+sPlSgDY4CiKCpdtz2Anu3W01nKQCyDCogVkQNJXopLQVAyeEm7O9v/Z/pAa8A6CdaZAuTPKWA5/PdJ9zlRZR5cntHTRRhqx+igNXtMieGOoZP1YnWfwB/a0o8MCIQpw0AAAAASUVORK5CYII=";
    let OverlayImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAs0lEQVRYR+2W0Q6AIAhF9Xf9IH+35gObI/Qi0qyNXmoT5HZAIafDTz4cP4UAkUCt9fJITSkFEn4YUPDm3L75e1UYEjEUsBpoZG8SgJy04ojgzF4k8FsBmuLlP+dK4BMCZumTasKdAB1bXnj9ce7XXhEwqvogEASCQBBQEWiXiOZOn/V/yV99E2p7vWSH+r+agFVEP8KZe4E1OKVuuxvuCkD+cCBBG3ivw7ndOyDfLwQcJ3AD7On8Ic5p3nwAAAAASUVORK5CYII=";
    let ComponentImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABAklEQVRYR+1WQRLEIAhrv+uD/O7ueGCGYQOh1FoP21OnFhMiBM/j5ed8Gf/Ym0Dv/WMVaq1B0ujfTKyrQLShJZEBFzI2lmajAzQQ+u6pM8AllhLwQCQDtK43z7zro/lRADEd36KMEagGGbGXFRBAljGSNxMjBPdVYDBERcWyu10DWlJLYkkXoGpnhjLdByISy5xw1ZB6bBh5fW8Te4SArYnIouksqB5FZGTUiiPGjJCV3voCHUbWBxigt15WoAqo427XwEwS7DhpF2TbqUo6JHBFyqkEoolXBfKmK7wPoBvMjKOwN6tBihoRaqeqCqgg96wB1NOsnaqq0DasbpyN+xP4ArhxGDBtdoDkAAAAAElFTkSuQmCC";
    let ImportExportImageURL$1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA0klEQVRYR+2VYQ6AIAiF67oeyOvWbKPRExCdaW32p5qO94Hw3LfJzz5Zf1sA/61AjPEIIVwJpO/0pv+avmqqAAoOBSAxnvEwAC4+HADFhwJI4p8EwO73TEXXKeAAHvG0XwWQup0EtDGkdfQHyyNEAG4ykqlYAFrmWswMAB1OClhjRKV4D4BS5tYReM8cNW4Ayc28QJb3YwzUMQFqLhXv3iqAKRXAUfJmVtqn3SPZEZQC9Vqnps2moJeAFYdPjGpEb4BIo9p0F/SEWwCrAqsC0ytwArCqxCFYK1feAAAAAElFTkSuQmCC";
    let SearchImageURL$1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA00lEQVRYR+2WQRKAIAgA87s+yO/WcHCGEBAV8WKnmqxdkKD0HD7SYf7jLlBKeWlQOWeR4ybAgS0iLgIYzkWr3V8W6MFrFqR1bgLaPlMJvHZJoEZlgUsSV+BmYCkDUFi0EOFaKkquaN0EQKaCuW/etQ9obXd7J8Rp5M616crJDW0Bt9849bgmsIjLNJSKTSs6y7+GKQO74CDYFdgJ7wrshqsCEXBRIArOCkTCG4Fo+E/gBLwRwMMEzlebzFAjotMqAi7WAO3vlkhm13Q74eyLrc9dgQ9itQQwkRB2awAAAABJRU5ErkJggg==";
    let SelectionImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAUklEQVRYR+3UwREAIAgDQWiXgtKuFqA+MTzOAiSzBjPMJ83zgwAIXAUkrY5yVtUxjwAzBTre/3UnazizA/wDdgHW0C5g7wAB7AL2EhIAAQR+CmweoTAhD/IaqwAAAABJRU5ErkJggg==";
    let SelectionGlobalsImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA+UlEQVRYR+2XUQ7EIAhE2+t6IK+7Gz5oKAEZ1IZusv3ZJlV5DgO651H8nMXxjwug9/5hmNZaCLZrvAtAAQhk9CuBs+N57nsUqPLCLdcs41Mw1vqh2SwYacCMca21UgpwYK4SuSP9zQPXFQYroOXTrueA2TRCCnjBvaAexJQHouBZCJ2aUIGdAGkFrAkZeRE/DDshunskDd7ZAQEgfX50bhDgEgBaYiPFQgC0cTzmAZZJdyrUB8i4dBVYUKgCSAXQ+mEfQCCQ3XsK/8ZZIKuA3ktOQ1klZfeB1ZvSVBWsBo3mv+dWrFsl0v///wui/CLf4UaELDYzphzgC1oI5DDpfBDzAAAAAElFTkSuQmCC";
    let SelectionResourcesImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA7ElEQVRYR+2XUQ6EMAhE9bo9UK+7m35gugSYEWl0N+uPMVIYnhTqvt187TfH3w4BvfeXiGmtQWFV9q6AEWAIie6z4LP2sjZFYM5+OLpCDKJeXSMfAgTjqqCW/98hIHUR1cNSAowA69NSNYCc6/eefZpAlYAUgbPBJYi1LkWgUkBIwOrt2eAWBW92hK340QKQuEFhtoEEvPYbbaloEDECx3rYB7xqRlOwbBdolNazpsdmTxHwviXq+RahVB+4kh0z1mENME5YmxICbDDW7k8gdSqedwbqB3ouaPvv/C9YQoCt2mq7Zx3Lq7Nj/L0BoDBwMIhTLVUAAAAASUVORK5CYII=";
    let SelectionPropertiesImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABM0lEQVRYR+1XQQ7DMAhrv9sH5bubcqDykMEQReoO3WWHJsUY20nP4+Hf+XD94wYwxvgYmOu6JLBd60MAs8AEkv0j4O562/s/DHS1YB2zfTaeyih/Zp29FAtFBVAXuN6AsPdLsfkOI/FFxZWw2wxUAGDHTKjYVJkBT7unkwGrWLXEgKfX7Dk7Yd0yYaKlWwyw2bJ8mC9VImTASgxEQmRMIBBvwy0uMDBR8nXzZDkJfacqfCJBlgBkaq4y0QaAHfnNzJLmiEpKojbCHFDJhha0cUSizHSRuoB1k826ogPvDMqASjD1HBlRrqAMqAJKlL5o+zRcBRCJ1esljOLogMG5dTXg3VTSQJbr7KKB6eiP3+X7QCcH2G1p641IaYIpnR086WnYLbJr/ftdUL4TqkRbff4C+AI8xegwDnQdAwAAAABJRU5ErkJggg==";
    let SelectionConfigurationImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABGUlEQVRYR82WXQ4DIQiEd6/rgbxuGx9oKOFnQBLdl+42qJ/jAL7P4ec9vP7zA5hzfghmjBGCdcWbAGuBBeL9cuBsPI29R4FTXvg7a5KRYOQ3Ckn+kF7S5jPNljUZh17viJFXXKhAJjNWrKdiSoHqjrj81lHwo3QV4IGIH/ixacqVFEAhqp6BFfAyA118WwENAl3cSuGWSoiknQXaBhBBtALIyWQj0uQOAbJllsdrXROdL5UF2s659JESW1lgSSirXQQhlYF7gdcTUIiUAtmajkLAClTuBhqE5hGzGVnORbqa7J4yS8JKqPVy+i8qMnJyz7DyohJev9F8rsa1lGLk+hVWwqi8yvzejSfF7lGgeoa74+4x4e5OquO/i3SsMOeJ2OQAAAAASUVORK5CYII=";
    let SelectionScriptImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABFElEQVRYR+1XUQ5CMQh777o70K6r4QODCKPAkmmiPyaGja4t3byvw5/7cP/rBWDO+WAwY4wQ2K56FwA1ICCrbwk4W89rv4eBU15405pptMBIzbNg2VPW/qHZqFmneWTskIGs27mhBi0NLRkMGeCNkNH0mtPv3nqYAamjHj95Ij6p1bTkAc2AlsSjenVqVwILYUcCTfsWBpARzIAOk9CTQGqt6bYAeNP0ewCqEoQMeBtn9NQ5gGRHKwdY+5VP5MG2TAEy9xnW0gxUPcCXmpbFvAt23H6tJESeV8hzrZyEUsMKGPT0VOd6oCODN36lKUBM16kJozgKKJTuMAmtex4xmgyjTP3/f8EHAx0jddaGr+LO5sjaJ0cgzDAHqlx2AAAAAElFTkSuQmCC";
    let SelectionContentsImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAqklEQVRYR+2X3QqAIAxG9XV9oL1u4YVh5JyOb2yQ3QSx9HD2I+bk/GTn/dMDQERXgymliGCoeBagblBBZu8eeDe+/RvHgFctvHLdNFrBjNYXi80K5lMD9UNIA3277dpYaWexBpAAqhpAAowMigZ2tc/iVQaQAFMD3GxHpYBbXxzF/wGwzjW3fvwuQNWA2gASQDUHkABnEh4DqrOAa59zL4AbCHEWeEC43wtuK9YEMALX8OsAAAAASUVORK5CYII=";

    function instance$4($$self, $$props, $$invalidate) {
    	let $InspectorState;
    	component_subscribe($$self, InspectorState, $$value => $$invalidate(2, $InspectorState = $$value));
    	let { Applet } = $$props;
    	let { PositionAroundPreferredPosition } = $$props;
    	const click_handler = () => InspectorState.setMode("applet");
    	const click_handler_1 = () => InspectorState.setMode("master");
    	const click_handler_2 = () => InspectorState.setMode("card");
    	const click_handler_3 = () => InspectorState.setMode("overlay");
    	const click_handler_4 = () => InspectorState.setMode("component");
    	const click_handler_5 = () => InspectorState.setMode("import-export");
    	const click_handler_6 = () => InspectorState.setMode("search");
    	const click_handler_7 = () => InspectorState.setPane("overview");
    	const click_handler_8 = () => InspectorState.setPane("selection-globals");
    	const click_handler_9 = () => InspectorState.setPane("selection-resources");
    	const click_handler_10 = () => InspectorState.setPane("selection-properties");
    	const click_handler_11 = () => InspectorState.setPane("selection-configuration");
    	const click_handler_12 = () => InspectorState.setPane("selection-script");
    	const click_handler_13 = () => InspectorState.setPane("selection-contents");

    	function dialog_State_binding(value) {
    		$InspectorState = value;
    		InspectorState.set($InspectorState);
    	}

    	$$self.$$set = $$props => {
    		if ("Applet" in $$props) $$invalidate(0, Applet = $$props.Applet);
    		if ("PositionAroundPreferredPosition" in $$props) $$invalidate(1, PositionAroundPreferredPosition = $$props.PositionAroundPreferredPosition);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*Applet, $InspectorState*/ 5) {
    			if (Applet != null) {
    				// needs "$:"
    				if (isNaN($InspectorState.Width)) {
    					InspectorState.set({
    						isVisible: true,
    						Width: 300,
    						Height: 420,
    						Offset: { x: NaN, y: NaN }, // but let "Dialog" compute actual position
    						
    					});
    				}
    			}
    		}
    	};

    	return [
    		Applet,
    		PositionAroundPreferredPosition,
    		$InspectorState,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		click_handler_9,
    		click_handler_10,
    		click_handler_11,
    		click_handler_12,
    		click_handler_13,
    		dialog_State_binding
    	];
    }

    class InspectorView extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			Applet: 0,
    			PositionAroundPreferredPosition: 1
    		});
    	}
    }

    const initialNudgerState = {
        isVisible:false, Offset:{ x:NaN,y:NaN }, Width:NaN,Height:NaN
      };

      let currentlyChosenApplet$1 = undefined;
      let currentNudgerState    = Object.assign({}, initialNudgerState);

      const NudgerStateStore = writable(currentNudgerState);    // subscription mgmt.
      const NudgerStateSet   = new WeakMap();        // applet-specific Nudger states

    /**** keep track of changes in "chosenApplet" ****/

      chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
        if (currentlyChosenApplet$1 !== newChosenApplet) {
          currentlyChosenApplet$1 = newChosenApplet;

          if (currentlyChosenApplet$1 == null) {
            currentNudgerState = Object.assign({}, initialNudgerState);
          } else {
            if (NudgerStateSet.has(currentlyChosenApplet$1)) {
              currentNudgerState = NudgerStateSet.get(currentlyChosenApplet$1);
            } else {
              currentNudgerState = Object.assign({}, initialNudgerState);
              NudgerStateSet.set(currentlyChosenApplet$1,currentNudgerState);
            }
            NudgerStateStore.set(currentNudgerState);
          }
        }
      });

    /**** validate changes to "NudgerState" ****/

      function setNudgerState (newNudgerState) {
        if (currentlyChosenApplet$1 !== null) {
          if (webappTinkererRuntime.ValuesDiffer(currentNudgerState,newNudgerState)) {
            currentNudgerState = Object.assign({}, newNudgerState);
            NudgerStateSet.set(currentlyChosenApplet$1,newNudgerState);
            NudgerStateStore.set(newNudgerState);
          }
        }
      }

    /**** export an explicitly implemented store ****/

      const NudgerState = {
        subscribe: (Callback) => NudgerStateStore.subscribe(Callback),
        set:       setNudgerState
      };

    /* src/NudgerView.svelte generated by Svelte v3.38.3 */

    function create_if_block$2(ctx) {
    	let dialog;
    	let updating_State;
    	let current;

    	function dialog_State_binding(value) {
    		/*dialog_State_binding*/ ctx[3](value);
    	}

    	let dialog_props = {
    		class: "WAD-Nudger",
    		Applet: /*Applet*/ ctx[0],
    		Title: "WAT-Designer: Nudger",
    		resizable: false,
    		PositionAroundPreferredPosition: /*PositionAroundPreferredPosition*/ ctx[1],
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	};

    	if (/*$NudgerState*/ ctx[2] !== void 0) {
    		dialog_props.State = /*$NudgerState*/ ctx[2];
    	}

    	dialog = new Dialog({ props: dialog_props });
    	binding_callbacks.push(() => bind(dialog, "State", dialog_State_binding));

    	return {
    		c() {
    			create_component(dialog.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(dialog, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const dialog_changes = {};
    			if (dirty & /*Applet*/ 1) dialog_changes.Applet = /*Applet*/ ctx[0];
    			if (dirty & /*PositionAroundPreferredPosition*/ 2) dialog_changes.PositionAroundPreferredPosition = /*PositionAroundPreferredPosition*/ ctx[1];

    			if (dirty & /*$$scope*/ 16) {
    				dialog_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_State && dirty & /*$NudgerState*/ 4) {
    				updating_State = true;
    				dialog_changes.State = /*$NudgerState*/ ctx[2];
    				add_flush_callback(() => updating_State = false);
    			}

    			dialog.$set(dialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(dialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(dialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(dialog, detaching);
    		}
    	};
    }

    // (32:2) <Dialog class="WAD-Nudger" {Applet} Title="WAT-Designer: Nudger" resizable={false}     {PositionAroundPreferredPosition} bind:State={$NudgerState}   >
    function create_default_slot$1(ctx) {
    	let iconbutton0;
    	let t0;
    	let iconbutton1;
    	let t1;
    	let iconbutton2;
    	let t2;
    	let iconbutton3;
    	let t3;
    	let iconbutton4;
    	let t4;
    	let iconbutton5;
    	let t5;
    	let iconbutton6;
    	let t6;
    	let iconbutton7;
    	let current;

    	iconbutton0 = new IconButton({
    			props: {
    				style: "left:44px; top:4px",
    				ImageURL: MoveUpImageURL
    			}
    		});

    	iconbutton1 = new IconButton({
    			props: {
    				style: "left:4px;  top:44px",
    				ImageURL: MoveLeftImageURL
    			}
    		});

    	iconbutton2 = new IconButton({
    			props: {
    				style: "left:84px; top:44px",
    				ImageURL: MoveRightImageURL
    			}
    		});

    	iconbutton3 = new IconButton({
    			props: {
    				style: "left:44px; top:84px",
    				ImageURL: MoveDownImageURL
    			}
    		});

    	iconbutton4 = new IconButton({
    			props: {
    				style: "left:184px; top:4px",
    				ImageURL: DecreaseHeightImageURL
    			}
    		});

    	iconbutton5 = new IconButton({
    			props: {
    				style: "left:144px; top:44px",
    				ImageURL: DecreaseWidthImageURL
    			}
    		});

    	iconbutton6 = new IconButton({
    			props: {
    				style: "left:224px; top:44px",
    				ImageURL: IncreaseWidthImageURL
    			}
    		});

    	iconbutton7 = new IconButton({
    			props: {
    				style: "left:184px; top:84px",
    				ImageURL: IncreaseHeightImageURL
    			}
    		});

    	return {
    		c() {
    			create_component(iconbutton0.$$.fragment);
    			t0 = space();
    			create_component(iconbutton1.$$.fragment);
    			t1 = space();
    			create_component(iconbutton2.$$.fragment);
    			t2 = space();
    			create_component(iconbutton3.$$.fragment);
    			t3 = space();
    			create_component(iconbutton4.$$.fragment);
    			t4 = space();
    			create_component(iconbutton5.$$.fragment);
    			t5 = space();
    			create_component(iconbutton6.$$.fragment);
    			t6 = space();
    			create_component(iconbutton7.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(iconbutton0, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(iconbutton1, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(iconbutton2, target, anchor);
    			insert(target, t2, anchor);
    			mount_component(iconbutton3, target, anchor);
    			insert(target, t3, anchor);
    			mount_component(iconbutton4, target, anchor);
    			insert(target, t4, anchor);
    			mount_component(iconbutton5, target, anchor);
    			insert(target, t5, anchor);
    			mount_component(iconbutton6, target, anchor);
    			insert(target, t6, anchor);
    			mount_component(iconbutton7, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(iconbutton0.$$.fragment, local);
    			transition_in(iconbutton1.$$.fragment, local);
    			transition_in(iconbutton2.$$.fragment, local);
    			transition_in(iconbutton3.$$.fragment, local);
    			transition_in(iconbutton4.$$.fragment, local);
    			transition_in(iconbutton5.$$.fragment, local);
    			transition_in(iconbutton6.$$.fragment, local);
    			transition_in(iconbutton7.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(iconbutton0.$$.fragment, local);
    			transition_out(iconbutton1.$$.fragment, local);
    			transition_out(iconbutton2.$$.fragment, local);
    			transition_out(iconbutton3.$$.fragment, local);
    			transition_out(iconbutton4.$$.fragment, local);
    			transition_out(iconbutton5.$$.fragment, local);
    			transition_out(iconbutton6.$$.fragment, local);
    			transition_out(iconbutton7.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(iconbutton0, detaching);
    			if (detaching) detach(t0);
    			destroy_component(iconbutton1, detaching);
    			if (detaching) detach(t1);
    			destroy_component(iconbutton2, detaching);
    			if (detaching) detach(t2);
    			destroy_component(iconbutton3, detaching);
    			if (detaching) detach(t3);
    			destroy_component(iconbutton4, detaching);
    			if (detaching) detach(t4);
    			destroy_component(iconbutton5, detaching);
    			if (detaching) detach(t5);
    			destroy_component(iconbutton6, detaching);
    			if (detaching) detach(t6);
    			destroy_component(iconbutton7, detaching);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$NudgerState*/ ctx[2].isVisible && create_if_block$2(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*$NudgerState*/ ctx[2].isVisible) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$NudgerState*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }




    //import {  NudgerState } from './NudgerState.js'      // causes Svelte warnings
    /**** normal IconButton images as Data URLs ****/
    let MoveUpImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAh0lEQVRYR+3XQQqAMAxE0fa6PVCuq3TRjaBJpuhHiHuZ78MK9gZfHd5vFVAC/xYws2OeojGG/CDyjXMYDVjj6zuiKsgCaMB1fEdBEkAD7sZVhbQAGuCNKwopATQgOp5VCAugAdnxjEJIAA1Qx6MKrgAasDseUXgUwAO++Gdw34G3IyqgBHCBE0spSCFzAkqKAAAAAElFTkSuQmCC";

    let MoveLeftImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAiUlEQVRYR+3XSwqAMAxF0Xa7WVC2qzjIpBCa5ksljoV7+kDROYqvWdwfDegF/r0AIj7fUwYA7EFDFqAwPeJpgDWcBuDC4YBdOAwgDbsDTsNuAG3YDLCG7wfQCaxLuL2ItBA3gHYRd8ApJAwghYQDdpA0AAdJB6yQMoDknyPki0gSpnsa0AuUL/ACyt5IIUA+wvAAAAAASUVORK5CYII=";
    let MoveRightImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAhklEQVRYR+3Xyw3AIAwDUFg3A2XdVj3kWuVjk6oKA+AnoyDYq3nt5vw1gGng2w2o6vVMiYjQoK8bG8BGlQEJARiQFAAJKQEQEAigAoECMhAKIAKhAjyQfwM8FxelAU+wHQ8UEAmGAjLBEEAluARABKcAyOAQgBHsApz4M9CeWl78AKaB9gZuy2VIIQlnVq4AAAAASUVORK5CYII=";
    let MoveDownImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAiklEQVRYR+2Wuw3AIAwFYV0P5HUT0VEk/kt+hRnAvjuBxF7NZzfvXwMwBbALMPNT8UqI6FdULNAOcOyzEJL9ma/egXaATAXN3lQAAiACYbE3F4AA8EBY7V0FIAAsEB57dwEIAAnCax8qAAHwBRGxDxeAALghovapAhAAFb8l9T9QsUSaMQBToL3AC0spSCGCz338AAAAAElFTkSuQmCC";
    let DecreaseHeightImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAlElEQVRYR+2USw7AIAgF9bociOu2caEhjcXwMbDAtcRxeNBb8OnB77cCKAN5DCDio5kIADB9wlSsAf7WHAGGGesvOVAWgLblFsQvwC4TNyC2AFwgvSFyZ2CEJzSEUgDJLpmtdG1BAWg2Y94xDF1EU2XoKqYQ3tuPZuU4hppgSWoWgGSG6QNWO3kMSLR53i0DZSDcwAti40whmNIJqgAAAABJRU5ErkJggg==";
    let DecreaseWidthImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAjUlEQVRYR+2VUQrAIAxD9bo9UK+70UGhG2o3DbiP+Fsb42vQWjavuvn8QgMkQAIXAVU9RGSJxqwGDfyXwGimrRo0AyZm4ewFs1WHGXDxNwbiHjcQ+7OPzi54y8CX5ihuQhAD/ia4eDYCOAE/eGsGookRgWcNFsIsOL06DSwRmMWO6Fv6gmmABEiABBAETmT6sCHHOCicAAAAAElFTkSuQmCC";
    let IncreaseWidthImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAnklEQVRYR+2VYQrAIAiF67oeqOtuNBBaWDYzhPH212nvfWnmFPzl4PMTBIAACDwESikXEW3RsNb4v4BKhh87ifJxAmYBszuVYqP/TQI4adSYUtxNgKaYp6a/VxbQ5muLrhp89cCX5LZ4LeQiYOSudyJRchPQigjpAXYbOgVa80hxtymwHD7bJ9pUHX8JNUNbG1ArvhKHABAAARAIJ3ADzKXQIRXj3OkAAAAASUVORK5CYII=";
    let IncreaseHeightImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAnklEQVRYR+2VSw7AIAgF9boeyOu26UJDDEUf2GBSui46DB9zcv6y8/0pAMLAOQZqrZdmIkoppiRMwRrgMWYK8JixZimBigC0LF9BvAJwPYFCrCTAAkgNiUCoAWjNLD3wPwBkl7RSbh3DABgXjroJjxhD10XUVK4olPb8SvzWKdC8jlMAzaFITAdAZphegLwNHNg5BhBtO/8NA2HA3cANKa1sIQSaVB0AAAAASUVORK5CYII=";

    function instance$3($$self, $$props, $$invalidate) {
    	let $NudgerState;
    	component_subscribe($$self, NudgerState, $$value => $$invalidate(2, $NudgerState = $$value));
    	let { Applet } = $$props;
    	let { PositionAroundPreferredPosition } = $$props;

    	function dialog_State_binding(value) {
    		$NudgerState = value;
    		NudgerState.set($NudgerState);
    	}

    	$$self.$$set = $$props => {
    		if ("Applet" in $$props) $$invalidate(0, Applet = $$props.Applet);
    		if ("PositionAroundPreferredPosition" in $$props) $$invalidate(1, PositionAroundPreferredPosition = $$props.PositionAroundPreferredPosition);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*Applet, $NudgerState*/ 5) {
    			if (Applet != null) {
    				// needs "$:"
    				if (isNaN($NudgerState.Width)) {
    					NudgerState.set({
    						isVisible: true,
    						Width: 260,
    						Height: 148,
    						Offset: { x: NaN, y: NaN }, // but let "Dialog" compute actual position
    						
    					});
    				}
    			}
    		}
    	};

    	return [Applet, PositionAroundPreferredPosition, $NudgerState, dialog_State_binding];
    }

    class NudgerView extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			Applet: 0,
    			PositionAroundPreferredPosition: 1
    		});
    	}
    }

    const initialToolboxState = {
        isVisible:false, Offset:{ x:NaN,y:NaN }, Width:NaN,Height:NaN
      };

      let currentlyChosenApplet = undefined;
      let currentToolboxState   = Object.assign({}, initialToolboxState);

      const ToolboxStateStore = writable(currentToolboxState);   // subscription mgmt
      const ToolboxStateSet   = new WeakMap();      // applet-specific Toolbox states

    /**** keep track of changes in "chosenApplet" ****/

      chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
        if (currentlyChosenApplet !== newChosenApplet) {
          currentlyChosenApplet = newChosenApplet;

          if (currentlyChosenApplet == null) {
            currentToolboxState = Object.assign({}, initialToolboxState);
          } else {
            if (ToolboxStateSet.has(currentlyChosenApplet)) {
              currentToolboxState = ToolboxStateSet.get(currentlyChosenApplet);
            } else {
              currentToolboxState = Object.assign({}, initialToolboxState);
              ToolboxStateSet.set(currentlyChosenApplet,currentToolboxState);
            }
            ToolboxStateStore.set(currentToolboxState);
          }
        }
      });

    /**** validate changes to "ToolboxState" ****/

      function setToolboxState (newToolboxState) {
        if (currentlyChosenApplet !== null) {
          if (webappTinkererRuntime.ValuesDiffer(currentToolboxState,newToolboxState)) {
            currentToolboxState = Object.assign({}, newToolboxState);
            ToolboxStateSet.set(currentlyChosenApplet,newToolboxState);
            ToolboxStateStore.set(newToolboxState);
          }
        }
      }

    /**** export an explicitly implemented store ****/

      const ToolboxState = {
        subscribe: (Callback) => ToolboxStateStore.subscribe(Callback),
        set:       setToolboxState
      };

    /* src/ToolboxView.svelte generated by Svelte v3.38.3 */

    function create_if_block$1(ctx) {
    	let dialog;
    	let updating_State;
    	let current;

    	function dialog_State_binding(value) {
    		/*dialog_State_binding*/ ctx[8](value);
    	}

    	let dialog_props = {
    		class: "WAD-Toolbox",
    		Applet: /*Applet*/ ctx[0],
    		Title: "WAT-Designer",
    		resizable: false,
    		PositionAroundPreferredPosition: /*PositionAroundPreferredPosition*/ ctx[1],
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	if (/*$ToolboxState*/ ctx[2] !== void 0) {
    		dialog_props.State = /*$ToolboxState*/ ctx[2];
    	}

    	dialog = new Dialog({ props: dialog_props });
    	binding_callbacks.push(() => bind(dialog, "State", dialog_State_binding));
    	dialog.$on("close", /*onClose*/ ctx[5]);

    	return {
    		c() {
    			create_component(dialog.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(dialog, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const dialog_changes = {};
    			if (dirty & /*Applet*/ 1) dialog_changes.Applet = /*Applet*/ ctx[0];
    			if (dirty & /*PositionAroundPreferredPosition*/ 2) dialog_changes.PositionAroundPreferredPosition = /*PositionAroundPreferredPosition*/ ctx[1];

    			if (dirty & /*$$scope, $InspectorState, $NudgerState*/ 536) {
    				dialog_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_State && dirty & /*$ToolboxState*/ 4) {
    				updating_State = true;
    				dialog_changes.State = /*$ToolboxState*/ ctx[2];
    				add_flush_callback(() => updating_State = false);
    			}

    			dialog.$set(dialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(dialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(dialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(dialog, detaching);
    		}
    	};
    }

    // (63:2) <Dialog class="WAD-Toolbox" {Applet} Title="WAT-Designer" resizable={false}     {PositionAroundPreferredPosition} bind:State={$ToolboxState}     on:close={onClose}   >
    function create_default_slot(ctx) {
    	let iconbutton0;
    	let t0;
    	let iconbutton1;
    	let t1;
    	let iconbutton2;
    	let t2;
    	let iconbutton3;
    	let t3;
    	let iconbutton4;
    	let t4;
    	let iconbutton5;
    	let t5;
    	let iconbutton6;
    	let t6;
    	let iconbutton7;
    	let t7;
    	let iconbutton8;
    	let t8;
    	let iconbutton9;
    	let t9;
    	let iconbutton10;
    	let t10;
    	let iconbutton11;
    	let t11;
    	let iconbutton12;
    	let t12;
    	let iconbutton13;
    	let t13;
    	let iconbutton14;
    	let t14;
    	let iconbutton15;
    	let t15;
    	let iconbutton16;
    	let t16;
    	let iconbutton17;
    	let t17;
    	let iconbutton18;
    	let t18;
    	let iconbutton19;
    	let t19;
    	let iconbutton20;
    	let t20;
    	let iconbutton21;
    	let t21;
    	let iconbutton22;
    	let current;

    	iconbutton0 = new IconButton({
    			props: {
    				style: "left:4px;   top:4px",
    				ImageURL: LayouterImageURL
    			}
    		});

    	iconbutton1 = new IconButton({
    			props: {
    				style: "left:44px;  top:4px",
    				ImageURL: UnlockedImageURL,
    				activeURL: LockedImageURL
    			}
    		});

    	iconbutton2 = new IconButton({
    			props: {
    				style: "left:84px;  top:4px",
    				ImageURL: NudgerImageURL,
    				active: /*$NudgerState*/ ctx[3].isVisible
    			}
    		});

    	iconbutton2.$on("click", /*toggleNudgerView*/ ctx[6]);

    	iconbutton3 = new IconButton({
    			props: {
    				style: "left:124px; top:4px",
    				ImageURL: InspectorImageURL,
    				active: /*$InspectorState*/ ctx[4].isVisible
    			}
    		});

    	iconbutton3.$on("click", /*toggleInspectorView*/ ctx[7]);

    	iconbutton4 = new IconButton({
    			props: {
    				style: "left:4px;   top:44px",
    				ImageURL: UndoImageURL
    			}
    		});

    	iconbutton5 = new IconButton({
    			props: {
    				style: "left:44px;  top:44px",
    				ImageURL: RedoImageURL
    			}
    		});

    	iconbutton6 = new IconButton({
    			props: {
    				style: "left:84px;  top:44px",
    				ImageURL: SaveImageURL
    			}
    		});

    	iconbutton7 = new IconButton({
    			props: {
    				style: "left:124px; top:44px",
    				ImageURL: SettingsImageURL
    			}
    		});

    	iconbutton8 = new IconButton({
    			props: {
    				style: "left:4px;   top:84px",
    				ImageURL: CreateImageURL
    			}
    		});

    	iconbutton9 = new IconButton({
    			props: {
    				style: "left:44px;  top:84px",
    				ImageURL: DuplicateImageURL
    			}
    		});

    	iconbutton10 = new IconButton({
    			props: {
    				style: "left:124px; top:84px",
    				ImageURL: SnapToGridImageURL
    			}
    		});

    	iconbutton11 = new IconButton({
    			props: {
    				style: "left:4px;   top:124px",
    				ImageURL: CutImageURL
    			}
    		});

    	iconbutton12 = new IconButton({
    			props: {
    				style: "left:44px;  top:124px",
    				ImageURL: CopyImageURL
    			}
    		});

    	iconbutton13 = new IconButton({
    			props: {
    				style: "left:84px;  top:124px",
    				ImageURL: PasteImageURL
    			}
    		});

    	iconbutton14 = new IconButton({
    			props: {
    				style: "left:124px; top:124px",
    				ImageURL: DeleteImageURL
    			}
    		});

    	iconbutton15 = new IconButton({
    			props: {
    				style: "left:4px;   top:164px",
    				ImageURL: ToTopImageURL
    			}
    		});

    	iconbutton16 = new IconButton({
    			props: {
    				style: "left:44px;  top:164px",
    				ImageURL: UpImageURL
    			}
    		});

    	iconbutton17 = new IconButton({
    			props: {
    				style: "left:84px;  top:164px",
    				ImageURL: DownImageURL
    			}
    		});

    	iconbutton18 = new IconButton({
    			props: {
    				style: "left:124px; top:164px",
    				ImageURL: ToBottomImageURL
    			}
    		});

    	iconbutton19 = new IconButton({
    			props: {
    				style: "left:4px;   top:204px",
    				ImageURL: ChooseContainerImageURL
    			}
    		});

    	iconbutton20 = new IconButton({
    			props: {
    				style: "left:44px;  top:204px",
    				ImageURL: ChooseContentImageURL
    			}
    		});

    	iconbutton21 = new IconButton({
    			props: {
    				style: "left:84px;  top:204px",
    				ImageURL: ImportExportImageURL
    			}
    		});

    	iconbutton22 = new IconButton({
    			props: {
    				style: "left:124px; top:204px",
    				ImageURL: SearchImageURL
    			}
    		});

    	return {
    		c() {
    			create_component(iconbutton0.$$.fragment);
    			t0 = space();
    			create_component(iconbutton1.$$.fragment);
    			t1 = space();
    			create_component(iconbutton2.$$.fragment);
    			t2 = space();
    			create_component(iconbutton3.$$.fragment);
    			t3 = space();
    			create_component(iconbutton4.$$.fragment);
    			t4 = space();
    			create_component(iconbutton5.$$.fragment);
    			t5 = space();
    			create_component(iconbutton6.$$.fragment);
    			t6 = space();
    			create_component(iconbutton7.$$.fragment);
    			t7 = space();
    			create_component(iconbutton8.$$.fragment);
    			t8 = space();
    			create_component(iconbutton9.$$.fragment);
    			t9 = space();
    			create_component(iconbutton10.$$.fragment);
    			t10 = space();
    			create_component(iconbutton11.$$.fragment);
    			t11 = space();
    			create_component(iconbutton12.$$.fragment);
    			t12 = space();
    			create_component(iconbutton13.$$.fragment);
    			t13 = space();
    			create_component(iconbutton14.$$.fragment);
    			t14 = space();
    			create_component(iconbutton15.$$.fragment);
    			t15 = space();
    			create_component(iconbutton16.$$.fragment);
    			t16 = space();
    			create_component(iconbutton17.$$.fragment);
    			t17 = space();
    			create_component(iconbutton18.$$.fragment);
    			t18 = space();
    			create_component(iconbutton19.$$.fragment);
    			t19 = space();
    			create_component(iconbutton20.$$.fragment);
    			t20 = space();
    			create_component(iconbutton21.$$.fragment);
    			t21 = space();
    			create_component(iconbutton22.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(iconbutton0, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(iconbutton1, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(iconbutton2, target, anchor);
    			insert(target, t2, anchor);
    			mount_component(iconbutton3, target, anchor);
    			insert(target, t3, anchor);
    			mount_component(iconbutton4, target, anchor);
    			insert(target, t4, anchor);
    			mount_component(iconbutton5, target, anchor);
    			insert(target, t5, anchor);
    			mount_component(iconbutton6, target, anchor);
    			insert(target, t6, anchor);
    			mount_component(iconbutton7, target, anchor);
    			insert(target, t7, anchor);
    			mount_component(iconbutton8, target, anchor);
    			insert(target, t8, anchor);
    			mount_component(iconbutton9, target, anchor);
    			insert(target, t9, anchor);
    			mount_component(iconbutton10, target, anchor);
    			insert(target, t10, anchor);
    			mount_component(iconbutton11, target, anchor);
    			insert(target, t11, anchor);
    			mount_component(iconbutton12, target, anchor);
    			insert(target, t12, anchor);
    			mount_component(iconbutton13, target, anchor);
    			insert(target, t13, anchor);
    			mount_component(iconbutton14, target, anchor);
    			insert(target, t14, anchor);
    			mount_component(iconbutton15, target, anchor);
    			insert(target, t15, anchor);
    			mount_component(iconbutton16, target, anchor);
    			insert(target, t16, anchor);
    			mount_component(iconbutton17, target, anchor);
    			insert(target, t17, anchor);
    			mount_component(iconbutton18, target, anchor);
    			insert(target, t18, anchor);
    			mount_component(iconbutton19, target, anchor);
    			insert(target, t19, anchor);
    			mount_component(iconbutton20, target, anchor);
    			insert(target, t20, anchor);
    			mount_component(iconbutton21, target, anchor);
    			insert(target, t21, anchor);
    			mount_component(iconbutton22, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const iconbutton2_changes = {};
    			if (dirty & /*$NudgerState*/ 8) iconbutton2_changes.active = /*$NudgerState*/ ctx[3].isVisible;
    			iconbutton2.$set(iconbutton2_changes);
    			const iconbutton3_changes = {};
    			if (dirty & /*$InspectorState*/ 16) iconbutton3_changes.active = /*$InspectorState*/ ctx[4].isVisible;
    			iconbutton3.$set(iconbutton3_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(iconbutton0.$$.fragment, local);
    			transition_in(iconbutton1.$$.fragment, local);
    			transition_in(iconbutton2.$$.fragment, local);
    			transition_in(iconbutton3.$$.fragment, local);
    			transition_in(iconbutton4.$$.fragment, local);
    			transition_in(iconbutton5.$$.fragment, local);
    			transition_in(iconbutton6.$$.fragment, local);
    			transition_in(iconbutton7.$$.fragment, local);
    			transition_in(iconbutton8.$$.fragment, local);
    			transition_in(iconbutton9.$$.fragment, local);
    			transition_in(iconbutton10.$$.fragment, local);
    			transition_in(iconbutton11.$$.fragment, local);
    			transition_in(iconbutton12.$$.fragment, local);
    			transition_in(iconbutton13.$$.fragment, local);
    			transition_in(iconbutton14.$$.fragment, local);
    			transition_in(iconbutton15.$$.fragment, local);
    			transition_in(iconbutton16.$$.fragment, local);
    			transition_in(iconbutton17.$$.fragment, local);
    			transition_in(iconbutton18.$$.fragment, local);
    			transition_in(iconbutton19.$$.fragment, local);
    			transition_in(iconbutton20.$$.fragment, local);
    			transition_in(iconbutton21.$$.fragment, local);
    			transition_in(iconbutton22.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(iconbutton0.$$.fragment, local);
    			transition_out(iconbutton1.$$.fragment, local);
    			transition_out(iconbutton2.$$.fragment, local);
    			transition_out(iconbutton3.$$.fragment, local);
    			transition_out(iconbutton4.$$.fragment, local);
    			transition_out(iconbutton5.$$.fragment, local);
    			transition_out(iconbutton6.$$.fragment, local);
    			transition_out(iconbutton7.$$.fragment, local);
    			transition_out(iconbutton8.$$.fragment, local);
    			transition_out(iconbutton9.$$.fragment, local);
    			transition_out(iconbutton10.$$.fragment, local);
    			transition_out(iconbutton11.$$.fragment, local);
    			transition_out(iconbutton12.$$.fragment, local);
    			transition_out(iconbutton13.$$.fragment, local);
    			transition_out(iconbutton14.$$.fragment, local);
    			transition_out(iconbutton15.$$.fragment, local);
    			transition_out(iconbutton16.$$.fragment, local);
    			transition_out(iconbutton17.$$.fragment, local);
    			transition_out(iconbutton18.$$.fragment, local);
    			transition_out(iconbutton19.$$.fragment, local);
    			transition_out(iconbutton20.$$.fragment, local);
    			transition_out(iconbutton21.$$.fragment, local);
    			transition_out(iconbutton22.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(iconbutton0, detaching);
    			if (detaching) detach(t0);
    			destroy_component(iconbutton1, detaching);
    			if (detaching) detach(t1);
    			destroy_component(iconbutton2, detaching);
    			if (detaching) detach(t2);
    			destroy_component(iconbutton3, detaching);
    			if (detaching) detach(t3);
    			destroy_component(iconbutton4, detaching);
    			if (detaching) detach(t4);
    			destroy_component(iconbutton5, detaching);
    			if (detaching) detach(t5);
    			destroy_component(iconbutton6, detaching);
    			if (detaching) detach(t6);
    			destroy_component(iconbutton7, detaching);
    			if (detaching) detach(t7);
    			destroy_component(iconbutton8, detaching);
    			if (detaching) detach(t8);
    			destroy_component(iconbutton9, detaching);
    			if (detaching) detach(t9);
    			destroy_component(iconbutton10, detaching);
    			if (detaching) detach(t10);
    			destroy_component(iconbutton11, detaching);
    			if (detaching) detach(t11);
    			destroy_component(iconbutton12, detaching);
    			if (detaching) detach(t12);
    			destroy_component(iconbutton13, detaching);
    			if (detaching) detach(t13);
    			destroy_component(iconbutton14, detaching);
    			if (detaching) detach(t14);
    			destroy_component(iconbutton15, detaching);
    			if (detaching) detach(t15);
    			destroy_component(iconbutton16, detaching);
    			if (detaching) detach(t16);
    			destroy_component(iconbutton17, detaching);
    			if (detaching) detach(t17);
    			destroy_component(iconbutton18, detaching);
    			if (detaching) detach(t18);
    			destroy_component(iconbutton19, detaching);
    			if (detaching) detach(t19);
    			destroy_component(iconbutton20, detaching);
    			if (detaching) detach(t20);
    			destroy_component(iconbutton21, detaching);
    			if (detaching) detach(t21);
    			destroy_component(iconbutton22, detaching);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$ToolboxState*/ ctx[2].isVisible && create_if_block$1(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*$ToolboxState*/ ctx[2].isVisible) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$ToolboxState*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }




    /**** normal IconButton images as Data URLs ****/
    let LayouterImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABA0lEQVRYR82WSw6EMAxD4bo9UK/LiAWjTCYfO6lUWEKwX01ocx6br3Oz/0EDzDmvCHqMQWlCxZmpB4TApADaPBNl610AVkingL5vAsiXsxVnTZxphQBd8wfugbD0/gCi4my10lCbebo/AFlcCICn4d03AarRW7+r1LJSWAYgxb24Q4DOt0fMvYb8JlAFYMxvCO3TAmDNlwJUzJcBVM2XAHTM2wBd8xbACvMQwHqo/125FVd2y/JOiJ7t2VkBA9xC1h6u72eG8jl0GEWfgTGzaqHjGBkgKiDUQCJT6ERuNTA0EXmdz3Y92rjvHcu9DmZ6AEktTUAbWmNXZ4OiAZgEkNrtAB9tuDAwYD8R4wAAAABJRU5ErkJggg==";

    let LockedImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAmUlEQVRYR+2VSw7AIAhE9bocyOu2cWFCjJYZXFAT3MrnMSjUEnxqcP6SAHcq0Fp75rcjIq5iKKdV4lMQGEAnX1Vr3e9+GwSABkftNAwFgPR5QCC2HcQEYAP2oIxPAvxXAeTPo4vs60FuFUgASwEtK2M7t83VAmsUM/vhToBeYWgLEiAVQEfwsLtzFLNVeu3NdewNjPolQLgCL7lKlCGMKV/iAAAAAElFTkSuQmCC";
    let UnlockedImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAnklEQVRYR+2WSwrAIAxE9boeKNdtcSGIaDMTKUGJ2+bzMlOiOTmf7Nw/mQBE5BnBSymmWlTSrPEuCAzQN59Nq31fWQ0BoMXRuB6GAkB8bhBIbAVRAdiCtSiTcycAs1t+USAA7lAAWbvopF87YfkTBoCmQC8rEzvaZrJAuw2ZK/pMgDqhqwUBEAqgK7jFnbmK2Smt8eqLyFoYzQsAdwVeyNKYIaHO7AQAAAAASUVORK5CYII=";
    let NudgerImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAo0lEQVRYR+2WUQ7AIAhD9boeiOtu8YPEmG1CIUEX9g32WYuuluCvBuuXBEgHTA4Q0dVD3FqD14Ebu3AoAIvzGKMuwA6EAsziFhcgB8IBPK9vsQPSxEvreBNLAG3YtPWvAOg5a/v2BeAz0lqqrV9mYAZZ3XjuIfQcuae1xA6MzdqgfW3iTIDxKba8A70XcmALgPAfki0APEYUzoCHuCmECfAbB26pGWAhx+HZtAAAAABJRU5ErkJggg==";
    let InspectorImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA6UlEQVRYR+2WSw6AIAxE9bociOtqWDTBSjvTotEF7gyh8zr9hH37+Ns/1t8WwHIg5UCt9Rg1byklHC90wRLWMBEQGmAkLkLeGRpzCgBZjs49CAjQB9cZo/8mjMrhAujMkKBVEg9iAZgOMF2PStI3n1WGKQBr/iNjGQJAM+2d0w6w2y4Lo0EuDrwtLtA9xK0Eb0O4DmRtnbnnNiFao6xwc5VuQgnqXWKFmVhwFc+6gBL5N0CzEGXglYO5C98DWQhGvMWmAASCeWDIHmF7hwboO3oEEhWWeGEADTJar5ExTQNERKYepU8JWXFOXsLIIZeR3YwAAAAASUVORK5CYII=";
    let UndoImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAz0lEQVRYR+2WUQrAIAxD53U9kNfd8KNQRG0a3crA/Y1p85ZUbLqCnxSsfx2ALQ6UUu6cM1WL2qT7porX9xAAEQ8B0OKfA7TiEgkTA9UDIwAGhAKoQr0ImFhogBZC2+9pziUADdHmjx7PZQCB6DUgArEFYHShhQPMIhLoVx34NwCSHzLMWHWGEVgbEfGlCMIBEHrLBeQnpqcAKTCDQPabxxAp0oNA98EAnqFj+2WEXrPoOu2Y6UBvALWazzMZuQBEOHwksxzwfKcc8AhYaw/AA7TnkCErkZMFAAAAAElFTkSuQmCC";
    let RedoImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAwklEQVRYR+2WSw7AIAhE63U9kNdtw4LEEHX4+OnCLm1wHkMA03P4S4f1nwvgdqCU8uac3fFcevcFBECXRCHCAFGIKQARCBcA2y9b2FMOE0BPmEGWAUhhEmqdeYYadKAWqjPsnVsh1ADS3i1tOBLZMohmZTkqS7cEO8QJ7AIsdwCV8gIMBxGyD009Tfy/AShDTRYtJ7Rx6l1geXRYFhUEqF1Ae9+zolUALIweJAiwVSoTAAJZ9iJC7Rb573IgIihjL8AHRW6QIYYSsiYAAAAASUVORK5CYII=";
    let SaveImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAoUlEQVRYR+2W2w6AIAhA9Xf9IH+3xoObYwl4YVDRW4vwcJQiJ+MrG6+fAiAM+DVQa712OqSUIipuGIQBqIQttsXge6oQVQBYmDOhDsBBfAMA7/HM+REb0OoI/wDcKabMSNqRNeAGoD9YACWpThLzHgMrXXDUQJ/sqc/xFgHwUQBzA/8FWKkcv0N9S8ipZXcq4n7F8Fw0Np2wMMoRAGHA3MAN5uOoIQ8aGmQAAAAASUVORK5CYII=";
    let SettingsImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAApklEQVRYR+1WQQ6AIAyD7/IgvqvhQLJMsNsk4KHejKOt7ZzL6fCVD/MnCgg7UGu9enyllDCO+aAmRPfW3goJQOAeR14FyLdEpLPnSAwFDB1YYb2OZBYFBUybEMUgLfXU6mgeAhBYAxjlGT1HAf/rgZaxJU/vaOYccDnQ7V0RBf+GnxyQne6JA5FK3NBK1gi274T6u9++FXsHj7XeHIEV0FtHAccduAHWc4AhlpaqkQAAAABJRU5ErkJggg==";
    let CreateImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAYUlEQVRYR+2WyQ0AIAgEpV0Kol1tQELWh2gyfj0YJ27QRvOw5voDAAz8ZyAi5i457n50GXkTABi4ZiArpPaOKh1pCgDAQLuB7LVfiyEAGHjWgNoLqvXyj6g6UJ0HAAPtBhZrOEghA+jrggAAAABJRU5ErkJggg==";
    let DuplicateImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAtElEQVRYR+2VUQ7AIAhD9boeyOtu8YOEbTJQS1gW9+vEZws1p+AvB5+fNsBDgVrrYbGllAJR71KkHW4tzP/l0Nb9dEk4ABW2gkAAuGWjasABGgxBWFRwARiB+BeANsI9S+AKSBBSP8ABuP+WkXQBmG7CHr0Uy5YRs0Q6JM9XwCEAs29IA/8vgBTHd7XcFAgD0ILIXYFwAJr9MAs+AyCloHsPaPHrAhAexdqt39YhQbQBVhQ4AVM68CG5nMXXAAAAAElFTkSuQmCC";

    //let ImageURL = ''
    let SnapToGridImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAArklEQVRYR+1WQQ7AIAjT7/ogv7vFAwkxaquZk2zstghY24LGcPiLh/cPDgAykHO+UkrNuNU1LbsDgAzs7hIIYFXnUZ5NDxTEgqy4fvSPZEH5uqugBGUzDQZtrg/BxEIANROo6Gw8DaA3jFqABASTYwcAMh1zGmGj9kzLlBJrh4GeuWb0rBlgWKMZKMWZgo93wWtzwOwk/M9lhEbsrnWqC/xNeJSBXdrTd4ED+DwDNzGk6CEizJfHAAAAAElFTkSuQmCC";

    let CutImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA7UlEQVRYR+2WXQ7EIAiE2+t6IK+7Gx9IKBFm0Bq3zfa1CJ/Dn+ex+Ts3xz9uB6i1fkoptF/akFFKgmcg3gHQbuwphNIxrUAUXKAiiCEAJiirSBrAFhgDoxWw558PwLSntrldgT/ATyogndHrf1gDTFu1W3vDxZ63diFAZon0bD14eg7MACDlBGKpAlKQwzUwo4AdNl6d0AqgfHqw0e0b1FIADR11if53WUajKUCtR++CWQD0+kmlAI3YDOxyBRAsDSASMQ4ZuXt+4C5AwUel10PK7QIUvFdEzJlUChiHaO5HPmzq0o9SBjBjsx3gC2HxLDBU8TlfAAAAAElFTkSuQmCC";
    let CopyImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA20lEQVRYR+2WSw7AIAhE7XU9kNdt44LEEoVBSmxNu/XDcxigR1r8HYvjp8cBSilnzhm+F96IKEXBLRB7ANQXjxTS0uFWQApOUBLEFAASFFXEDMANhsC0CvDz3wdAyrPd87gCP8ArFaDK6NW/6gGkrOqrR82Fn+f7RADLEOntHcHDfcADoClHEKEKkCGnPeBRgDebkU/CFZBeX6FCAVofSFXSrt2G0WwKtNKDZ4EXQPv7CU8B0pZDPeAGIImQixC5e/eos0ALbvHJngCWNPUU4Kkz/5RqKbKuLwe4ABMeJDCe+pJbAAAAAElFTkSuQmCC";
    let PasteImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA50lEQVRYR+2XQRaDMAhE9bo5UK7bvix4j1KIM5ZIFu3SRvgMjOh5FP/O4vwHBdB7f7XWqHuuCoSDSfJsiP0BRsWRjBntmCowSy5Qv0J8ASBJMxX5ALADhsBoBe4M6N4AVx62/6cr8AcoVUAcwPg8dQZYAMSyQ1FbUGhDBoCp3J6lAbxkSwCGXJ4K0TUrbaQgrIAG0L3TvZakkSpezykAC+HZckDooNEwRrDTXaATzgI/AiAwj7fAWzi2t0tnANl4y2yI7oJyAMQt0Tsk7AJEDUYJibcXACNl9FBClNJn4C8jNjB6vhzgDQIzTDDVGLxnAAAAAElFTkSuQmCC";
    let DeleteImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAT0lEQVRYR+3VwQ0AIAhDUVi3A3VdnUDDgQQO36sGy0vQjOGVw/cHARBAAAEE9grYPh3/hKRvk89NAiAwLtAxAZUae9+BSvqOMwgggAACCFwbXBghpjcrJwAAAABJRU5ErkJggg==";
    let ToTopImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAfElEQVRYR+2VQQoAIQwD9bt9UL/rsgcvgjYpQhHiVSHDmGpvxasX5zcByMDRgLuPGyU1s22OAN4u4ezI6Y6jDqUNrAXNQqQAdtORgaABotFkISiAKHzeNwMBA6DhLAQMsLa5tIQ/jABkQAZkIPpm0f30S4gGROcEIAPlBj7GtEgh19O+fAAAAABJRU5ErkJggg==";
    let UpImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAbklEQVRYR+2WQQoAIQzE9Lt9UL/r4sGLsNjOCmUh3iUxSLW34tWL+Q0BClDg3wXcfcw5YmbyQeSNC74GmSohCezwLxJpgTe4KpESOMEVibBAFJ6VCAvsr2bpJZwyCFCAAhS49Z2XJyECFKDArQIPSvI8IYSMDKYAAAAASUVORK5CYII=";
    let DownImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAd0lEQVRYR+2WQQ6AIAwE4bt9UL+r4UBCiBF2L5g4XAnudCzVWg6veji/AIABDNgGMvMar3BEWM+yDrVgADCAgf8ZmCte/UfsDiZpEO1C7Ia3IiSApwk4m1DCLYA3CDXcBvjEt2CEcCrvr07ugVX3q/sAYAADGLgBiLQ8IQWkMTAAAAAASUVORK5CYII=";
    let ToBottomImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAg0lEQVRYR+2VUQoAIQhE67oeyOvu0sdCRKgjQS1NvxHzfJnVsnnVzfmFADTwXwOq+vQvSERSxaQOtWAC0AAN3GdgrNj7xqODCRpEUYhoeCsCAphNwNEEEp4CsCDQ8DTAEX9BD5Gp/Ls6uAe87kf3TYBo13uhliECnN0D3t2u2KcBGngBrgBIIbNZDX8AAAAASUVORK5CYII=";
    let ChooseContainerImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAn0lEQVRYR+3WQQrAIAwEQP2uD/K7LR4EkWiyoboU0mvFHZIo5kT+Mjk/BeCfFai1PqWUT/DwJi28DS4F0MMpgDH8OmAOvwqQwleXl2cutkOIhI8oBHIEgLRIPYbeKlgRKqBtZBlCyxppdkwACSH12YMwA2bEatDQ+wICjAgaoCOogN0r6ngLtCdcAKICUQF6BbRjOv+Hr2I0QFsfAHoFXqYLbCHp/EtEAAAAAElFTkSuQmCC";
    let ChooseContentImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAmUlEQVRYR+3X3QqAIAwFYH3dPdBet/BCiLD9nA00WPe1b0en1Nvmp2+u3wpQCZydADNf0pQQUbgB8QMaYOIikBTAgKCINACKgNdwtTxICjBgdJyBCAFWCG8KBagE/pWA9Wh+3x/SZLgT8CK0sXQDvg6g1a2pFR/vQAALwlI8BJAQ1uJhwBFH8RPh6XzuGXgPZP3QFKAS2J7ADQIZTCGjWjAzAAAAAElFTkSuQmCC";
    let ImportExportImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA0klEQVRYR+2VYQ6AIAiF67oeyOvWbKPRExCdaW32p5qO94Hw3LfJzz5Zf1sA/61AjPEIIVwJpO/0pv+avmqqAAoOBSAxnvEwAC4+HADFhwJI4p8EwO73TEXXKeAAHvG0XwWQup0EtDGkdfQHyyNEAG4ykqlYAFrmWswMAB1OClhjRKV4D4BS5tYReM8cNW4Ayc28QJb3YwzUMQFqLhXv3iqAKRXAUfJmVtqn3SPZEZQC9Vqnps2moJeAFYdPjGpEb4BIo9p0F/SEWwCrAqsC0ytwArCqxCFYK1feAAAAAElFTkSuQmCC";
    let SearchImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA00lEQVRYR+2WQRKAIAgA87s+yO/WcHCGEBAV8WKnmqxdkKD0HD7SYf7jLlBKeWlQOWeR4ybAgS0iLgIYzkWr3V8W6MFrFqR1bgLaPlMJvHZJoEZlgUsSV+BmYCkDUFi0EOFaKkquaN0EQKaCuW/etQ9obXd7J8Rp5M616crJDW0Bt9849bgmsIjLNJSKTSs6y7+GKQO74CDYFdgJ7wrshqsCEXBRIArOCkTCG4Fo+E/gBLwRwMMEzlebzFAjotMqAi7WAO3vlkhm13Q74eyLrc9dgQ9itQQwkRB2awAAAABJRU5ErkJggg==";

    function instance$2($$self, $$props, $$invalidate) {
    	let $ToolboxState;
    	let $NudgerState;
    	let $InspectorState;
    	component_subscribe($$self, ToolboxState, $$value => $$invalidate(2, $ToolboxState = $$value));
    	component_subscribe($$self, NudgerState, $$value => $$invalidate(3, $NudgerState = $$value));
    	component_subscribe($$self, InspectorState, $$value => $$invalidate(4, $InspectorState = $$value));
    	let { Applet } = $$props;
    	let { PositionAroundPreferredPosition } = $$props;

    	function onClose() {
    		let currentToolboxState = $ToolboxState;
    		ToolboxState.set(Object.assign(Object.assign({}, currentToolboxState), { isVisible: true })); // because...
    		chosenApplet.set(undefined); // ..."chosenApplet" decides about visibility
    	}

    	function toggleNudgerView() {
    		let currentState = $NudgerState;
    		NudgerState.set(Object.assign(Object.assign({}, currentState), { isVisible: !currentState.isVisible }));
    	}

    	function toggleInspectorView() {
    		let currentState = $InspectorState;
    		InspectorState.set(Object.assign(Object.assign({}, currentState), { isVisible: !currentState.isVisible }));
    	}

    	function dialog_State_binding(value) {
    		$ToolboxState = value;
    		ToolboxState.set($ToolboxState);
    	}

    	$$self.$$set = $$props => {
    		if ("Applet" in $$props) $$invalidate(0, Applet = $$props.Applet);
    		if ("PositionAroundPreferredPosition" in $$props) $$invalidate(1, PositionAroundPreferredPosition = $$props.PositionAroundPreferredPosition);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*Applet, $ToolboxState*/ 5) {
    			if (Applet != null) {
    				// needs "$:"
    				if (isNaN($ToolboxState.Width)) {
    					ToolboxState.set({
    						isVisible: true,
    						Width: 160,
    						Height: 264,
    						Offset: { x: NaN, y: NaN }, // but let "Dialog" compute actual position
    						
    					});
    				}
    			}
    		}
    	};

    	return [
    		Applet,
    		PositionAroundPreferredPosition,
    		$ToolboxState,
    		$NudgerState,
    		$InspectorState,
    		onClose,
    		toggleNudgerView,
    		toggleInspectorView,
    		dialog_State_binding
    	];
    }

    class ToolboxView extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			Applet: 0,
    			PositionAroundPreferredPosition: 1
    		});
    	}
    }

    var css_248z$1 = ".WAD-DesignerButton.svelte-vi4zzc{display:block;position:absolute;width:32px;height:32px;cursor:pointer;pointer-events:auto}";
    styleInject(css_248z$1,{"insertAt":"top"});

    /* src/DesignerButton.svelte generated by Svelte v3.38.3 */

    function create_fragment$1(ctx) {
    	let div;
    	let iconbutton;
    	let current;
    	let mounted;
    	let dispose;
    	iconbutton = new IconButton({ props: { ImageURL } });

    	return {
    		c() {
    			div = element("div");
    			create_component(iconbutton.$$.fragment);
    			attr(div, "class", "WAD-DesignerButton svelte-vi4zzc");
    			set_style(div, "left", /*Applet*/ ctx[0].x + /*Offset*/ ctx[1].x + "px");
    			set_style(div, "top", /*Applet*/ ctx[0].y + /*Offset*/ ctx[1].y + "px\n");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(iconbutton, div, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(asDraggable.call(null, div, {
    						onDragStart: /*onDragStart*/ ctx[2],
    						onDragMove: /*onDragMove*/ ctx[3]
    					})),
    					listen(div, "click", /*onClick*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*Applet, Offset*/ 3) {
    				set_style(div, "left", /*Applet*/ ctx[0].x + /*Offset*/ ctx[1].x + "px");
    			}

    			if (!current || dirty & /*Applet, Offset*/ 3) {
    				set_style(div, "top", /*Applet*/ ctx[0].y + /*Offset*/ ctx[1].y + "px\n");
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(iconbutton.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(iconbutton.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(iconbutton);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }



    /**** normal DesignerButton image as Data URL ****/
    let ImageURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABA0lEQVRYR82WSw6EMAxD4bo9UK/LiAWjTCYfO6lUWEKwX01ocx6br3Oz/0EDzDmvCHqMQWlCxZmpB4TApADaPBNl610AVkingL5vAsiXsxVnTZxphQBd8wfugbD0/gCi4my10lCbebo/AFlcCICn4d03AarRW7+r1LJSWAYgxb24Q4DOt0fMvYb8JlAFYMxvCO3TAmDNlwJUzJcBVM2XAHTM2wBd8xbACvMQwHqo/125FVd2y/JOiJ7t2VkBA9xC1h6u72eG8jl0GEWfgTGzaqHjGBkgKiDUQCJT6ERuNTA0EXmdz3Y92rjvHcu9DmZ6AEktTUAbWmNXZ4OiAZgEkNrtAB9tuDAwYD8R4wAAAABJRU5ErkJggg==";

    /**** keep track of every Applet's DesignerButton position ****/
    let ButtonOffset = new WeakMap();

    function instance$1($$self, $$props, $$invalidate) {
    	let { Applet } = $$props;
    	let { startDesigning } = $$props;
    	let { preferredPosition } = $$props;
    	let Offset;

    	if (Applet != null) {
    		Offset = ButtonOffset.get(Applet) || { x: Applet.Width - 32 - 2, y: 2 };
    		ButtonOffset.set(Applet, Offset); // reactive statement!
    	}

    	/**** Event Handling ****/
    	function onDragStart() {
    		return Offset;
    	}

    	function onDragMove(x, y) {
    		$$invalidate(1, Offset = { x, y });
    	}

    	function onClick(Event) {
    		$$invalidate(5, preferredPosition = { x: Event.clientX, y: Event.clientY });
    		startDesigning(Applet);
    	}

    	$$self.$$set = $$props => {
    		if ("Applet" in $$props) $$invalidate(0, Applet = $$props.Applet);
    		if ("startDesigning" in $$props) $$invalidate(6, startDesigning = $$props.startDesigning);
    		if ("preferredPosition" in $$props) $$invalidate(5, preferredPosition = $$props.preferredPosition);
    	};

    	return [
    		Applet,
    		Offset,
    		onDragStart,
    		onDragMove,
    		onClick,
    		preferredPosition,
    		startDesigning
    	];
    }

    class DesignerButton extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			Applet: 0,
    			startDesigning: 6,
    			preferredPosition: 5
    		});
    	}
    }

    //----------------------------------------------------------------------------//
    //                           Svelte Touch-to-Mouse                            //
    //----------------------------------------------------------------------------//
    // see https://stackoverflow.com/questions/1517924/javascript-mapping-touch-events-to-mouse-events
    // and https://stackoverflow.com/questions/5885808/includes-touch-events-clientx-y-scrolling-or-not
    // Important!
    // for all elements affected by "mapTouchToMouseFor" (i.e., for all elements
    // selected by "Selector"), don't forget to set the following style properties
    //
    // -webkit-touch-callout:none;
    // -ms-touch-action: none; touch-action: none;
    //
    // either in a stylesheet or inline
    function mapTouchToMouseFor(Selector) {
        function TouchEventMapper(originalEvent) {
            var Target = originalEvent.target;
            if (!Target.matches(Selector)) {
                return;
            }
            var simulatedEventType;
            switch (originalEvent.type) {
                case 'touchstart':
                    simulatedEventType = 'mousedown';
                    break;
                case 'touchmove':
                    simulatedEventType = 'mousemove';
                    break;
                case 'touchend':
                    simulatedEventType = 'mouseup';
                    break;
                case 'touchcancel':
                    simulatedEventType = 'mouseup';
                    break;
                default: return;
            }
            var firstTouch = originalEvent.changedTouches[0];
            var clientX = firstTouch.clientX, pageX = firstTouch.pageX, PageXOffset = window.pageXOffset;
            var clientY = firstTouch.clientY, pageY = firstTouch.pageY, PageYOffset = window.pageYOffset;
            if ((pageX === 0) && (Math.floor(clientX) > Math.floor(pageX)) ||
                (pageY === 0) && (Math.floor(clientY) > Math.floor(pageY))) {
                clientX -= PageXOffset;
                clientY -= PageYOffset;
            }
            else if ((clientX < pageX - PageXOffset) || (clientY < pageY - PageYOffset)) {
                clientX = pageX - PageXOffset;
                clientY = pageY - PageYOffset;
            }
            var simulatedEvent = new MouseEvent(simulatedEventType, {
                bubbles: true, cancelable: true,
                screenX: firstTouch.screenX, screenY: firstTouch.screenY,
                // @ts-ignore we definitely want "pageX" and "pageY"
                clientX: clientX, clientY: clientY, pageX: pageX, pageY: pageY, buttons: 1, button: 0,
                ctrlKey: originalEvent.ctrlKey, shiftKey: originalEvent.shiftKey,
                altKey: originalEvent.altKey, metaKey: originalEvent.metaKey
            });
            firstTouch.target.dispatchEvent(simulatedEvent);
            //    originalEvent.preventDefault()
        }
        document.addEventListener('touchstart', TouchEventMapper, true);
        document.addEventListener('touchmove', TouchEventMapper, true);
        document.addEventListener('touchend', TouchEventMapper, true);
        document.addEventListener('touchcancel', TouchEventMapper, true);
    }

    var DragDropTouch;
    (function (DragDropTouchExport) {
        var DataTransfer = (function () {
            function DataTransfer() {
                this._dropEffect = 'move';
                this._effectAllowed = 'all';
                this._data = {};
            }
            Object.defineProperty(DataTransfer.prototype, "dropEffect", {
                enumerable: true, configurable: true,
                get: function () { return this._dropEffect; },
                set: function (value) { this._dropEffect = value; },
            });
            Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
                enumerable: true, configurable: true,
                get: function () { return this._effectAllowed; },
                set: function (value) { this._effectAllowed = value; },
            });
            Object.defineProperty(DataTransfer.prototype, "types", {
                enumerable: true, configurable: true,
                get: function () { return Object.keys(this._data); },
            });
            DataTransfer.prototype.clearData = function (type) {
                if (type == null) {
                    this._data = {};
                }
                else {
                    delete this._data[type.toLowerCase()];
                }
            };
            DataTransfer.prototype.getData = function (type) {
                return this._data[type.toLowerCase()] || '';
            };
            DataTransfer.prototype.setData = function (type, value) {
                this._data[type.toLowerCase()] = value;
            };
            DataTransfer.prototype.setDragImage = function (img, offsetX, offsetY) {
                var ddt = DragDropTouchSingleton._instance;
                ddt._imgCustom = img;
                ddt._imgOffset = { x: offsetX, y: offsetY };
            };
            return DataTransfer;
        }());
        DragDropTouchExport.DataTransfer = DataTransfer;
        var DragDropTouchSingleton = (function () {
            function DragDropTouch() {
                this._lastClick = 0;
                if ((DragDropTouchSingleton != null) &&
                    (DragDropTouchSingleton._instance != null)) {
                    throw new Error('DragDropTouch instance already created.');
                }
                // https://github.com/Modernizr/Modernizr/issues/1894
                var supportsPassive = false;
                document.addEventListener('test', function () { }, {
                    get passive() { supportsPassive = true; return true; }
                });
                if (navigator.maxTouchPoints > 0) {
                    var touchstart = this._touchstart.bind(this);
                    var touchmove = this._touchmove.bind(this);
                    var touchend = this._touchend.bind(this);
                    var Options = (supportsPassive ? { passive: false, capture: false } : false);
                    document.addEventListener('touchstart', touchstart, Options);
                    document.addEventListener('touchmove', touchmove, Options);
                    document.addEventListener('touchend', touchend);
                    document.addEventListener('touchcancel', touchend);
                }
            }
            DragDropTouch.getInstance = function () {
                return DragDropTouchSingleton._instance;
            };
            /**** Event Handlers ****/
            DragDropTouch.prototype._touchstart = function (e) {
                var _this = this;
                if (this._shouldHandle(e)) {
                    if (Date.now() - this._lastClick < DragDropTouchSingleton._DBLCLICK) {
                        if (this._dispatchEvent(e, 'dblclick', e.target)) {
                            e.preventDefault();
                            this._reset();
                            return;
                        }
                    }
                    this._reset();
                    var src_1 = this._closestDraggable(e.target);
                    if (src_1 != null) {
                        if (!this._dispatchEvent(e, 'mousemove', e.target) &&
                            !this._dispatchEvent(e, 'mousedown', e.target)) {
                            this._dragSource = src_1;
                            this._ptDown = this._getPoint(e);
                            this._lastTouch = e;
                            e.preventDefault();
                            setTimeout(function () {
                                if ((_this._dragSource === src_1) && (_this._img == null)) {
                                    if (_this._dispatchEvent(e, 'contextmenu', src_1)) {
                                        _this._reset();
                                    }
                                }
                            }, DragDropTouchSingleton._CTXMENU);
                            if (DragDropTouchSingleton._ISPRESSHOLDMODE) {
                                this._pressHoldInterval = setTimeout(function () {
                                    _this._isDragEnabled = true;
                                    _this._touchmove(e);
                                }, DragDropTouchSingleton._PRESSHOLDAWAIT);
                            }
                        }
                    }
                }
            };
            DragDropTouch.prototype._touchmove = function (e) {
                if (this._shouldCancelPressHoldMove(e)) {
                    this._reset();
                    return;
                }
                if (this._shouldHandleMove(e) || this._shouldHandlePressHoldMove(e)) {
                    var target = this._getTarget(e);
                    if (this._dispatchEvent(e, 'mousemove', target)) {
                        this._lastTouch = e;
                        e.preventDefault();
                        return;
                    }
                    var lastPointOnPage = this._getPoint(this._lastTouch, true);
                    var curPointOnPage = this._getPoint(e, true);
                    this._lastMovementX = curPointOnPage.x - lastPointOnPage.x;
                    this._lastMovementY = curPointOnPage.y - lastPointOnPage.y;
                    var Extras = { movementX: this._lastMovementX, movementY: this._lastMovementY };
                    if (this._dragSource && (this._img == null) && this._shouldStartDragging(e)) {
                        this._dispatchEvent(e, 'dragstart', this._dragSource, Extras);
                        this._createImage(e);
                        this._dispatchEvent(e, 'dragenter', target, Extras);
                    }
                    if (this._img != null) {
                        this._lastTouch = e;
                        e.preventDefault();
                        this._dispatchEvent(e, 'drag', this._dragSource, Extras);
                        if (target != this._lastTarget) {
                            this._dispatchEvent(this._lastTouch, 'dragleave', this._lastTarget, Extras);
                            this._dispatchEvent(e, 'dragenter', target, Extras);
                            this._lastTarget = target;
                        }
                        this._moveImage(e);
                        this._isDropZone = this._dispatchEvent(e, 'dragover', target, Extras);
                    }
                }
            };
            DragDropTouch.prototype._touchend = function (e) {
                if (this._shouldHandle(e)) {
                    if (this._dispatchEvent(this._lastTouch, 'mouseup', e.target)) {
                        e.preventDefault();
                        return;
                    }
                    if (this._img == null) {
                        this._dragSource = null;
                        this._dispatchEvent(this._lastTouch, 'click', e.target);
                        this._lastClick = Date.now();
                    }
                    this._destroyImage();
                    if (this._dragSource) {
                        var Extras = { movementX: this._lastMovementX, movementY: this._lastMovementY };
                        if (e.type.indexOf('cancel') < 0 && this._isDropZone) {
                            this._dispatchEvent(this._lastTouch, 'drop', this._lastTarget, Extras);
                        }
                        this._dispatchEvent(this._lastTouch, 'dragend', this._dragSource, Extras);
                        this._reset();
                    }
                }
            };
            /**** Utility Functions ****/
            DragDropTouch.prototype._shouldHandle = function (e) {
                return ((e != null) && !e.defaultPrevented &&
                    (e.touches != null) && (e.touches.length < 2));
            };
            DragDropTouch.prototype._shouldHandleMove = function (e) {
                return !DragDropTouchSingleton._ISPRESSHOLDMODE && this._shouldHandle(e);
            };
            DragDropTouch.prototype._shouldHandlePressHoldMove = function (e) {
                return (DragDropTouchSingleton._ISPRESSHOLDMODE && this._isDragEnabled &&
                    (e != null) && (e.touches != null) && (e.touches.length > 0));
            };
            DragDropTouch.prototype._shouldCancelPressHoldMove = function (e) {
                return (DragDropTouchSingleton._ISPRESSHOLDMODE && !this._isDragEnabled &&
                    (this._getDelta(e) > DragDropTouchSingleton._PRESSHOLDMARGIN));
            };
            DragDropTouch.prototype._shouldStartDragging = function (e) {
                var delta = this._getDelta(e);
                return ((delta > DragDropTouchSingleton._THRESHOLD) ||
                    DragDropTouchSingleton._ISPRESSHOLDMODE && (delta >= DragDropTouchSingleton._PRESSHOLDTHRESHOLD));
            };
            DragDropTouch.prototype._reset = function () {
                this._destroyImage();
                this._dragSource = null;
                this._lastTouch = null;
                this._lastTarget = null;
                this._ptDown = null;
                this._isDragEnabled = false;
                this._isDropZone = false;
                this._dataTransfer = new DataTransfer();
                this._lastMovementX = 0;
                this._lastMovementY = 0;
                clearInterval(this._pressHoldInterval);
            };
            DragDropTouch.prototype._getPoint = function (e, page) {
                if ((e != null) && (e.touches != null) &&
                    (e.touches.length > 0)) {
                    var Touch_1 = e.touches[0];
                    return { x: page ? Touch_1.pageX : Touch_1.clientX, y: page ? Touch_1.pageY : Touch_1.clientY };
                }
                else {
                    var Event_1 = e;
                    return { x: page ? Event_1.pageX : Event_1.clientX, y: page ? Event_1.pageY : Event_1.clientY };
                }
            };
            DragDropTouch.prototype._getDelta = function (e) {
                if (DragDropTouchSingleton._ISPRESSHOLDMODE && !this._ptDown) {
                    return 0;
                }
                var p = this._getPoint(e);
                return Math.abs(p.x - this._ptDown.x) + Math.abs(p.y - this._ptDown.y);
            };
            DragDropTouch.prototype._getTarget = function (e) {
                var pt = this._getPoint(e);
                var el = document.elementFromPoint(pt.x, pt.y);
                while ((el != null) && (getComputedStyle(el).pointerEvents == 'none')) {
                    el = el.parentElement;
                }
                return el;
            };
            DragDropTouch.prototype._createImage = function (e) {
                if (this._img != null) {
                    this._destroyImage();
                }
                var src = this._imgCustom || this._dragSource;
                this._img = src.cloneNode(true);
                this._copyStyle(src, this._img);
                this._img.style.top = this._img.style.left = '-9999px';
                if (this._imgCustom == null) {
                    var rc = src.getBoundingClientRect();
                    var pt = this._getPoint(e);
                    this._imgOffset = { x: pt.x - rc.left, y: pt.y - rc.top };
                    this._img.style.opacity = DragDropTouchSingleton._OPACITY.toString();
                }
                this._moveImage(e);
                document.body.appendChild(this._img);
            };
            DragDropTouch.prototype._destroyImage = function () {
                if ((this._img != null) && (this._img.parentElement != null)) {
                    this._img.parentElement.removeChild(this._img);
                }
                this._img = null;
                this._imgCustom = null;
            };
            DragDropTouch.prototype._moveImage = function (e) {
                var _this = this;
                requestAnimationFrame(function () {
                    if (_this._img != null) {
                        var pt = _this._getPoint(e, true), s = _this._img.style;
                        s.position = 'absolute';
                        s.pointerEvents = 'none';
                        s.zIndex = '999999';
                        s.left = Math.round(pt.x - _this._imgOffset.x) + 'px';
                        s.top = Math.round(pt.y - _this._imgOffset.y) + 'px';
                    }
                });
            };
            DragDropTouch.prototype._copyProps = function (dst, src, props) {
                for (var i = 0; i < props.length; i++) {
                    var p = props[i];
                    dst[p] = src[p];
                }
            };
            DragDropTouch.prototype._copyStyle = function (src, dst) {
                DragDropTouchSingleton._rmvAtts.forEach(function (att) {
                    dst.removeAttribute(att);
                });
                if (src instanceof HTMLCanvasElement) {
                    var cSrc = src, cDst = dst;
                    cDst.width = cSrc.width;
                    cDst.height = cSrc.height;
                    cDst.getContext('2d').drawImage(cSrc, 0, 0);
                }
                var cs = getComputedStyle(src); // poor trick to satisfy compiler
                for (var i = 0; i < cs.length; i++) {
                    var key = cs[i];
                    if (key.indexOf('transition') < 0) {
                        dst.style[key] = cs[key];
                    }
                }
                dst.style.pointerEvents = 'none';
                for (var i = 0; i < src.children.length; i++) {
                    this._copyStyle(src.children[i], dst.children[i]);
                }
            };
            DragDropTouch.prototype._dispatchEvent = function (e /* poor TypeScript trick */, type, target, Extras) {
                if ((e != null) && (target != null)) {
                    var evt = document.createEvent('Event'); // poor trick to satisfy compiler
                    var t = (e['touches'] != null) ? e['touches'][0] : e;
                    evt.initEvent(type, true, true);
                    evt['button'] = 0;
                    evt['which'] = evt['buttons'] = 1;
                    this._copyProps(evt, e, DragDropTouchSingleton._kbdProps);
                    this._copyProps(evt, t, DragDropTouchSingleton._ptProps);
                    evt['dataTransfer'] = this._dataTransfer;
                    if (Extras != null) {
                        evt['movementX'] = Extras.movementX;
                        evt['movementY'] = Extras.movementY;
                    }
                    target.dispatchEvent(evt);
                    return evt.defaultPrevented;
                }
                return false;
            };
            DragDropTouch.prototype._closestDraggable = function (e) {
                for (; e; e = e.parentElement) {
                    if (e.hasAttribute('draggable') && e.getAttribute('draggable')) {
                        return e;
                    }
                }
                return null;
            };
            // @ts-ignore
            var Singleton = new DragDropTouch();
            Singleton._instance = Singleton;
            return Singleton;
        }());
        DragDropTouchExport.DragDropTouch = DragDropTouchSingleton;
        var Singleton = DragDropTouch.DragDropTouch;
        Singleton._THRESHOLD = 5; // pixels to move before drag starts
        Singleton._OPACITY = 0.5; // drag image opacity
        Singleton._DBLCLICK = 500; // max ms between clicks in a double click
        Singleton._CTXMENU = 900; // ms to hold before raising 'contextmenu' event
        Singleton._ISPRESSHOLDMODE = false; // decides of press & hold mode presence
        Singleton._PRESSHOLDAWAIT = 400; // ms to wait before press & hold is detected
        Singleton._PRESSHOLDMARGIN = 25; // pixels that finger might shiver while pressing
        Singleton._PRESSHOLDTHRESHOLD = 0; // pixels to move before drag starts
        Singleton._rmvAtts = 'id,class,style,draggable'.split(',');
        Singleton._kbdProps = 'altKey,ctrlKey,metaKey,shiftKey'.split(',');
        Singleton._ptProps = 'pageX,pageY,clientX,clientY,screenX,screenY,offsetX,offsetY'.split(',');
    })(DragDropTouch || (DragDropTouch = {}));
    var DragDropTouch$1 = DragDropTouch;

    //----------------------------------------------------------------------------//
    DragDropTouch$1.DragDropTouch;

    var css_248z = "[draggable]{-webkit-touch-callout:none;-ms-touch-action:none;touch-action:none;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;user-select:none}";
    styleInject(css_248z,{"insertAt":"top"});

    /* src/WAD.svelte generated by Svelte v3.38.3 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    // (97:4) {#if $chosenApplet !== Applet}
    function create_if_block_3(ctx) {
    	let designerbutton;
    	let updating_preferredPosition;
    	let current;

    	function designerbutton_preferredPosition_binding(value) {
    		/*designerbutton_preferredPosition_binding*/ ctx[9](value);
    	}

    	let designerbutton_props = {
    		Applet: /*Applet*/ ctx[11],
    		startDesigning: /*startDesigning*/ ctx[0]
    	};

    	if (/*preferredPosition*/ ctx[1] !== void 0) {
    		designerbutton_props.preferredPosition = /*preferredPosition*/ ctx[1];
    	}

    	designerbutton = new DesignerButton({ props: designerbutton_props });
    	binding_callbacks.push(() => bind(designerbutton, "preferredPosition", designerbutton_preferredPosition_binding));

    	return {
    		c() {
    			create_component(designerbutton.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(designerbutton, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const designerbutton_changes = {};
    			if (dirty & /*$AppletList*/ 8) designerbutton_changes.Applet = /*Applet*/ ctx[11];

    			if (!updating_preferredPosition && dirty & /*preferredPosition*/ 2) {
    				updating_preferredPosition = true;
    				designerbutton_changes.preferredPosition = /*preferredPosition*/ ctx[1];
    				add_flush_callback(() => updating_preferredPosition = false);
    			}

    			designerbutton.$set(designerbutton_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(designerbutton.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(designerbutton.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(designerbutton, detaching);
    		}
    	};
    }

    // (96:2) {#each $AppletList as Applet (Applet['uniqueId'])}
    function create_each_block(key_1, ctx) {
    	let first;
    	let if_block_anchor;
    	let current;
    	let if_block = /*$chosenApplet*/ ctx[2] !== /*Applet*/ ctx[11] && create_if_block_3(ctx);

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*$chosenApplet*/ ctx[2] !== /*Applet*/ ctx[11]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$chosenApplet, $AppletList*/ 12) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (104:2) {#if ($chosenApplet !== null)}
    function create_if_block_2(ctx) {
    	let toolboxview;
    	let current;

    	toolboxview = new ToolboxView({
    			props: {
    				Applet: /*$chosenApplet*/ ctx[2],
    				PositionAroundPreferredPosition: /*PositionAroundPreferredPosition*/ ctx[6]
    			}
    		});

    	return {
    		c() {
    			create_component(toolboxview.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(toolboxview, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const toolboxview_changes = {};
    			if (dirty & /*$chosenApplet*/ 4) toolboxview_changes.Applet = /*$chosenApplet*/ ctx[2];
    			toolboxview.$set(toolboxview_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(toolboxview.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(toolboxview.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(toolboxview, detaching);
    		}
    	};
    }

    // (108:2) {#if ($chosenApplet !== null) && $NudgerState.isVisible }
    function create_if_block_1(ctx) {
    	let nudgerview;
    	let current;

    	nudgerview = new NudgerView({
    			props: {
    				Applet: /*$chosenApplet*/ ctx[2],
    				PositionAroundPreferredPosition: /*PositionAroundPreferredPosition*/ ctx[6]
    			}
    		});

    	return {
    		c() {
    			create_component(nudgerview.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(nudgerview, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const nudgerview_changes = {};
    			if (dirty & /*$chosenApplet*/ 4) nudgerview_changes.Applet = /*$chosenApplet*/ ctx[2];
    			nudgerview.$set(nudgerview_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(nudgerview.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(nudgerview.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(nudgerview, detaching);
    		}
    	};
    }

    // (112:2) {#if ($chosenApplet !== null) && $InspectorState.isVisible }
    function create_if_block(ctx) {
    	let inspectorview;
    	let current;

    	inspectorview = new InspectorView({
    			props: {
    				Applet: /*$chosenApplet*/ ctx[2],
    				PositionAroundPreferredPosition: /*PositionAroundPreferredPosition*/ ctx[6]
    			}
    		});

    	return {
    		c() {
    			create_component(inspectorview.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(inspectorview, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const inspectorview_changes = {};
    			if (dirty & /*$chosenApplet*/ 4) inspectorview_changes.Applet = /*$chosenApplet*/ ctx[2];
    			inspectorview.$set(inspectorview_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(inspectorview.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(inspectorview.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(inspectorview, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t0;
    	let t1;
    	let t2;
    	let current;
    	let each_value = /*$AppletList*/ ctx[3];
    	const get_key = ctx => /*Applet*/ ctx[11]["uniqueId"];

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	let if_block0 = /*$chosenApplet*/ ctx[2] !== null && create_if_block_2(ctx);
    	let if_block1 = /*$chosenApplet*/ ctx[2] !== null && /*$NudgerState*/ ctx[4].isVisible && create_if_block_1(ctx);
    	let if_block2 = /*$chosenApplet*/ ctx[2] !== null && /*$InspectorState*/ ctx[5].isVisible && create_if_block(ctx);

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			if (if_block2) if_block2.c();
    			attr(div, "id", "webapp-tinkerer-designer");
    			set_style(div, "display", "block");
    			set_style(div, "position", "absolute");
    			set_style(div, "left", "0px");
    			set_style(div, "top", "0px");
    			set_style(div, "width", "0px");
    			set_style(div, "height", "0px");
    			set_style(div, "overflow", "visible");
    			set_style(div, "pointer-events", "none");
    			set_style(div, "margin", "0px");
    			set_style(div, "padding", "0px");
    			set_style(div, "border", "none");
    			set_style(div, "background", "transparent");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t0);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			append(div, t2);
    			if (if_block2) if_block2.m(div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$AppletList, startDesigning, preferredPosition, $chosenApplet*/ 15) {
    				each_value = /*$AppletList*/ ctx[3];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div, outro_and_destroy_block, create_each_block, t0, get_each_context);
    				check_outros();
    			}

    			if (/*$chosenApplet*/ ctx[2] !== null) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*$chosenApplet*/ 4) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div, t1);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*$chosenApplet*/ ctx[2] !== null && /*$NudgerState*/ ctx[4].isVisible) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*$chosenApplet, $NudgerState*/ 20) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div, t2);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*$chosenApplet*/ ctx[2] !== null && /*$InspectorState*/ ctx[5].isVisible) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*$chosenApplet, $InspectorState*/ 36) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};
    }

    mapTouchToMouseFor("#webapp-tinkerer-designer *");

    function inhibitsEventsFrom(Visual) {
    	return false;
    }

    /**** PositionAround ****/
    function PositionAround(preferredPosition, Width, Height) {
    	let ViewportWidth = Math.max(window.innerWidth, document.body.clientWidth);
    	let ViewportHeight = Math.max(window.innerHeight, document.body.clientHeight);
    	let x = Math.max(0, Math.min(preferredPosition.x, ViewportWidth - Width));
    	let y = Math.max(0, Math.min(preferredPosition.y, ViewportHeight - Height));
    	return { x: Math.round(x), y: Math.round(y) };
    }

    function instance($$self, $$props, $$invalidate) {
    	let $chosenApplet;
    	let $AppletList;
    	let $NudgerState;
    	let $InspectorState;
    	component_subscribe($$self, chosenApplet, $$value => $$invalidate(2, $chosenApplet = $$value));
    	component_subscribe($$self, AppletList, $$value => $$invalidate(3, $AppletList = $$value));
    	component_subscribe($$self, NudgerState, $$value => $$invalidate(4, $NudgerState = $$value));
    	component_subscribe($$self, InspectorState, $$value => $$invalidate(5, $InspectorState = $$value));
    	const Version = "0.1.0";

    	function startDesigning(Applet, Target, Property) {
    		if (Applet == null) {
    			chooseApplet(undefined);
    		} else {
    			chooseApplet(Applet);

    			switch (true) {
    				case Target == null:
    					break;
    				case webappTinkererRuntime.ValueIsName(Target):
    					//        chooseMaster
    					break;
    				case webappTinkererRuntime.ValueIsVisual(Target):
    					//        chooseVisual
    					break;
    				default:
    					throwError("InvalidArgument: WAT master name or visual expected");
    			}
    		}
    	}

    	webappTinkererRuntime.ready(() => {
    		webappTinkererRuntime.registerDesigner({ startDesigning, inhibitsEventsFrom });
    		console.log("WAD is running");
    	});

    	/**** chooseApplet ****/
    	function chooseApplet(Applet) {
    		if (Applet !== $chosenApplet) {
    			chosenApplet.set(Applet);
    		}
    	}

    	/**** preferredPosition - relative to Viewport ****/
    	let preferredPosition = { x: 0, y: 0 };

    	/**** PositionAroundPreferredPosition ****/
    	function PositionAroundPreferredPosition(Width, Height) {
    		return PositionAround(preferredPosition, Width, Height);
    	}

    	function designerbutton_preferredPosition_binding(value) {
    		preferredPosition = value;
    		$$invalidate(1, preferredPosition);
    	}

    	return [
    		startDesigning,
    		preferredPosition,
    		$chosenApplet,
    		$AppletList,
    		$NudgerState,
    		$InspectorState,
    		PositionAroundPreferredPosition,
    		Version,
    		inhibitsEventsFrom,
    		designerbutton_preferredPosition_binding
    	];
    }

    class WAD extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			Version: 7,
    			startDesigning: 0,
    			inhibitsEventsFrom: 8
    		});
    	}

    	get Version() {
    		return this.$$.ctx[7];
    	}

    	get startDesigning() {
    		return this.$$.ctx[0];
    	}

    	get inhibitsEventsFrom() {
    		return inhibitsEventsFrom;
    	}
    }

    /*******************************************************************************
    *                                                                              *
    *                        WebApp Tinkerer (WAT) Runtime                         *
    *                                                                              *
    *******************************************************************************/
    /**** get a reference to the "global" object ****/
    var global = /*#__PURE__*/ Function('return this')();
    // see https://stackoverflow.com/questions/3277182/how-to-get-the-global-object-in-javascript
    /**** check WAT presence ****/
    var WAT = global.WAT;
    if (typeof (WAT === null || WAT === void 0 ? void 0 : WAT.ready) !== 'function') {
        window.alert('"WebApp Tinkerer" not found\n\n' +
            'The WAT Designer needs the WAT Runtime to be loaded first');
        throw new Error('MissingDependency: "WAT" not found');
    }
    /**** ready to attach designer ****/
    WAT.ready(function () {
        new WAD({
            target: document.body
        });
    });

    exports.global = global;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}, WAT));
//# sourceMappingURL=webapp-tinkerer-designer.js.map
