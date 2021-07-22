<style>
  .WAD-SelectionScriptPane {
    display:flex; position:absolute; flex-flow:column nowrap;
    width:100%; height:100%;
    padding:4px;
  }

  span { line-height:24px }
</style>

<script context="module" lang="ts">
</script>

<script lang="ts">
  function onDoubleClick () {
  }
</script>

<div class="WAD-SelectionScriptPane" on:dblclick={onDoubleClick}>
  <div style="
    display:flex; flex-flow:row nowrap; align-items:flex-end;
    padding:0px; padding-bottom:2px;
    height:30px
  ">
    <span style="flex:1 1 auto">Script of XXX</span>
  </div>
</div>