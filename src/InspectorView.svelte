<style>
  .WAD-Inspector {
    min-width:300px; min-height:420px;
  }
</style>

<script context="module" lang="ts">
  import type {
    WAT_Applet, WAT_Dimension, WAT_Position
  } from 'webapp-tinkerer-runtime'
  import type { WAD_DialogState } from './Dialog.svelte'

  import       Dialog       from './Dialog.svelte'
  import     IconButton     from './IconButton.svelte'
  import {  chosenApplet  } from './chosenApplet.js'
  import { InspectorState } from './InspectorState.js'

/**** normal IconButton images as Data URLs ****/

  let ImageURL = ''

/**** keep track of every Applet's Inspector state ****/

  type WAD_InspectorState = WAD_DialogState
</script>

<script lang="ts">
  export let Applet:WAT_Applet
  export let PositionAroundPreferredPosition:(Width:WAT_Dimension,Height:WAT_Dimension) => WAT_Position

$:if (Applet != null) {                                            // needs "$:"
    if (isNaN(($InspectorState as WAD_InspectorState).Width)) {
      InspectorState.set({               // internally requires (Applet != null)
        isVisible:true, Width:300,Height:420,  // "InspectorView" knows its size
        Offset:{ x:NaN,y:NaN }       // but let "Dialog" compute actual position
      })
    }
  }
</script>

{#if $InspectorState.isVisible}
  <Dialog class="WAD-Inspector" {Applet} Title="WAT-Designer: Inspector" resizable={true}
    {PositionAroundPreferredPosition} bind:State={$InspectorState}
  >
  </Dialog>
{/if}
