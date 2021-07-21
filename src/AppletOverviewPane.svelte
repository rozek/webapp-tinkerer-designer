<style>
  .WAD-AppletOverviewPane {
    display:flex; position:relative; flex-flow:column nowrap;
    width:100%; height:100%;
    padding:4px;
  }
</style>

<script context="module" lang="ts">
  import { AppletList } from './AppletList.js'
  import    ListView    from 'svelte-sortable-flat-list-view'
</script>

<script lang="ts">
</script>

<div class="WAD-AppletOverviewPane">
  <div style="height:24px; line-height:22px">designable Applets:</div>
  <ListView style="flex:1 1 auto; border:solid 1px #969696; padding:2px"
    List={$AppletList} Key={(Applet,Index) => (Applet.Id || ('Applet #' + Index))}
    SelectionLimit={1}
  />
</div>