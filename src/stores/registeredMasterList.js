  import { readable } from 'svelte/store'

  import {
    registeredMasters, ValuesDiffer
  } from 'webapp-tinkerer-runtime'

  let currentMasterList = []

  export const registeredMasterList = readable(currentMasterList, (set) => {
    function updateMasterList () {
      let newMasterList = registeredMasters().sort()
      if (ValuesDiffer(currentMasterList,newMasterList)) {
        currentMasterList = newMasterList
        set(newMasterList)
      }

      setTimeout(updateMasterList, 300)
    }

  /**** wait with monitoring until all masters have been loaded ****/

    if (
      (document.readyState === 'complete') ||
      (document.readyState === 'interactive')
    ) {
      updateMasterList()
    } else {
      window.addEventListener('DOMContentLoaded', updateMasterList)
    }

    return () => {}
  })

