<style>
  .WAD-Toolbox {
    display:block; position:absolute;
    width:160px; height:264px;
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
  import { ToolboxState } from './ToolboxState.js'

/**** normal IconButton images as Data URLs ****/

  let LayouterImageURL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABA0lEQVRYR82WSw6EMAxD4bo9UK/LiAWjTCYfO6lUWEKwX01ocx6br3Oz/0EDzDmvCHqMQWlCxZmpB4TApADaPBNl610AVkingL5vAsiXsxVnTZxphQBd8wfugbD0/gCi4my10lCbebo/AFlcCICn4d03AarRW7+r1LJSWAYgxb24Q4DOt0fMvYb8JlAFYMxvCO3TAmDNlwJUzJcBVM2XAHTM2wBd8xbACvMQwHqo/125FVd2y/JOiJ7t2VkBA9xC1h6u72eG8jl0GEWfgTGzaqHjGBkgKiDUQCJT6ERuNTA0EXmdz3Y92rjvHcu9DmZ6AEktTUAbWmNXZ4OiAZgEkNrtAB9tuDAwYD8R4wAAAABJRU5ErkJggg=='
  let EventLockImageURL = ''
  let NudgerImageURL    = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAo0lEQVRYR+2WUQ7AIAhD9boeiOtu8YPEmG1CIUEX9g32WYuuluCvBuuXBEgHTA4Q0dVD3FqD14Ebu3AoAIvzGKMuwA6EAsziFhcgB8IBPK9vsQPSxEvreBNLAG3YtPWvAOg5a/v2BeAz0lqqrV9mYAZZ3XjuIfQcuae1xA6MzdqgfW3iTIDxKba8A70XcmALgPAfki0APEYUzoCHuCmECfAbB26pGWAhx+HZtAAAAABJRU5ErkJggg=='
  let InspectorImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA6UlEQVRYR+2WSw6AIAxE9bociOtqWDTBSjvTotEF7gyh8zr9hH37+Ns/1t8WwHIg5UCt9Rg1byklHC90wRLWMBEQGmAkLkLeGRpzCgBZjs49CAjQB9cZo/8mjMrhAujMkKBVEg9iAZgOMF2PStI3n1WGKQBr/iNjGQJAM+2d0w6w2y4Lo0EuDrwtLtA9xK0Eb0O4DmRtnbnnNiFao6xwc5VuQgnqXWKFmVhwFc+6gBL5N0CzEGXglYO5C98DWQhGvMWmAASCeWDIHmF7hwboO3oEEhWWeGEADTJar5ExTQNERKYepU8JWXFOXsLIIZeR3YwAAAAASUVORK5CYII='

  let UndoImageURL     = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAz0lEQVRYR+2WUQrAIAxD53U9kNfd8KNQRG0a3crA/Y1p85ZUbLqCnxSsfx2ALQ6UUu6cM1WL2qT7porX9xAAEQ8B0OKfA7TiEgkTA9UDIwAGhAKoQr0ImFhogBZC2+9pziUADdHmjx7PZQCB6DUgArEFYHShhQPMIhLoVx34NwCSHzLMWHWGEVgbEfGlCMIBEHrLBeQnpqcAKTCDQPabxxAp0oNA98EAnqFj+2WEXrPoOu2Y6UBvALWazzMZuQBEOHwksxzwfKcc8AhYaw/AA7TnkCErkZMFAAAAAElFTkSuQmCC'
  let RedoImageURL     = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAwklEQVRYR+2WSw7AIAhE63U9kNdtw4LEEHX4+OnCLm1wHkMA03P4S4f1nwvgdqCU8uac3fFcevcFBECXRCHCAFGIKQARCBcA2y9b2FMOE0BPmEGWAUhhEmqdeYYadKAWqjPsnVsh1ADS3i1tOBLZMohmZTkqS7cEO8QJ7AIsdwCV8gIMBxGyD009Tfy/AShDTRYtJ7Rx6l1geXRYFhUEqF1Ae9+zolUALIweJAiwVSoTAAJZ9iJC7Rb573IgIihjL8AHRW6QIYYSsiYAAAAASUVORK5CYII='
  let SaveImageURL     = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAoUlEQVRYR+2W2w6AIAhA9Xf9IH+3xoObYwl4YVDRW4vwcJQiJ+MrG6+fAiAM+DVQa712OqSUIipuGIQBqIQttsXge6oQVQBYmDOhDsBBfAMA7/HM+REb0OoI/wDcKabMSNqRNeAGoD9YACWpThLzHgMrXXDUQJ/sqc/xFgHwUQBzA/8FWKkcv0N9S8ipZXcq4n7F8Fw0Np2wMMoRAGHA3MAN5uOoIQ8aGmQAAAAASUVORK5CYII='
  let SettingsImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAApklEQVRYR+1WQQ6AIAyD7/IgvqvhQLJMsNsk4KHejKOt7ZzL6fCVD/MnCgg7UGu9enyllDCO+aAmRPfW3goJQOAeR14FyLdEpLPnSAwFDB1YYb2OZBYFBUybEMUgLfXU6mgeAhBYAxjlGT1HAf/rgZaxJU/vaOYccDnQ7V0RBf+GnxyQne6JA5FK3NBK1gi274T6u9++FXsHj7XeHIEV0FtHAccduAHWc4AhlpaqkQAAAABJRU5ErkJggg=='

  let CreateImageURL     = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAYUlEQVRYR+2WyQ0AIAgEpV0Kol1tQELWh2gyfj0YJ27QRvOw5voDAAz8ZyAi5i457n50GXkTABi4ZiArpPaOKh1pCgDAQLuB7LVfiyEAGHjWgNoLqvXyj6g6UJ0HAAPtBhZrOEghA+jrggAAAABJRU5ErkJggg=='
  let DuplicateImageURL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAtElEQVRYR+2VUQ7AIAhD9boeyOtu8YOEbTJQS1gW9+vEZws1p+AvB5+fNsBDgVrrYbGllAJR71KkHW4tzP/l0Nb9dEk4ABW2gkAAuGWjasABGgxBWFRwARiB+BeANsI9S+AKSBBSP8ABuP+WkXQBmG7CHr0Uy5YRs0Q6JM9XwCEAs29IA/8vgBTHd7XcFAgD0ILIXYFwAJr9MAs+AyCloHsPaPHrAhAexdqt39YhQbQBVhQ4AVM68CG5nMXXAAAAAElFTkSuQmCC'
//let ImageURL = ''
  let SnapToGridImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAArklEQVRYR+1WQQ7AIAjT7/ogv7vFAwkxaquZk2zstghY24LGcPiLh/cPDgAykHO+UkrNuNU1LbsDgAzs7hIIYFXnUZ5NDxTEgqy4fvSPZEH5uqugBGUzDQZtrg/BxEIANROo6Gw8DaA3jFqABASTYwcAMh1zGmGj9kzLlBJrh4GeuWb0rBlgWKMZKMWZgo93wWtzwOwk/M9lhEbsrnWqC/xNeJSBXdrTd4ED+DwDNzGk6CEizJfHAAAAAElFTkSuQmCC'

  let CutImageURL    = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA7UlEQVRYR+2WXQ7EIAiE2+t6IK+7Gx9IKBFm0Bq3zfa1CJ/Dn+ex+Ts3xz9uB6i1fkoptF/akFFKgmcg3gHQbuwphNIxrUAUXKAiiCEAJiirSBrAFhgDoxWw558PwLSntrldgT/ATyogndHrf1gDTFu1W3vDxZ63diFAZon0bD14eg7MACDlBGKpAlKQwzUwo4AdNl6d0AqgfHqw0e0b1FIADR11if53WUajKUCtR++CWQD0+kmlAI3YDOxyBRAsDSASMQ4ZuXt+4C5AwUel10PK7QIUvFdEzJlUChiHaO5HPmzq0o9SBjBjsx3gC2HxLDBU8TlfAAAAAElFTkSuQmCC'
  let CopyImageURL   = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA20lEQVRYR+2WSw7AIAhE7XU9kNdt44LEEoVBSmxNu/XDcxigR1r8HYvjp8cBSilnzhm+F96IKEXBLRB7ANQXjxTS0uFWQApOUBLEFAASFFXEDMANhsC0CvDz3wdAyrPd87gCP8ArFaDK6NW/6gGkrOqrR82Fn+f7RADLEOntHcHDfcADoClHEKEKkCGnPeBRgDebkU/CFZBeX6FCAVofSFXSrt2G0WwKtNKDZ4EXQPv7CU8B0pZDPeAGIImQixC5e/eos0ALbvHJngCWNPUU4Kkz/5RqKbKuLwe4ABMeJDCe+pJbAAAAAElFTkSuQmCC'
  let PasteImageURL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA50lEQVRYR+2XQRaDMAhE9bo5UK7bvix4j1KIM5ZIFu3SRvgMjOh5FP/O4vwHBdB7f7XWqHuuCoSDSfJsiP0BRsWRjBntmCowSy5Qv0J8ASBJMxX5ALADhsBoBe4M6N4AVx62/6cr8AcoVUAcwPg8dQZYAMSyQ1FbUGhDBoCp3J6lAbxkSwCGXJ4K0TUrbaQgrIAG0L3TvZakkSpezykAC+HZckDooNEwRrDTXaATzgI/AiAwj7fAWzi2t0tnANl4y2yI7oJyAMQt0Tsk7AJEDUYJibcXACNl9FBClNJn4C8jNjB6vhzgDQIzTDDVGLxnAAAAAElFTkSuQmCC'
  let DeleteImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAT0lEQVRYR+3VwQ0AIAhDUVi3A3VdnUDDgQQO36sGy0vQjOGVw/cHARBAAAEE9grYPh3/hKRvk89NAiAwLtAxAZUae9+BSvqOMwgggAACCFwbXBghpjcrJwAAAABJRU5ErkJggg=='

  let ToTopImageURL    = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAfElEQVRYR+2VQQoAIQwD9bt9UL/rsgcvgjYpQhHiVSHDmGpvxasX5zcByMDRgLuPGyU1s22OAN4u4ezI6Y6jDqUNrAXNQqQAdtORgaABotFkISiAKHzeNwMBA6DhLAQMsLa5tIQ/jABkQAZkIPpm0f30S4gGROcEIAPlBj7GtEgh19O+fAAAAABJRU5ErkJggg=='
  let UpImageURL       = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAbklEQVRYR+2WQQoAIQzE9Lt9UL/r4sGLsNjOCmUh3iUxSLW34tWL+Q0BClDg3wXcfcw5YmbyQeSNC74GmSohCezwLxJpgTe4KpESOMEVibBAFJ6VCAvsr2bpJZwyCFCAAhS49Z2XJyECFKDArQIPSvI8IYSMDKYAAAAASUVORK5CYII='
  let DownImageURL     = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAd0lEQVRYR+2WQQ6AIAwE4bt9UL+r4UBCiBF2L5g4XAnudCzVWg6veji/AIABDNgGMvMar3BEWM+yDrVgADCAgf8ZmCte/UfsDiZpEO1C7Ia3IiSApwk4m1DCLYA3CDXcBvjEt2CEcCrvr07ugVX3q/sAYAADGLgBiLQ8IQWkMTAAAAAASUVORK5CYII='
  let ToBottomImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAg0lEQVRYR+2VUQoAIQhE67oeyOvu0sdCRKgjQS1NvxHzfJnVsnnVzfmFADTwXwOq+vQvSERSxaQOtWAC0AAN3GdgrNj7xqODCRpEUYhoeCsCAphNwNEEEp4CsCDQ8DTAEX9BD5Gp/Ls6uAe87kf3TYBo13uhliECnN0D3t2u2KcBGngBrgBIIbNZDX8AAAAASUVORK5CYII='

  let ChooseContainerImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAn0lEQVRYR+3WQQrAIAwEQP2uD/K7LR4EkWiyoboU0mvFHZIo5kT+Mjk/BeCfFai1PqWUT/DwJi28DS4F0MMpgDH8OmAOvwqQwleXl2cutkOIhI8oBHIEgLRIPYbeKlgRKqBtZBlCyxppdkwACSH12YMwA2bEatDQ+wICjAgaoCOogN0r6ngLtCdcAKICUQF6BbRjOv+Hr2I0QFsfAHoFXqYLbCHp/EtEAAAAAElFTkSuQmCC'
  let ChooseContentImageURL   = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAmUlEQVRYR+3X3QqAIAwFYH3dPdBet/BCiLD9nA00WPe1b0en1Nvmp2+u3wpQCZydADNf0pQQUbgB8QMaYOIikBTAgKCINACKgNdwtTxICjBgdJyBCAFWCG8KBagE/pWA9Wh+3x/SZLgT8CK0sXQDvg6g1a2pFR/vQAALwlI8BJAQ1uJhwBFH8RPh6XzuGXgPZP3QFKAS2J7ADQIZTCGjWjAzAAAAAElFTkSuQmCC'
  let ImportExportImageURL    = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA0klEQVRYR+2VYQ6AIAiF67oeyOvWbKPRExCdaW32p5qO94Hw3LfJzz5Zf1sA/61AjPEIIVwJpO/0pv+avmqqAAoOBSAxnvEwAC4+HADFhwJI4p8EwO73TEXXKeAAHvG0XwWQup0EtDGkdfQHyyNEAG4ykqlYAFrmWswMAB1OClhjRKV4D4BS5tYReM8cNW4Ayc28QJb3YwzUMQFqLhXv3iqAKRXAUfJmVtqn3SPZEZQC9Vqnps2moJeAFYdPjGpEb4BIo9p0F/SEWwCrAqsC0ytwArCqxCFYK1feAAAAAElFTkSuQmCC'
  let SearchImageURL          = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA00lEQVRYR+2WQRKAIAgA87s+yO/WcHCGEBAV8WKnmqxdkKD0HD7SYf7jLlBKeWlQOWeR4ybAgS0iLgIYzkWr3V8W6MFrFqR1bgLaPlMJvHZJoEZlgUsSV+BmYCkDUFi0EOFaKkquaN0EQKaCuW/etQ9obXd7J8Rp5M616crJDW0Bt9849bgmsIjLNJSKTSs6y7+GKQO74CDYFdgJ7wrshqsCEXBRIArOCkTCG4Fo+E/gBLwRwMMEzlebzFAjotMqAi7WAO3vlkhm13Q74eyLrc9dgQ9itQQwkRB2awAAAABJRU5ErkJggg=='

/**** keep track of every Applet's Toolbox state ****/

  type WAD_ToolboxState = WAD_DialogState
</script>

<script lang="ts">
  export let Applet:WAT_Applet
  export let PositionAroundPreferredPosition:(Width:WAT_Dimension,Height:WAT_Dimension) => WAT_Position

$:if (Applet != null) {                                            // needs "$:"
    if (isNaN(($ToolboxState as WAD_ToolboxState).Width)) {
      ToolboxState.set({                 // internally requires (Applet != null)
        isVisible:true, Width:160,Height:264,    // "ToolboxView" knows its size
        Offset:{ x:NaN,y:NaN }       // but let "Dialog" compute actual position
      })
    }
  }

  function onClose () {
    let currentToolboxState = ($ToolboxState as WAD_ToolboxState)
    ToolboxState.set({ ...currentToolboxState,isVisible:true })    // because...
    chosenApplet.set(undefined)    // ..."chosenApplet" decides about visibility
  }
</script>

{#if $ToolboxState.isVisible}
  <Dialog class="WAD-Toolbox" {Applet} Title="WAT-Designer" resizable={false}
    {PositionAroundPreferredPosition} bind:State={$ToolboxState}
    on:close={onClose}
  >
    <IconButton style="left:4px;   top:4px" ImageURL={LayouterImageURL}/>
    <IconButton style="left:44px;  top:4px" ImageURL={EventLockImageURL}/>
    <IconButton style="left:84px;  top:4px" ImageURL={NudgerImageURL}/>
    <IconButton style="left:124px; top:4px" ImageURL={InspectorImageURL}/>

    <IconButton style="left:4px;   top:44px" ImageURL={UndoImageURL}/>
    <IconButton style="left:44px;  top:44px" ImageURL={RedoImageURL}/>
    <IconButton style="left:84px;  top:44px" ImageURL={SaveImageURL}/>
    <IconButton style="left:124px; top:44px" ImageURL={SettingsImageURL}/>

    <IconButton style="left:4px;   top:84px" ImageURL={CreateImageURL}/>
    <IconButton style="left:44px;  top:84px" ImageURL={DuplicateImageURL}/>
    <!-- -->
    <IconButton style="left:124px; top:84px" ImageURL={SnapToGridImageURL}/>

    <IconButton style="left:4px;   top:124px" ImageURL={CutImageURL}/>
    <IconButton style="left:44px;  top:124px" ImageURL={CopyImageURL}/>
    <IconButton style="left:84px;  top:124px" ImageURL={PasteImageURL}/>
    <IconButton style="left:124px; top:124px" ImageURL={DeleteImageURL}/>

    <IconButton style="left:4px;   top:164px" ImageURL={ToTopImageURL}/>
    <IconButton style="left:44px;  top:164px" ImageURL={UpImageURL}/>
    <IconButton style="left:84px;  top:164px" ImageURL={DownImageURL}/>
    <IconButton style="left:124px; top:164px" ImageURL={ToBottomImageURL}/>

    <IconButton style="left:4px;   top:204px" ImageURL={ChooseContainerImageURL}/>
    <IconButton style="left:44px;  top:204px" ImageURL={ChooseContentImageURL}/>
    <IconButton style="left:84px;  top:204px" ImageURL={ImportExportImageURL}/>
    <IconButton style="left:124px; top:204px" ImageURL={SearchImageURL}/>
  </Dialog>
{/if}
