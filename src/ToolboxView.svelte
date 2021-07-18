<style>
  .WAD-Toolbox {
    display:block; position:absolute;
  }
</style>

<script context="module" lang="ts">
  import type {
    WAT_Applet, WAT_Dimension, WAT_Position
  } from 'webapp-tinkerer-runtime'

  import { ToolboxState } from './ToolboxState.js'
  import { asDraggable  } from 'svelte-drag-and-drop-actions'

/**** keep track of every Applet's Toolbox state ****/

  type WAD_ToolboxState = {
    Offset:WAT_Position
  }
  let ToolboxStateSet = new WeakMap<WAT_Applet,WAD_ToolboxState>()
</script>

<script lang="ts">
  export let Applet:WAT_Applet
  export let preferredPosition:WAT_Position
  export let PositionAround:(preferredPosition:WAT_Position, Width:WAT_Dimension,Height:WAT_Dimension) => WAT_Position

  let Offset:WAT_Position
  if (Applet != null) {
    Offset = (
      (ToolboxStateSet.get(Applet) as WAD_ToolboxState)?.Offset ||
      PositionAround(preferredPosition, 32,32)
    )
    ToolboxStateSet.set(Applet,{ Offset })                // reactive statement!
  }
</script>

<div class="WAD-Toolbox" style="">
</div>
