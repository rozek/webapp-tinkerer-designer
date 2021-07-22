  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import { chosenApplet } from '../stores/chosenApplet.js'

  let currentlyChosenApplet = undefined
  let currentCardList       = []

  const chosenCardListStore = writable([])        // for subscription management

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      let newCardList = (newChosenApplet == null ? [] : newChosenApplet.CardList)
      if (ValuesDiffer(currentCardList,newCardList,'by-reference')) {
        currentCardList = newCardList
        chosenCardListStore.set(currentCardList)
      }
    }
  })

/**** keep track of all cards in "chosenApplet" ****/

  function updateChosenCardList () {
    if (currentlyChosenApplet != null) {
      let newCardList = currentlyChosenApplet.CardList
      if (ValuesDiffer(currentCardList,newCardList,'by-reference')) {
        currentCardList = newCardList
        chosenCardListStore.set(currentCardList)
      }
    }
  }

  setInterval(updateChosenCardList, 300)

/**** export an explicitly implemented store ****/

  export const chosenCardList = {
    subscribe: (Subscription) => chosenCardListStore.subscribe(Subscription)
  }
