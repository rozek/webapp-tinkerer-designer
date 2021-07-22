  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import { chosenApplet } from '../stores/chosenApplet.js'

  const initialNudgerState = {
    isVisible:false, Offset:{ x:NaN,y:NaN }, Width:NaN,Height:NaN
  }

  let currentlyChosenApplet = undefined
  let currentNudgerState    = Object.assign({}, initialNudgerState)

  const NudgerStateStore = writable(currentNudgerState)    // subscription mgmt.
  const NudgerStateSet   = new WeakMap()        // applet-specific Nudger states

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentNudgerState = Object.assign({}, initialNudgerState)
      } else {
        if (NudgerStateSet.has(currentlyChosenApplet)) {
          currentNudgerState = NudgerStateSet.get(currentlyChosenApplet)
        } else {
          currentNudgerState = Object.assign({}, initialNudgerState)
          NudgerStateSet.set(currentlyChosenApplet,currentNudgerState)
        }
      }
      NudgerStateStore.set(currentNudgerState)
    }
  })

/**** validate changes to "NudgerState" ****/

  function setNudgerState (newNudgerState) {
    if (currentlyChosenApplet !== null) {
      if (ValuesDiffer(currentNudgerState,newNudgerState)) {
        currentNudgerState = Object.assign({}, newNudgerState)
        NudgerStateSet.set(currentlyChosenApplet,newNudgerState)
        NudgerStateStore.set(newNudgerState)
      }
    }
  }

/**** export an explicitly implemented store ****/

  export const NudgerState = {
    subscribe: (Callback) => NudgerStateStore.subscribe(Callback),
    set:       setNudgerState
  }
