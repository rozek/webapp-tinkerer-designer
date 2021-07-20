<style>
  .WAD-Nudger {
    display:block; position:absolute;
    width:260px; height:148px;
  }
</style>

<script context="module" lang="ts">
  import type {
    WAT_Applet, WAT_Dimension, WAT_Position
  } from 'webapp-tinkerer-runtime'
  import type { WAD_DialogState } from './Dialog.svelte'

  import      Dialog      from './Dialog.svelte'
  import    IconButton    from './IconButton.svelte'
  import { chosenApplet } from './chosenApplet.js'
  import {  NudgerState } from './NudgerState.js'

/**** normal IconButton images as Data URLs ****/

  let MoveUpImageURL    = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAh0lEQVRYR+3XQQqAMAxE0fa6PVCuq3TRjaBJpuhHiHuZ78MK9gZfHd5vFVAC/xYws2OeojGG/CDyjXMYDVjj6zuiKsgCaMB1fEdBEkAD7sZVhbQAGuCNKwopATQgOp5VCAugAdnxjEJIAA1Qx6MKrgAasDseUXgUwAO++Gdw34G3IyqgBHCBE0spSCFzAkqKAAAAAElFTkSuQmCC'
  let MoveLeftImageURL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAiUlEQVRYR+3XSwqAMAxF0Xa7WVC2qzjIpBCa5ksljoV7+kDROYqvWdwfDegF/r0AIj7fUwYA7EFDFqAwPeJpgDWcBuDC4YBdOAwgDbsDTsNuAG3YDLCG7wfQCaxLuL2ItBA3gHYRd8ApJAwghYQDdpA0AAdJB6yQMoDknyPki0gSpnsa0AuUL/ACyt5IIUA+wvAAAAAASUVORK5CYII='
  let MoveRightImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAhklEQVRYR+3Xyw3AIAwDUFg3A2XdVj3kWuVjk6oKA+AnoyDYq3nt5vw1gGng2w2o6vVMiYjQoK8bG8BGlQEJARiQFAAJKQEQEAigAoECMhAKIAKhAjyQfwM8FxelAU+wHQ8UEAmGAjLBEEAluARABKcAyOAQgBHsApz4M9CeWl78AKaB9gZuy2VIIQlnVq4AAAAASUVORK5CYII='
  let MoveDownImageURL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAiklEQVRYR+2Wuw3AIAwFYV0P5HUT0VEk/kt+hRnAvjuBxF7NZzfvXwMwBbALMPNT8UqI6FdULNAOcOyzEJL9ma/egXaATAXN3lQAAiACYbE3F4AA8EBY7V0FIAAsEB57dwEIAAnCax8qAAHwBRGxDxeAALghovapAhAAFb8l9T9QsUSaMQBToL3AC0spSCGCz338AAAAAElFTkSuQmCC'

  let DecreaseHeightImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAlElEQVRYR+2USw7AIAgF9bociOu2caEhjcXwMbDAtcRxeNBb8OnB77cCKAN5DCDio5kIADB9wlSsAf7WHAGGGesvOVAWgLblFsQvwC4TNyC2AFwgvSFyZ2CEJzSEUgDJLpmtdG1BAWg2Y94xDF1EU2XoKqYQ3tuPZuU4hppgSWoWgGSG6QNWO3kMSLR53i0DZSDcwAti40whmNIJqgAAAABJRU5ErkJggg=='
  let DecreaseWidthImageURL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAjUlEQVRYR+2VUQrAIAxD9bo9UK+70UGhG2o3DbiP+Fsb42vQWjavuvn8QgMkQAIXAVU9RGSJxqwGDfyXwGimrRo0AyZm4ewFs1WHGXDxNwbiHjcQ+7OPzi54y8CX5ihuQhAD/ia4eDYCOAE/eGsGookRgWcNFsIsOL06DSwRmMWO6Fv6gmmABEiABBAETmT6sCHHOCicAAAAAElFTkSuQmCC'
  let IncreaseWidthImageURL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAnklEQVRYR+2VYQrAIAiF67oeqOtuNBBaWDYzhPH212nvfWnmFPzl4PMTBIAACDwESikXEW3RsNb4v4BKhh87ifJxAmYBszuVYqP/TQI4adSYUtxNgKaYp6a/VxbQ5muLrhp89cCX5LZ4LeQiYOSudyJRchPQigjpAXYbOgVa80hxtymwHD7bJ9pUHX8JNUNbG1ArvhKHABAAARAIJ3ADzKXQIRXj3OkAAAAASUVORK5CYII='
  let IncreaseHeightImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAnklEQVRYR+2VSw7AIAgF9boeyOu26UJDDEUf2GBSui46DB9zcv6y8/0pAMLAOQZqrZdmIkoppiRMwRrgMWYK8JixZimBigC0LF9BvAJwPYFCrCTAAkgNiUCoAWjNLD3wPwBkl7RSbh3DABgXjroJjxhD10XUVK4olPb8SvzWKdC8jlMAzaFITAdAZphegLwNHNg5BhBtO/8NA2HA3cANKa1sIQSaVB0AAAAASUVORK5CYII='

/**** keep track of every Applet's Nudger state ****/

  type WAD_NudgerState = WAD_DialogState
</script>

<script lang="ts">
  export let Applet:WAT_Applet
  export let PositionAroundPreferredPosition:(Width:WAT_Dimension,Height:WAT_Dimension) => WAT_Position

$:if (Applet != null) {                                            // needs "$:"
    if (isNaN(($NudgerState as WAD_NudgerState).Width)) {
      NudgerState.set({                  // internally requires (Applet != null)
        isVisible:true, Width:260,Height:148,     // "NudgerView" knows its size
        Offset:{ x:NaN,y:NaN }       // but let "Dialog" compute actual position
      })
    }
  }
</script>

{#if $NudgerState.isVisible}
  <Dialog class="WAD-Nudger" {Applet} Title="WAT-Designer: Nudger" resizable={false}
    {PositionAroundPreferredPosition} bind:State={$NudgerState}
  >
    <IconButton style="left:44px; top:4px"  ImageURL={MoveUpImageURL}/>
    <IconButton style="left:4px;  top:44px" ImageURL={MoveLeftImageURL}/>
    <IconButton style="left:84px; top:44px" ImageURL={MoveRightImageURL}/>
    <IconButton style="left:44px; top:84px" ImageURL={MoveDownImageURL}/>

    <IconButton style="left:184px; top:4px"  ImageURL={DecreaseHeightImageURL}/>
    <IconButton style="left:144px; top:44px" ImageURL={DecreaseWidthImageURL}/>
    <IconButton style="left:224px; top:44px" ImageURL={IncreaseWidthImageURL}/>
    <IconButton style="left:184px; top:84px" ImageURL={IncreaseHeightImageURL}/>
  </Dialog>
{/if}
