// see https://remarkablemark.org/blog/2019/07/12/rollup-commonjs-umd/

import commonjs       from '@rollup/plugin-commonjs'
import resolve        from '@rollup/plugin-node-resolve'
import autoPreprocess from 'svelte-preprocess'
import typescript     from '@rollup/plugin-typescript';
import postcss        from 'rollup-plugin-postcss'
import { terser }     from 'rollup-plugin-terser'

export default {
  input: './src/webapp-tinkerer-designer.ts',
  external:[                                 // list of (unbundled) dependencies
    'webapp-tinkerer-runtime',               // partial bundling
  ],
  output: {
    file:      './dist/webapp-tinkerer-designer.js',
    format:    'iife',
    name:      'WAD',
    globals:   { 'webapp-tinkerer-runtime':'WAT' },
    noConflict:true,
    sourcemap: true,
    exports: 'default',
  },
  plugins: [
    resolve({ browser:true, dedupe:['svelte'] }), commonjs(), typescript(),
    postcss({ extract:false, inject:{insertAt:'top'} }),
    terser({ format:{ comments:false, safari10:true } })
  ],
};
