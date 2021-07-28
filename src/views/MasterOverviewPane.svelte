<style>
  .WAD-MasterOverviewPane {
    display:flex; position:absolute; flex-flow:column nowrap;
    width:100%; height:100%;
    padding:4px;
  }
</style>

<script context="module" lang="ts">
  import Button from '../components/Button.svelte'
  import { Globals } from '../stores/Globals.js'
</script>

<script lang="ts">
  function onDoubleClick () {
  }
</script>

<div class="WAD-MasterOverviewPane" on:dblclick={onDoubleClick}>
  <div style="
    display:flex; flex-flow:row nowrap; align-items:flex-end;
    padding:0px; padding-bottom:2px;
    height:30px
  ">
    <span style="flex:1 1 auto; line-height:24px">known Masters:</span>
    <Button disabled>design</Button>
  </div>
</div>