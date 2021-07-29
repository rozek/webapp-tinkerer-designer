<style>
  .WAD-AppletOverviewPane {
    display:flex; position:absolute; flex-flow:column nowrap;
    width:100%; height:100%;
    padding:4px;
  }
</style>

<script context="module" lang="ts">
  import type { WAT_Applet } from 'webapp-tinkerer-runtime'

  import       { Globals }      from '../stores/Globals.js'
  import     { AppletList }     from '../stores/AppletList.js'
  import    { chosenApplet }    from '../stores/chosenApplet.js'
  import { selectedAppletList } from '../stores/selectedAppletList.js'
  import         Button         from '../components/Button.svelte'
  import        IconImage       from '../components/IconImage.svelte'
  import        ListView        from 'svelte-sortable-flat-list-view'

  let smallChooseSelectionImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAG5JREFUOE/t1EEOABAMBEC+2wf1u8RBUkJ3JeXEWaZLlpyCVw720l1QVcucWESOhg6bV2AfwMJwuh3CoBBsCTsaBp6gVMIPutf07g69ktvXNFfJTYjQVS/hkXforuQQtB1k3jUFXik2+xHTCVmwAr8+PBWXrjCNAAAAAElFTkSuQmCC'
</script>

<script lang="ts">
  let AppletListView:ListView

  let lastTouchedApplet:Applet | undefined = undefined
  function selectApplet (Event:CustomEvent) {           // triggered by ListView
    lastTouchedApplet = Event.detail
  }

  function deselectApplet (Event:CustomEvent) {         // triggered by ListView
    lastTouchedApplet = (
      AppletList.contains(Event.detail) ? Event.detail : undefined
    )
  }

  function onDoubleClick () {
    AppletListView.select(lastTouchedApplet)
    chooseSelection()
  }

$:chosable = (
    ($selectedAppletList.length === 1) && ($chosenApplet !== $selectedAppletList[0])
  )

  function chooseSelection () {
    let Applet = $selectedAppletList[0]
    if (Applet != null) { chosenApplet.set(Applet) }
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
    style="flex:1 1 auto; border:solid 1px {$Globals.normalColor}; padding:2px"
    List={$AppletList} Key={(Applet,Index) => Applet.Id} withTransitions={false}
    SelectionLimit={1} bind:SelectionList={$selectedAppletList}
    let:Item={Applet} let:Index={Index}
  >
    <div style="color:{
      $selectedAppletList.indexOf(Applet) < 0
      ? (Applet === $chosenApplet ? $Globals.activeColor : $Globals.normalColor)
      : $Globals.ShadowColor
    }">
      {Applet.Id || ('Applet #' + Index)}
    </div>
  </ListView>
</div>