<style>
  .WAD-AppletOverviewPane {
    display:flex; position:absolute; flex-flow:column nowrap;
    width:100%; height:100%;
    padding:4px;
  }
</style>

<script context="module" lang="ts">
  import {     AppletList     } from './AppletList.js'
  import {    chosenApplet    } from './chosenApplet.js'
  import { selectedAppletList } from './selectedAppletList.js'
  import        ListView        from 'svelte-sortable-flat-list-view'
</script>

<script lang="ts">
  function selectApplet (Event) {
    selectedAppletList.select(Event.detail)
  }

  function deselectApplet (Event) {
    selectedAppletList.deselect(Event.detail)
  }

  function chooseApplet () {
    let Applet = $selectedAppletList[0]
      selectedAppletList.clear()
      selectedAppletList.select(Applet)
    chosenApplet.set(Applet)
  }
</script>

<div class="WAD-AppletOverviewPane" on:dblclick={chooseApplet}>
  <div style="height:24px; line-height:22px">designable Applets:</div>
  <ListView style="flex:1 1 auto; border:solid 1px #969696; padding:2px"
    List={$AppletList} Key={(Applet,Index) => (Applet.Id || ('Applet #' + Index))}
    SelectionLimit={1}
    on:selected-item={selectApplet} on:deselected-item={deselectApplet}
  />
</div>