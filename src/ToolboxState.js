  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import { chosenApplet } from './chosenApplet.js'

  const initialToolboxState = {
    isVisible:false, Offset:{ x:NaN,y:NaN }, Width:NaN,Height:NaN
  }

  let currentlyChosenApplet = undefined
  let currentToolboxState   = Object.assign({}, initialToolboxState)

  const ToolboxStateStore = writable(currentToolboxState)   // subscription mgmt
  const ToolboxStateSet   = new WeakMap()      // applet-specific Toolbox states

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentToolboxState = Object.assign({}, initialToolboxState)
      } else {
        if (ToolboxStateSet.has(currentlyChosenApplet)) {
          currentToolboxState = ToolboxStateSet.get(currentlyChosenApplet)
        } else {
          currentToolboxState = Object.assign({}, initialToolboxState)
          ToolboxStateSet.set(currentlyChosenApplet,currentToolboxState)
        }
        ToolboxStateStore.set(currentToolboxState)
      }
    }
  })

/**** validate changes to "ToolboxState" ****/

  function setToolboxState (newToolboxState) {
    if (currentlyChosenApplet !== null) {
      if (ValuesDiffer(currentToolboxState,newToolboxState)) {
        currentToolboxState = Object.assign({}, newToolboxState)
        ToolboxStateSet.set(currentlyChosenApplet,newToolboxState)
        ToolboxStateStore.set(newToolboxState)
      }
    }
  }

/**** export an explicitly implemented store ****/

  export const ToolboxState = {
    subscribe: (Callback) => ToolboxStateStore.subscribe(Callback),
    set:       setToolboxState
  }
