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
  .error   { color:var(--error-color) }
</style>

<script context="module" lang="ts">
  import   { Globals }    from '../stores/Globals.js'
  import { MessageState } from '../stores/MessageState.js'

/**** Colors ****/

  Globals.define({
    normalColor: '#C0C0C0', /* silver */
    hoveredColor:'#FFD700', /* gold */
    activeColor: '#ADFF2F'  /* greenyellow */
  })


</script>

<div class="WAD-MessageView" style="
  --info-color:{$Globals.InfoColor};
  --warning-color:{$Globals.WarningColor};
  --error-color:{$Globals.ErrorColor};
" class:info   ={$MessageState.MessageType === 'info'}
  class:warning={$MessageState.MessageType === 'warning'}
  class:error  ={$MessageState.MessageType === 'error'}
>{$MessageState.Message}</div>
