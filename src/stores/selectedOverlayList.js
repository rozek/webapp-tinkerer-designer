  import { writable } from 'svelte/store'

  import   { ValuesDiffer }    from 'webapp-tinkerer-runtime'
  import   { chosenApplet }    from '../stores/chosenApplet.js'
  import { chosenOverlayList } from '../stores/chosenOverlayList.js'

  let currentlyChosenApplet      = undefined
  let currentlyChosenOverlayList = []
  let currentSelectionList       = []

  const SelectionListStore = writable(currentSelectionList) // subscription mgmt
  const SelectionListSet   = new WeakMap()          // applet-specific selection

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentlyChosenOverlayList = []
        currentSelectionList       = []
      } else {
        if (SelectionListSet.has(currentlyChosenApplet)) {
          currentSelectionList       = SelectionListSet.get(currentlyChosenApplet)
          currentlyChosenOverlayList = currentlyChosenApplet.OverlayList
          updateSelectionList()        // before "chosenOverlayList" was updated
        } else {
          currentSelectionList = []
          SelectionListSet.set(currentlyChosenApplet,currentSelectionList)
        }
        SelectionListStore.set(currentSelectionList)
      }
    }
  })

/**** keep track of changes in "chosenOverlayList" ****/

  chosenOverlayList.subscribe((newChosenOverlayList) => {
    if (ValuesDiffer(currentlyChosenOverlayList,newChosenOverlayList,'by-reference')) {
      currentlyChosenOverlayList = newChosenOverlayList
      updateSelectionList()
    }
  })

/**** updateSelectionList ****/

  function updateSelectionList () {
    if (currentSelectionList.length > 0) {
      let newSelectionList = currentSelectionList.filter(
        (Overlay) => (currentlyChosenOverlayList.indexOf(Overlay) >= 0) // not optimal
      )
      if (ValuesDiffer(currentSelectionList,newSelectionList,'by-reference')) {
        currentSelectionList = newSelectionList
        SelectionListSet.set(currentlyChosenApplet,currentSelectionList)
        SelectionListStore.set(currentSelectionList)
      }
    }
  }

/**** select ****/

  function select (Overlay) {
    let OverlayIndex = currentSelectionList.indexOf(Overlay)
    if ((OverlayIndex < 0) && (currentOverlayList.indexOf(Overlay) >= 0)) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.push(Overlay)
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** deselect ****/

  function deselect (Overlay) {
    let OverlayIndex = currentSelectionList.indexOf(Overlay)
    if (OverlayIndex >= 0) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.splice(OverlayIndex,1)
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** clear ****/

  function clear () {
    if (currentSelectionList.length > 0) {
      currentSelectionList = initialSelectionList
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** validate changes to "SelectionList" ****/

  function setSelectionList (newSelectionList) {
    if (ValuesDiffer(currentSelectionList,newSelectionList,'by-reference')) {
      currentSelectionList = newSelectionList.slice()
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** export an explicitly implemented store ****/

  export const selectedOverlayList = {
    subscribe: (Subscription) => SelectionListStore.subscribe(Subscription),
    set:setSelectionList, select, deselect, clear
  }
