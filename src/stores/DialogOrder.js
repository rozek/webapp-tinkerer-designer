  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import { chosenApplet } from '../stores/chosenApplet.js'

  const initialDialogOrder = { Dialogs:[], zIndexOf }

  let currentlyChosenApplet = undefined
  let currentDialogOrder = { Dialogs:[], zIndexOf }

  const DialogOrderStore = writable(currentDialogOrder)     // subscription mgmt
  const DialogOrderSet   = new WeakMap()        // applet-specific dialog orders

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentDialogOrder = { Dialogs:initialDialogOrder.Dialogs.slice(), zIndexOf }
      } else {
        if (DialogOrderSet.has(currentlyChosenApplet)) {
          currentDialogOrder = DialogOrderSet.get(currentlyChosenApplet)
        } else {
          currentDialogOrder = { Dialogs:initialDialogOrder.Dialogs.slice(), zIndexOf }
          DialogOrderSet.set(currentlyChosenApplet,currentDialogOrder)
        }
        DialogOrderStore.set(currentDialogOrder)
      }
    }
  })

/**** validate changes to "DialogOrder" ****/

  function setDialogOrder (newDialogOrder) {
    if (currentlyChosenApplet != null) {
      if (ValuesDiffer(currentDialogOrder,newDialogOrder,'by-reference')) {
        currentDialogOrder = newDialogOrder
        DialogOrderSet.set(currentlyChosenApplet,newDialogOrder)
        DialogOrderStore.set(newDialogOrder)
      }
    }
  }

/**** open ****/

  function open (DialogElement) {
    if (
      (DialogElement != null) &&
      (currentDialogOrder.Dialogs.indexOf(DialogElement) < 0)
    ) {
      let Dialogs = currentDialogOrder.Dialogs.slice()
        Dialogs.push(DialogElement)
      setDialogOrder({ Dialogs, zIndexOf })
    }
  }

/**** close ****/

  function close (DialogElement) {
    if (DialogElement != null) {
      let DialogIndex = currentDialogOrder.Dialogs.indexOf(DialogElement)
      if (DialogIndex >= 0) {
        let Dialogs = currentDialogOrder.Dialogs.slice()
          Dialogs.splice(DialogIndex,1)
        setDialogOrder({ Dialogs, zIndexOf })
      }
    }
  }

/**** raise ****/

  function raise (DialogElement) {
    if (DialogElement != null) {
      let DialogIndex = currentDialogOrder.Dialogs.indexOf(DialogElement)
      if (DialogIndex >= 0) {
        let Dialogs = currentDialogOrder.Dialogs.slice()
          Dialogs.splice(DialogIndex,1)
          Dialogs.push(DialogElement)
        setDialogOrder({ Dialogs, zIndexOf })
      }
    }
  }

/**** zIndexOf ****/

  function zIndexOf (DialogElement) {
    if (DialogElement != null) {
      let DialogIndex = currentDialogOrder.Dialogs.indexOf(DialogElement)
      if (DialogIndex >= 0) { return 1000000 + DialogIndex }
    }
    return 'auto'
  }

/**** export an explicitly implemented store ****/

  export const DialogOrder = {
    subscribe: (Callback) => DialogOrderStore.subscribe(Callback),
    open, close, raise, zIndexOf
  }
