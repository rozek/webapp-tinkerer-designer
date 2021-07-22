  import { writable } from 'svelte/store'

  import    { ValuesDiffer }     from 'webapp-tinkerer-runtime'
  import    { chosenApplet }     from '../stores/chosenApplet.js'
  import   { chosenContainer }   from '../stores/chosenContainer.js'
  import { chosenComponentList } from '../stores/chosenComponentList.js'

  let currentlyChosenApplet        = undefined
  let currentlyChosenContainer     = undefined
  let currentlyChosenComponentList = []
  let currentSelectionList         = []

  const SelectionListStore = writable(currentSelectionList) // subscription mgmt
  const SelectionListSet   = new WeakMap()          // applet-specific selection

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentlyChosenContainer     = undefined
        currentlyChosenComponentList = []
        currentSelectionList         = []
      } else {
        if (SelectionListSet.has(currentlyChosenApplet)) {
          currentSelectionList     = SelectionListSet.get(currentlyChosenApplet)
          currentlyChosenContainer = (
            currentSelectionList[0]?.Container || currentlyChosenApplet.shownCard
          )
          currentlyChosenComponentList = currentlyChosenContainer.ComponentList
          updateSelectionList()      // before "chosenComponentList" was updated
        } else {
          currentlyChosenContainer     = undefined        // that's ok right now
          currentlyChosenComponentList = []                              // dto.
          currentSelectionList         = []  // ...because there is no selection
          SelectionListSet.set(currentlyChosenApplet,currentSelectionList)
        }
        SelectionListStore.set(currentSelectionList)
      }
    }
  })

/**** keep track of changes in "chosenContainer" ****/

  chosenContainer.subscribe((newChosenContainer) => {
    if (currentlyChosenContainer !== newChosenContainer) {
      currentlyChosenContainer     = newChosenContainer
      currentlyChosenComponentList = currentlyChosenContainer.ComponentList
      updateSelectionList()          // before "chosenComponentList" was updated
    }
  })

/**** keep track of changes in "chosenComponentList" ****/

  chosenComponentList.subscribe((newChosenComponentList) => {
    if (ValuesDiffer(currentlyChosenComponentList,newChosenComponentList,'by-reference')) {
      currentlyChosenComponentList = newChosenComponentList
      updateSelectionList()
    }
  })

/**** updateSelectionList ****/

  function updateSelectionList () {
    if (currentSelectionList.length > 0) {
      let newSelectionList = currentSelectionList.filter(
        (Component) => (currentlyChosenComponentList.indexOf(Component) >= 0)    // not optimal
      )
      if (ValuesDiffer(currentSelectionList,newSelectionList,'by-reference')) {
        currentSelectionList = newSelectionList
        SelectionListSet.set(currentlyChosenApplet,currentSelectionList)
        SelectionListStore.set(currentSelectionList)
      }
    }
  }

/**** select ****/

  function select (Component) {
    let ComponentIndex = currentSelectionList.indexOf(Component)
    if ((ComponentIndex < 0) && (currentComponentList.indexOf(Component) >= 0)) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.push(Component)
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** deselect ****/

  function deselect (Component) {
    let ComponentIndex = currentSelectionList.indexOf(Component)
    if (ComponentIndex >= 0) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.splice(ComponentIndex,1)
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

  export const selectedComponentList = {
    subscribe: (Subscription) => SelectionListStore.subscribe(Subscription),
    set:setSelectionList, select, deselect, clear
  }
