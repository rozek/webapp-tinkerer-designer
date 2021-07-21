  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import {  AppletList  } from './AppletList.js'

  let currentAppletList = []

  const initialSelectionList = []
  let   currentSelectionList = []

  const SelectionListStore = writable(currentSelectionList) // subscription mgmt

/**** keep track of changes in "AppletList" ****/

  AppletList.subscribe((newAppletList) => {      // implements a "derived" store
    currentAppletList = newAppletList

    let newSelectionList = currentSelectionList.filter(
      (Applet) => (currentAppletList.indexOf(Applet) >= 0)
    )
    if (ValuesDiffer(currentSelectionList,newSelectionList,'by-reference')) {
      currentSelectionList = newSelectionList
      SelectionListStore.set(currentSelectionList)
    }
  })

/**** select ****/

  function select (Applet) {
    let AppletIndex = currentSelectionList.indexOf(Applet)
    if ((AppletIndex < 0) && (currentAppletList.indexOf(Applet) >= 0)) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.push(Applet)
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** deselect ****/

  function deselect (Applet) {
    let AppletIndex = currentSelectionList.indexOf(Applet)
    if (AppletIndex >= 0) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.splice(AppletIndex,1)
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** clear ****/

  function clear (Applet) {
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

  export const selectedAppletList = {
    subscribe: (Subscription) => SelectionListStore.subscribe(Subscription),
    set:setSelectionList, select, deselect, clear
  }
