  import { writable } from 'svelte/store'

  import  { ValuesDiffer }   from 'webapp-tinkerer-runtime'
  import { chosenContainer } from '../stores/chosenContainer.js'

  let currentlyChosenContainer = undefined
  let currentComponentList     = []

  const chosenComponentListStore = writable([])   // for subscription management

/**** keep track of changes in "chosenContainer" ****/

  chosenContainer.subscribe((newChosenContainer) => { // impl. a "derived" store
    if (currentlyChosenContainer !== newChosenContainer) {
      currentlyChosenContainer = newChosenContainer

      let newComponentList = (
        newChosenContainer == null ? [] : newChosenContainer.ComponentList
      )
      if (ValuesDiffer(currentComponentList,newComponentList,'by-reference')) {
        currentComponentList = newComponentList
        chosenComponentListStore.set(currentComponentList)
      }
    }
  })

/**** keep track of all Components in "chosenContainer" ****/

  function updateChosenComponentList () {
    if (currentlyChosenContainer != null) {
      let newComponentList = currentlyChosenContainer.ComponentList
      if (ValuesDiffer(currentComponentList,newComponentList,'by-reference')) {
        currentComponentList = newComponentList
        chosenComponentListStore.set(currentComponentList)
      }
    }
  }

  setInterval(updateChosenComponentList, 300)

/**** export an explicitly implemented store ****/

  export const chosenComponentList = {
    subscribe: (Subscription) => chosenComponentListStore.subscribe(Subscription)
  }
