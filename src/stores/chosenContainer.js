  import { writable } from 'svelte/store'

  import { chosenApplet } from '../stores/chosenApplet.js'

  let currentlyChosenApplet    = undefined
  let currentlyChosenContainer = undefined

  const chosenContainerStore = writable(undefined)// for subscription management
  const chosenContainerSet   = new WeakMap() // applet-specific container choice

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentlyChosenContainer = undefined
      } else {
        if (chosenContainerSet.has(currentlyChosenApplet)) {
          currentlyChosenContainer = chosenContainerSet.get(currentlyChosenApplet)
          updateChosenContainer()
        } else {
          currentlyChosenContainer = currentlyChosenApplet.shownCard
          chosenContainerSet.set(currentlyChosenApplet,currentlyChosenContainer)
          chosenContainerStore.set(currentlyChosenContainer)
        }
      }
    }
  })

/**** keep track of all Containers in "chosenApplet" ****/

  function updateChosenContainer () {
    if (
      (currentlyChosenApplet    != null) &&
      (currentlyChosenContainer != null)
    ) {
      if (
        (currentlyChosenContainer.Applet !== currentlyChosenApplet) ||
        ('Card Overlay Compound'.indexOf(currentlyChosenContainer.Category) < 0)
      ) {
        currentlyChosenContainer = currentlyChosenApplet.shownCard
        chosenContainerSet.set(currentlyChosenApplet,currentlyChosenContainer)
        chosenContainerStore.set(currentlyChosenContainer)
      }
    }
  }

  setInterval(updateChosenContainer, 300)

/**** export an explicitly implemented store ****/

  export const chosenContainer = {
    subscribe: (Subscription) => chosenContainerStore.subscribe(Subscription),
    set:setChosenContainer
  }
