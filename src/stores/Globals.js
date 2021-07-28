  import { writable } from 'svelte/store'

  const { subscribe, set, update } = writable({
    normalColor: '#C0C0C0', /* silver */
    hoveredColor:'#FFD700', /* gold */
    activeColor: '#ADFF2F', /* greenyellow */

    LightColor: '#C0C0C0', /* normalColor */
    ShadowColor:'#454545',

    InfoColor:   '#C0C0C0', /* normalColor */
    WarningColor:'#FFD700', /* gold */
    ErrorColor:  '#FF4500', /* orangered */
  })

  function define (KeyOrObject, Value) {
    if (typeof(KeyOrObject) === 'string') {
      update((Globals) => { Globals[KeyOrObject] = Value; return Globals })
    } else {
      update((Globals) => Object.assign(Globals,KeyOrObject))
    }
  }

  export const Globals = { subscribe, define }
