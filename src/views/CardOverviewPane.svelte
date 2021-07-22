<style>
  .WAD-CardOverviewPane {
    display:flex; position:absolute; flex-flow:column nowrap;
    width:100%; height:100%;
    padding:4px;
  }

  span { line-height:24px }
</style>

<script context="module" lang="ts">
  import { chosenApplet } from '../stores/chosenApplet.js'
  import      Button      from '../components/Button.svelte'

/**** Colors ****/

  const normalColor  = '#AAAAAA'
  const hoveredColor = '#FFEC2E'
  const activeColor  = '#7FFF00' /* chartreuse */


</script>

<script lang="ts">
  function onDoubleClick () {
  }
</script>

<div class="WAD-CardOverviewPane" on:dblclick={onDoubleClick}>
  <div style="
    display:flex; flex-flow:row nowrap; align-items:flex-end;
    padding:0px; padding-bottom:2px;
    height:30px
  ">
    <span>Cards in&nbsp;</span>
    <span style="flex:1 1 auto; text-overflow:ellipsis">
      {$chosenApplet.Id}
    </span>
    <Button disabled>design</Button>
  </div>
</div>