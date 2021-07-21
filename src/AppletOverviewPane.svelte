<style>
  .WAD-AppletOverviewPane {
    display:flex; position:absolute; flex-flow:column nowrap;
    width:100%; height:100%;
    padding:4px;
  }
</style>

<script context="module" lang="ts">
  import type { WAT_Applet } from 'webapp-tinkerer-runtime'

  import {     AppletList     } from './AppletList.js'
  import {    chosenApplet    } from './chosenApplet.js'
  import { selectedAppletList } from './selectedAppletList.js'
  import        ListView        from 'svelte-sortable-flat-list-view'
  import         Button         from './Button.svelte'

/**** Colors ****/

  const normalColor  = '#AAAAAA'
  const hoveredColor = '#FFEC2E'
  const activeColor  = '#7FFF00' /* chartreuse */


</script>

<script lang="ts">
  function selectApplet (Event:CustomEvent) {
    selectedAppletList.select(Event.detail)
  }

  function deselectApplet (Event:CustomEvent) {
    selectedAppletList.deselect(Event.detail)
  }

  function onDoubleClick () {
    let Applet = $selectedAppletList[0]
      selectedAppletList.clear()
      selectedAppletList.select(Applet)
    chosenApplet.set(Applet)
  }

  function editSelection () {
    let Applet = $selectedAppletList[0]
    if (Applet != null) {  chosenApplet.set(Applet) }
  }
</script>

<div class="WAD-AppletOverviewPane" on:dblclick={onDoubleClick}>
  <div style="
    display:flex; flex-flow:row nowrap; align-items:flex-end;
    padding:0px; padding-bottom:2px;
    height:30px
  ">
    <span style="flex:1 1 auto; line-height:24px">designable Applets:</span>
    <Button disabled={
      ($selectedAppletList.length === 0) || ($chosenApplet === $selectedAppletList[0])
    } on:click={editSelection}
    >design</Button>
  </div>

  <ListView style="flex:1 1 auto; border:solid 1px #969696; padding:2px"
    List={$AppletList} Key={(Applet,Index) => Applet.Id}
    SelectionLimit={1}
    on:selected-item={selectApplet} on:deselected-item={deselectApplet}
    let:Item={Applet} let:Index={Index}
  >
    <div style="color:{
      $selectedAppletList.indexOf(Applet) < 0
      ? (Applet === $chosenApplet ? activeColor : normalColor)
      : '#454545'
    }">
      {Applet.Id || ('Applet #' + Index)}
    </div>
  </ListView>
</div>