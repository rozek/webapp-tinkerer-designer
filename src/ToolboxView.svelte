<style>
  .WAD-Toolbox {
    display:block; position:absolute;
    width:160px; height:264px;
  }
</style>

<script context="module" lang="ts">
  import type {
    WAT_Applet, WAT_Dimension, WAT_Position
  } from 'webapp-tinkerer-runtime'
  import type { WAD_DialogState } from './Dialog.svelte'

  import      Dialog      from './Dialog.svelte'
  import { chosenApplet } from './chosenApplet.js'
  import { ToolboxState } from './ToolboxState.js'

/**** keep track of every Applet's Toolbox state ****/

  type WAD_ToolboxState = WAD_DialogState
</script>

<script lang="ts">
  export let Applet:WAT_Applet
  export let PositionAroundPreferredPosition:(Width:WAT_Dimension,Height:WAT_Dimension) => WAT_Position

$:if (Applet != null) {                                            // needs "$:"
    if (isNaN(($ToolboxState as WAD_ToolboxState).Width)) {
      ToolboxState.set({                 // internally requires (Applet != null)
        isVisible:true, Width:160,Height:264,    // "ToolboxView" knows its size
        Offset:{ x:NaN,y:NaN }       // but let "Dialog" compute actual position
      })
    }
  }

  function onClose () {
    let currentToolboxState = ($ToolboxState as WAD_ToolboxState)
    ToolboxState.set({ ...currentToolboxState,isVisible:true })    // because...
    chosenApplet.set(undefined)    // ..."chosenApplet" decides about visibility
  }
</script>

{#if $ToolboxState.isVisible}
  <Dialog class="WAD-Toolbox" {Applet} Title="WAT-Designer" resizable={false}
    {PositionAroundPreferredPosition} bind:State={$ToolboxState}
    on:close={onClose}
  >
  </Dialog>
{/if}
