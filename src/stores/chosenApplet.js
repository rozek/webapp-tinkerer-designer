  import { writable } from 'svelte/store'

  import { AppletList } from '../stores/AppletList.js'

  let currentAppletList     = []
  let currentlyChosenApplet = undefined

  const chosenAppletStore = writable(undefined)   // for subscription management

/**** keep track of changes in "AppletList" ****/

  AppletList.subscribe((newAppletList) => {      // implements a "derived" store
    currentAppletList = newAppletList
    if (
      (currentlyChosenApplet != null) &&
      (newAppletList.indexOf(currentlyChosenApplet) < 0)
    ) {
      currentlyChosenApplet = undefined
      chosenAppletStore.set(undefined)
    }
  })

/**** validate changes to "chosenApplet" ****/

  function setChosenApplet (Applet) {
    if (                   // "Applet" must be in the list of designable applets
      (Applet != null) &&
      (currentAppletList.indexOf(Applet) < 0)
    ) {
      Applet = undefined
    }

    if (currentlyChosenApplet !== Applet) {
      currentlyChosenApplet = Applet
      chosenAppletStore.set(Applet)
    }
  }

/**** export an explicitly implemented store ****/

  export const chosenApplet = {
    subscribe: (Subscription) => chosenAppletStore.subscribe(Subscription),
    set:       setChosenApplet
  }
