  import { writable } from 'svelte/store'

  import  { ValuesDiffer }   from 'webapp-tinkerer-runtime'
  import { knownMasterList } from '../stores/knownMasterList.js'

  let currentMasterList = []

  const initialSelectionList = []
  let   currentSelectionList = []

  const SelectionListStore = writable(currentSelectionList) // subscription mgmt

/**** keep track of changes in "knownMasterList" ****/

  knownMasterList.subscribe((newMasterList) => { // implements a "derived" store
    currentMasterList = newMasterList

    let newSelectionList = currentSelectionList.filter(
      (Master) => (currentMasterList.indexOf(Master) >= 0)
    )
    if (ValuesDiffer(currentSelectionList,newSelectionList)) {
      currentSelectionList = newSelectionList
      SelectionListStore.set(currentSelectionList)
    }
  })

/**** select ****/

  function select (Master) {
    let MasterIndex = currentSelectionList.indexOf(Master)
    if ((MasterIndex < 0) && (currentMasterList.indexOf(Master) >= 0)) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.push(Master)
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** deselect ****/

  function deselect (Master) {
    let MasterIndex = currentSelectionList.indexOf(Master)
    if (MasterIndex >= 0) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.splice(MasterIndex,1)
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** clear ****/

  function clear (Master) {
    if (currentSelectionList.length > 0) {
      currentSelectionList = initialSelectionList
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** validate changes to "SelectionList" ****/

  function setSelectionList (newSelectionList) {
    if (ValuesDiffer(currentSelectionList,newSelectionList)) {
      currentSelectionList = newSelectionList.slice()
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** export an explicitly implemented store ****/

  export const selectedMasterList = {
    subscribe: (Subscription) => SelectionListStore.subscribe(Subscription),
    set:setSelectionList, select, deselect, clear
  }
