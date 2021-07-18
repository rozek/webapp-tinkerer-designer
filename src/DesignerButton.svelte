<style>
  .WAD-DesignerButton {
    display:block; position:absolute;
    width:32px; height:32px;
    cursor:pointer; pointer-events:auto;
  }
</style>

<script context="module" lang="ts">
  import      {       asDraggable        } from 'svelte-drag-and-drop-actions'
  import              IconButton           from './IconButton.svelte'
  import type { WAT_Applet, WAT_Position } from 'webapp-tinkerer-runtime'

  let ImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABA0lEQVRYR82WSw6EMAxD4bo9UK/LiAWjTCYfO6lUWEKwX01ocx6br3Oz/0EDzDmvCHqMQWlCxZmpB4TApADaPBNl610AVkingL5vAsiXsxVnTZxphQBd8wfugbD0/gCi4my10lCbebo/AFlcCICn4d03AarRW7+r1LJSWAYgxb24Q4DOt0fMvYb8JlAFYMxvCO3TAmDNlwJUzJcBVM2XAHTM2wBd8xbACvMQwHqo/125FVd2y/JOiJ7t2VkBA9xC1h6u72eG8jl0GEWfgTGzaqHjGBkgKiDUQCJT6ERuNTA0EXmdz3Y92rjvHcu9DmZ6AEktTUAbWmNXZ4OiAZgEkNrtAB9tuDAwYD8R4wAAAABJRU5ErkJggg=='

  let ButtonOffset = new WeakMap<WAT_Applet,WAT_Position>()// remember positions
</script>

<script lang="ts">
  export let Applet:WAT_Applet
  export let startDesigning:Function

  let Offset:WAT_Position = (
    (ButtonOffset.get(Applet) as WAT_Position) || { x:Applet.Width-32-2, y:2 }
  )
  ButtonOffset.set(Applet,Offset)                         // reactive statement!

  function onDragStart ()                 { return Offset }
  function onDragMove (x:number,y:number) { Offset = { x,y } }

  function onClick () { startDesigning(Applet) }
</script>

<div class="WAD-DesignerButton" style="
  left:{Applet.x + Offset.x}px; top:{Applet.y + Offset.y}px
" use:asDraggable={{ onDragStart, onDragMove }}
  on:click={onClick}
>
  <IconButton {ImageURL}></IconButton>
</div>

