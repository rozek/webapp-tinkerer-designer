<style>
  .WAD-AppletOverviewPane {
    display:flex; position:absolute; flex-flow:column nowrap;
    width:100%; height:100%;
    padding:4px;
  }
</style>

<script context="module" lang="ts">
  import type { WAT_Applet } from 'webapp-tinkerer-runtime'

  import {     AppletList     } from '../stores/AppletList.js'
  import {    chosenApplet    } from '../stores/chosenApplet.js'
  import { selectedAppletList } from '../stores/selectedAppletList.js'
  import         Button         from '../components/Button.svelte'
  import        IconImage       from '../components/IconImage.svelte'
  import        ListView        from 'svelte-sortable-flat-list-view'

  let smallChooseSelectionImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAG5JREFUOE/t1EEOABAMBEC+2wf1u8RBUkJ3JeXEWaZLlpyCVw720l1QVcucWESOhg6bV2AfwMJwuh3CoBBsCTsaBp6gVMIPutf07g69ktvXNFfJTYjQVS/hkXforuQQtB1k3jUFXik2+xHTCVmwAr8+PBWXrjCNAAAAAElFTkSuQmCC'

/**** Colors ****/

  const normalColor  = '#AAAAAA'
  const hoveredColor = '#FFEC2E'
  const activeColor  = '#7FFF00' /* chartreuse */


</script>

<script lang="ts">
  let AppletListView:ListView

  function selectApplet (Event:CustomEvent) {           // triggered by ListView
    selectedAppletList.select(Event.detail)
  }

  function deselectApplet (Event:CustomEvent) {         // triggered by ListView
    selectedAppletList.deselect(Event.detail)
  }

  function onDoubleClick () {
    let Applet = $selectedAppletList[0]
      selectedAppletList.clear()
      selectedAppletList.select(Applet)
    chosenApplet.set(Applet)

    AppletListView.select(Applet)
  }

$:chosable = (
    ($selectedAppletList.length === 1) && ($chosenApplet !== $selectedAppletList[0])
  )

  function chooseSelection () {
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
    <Button disabled={! chosable} style="padding:2px" on:click={chooseSelection}>
      <IconImage ImageURL={smallChooseSelectionImageURL} disabled={! chosable}
        style="width:20px; height:20px"/>
    </Button>
  </div>

  <ListView bind:this={AppletListView}
    style="flex:1 1 auto; border:solid 1px {normalColor}; padding:2px"
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