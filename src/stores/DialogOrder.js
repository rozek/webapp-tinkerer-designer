  import { writable } from 'svelte/store'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'

  let   currentDialogOrder = { Dialogs:[], zIndexOf }
  const DialogOrderStore = writable(currentDialogOrder)     // subscription mgmt

/**** validate changes to "DialogOrder" ****/

  function setDialogOrder (newDialogOrder) {
    if (ValuesDiffer(currentDialogOrder,newDialogOrder,'by-reference')) {
      currentDialogOrder = newDialogOrder
      DialogOrderStore.set(newDialogOrder)
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
