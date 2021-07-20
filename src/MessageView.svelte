<style>
  .WAD-MessageView {
    display:block; position:relative; overflow:hidden;
    height:34px; line-height:34px; text-align:left;
    border:none; border-top:solid 1px var(--normal-color);
    padding:0px 34px 0px 4px; /* makes room for resize handle */
    white-space:nowrap; text-overflow:ellipsis
  }

  .info    { color:var(--info-color) }
  .warning { color:var(--warning-color) }
  .error   { color:#FF4500 } /* orangered */
</style>

<script context="module" lang="ts">
  import { MessageState } from './MessageState.js'

/**** Colors ****/

  const normalColor  = '#969696'
  const hoveredColor = '#FFEC2E'
  const activeColor  = '#7FFF00' /* chartreuse */


</script>

<div class="WAD-MessageView" style={
  `--normal-color:${normalColor};` +
  `--info-color:${normalColor}; --warning-color:${hoveredColor}`
} class:info   ={$MessageState.MessageType === 'info'}
  class:warning={$MessageState.MessageType === 'warning'}
  class:error  ={$MessageState.MessageType === 'error'}
>{$MessageState.Message}</div>
