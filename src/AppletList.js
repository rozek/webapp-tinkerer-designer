  import { readable } from 'svelte/store'

  import {
    AppletPeersInDocument, VisualForElement, ValuesDiffer
  } from 'webapp-tinkerer-runtime'

  let currentAppletList = []

  export const AppletList = readable(currentAppletList, (set) => {
    function updateAppletList () {
      let newAppletList = AppletPeersInDocument()
        .map((AppletPeer) => VisualForElement(AppletPeer))
        .filter((Applet) => Applet.mayBeDesigned)
      if (ValuesDiffer(currentAppletList,newAppletList)) {
        currentAppletList = newAppletList
        set(newAppletList)
      }

      setTimeout(updateAppletList, 300)
    }

    if (
      (document.readyState === 'complete') ||
      (document.readyState === 'interactive')
    ) {
      updateAppletList()
    } else {
      window.addEventListener('DOMContentLoaded', updateAppletList)
    }

    return () => {}
  })

