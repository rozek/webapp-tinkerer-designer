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
  import type { Writable } from 'svelte/store'

/**** Support for Mobile Devices ****/

  import DragDropTouch from 'svelte-drag-drop-touch'

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
    VisualForElement,
    AppletPeersInDocument
  } from 'webapp-tinkerer-runtime'

/**** Svelte Components ****/

  import DesignerButton from './DesignerButton.svelte'

</script>

<script lang="ts">
  export const Version = '0.1.0'

//----------------------------------------------------------------------------//
//                             Designer Interface                             //
//----------------------------------------------------------------------------//

/**** startDesigning ****/

  export function startDesigning (
    Applet:WAT_Applet, Target?:WAT_Visual|WAT_Name, Property?:WAT_Identifier,
    x?:number, y?:number
  ):void {


  }
/**** inhibitsEventsFrom ****/

  export function inhibitsEventsFrom (Visual:WAT_Visual):boolean {


    return false
  }



  WAT.ready(() => {
    WAT.registerDesigner({ startDesigning,inhibitsEventsFrom })
    console.log('WAD is running')
  })

//----------------------------------------------------------------------------//
//                                 Monitoring                                 //
//----------------------------------------------------------------------------//

/**** monitorApplets ****/

  import { AppletList } from './AppletList.js'

  let AppletMonitor:any
  WAT.ready(() => {
    AppletMonitor = setInterval(() => {
      let AppletsInDocument = AppletPeersInDocument().map(
        (AppletPeer:HTMLElement) => VisualForElement(AppletPeer)
      ).filter((Applet:WAT_Visual) => (Applet as WAT_Applet).mayBeDesigned)

      if (ValuesDiffer(AppletsInDocument,$AppletList)) {
        (AppletList as Writable<WAT_Visual[]>).set(AppletsInDocument)
      }
    }, 300)
  })





</script>

<div id="webapp-tinkerer-designer" style="
  display:block; position:absolute;
  left:0px; top:0px; width:0px; height:0px; overflow:visible;
  pointer-events:none;
  margin:0px; padding:0px; border:none; background:transparent;
">
  {#each $AppletList as Applet (Applet['uniqueId'])}
    <DesignerButton {Applet}/>
  {/each}

</div>