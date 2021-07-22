<!------------------------------------------------------------------------------
--                       WebApp Tinkerer Designer (WAD)                       --
------------------------------------------------------------------------------->

<style>
  :global([draggable]) {
    -webkit-touch-callout:none;
    -ms-touch-action:none; touch-action:none;
    -moz-user-select:none; -webkit-user-select:none; -ms-user-select:none; user-select:none;
  }

</style>

<script context="module" lang="ts">
  mapTouchToMouseFor('#webapp-tinkerer-designer *')

  import type { Writable } from 'svelte/store'

/**** Support for Mobile Devices ****/

  import   DragDropTouch    from 'svelte-drag-drop-touch'
  import mapTouchToMouseFor from 'svelte-touch-to-mouse'

/**** import from 'javascript-interface-library', use from WAT ****/

  import {
    throwError,
    ValuesDiffer
  } from 'javascript-interface-library'

/**** WAT Types ****/

  import type {
    WAT_Category, WAT_SemVer,
    WAT_Location, WAT_Dimension, WAT_Position, WAT_Size, WAT_Geometry,
    WAT_horizontalAnchoring, WAT_verticalAnchoring,
    WAT_horizontalOffsets, WAT_verticalOffsets,
    WAT_FontWeight, WAT_FontStyle,
    WAT_TextDecorationLine, WAT_TextDecorationStyle, WAT_TextDecoration,
    WAT_TextShadow, WAT_TextAlignment,
    WAT_BackgroundMode, WAT_BackgroundTexture, WAT_BorderStyle, WAT_BoxShadow,
    WAT_Cursor, WAT_customCursor, WAT_Overflow, WAT_TextOverflow,
    WAT_Text, WAT_Textline, WAT_Color, WAT_URL,

    WAT_Visual, WAT_Applet, WAT_Container, WAT_Layer, WAT_Card, WAT_Overlay,
    WAT_Component, WAT_Compound, WAT_Control,

    WAT_Identifier, WAT_Name, WAT_Label
  } from 'webapp-tinkerer-runtime'

/**** WAT Type-specific Constants ****/

  import {
    WAT_Categories,
    WAT_horizontalAnchorings, WAT_verticalAnchorings,
    WAT_FontWeights, WAT_FontWeightValues, WAT_FontStyles,
    WAT_TextDecorationLines, WAT_TextDecorationStyles, WAT_TextAlignments,
    WAT_BackgroundModes, WAT_BorderStyles, WAT_Cursors,
    WAT_Overflows, WAT_TextOverflows
  } from 'webapp-tinkerer-runtime'

/**** actual WAT methods ****/

  import {
    ready, registerDesigner,
    ValueIsName, ValueIsVisual,
    VisualForElement,
    AppletPeersInDocument
  } from 'webapp-tinkerer-runtime'

/**** Svelte Stores ****/

  import {   AppletList   } from './stores/AppletList.js'
//import {   NudgerState  } from './stores/NudgerState.js'    // causes warnings
//import { InspectorState } from './stores/InspectorState.js'            // dto.

/**** Svelte Components and Views ****/

  import DesignerButton from './components/DesignerButton.svelte'
  import ToolboxView    from './views/ToolboxView.svelte'
  import NudgerView     from './views/NudgerView.svelte'
  import InspectorView  from './views/InspectorView.svelte'

</script>

<script lang="ts">
  import {   NudgerState  } from './stores/NudgerState.js'
  import { InspectorState } from './stores/InspectorState.js'

  export const Version = '0.1.0'

/**** Colors ****/

  const normalColor  = '#AAAAAA'
  const hoveredColor = '#FFEC2E'
  const activeColor  = '#7FFF00' /* chartreuse */

//----------------------------------------------------------------------------//
//                             Designer Interface                             //
//----------------------------------------------------------------------------//

/**** startDesigning ****/

  export function startDesigning (
    Applet:WAT_Applet | undefined, Target?:WAT_Visual|WAT_Name, Property?:WAT_Identifier
  ):void {
    if (Applet == null) {
      chooseApplet(undefined)
    } else {
      chooseApplet(Applet)

      switch (true) {
        case (Target == null):
          break
        case ValueIsName(Target):
//        chooseMaster
          break
        case ValueIsVisual(Target):
//        chooseVisual
          break
        default: throwError('InvalidArgument: WAT master name or visual expected')
      }
    }
  }
/**** inhibitsEventsFrom ****/

  export function inhibitsEventsFrom (Visual:WAT_Visual):boolean {


    return false
  }



  ready(() => {
    registerDesigner({ startDesigning,inhibitsEventsFrom })
    console.log('WAD is running')
  })

//----------------------------------------------------------------------------//
//                                  Choices                                   //
//----------------------------------------------------------------------------//

  import { chosenApplet } from './stores/chosenApplet.js'

/**** chooseApplet ****/

  function chooseApplet (Applet:WAT_Applet | undefined):void {
    if (Applet !== $chosenApplet) {
      (chosenApplet as Writable<WAT_Applet | undefined>).set(Applet)
    }
  }


/**** preferredPosition - relative to Viewport ****/

  let preferredPosition:WAT_Position = { x:0,y:0 }

/**** PositionAround ****/

  function PositionAround (
    preferredPosition:WAT_Position, Width:WAT_Dimension,Height:WAT_Dimension
  ):WAT_Position {
    let ViewportWidth  = Math.max(window.innerWidth, document.body.clientWidth)
    let ViewportHeight = Math.max(window.innerHeight,document.body.clientHeight)

    let x = Math.max(0, Math.min(preferredPosition.x, ViewportWidth-Width))
    let y = Math.max(0, Math.min(preferredPosition.y,ViewportHeight-Height))

    return { x:Math.round(x),y:Math.round(y) }
  }

/**** PositionAroundPreferredPosition ****/

  function PositionAroundPreferredPosition (
    Width:WAT_Dimension,Height:WAT_Dimension
  ):WAT_Position {
    return PositionAround(preferredPosition, Width,Height)
  }




</script>

<div id="webapp-tinkerer-designer" style="
  display:block; position:absolute;
  left:0px; top:0px; width:0px; height:0px; overflow:visible;
  pointer-events:none;
  margin:0px; padding:0px; border:none; background:transparent;
">
  {#each $AppletList as Applet (Applet['uniqueId'])}
    {#if $chosenApplet !== Applet}
      <DesignerButton {Applet} {startDesigning}
        bind:preferredPosition={preferredPosition}
      />
    {/if}
  {/each}

  {#if ($chosenApplet !== null)}
    <ToolboxView Applet={$chosenApplet} {PositionAroundPreferredPosition}/>
  {/if}

  {#if ($chosenApplet !== null) && $NudgerState.isVisible }
    <NudgerView Applet={$chosenApplet} {PositionAroundPreferredPosition}/>
  {/if}

  {#if ($chosenApplet !== null) && $InspectorState.isVisible }
    <InspectorView Applet={$chosenApplet} {PositionAroundPreferredPosition}/>
  {/if}

</div>