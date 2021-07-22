  import { writable } from 'svelte/store'

  import  { ValuesDiffer }  from 'webapp-tinkerer-runtime'
  import  { chosenApplet }  from '../stores/chosenApplet.js'
  import { chosenCardList } from '../stores/chosenCardList.js'

  let currentlyChosenApplet   = undefined
  let currentlyChosenCardList = []
  let currentSelectionList    = []

  const SelectionListStore = writable(currentSelectionList) // subscription mgmt
  const SelectionListSet   = new WeakMap()          // applet-specific selection

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentSelectionList = []
      } else {
        if (SelectionListSet.has(currentlyChosenApplet)) {
          currentSelectionList    = SelectionListSet.get(currentlyChosenApplet)
          currentlyChosenCardList = currentlyChosenApplet.CardList
          updateSelectionList()           // before "chosenCardList" was updated
        } else {
          currentSelectionList = []
          SelectionListSet.set(currentlyChosenApplet,currentSelectionList)
        }
        SelectionListStore.set(currentSelectionList)
      }
    }
  })

/**** keep track of changes in "chosenCardList" ****/

  chosenCardList.subscribe((newChosenCardList) => {
    if (ValuesDiffer(currentlyChosenCardList,newChosenCardList,'by-reference')) {
      currentlyChosenCardList = newChosenCardList
      updateSelectionList()
    }
  })

/**** updateSelectionList ****/

  function updateSelectionList () {
    if (currentSelectionList.length > 0) {
      let newSelectionList = currentSelectionList.filter(
        (Card) => (currentlyChosenCardList.indexOf(Card) >= 0)    // not optimal
      )
      if (ValuesDiffer(currentSelectionList,newSelectionList,'by-reference')) {
        currentSelectionList = newSelectionList
        SelectionListSet.set(currentlyChosenApplet,currentSelectionList)
        SelectionListStore.set(currentSelectionList)
      }
    }
  }

/**** select ****/

  function select (Card) {
    let CardIndex = currentSelectionList.indexOf(Card)
    if ((CardIndex < 0) && (currentCardList.indexOf(Card) >= 0)) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.push(Card)
      SelectionListStore.set(currentSelectionList)
    }
  }

/**** deselect ****/

  function deselect (Card) {
    let CardIndex = currentSelectionList.indexOf(Card)
    if (CardIndex >= 0) {
      currentSelectionList = currentSelectionList.slice()
        currentSelectionList.splice(CardIndex,1)
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

  export const selectedCardList = {
    subscribe: (Subscription) => SelectionListStore.subscribe(Subscription),
    set:setSelectionList, select, deselect, clear
  }
