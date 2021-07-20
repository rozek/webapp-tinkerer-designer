<style>
  .WAD-Dialog {
    display:flex; flex-flow:column nowrap;
    position:absolute; z-index:10000;
    overflow:hidden;
    border:solid 1px #454545; border-radius:8px;
    background-color:#555555;
    box-shadow:0px 0px 60px 0px rgba(0,0,0,0.5);

    font-family:"Source Sans Pro","Helvetica Neue",Helvetica,Arial,sans-serif;
    font-size:14px; line-height:normal; text-align:left;
    color:#CCCCCC;

    pointer-events:auto;

    -webkit-touch-callout:none;
    -ms-touch-action:none; touch-action:none;
    -moz-user-select:none; -webkit-user-select:none; -ms-user-select:none; user-select:none;
  }

/**** Titlebar and Title ****/

  .WAD-Titlebar {
    display:flex; flex-flow:row nowrap; flex:0 0 auto;
    position:relative; overflow:hidden;
    height:24px;
    min-width:60px; min-height:24px;

    border-top-left-radius:7px; border-top-right-radius:7px;
    background-image:linear-gradient(180deg, rgb(128,128,128),rgb(64,64,64) 70%);
    background-image:-webkit-linear-gradient(270deg, rgb(128,128,128),rgb(64,64,64) 70%);
    background-clip:border-box; -webkit-background-clip:border-box;
    cursor:-webkit-grab; cursor:grab;
  }

  .WAD-Title {
    display:inline-block; position:relative; flex:1 1 auto;
    padding:0px 4px 0px 4px;
    background-color:transparent;
    line-height:24px; color:#7FFF00; /* chartreuse */
    /* pointer-events:none; */
  }

/**** CloseButton ****/

  .WAD-CloseButton {
    display:inline-block; position:relative; flex:0 0 auto;
    width:24px; height:24px;
    background-color:transparent;
    background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAhElEQVRIS+2UQQ7AIAgE9bs8iO+24WBiDDIcStomenXdgVXsrXj1Yv92AJjwexGp6jXKExG3kIxm28F82EArhPZHcWnADFnNvQIQYALPyLvVXYSmxUsmSGSeAkSdkPk3AKURkTnNSRhR9BQfeaY0SLSPc5D5BjIanAP8LkFwAJjg/yO6AX98SBk+NsXnAAAAAElFTkSuQmCC");
    cursor:pointer;
  }

  .WAD-CloseButton:hover {
    width:24px; height:24px;
    background-color:transparent;
    background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAi0lEQVRIS+2UwQ2AMAwDmx2Yg/3nYA52aFUkUBU1ufCI4FG+CT7X1EhJfiRZvywAJvxdRPXc621PtmNqJLJjnmB8uYM0hOaPOStELTBCvJnWc7/BTGhmyIrwMkXXgCCeeAjQlywIif8DkBoRiVNP3IjSrykVieavipbyq6B+ROdYtKiQtbcAmGB6RA0CC0gZD0CxdwAAAABJRU5ErkJggg==");
  }

/**** ContentArea ****/

  .WAD-ContentArea {
    display:inline-flex; flex-flow:column nowrap; flex:1 1 auto;
    position:relative; overflow:hidden;
    min-height:24px;
  }

/**** ResizeHandle ****/

  .WAD-ResizeHandle {
    display:block; position:absolute;
    right:0px; bottom:0px; width:32px; height:32px;
    background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAiklEQVRYR+WUwQ3AIAwDm3UzUNZtxQ8hhBpIbGhZIKezsVzkJ4z7ZnaXu6oq/wSorVMMwAHqzNvOQQzQAUY/DWIADjBSXmDSd4AO4FnXb3TAozxlB+gAnsxTDMABVpSH7AAdYEX5mR2IVD5lgA4QmfmUAThApvJXO0AHyFS+ZweQyrsG6ADIzNtbD4OSoCHdTWtaAAAAAElFTkSuQmCC");

    -webkit-touch-callout:none;
    -ms-touch-action:none; touch-action:none;
    -moz-user-select:none; -webkit-user-select:none; -ms-user-select:none; user-select:none;
  }

  .WAD-ResizeHandle:hover {
    background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAj0lEQVRYR+WU0Q2AIBBDvR2cw/3ncA53wPBHiCEeXFtQFriX11LbxM8U99N1pHzX9tP+CVBalxigA5SZ152jGJADtH4axQAdoKU8w8B3QA7gWddvdMCjHLIDcgBP5hADdIAR5SE7IAcYUb5mByKVdxmQA0Rm3mWADoBU/moH5ABI5XN2gKn80YAcgJl5fesG8FKgIRkBhjAAAAAASUVORK5CYII=");
  }
