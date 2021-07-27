<style>
  .WAD-Button {
    height:28px;
    border:solid 1px #303030; border-radius:4px;
    background-image:linear-gradient(180deg, #808080,#404040 70%);
    background-image:-webkit-linear-gradient(270deg, #808080,#404040 70%);
    color:#B4B4B4;
    font-size:inherit; font-weight:bold;

    -webkit-appearance:none; appearance:none;
  }

  .WAD-Button:hover:not(:disabled) {
    border-color:#FFEC2E;
    color:#FFEC2E;
  }

  .WAD-Button:active {
    background-image:linear-gradient(0deg, #808080,#404040 70%);
    background-image:-webkit-linear-gradient(90deg, #808080,#404040 70%);
  }

  .WAD-Button[active="true"] {
    color:#7FFF00;
  }

  .WAD-Button:disabled {
    opacity:0.3;
  }
</style>

<script lang="ts">
  export let active:boolean   = false
  export let disabled:boolean = false
</script>

<button {...$$restProps} class:WAD-Button={true} {active} {disabled} on:click>
  <slot {active} {disabled}>(Button)</slot>
</button>