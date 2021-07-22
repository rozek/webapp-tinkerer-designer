  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import { chosenApplet } from '../stores/chosenApplet.js'
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
      }
      InspectorStateStore.set(currentInspectorState)
    }
  })

/**** validate changes to "InspectorState" ****/

  function setInspectorState (newInspectorState) {
    if (currentlyChosenApplet !== null) {
      if (ValuesDiffer(currentInspectorState,newInspectorState)) {
        currentInspectorState = Object.assign({}, currentInspectorState, newInspectorState)
        InspectorStateSet.set(currentlyChosenApplet,currentInspectorState)
        InspectorStateStore.set(currentInspectorState)
      }
    }
  }

/**** setMode ****/

  function setMode (newMode) {
    if (newMode != currentInspectorState.Mode) {
      let newPane
        if ((newMode === 'import-export') || (newMode === 'search')) {
          newPane = undefined
        } else {
          newPane = currentInspectorState.Pane || 'overview'
        }
      setInspectorState({ ...currentInspectorState, Mode:newMode, Pane:newPane })
    }
  }

/**** setPane ****/

  function setPane (newPane) {
    if (newPane != currentInspectorState.Pane) {
      if ('import-export search'.indexOf(currentInspectorState.Mode) >= 0) {
        newPane = undefined
      }
      setInspectorState({ ...currentInspectorState, Pane:newPane })
    }
  }

/**** export an explicitly implemented store ****/

  export const InspectorState = {
    subscribe: (Callback) => InspectorStateStore.subscribe(Callback),
    set:       setInspectorState,
    setMode, setPane
  }
