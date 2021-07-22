  import { writable } from 'svelte/store'

  import { registeredMasterList } from '../stores/registeredMasterList.js'
  import   { missingMasterList }  from '../stores/missingMasterList.js'

  let currentRegisteredMasterList = []
  let currentMissingMasterList    = []
  let currentKnownMasterList      = []

  const knownMasterStore = writable(undefined)    // for subscription management

/**** keep track of changes in "registeredMasterList" ****/

  registeredMasterList.subscribe((newMasterList) => {   // impl. "derived" store
    currentRegisteredMasterList = newMasterList

    currentKnownMasterList = newMasterList.concat(currentMissingMasterList)
    currentKnownMasterList.sort()
    knownMasterStore.set(currentKnownMasterList)
  })

/**** keep track of changes in "missingMasterList" ****/

  missingMasterList.subscribe((newMasterList) => {      // impl. "derived" store
    currentRegisteredMasterList = newMasterList

    currentKnownMasterList = newMasterList.concat(currentRegisteredMasterList)
    currentKnownMasterList.sort()
    knownMasterStore.set(currentKnownMasterList)
  })

/**** export an explicitly implemented store ****/

  export const knownMasterList = {
    subscribe: (Subscription) => knownMasterStore.subscribe(Subscription),
  }
