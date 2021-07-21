  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import { chosenApplet } from './chosenApplet.js'

  let currentlyChosenApplet = undefined
  let currentOverlayList    = []

  const chosenOverlayListStore = writable([])     // for subscription management

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      let newOverlayList = (newChosenApplet == null ? [] : newChosenApplet.OverlayList)
      if (ValuesDiffer(currentOverlayList,newOverlayList,'by-reference')) {
        currentOverlayList = newOverlayList
        chosenOverlayListStore.set(currentOverlayList)
      }
    }
  })

/**** keep track of all Overlays in "chosenApplet" ****/

  function updateChosenOverlayList () {
    if (currentlyChosenApplet != null) {
      let newOverlayList = currentlyChosenApplet.OverlayList
      if (ValuesDiffer(currentOverlayList,newOverlayList,'by-reference')) {
        currentOverlayList = newOverlayList
        chosenOverlayListStore.set(currentOverlayList)
      }
    }
  }

  setInterval(updateChosenOverlayList, 300)

/**** export an explicitly implemented store ****/

  export const chosenOverlayList = {
    subscribe: (Subscription) => chosenOverlayListStore.subscribe(Subscription)
  }
