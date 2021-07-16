(function (DesignerButton, webappTinkererRuntime) {
    'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    var DesignerButton__default = /*#__PURE__*/_interopDefaultLegacy(DesignerButton);

    function noop() { }
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
    function empty() {
        return text('');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
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
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
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

    //----------------------------------------------------------------------------//
    /**** ValuesDiffer ****/
    function ValuesDiffer(thisValue, otherValue) {
        if (thisValue === otherValue) {
            return false;
        }
        var thisType = typeof thisValue;
        if (thisType !== typeof otherValue) {
            return true;
        }
        /**** ArraysDiffer ****/
        function ArraysDiffer(thisArray, otherArray) {
            if (!Array.isArray(otherArray)) {
                return true;
            }
            if (thisArray.length !== otherArray.length) {
                return true;
            }
            for (var i = 0, l = thisArray.length; i < l; i++) {
                if (ValuesDiffer(thisArray[i], otherArray[i])) {
                    return true;
                }
            }
            return false;
        }
        /**** ObjectsDiffer ****/
        function ObjectsDiffer(thisObject, otherObject) {
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
                if (ValuesDiffer(thisObject[key], otherObject[key])) {
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
                if (Array.isArray(thisValue)) {
                    return ArraysDiffer(thisValue, otherValue);
                }
                return ObjectsDiffer(thisValue, otherValue);
            default: return true; // unsupported property type
        }
        return true;
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

    const subscriber_queue = [];
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

    const AppletList = writable([]);

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

    var css_248z = "[draggable]{-webkit-touch-callout:none;-ms-touch-action:none;touch-action:none;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;user-select:none}";
    styleInject(css_248z,{"insertAt":"top"});

    /* src/webapp-tinkerer-designer.svelte generated by Svelte v3.38.3 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (67:2) {#each $AppletList as Applet (Applet['uniqueId'])}
    function create_each_block(key_1, ctx) {
    	let first;
    	let designerbutton;
    	let current;
    	designerbutton = new DesignerButton__default['default']({ props: { Applet: /*Applet*/ ctx[7] } });

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			create_component(designerbutton.$$.fragment);
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert(target, first, anchor);
    			mount_component(designerbutton, target, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const designerbutton_changes = {};
    			if (dirty & /*$AppletList*/ 1) designerbutton_changes.Applet = /*Applet*/ ctx[7];
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
    			if (detaching) detach(first);
    			destroy_component(designerbutton, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;
    	let each_value = /*$AppletList*/ ctx[0];
    	const get_key = ctx => /*Applet*/ ctx[7]["uniqueId"];

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

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

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$AppletList*/ 1) {
    				each_value = /*$AppletList*/ ctx[0];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div, outro_and_destroy_block, create_each_block, null, get_each_context);
    				check_outros();
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
    			if (detaching) detach(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};
    }




    function startDesigning(Applet, Target, Property, x, y) {
    	
    }

    function inhibitsEventsFrom(Visual) {
    	return false;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $AppletList;
    	component_subscribe($$self, AppletList, $$value => $$invalidate(0, $AppletList = $$value));
    	const Version = "0.1.0";

    	const global = /*#__PURE__*/
    	Function("return this")();

    	// see https://stackoverflow.com/questions/3277182/how-to-get-the-global-object-in-javascript
    	/**** check WAT presence ****/
    	const WAT = global.WAT;

    	if (typeof (WAT === null || WAT === void 0 ? void 0 : WAT.ready) !== "function") {
    		window.alert("\"WebApp Tinkerer\" not found\n\n" + "The WAT Designer needs the WAT Runtime to be loaded first");
    		throw new Error("MissingDependency: \"WAT\" not found");
    	}

    	WAT.ready(() => {
    		WAT.registerDesigner({ startDesigning, inhibitsEventsFrom });
    		console.log("WAD is running");
    	});

    	WAT.ready(() => {
    		setInterval(
    			() => {
    				let AppletsInDocument = webappTinkererRuntime.AppletPeersInDocument().map(AppletPeer => webappTinkererRuntime.VisualForElement(AppletPeer)).filter(Applet => Applet.mayBeDesigned);

    				if (ValuesDiffer(AppletsInDocument, $AppletList)) {
    					AppletList.set(AppletsInDocument);
    				}
    			},
    			300
    		);
    	});

    	return [$AppletList, Version, global, startDesigning, inhibitsEventsFrom];
    }

    class Webapp_tinkerer_designer extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			Version: 1,
    			global: 2,
    			startDesigning: 3,
    			inhibitsEventsFrom: 4
    		});
    	}

    	get Version() {
    		return this.$$.ctx[1];
    	}

    	get global() {
    		return this.$$.ctx[2];
    	}

    	get startDesigning() {
    		return startDesigning;
    	}

    	get inhibitsEventsFrom() {
    		return inhibitsEventsFrom;
    	}
    }

    new Webapp_tinkerer_designer({
        target: document.body
    });

}(DesignerButton, WAT));
//# sourceMappingURL=webapp-tinkerer-designer.js.map