</style>

<script context="module" lang="ts">
  import type {
    WAT_Applet, WAT_Dimension, WAT_Position
  } from 'webapp-tinkerer-runtime'

  import {      asDraggable      } from 'svelte-drag-and-drop-actions'
  import { createEventDispatcher } from 'svelte'

  import IconButton from './IconButton.svelte'

  export type WAD_DialogState = {
    isVisible:boolean,
    Offset:WAT_Position, Width:number, Height:number
  }

/**** normal CloseButton and ResizeHandle image as Data URL ****/

  let CloseButton_ImageURL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAhElEQVRIS+2UQQ7AIAgE9bs8iO+24WBiDDIcStomenXdgVXsrXj1Yv92AJjwexGp6jXKExG3kIxm28F82EArhPZHcWnADFnNvQIQYALPyLvVXYSmxUsmSGSeAkSdkPk3AKURkTnNSRhR9BQfeaY0SLSPc5D5BjIanAP8LkFwAJjg/yO6AX98SBk+NsXnAAAAAElFTkSuQmCC'
  let ResizeHandle_ImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAiklEQVRYR+WUwQ3AIAwDm3UzUNZtxQ8hhBpIbGhZIKezsVzkJ4z7ZnaXu6oq/wSorVMMwAHqzNvOQQzQAUY/DWIADjBSXmDSd4AO4FnXb3TAozxlB+gAnsxTDMABVpSH7AAdYEX5mR2IVD5lgA4QmfmUAThApvJXO0AHyFS+ZweQyrsG6ADIzNtbD4OSoCHdTWtaAAAAAElFTkSuQmCC'
</script>

<script lang="ts">
  const dispatch = createEventDispatcher()

  export let Applet:WAT_Applet
  export let Title:string
  export let resizable:boolean = false
  export let minWidth:number   = 120
  export let minHeight:number  = 80
  export let State:WAD_DialogState
  export let PositionAroundPreferredPosition:(Width:WAT_Dimension,Height:WAT_Dimension) => WAT_Position

$:if ((Applet != null) && isNaN(State.Offset.x)) {              // requires "$:"
    let GeometryOnDisplay = Applet.GeometryOnDisplay
    let PositionOnDisplay = PositionAroundPreferredPosition(State.Width,State.Height)
    State = { ...State, Offset:{
      x: PositionOnDisplay.x - GeometryOnDisplay.x,
      y: PositionOnDisplay.y - GeometryOnDisplay.y
    }}
  }

/**** Event Handling ****/

  function onDragStart ()                 { return State.Offset }
  function onDragMove (x:number,y:number) { State.Offset = { x,y } }

  function startResizing () { return { x:State.Width,y:State.Height } }
  function continueResizing (x:number,y:number) {
    State.Width  = Math.max(minWidth,x)
    State.Height = Math.max(minHeight,y)
  }

  function closeDialog () {
    State.isVisible = false
    dispatch('close')
  }
</script>

{#if (Applet != null) && State.isVisible}
  <div {...$$restProps} class="WAD-Dialog" style="
    left:{Applet.x + State.Offset.x}px; top:{Applet.y + State.Offset.y}px;
    width:{State.Width}px; height:{State.Height}px
  ">
    <div class="WAD-Titlebar"
      use:asDraggable={{ relativeTo:document.body, onDragStart, onDragMove }}
    >
      <div class="WAD-Title">{Title}</div>
      <div class="WAD-CloseButton" on:click={closeDialog}>
        <IconButton style="width:24px; height:24px" ImageURL={CloseButton_ImageURL}/>
      </div>
    </div>

    <div class="WAD-ContentArea">
      <slot></slot>
    </div>

    {#if resizable}
      <div class="WAD-ResizeHandle" use:asDraggable={{
        onDragStart:startResizing, onDragMove:continueResizing
      }}>
        <IconButton ImageURL={ResizeHandle_ImageURL} />
      </div>
    {/if}
  </div>
{/if}
