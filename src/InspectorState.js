  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import { chosenApplet } from './chosenApplet.js'

  const initialInspectorState = {
    isVisible:false, Offset:{ x:NaN,y:NaN }, Width:NaN,Height:NaN
  }

  let currentlyChosenApplet = undefined
  let currentInspectorState = Object.assign({}, initialInspectorState)

  const InspectorStateStore = writable(currentInspectorState) // subscript. mgmt
  const InspectorStateSet   = new WeakMap()  // applet-specific Inspector states

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentInspectorState = Object.assign({}, initialInspectorState)
      } else {
        if (InspectorStateSet.has(currentlyChosenApplet)) {
          currentInspectorState = InspectorStateSet.get(currentlyChosenApplet)
        } else {
          currentInspectorState = Object.assign({}, initialInspectorState)
          InspectorStateSet.set(currentlyChosenApplet,currentInspectorState)
        }
        InspectorStateStore.set(currentInspectorState)
      }
    }
  })

/**** validate changes to "InspectorState" ****/

  function setInspectorState (newInspectorState) {
    if (currentlyChosenApplet !== null) {
      if (ValuesDiffer(currentInspectorState,newInspectorState)) {
        currentInspectorState = Object.assign({}, newInspectorState)
        InspectorStateSet.set(currentlyChosenApplet,newInspectorState)
        InspectorStateStore.set(newInspectorState)
      }
    }
  }

/**** export an explicitly implemented store ****/

  export const InspectorState = {
    subscribe: (Callback) => InspectorStateStore.subscribe(Callback),
    set:       setInspectorState
  }
