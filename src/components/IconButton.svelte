<style>
  .WAD-IconButton {
    display:block; position:absolute;
    border:0px; outline:inherit; background:transparent; padding:0px;

    -webkit-appearance:none; appearance:none;
  }
</style>

<script context="module" lang="ts">
  import IconImage from './IconImage.svelte'
</script>

<script lang="ts">
  export let ImageURL:string                               // bitmap as Data URL
  export let disabled:boolean = false
  export let active:boolean   = false
  export let activeURL:string = undefined     // opt. image URL for active state
</script>

<button {...$$restProps} class:WAD-IconButton={true} {disabled} on:click>
  <IconImage {ImageURL} {activeURL} {active} {disabled}/>
</button>

