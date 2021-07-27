  import { writable } from 'svelte/store'

//import type { WAT_Textline } from 'webapp-tinkerer-runtime'

  import { ValuesDiffer } from 'webapp-tinkerer-runtime'
  import { chosenApplet } from '../stores/chosenApplet.js'
/*
  export WAD_MessageType   = 'info' | 'warning' | 'error'
  export WAD_Message       = WAT_Textline
  export WAD_MessageSource = WAT_Name | WAT_Visual | undefined
*/
  const initialMessageState = {
    MessageType:'info', Message:'', MessageSource:undefined
  }

  let currentlyChosenApplet = undefined
  let currentMessageState = Object.assign({}, initialMessageState)

  const MessageStateStore = writable(currentMessageState)   // subscription mgmt
  const MessageStateSet   = new WeakMap()      // applet-specific Message states

/**** keep track of changes in "chosenApplet" ****/

  chosenApplet.subscribe((newChosenApplet) => {  // implements a "derived" store
    if (currentlyChosenApplet !== newChosenApplet) {
      currentlyChosenApplet = newChosenApplet

      if (currentlyChosenApplet == null) {
        currentMessageState = Object.assign({}, initialMessageState)
      } else {
        if (MessageStateSet.has(currentlyChosenApplet)) {
          currentMessageState = MessageStateSet.get(currentlyChosenApplet)
        } else {
          currentMessageState = Object.assign({}, initialMessageState)
          MessageStateSet.set(currentlyChosenApplet,currentMessageState)
        }
      }
      MessageStateStore.set(currentMessageState)
    }
  })

/**** validate changes to "MessageState" ****/

  function setMessageState (newMessageState) {
    if (currentlyChosenApplet != null) {
      if (ValuesDiffer(currentMessageState,newMessageState)) {
        currentMessageState = Object.assign({}, newMessageState)
        MessageStateSet.set(currentlyChosenApplet,newMessageState)
        MessageStateStore.set(newMessageState)
      }
    }
  }

/**** clearInfo, clearWarning, clearError ****/

  function clearInfo () {
    if (currentMessageState.MessageType === 'info') {
      setMessageState(initialMessageState)
    }
  }

  function clearWarning () {
    if (currentMessageState.MessageType !== 'error') {
      setMessageState(initialMessageState)
    }
  }

  function clearError () {
    setMessageState(initialMessageState)
  }

/**** showInfo, showWarning, showError ****/

  function showInfo (Message, MessageSource) {
    if (currentMessageState.MessageType === 'info') {
      setMessageState({ MessageType:'info', Message, MessageSource })
    }
  }

  function showWarning (Message, MessageSource) {
    if (currentMessageState.MessageType !== 'error') {
      setMessageState({ MessageType:'warning', Message, MessageSource })
    }
  }

  function showError (Message, MessageSource) {
    setMessageState({ MessageType:'error', Message, MessageSource })
  }

/**** export an explicitly implemented store ****/

  export const MessageState = {
    subscribe: (Callback) => MessageStateStore.subscribe(Callback),
    clearInfo, clearWarning, clearError, showInfo, showWarning, showError
  }
