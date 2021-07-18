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
    ready, registerDesigner,
    VisualForElement,
    AppletPeersInDocument
  } from 'webapp-tinkerer-runtime'

/**** Svelte Components ****/

  import DesignerButton from './DesignerButton.svelte'

</script>

<script lang="ts">
  export const Version = '0.1.0'

/**** Colors ****/

  const normalColor  = '#969696'
  const hoveredColor = '#FFEC2E'
  const activeColor  = '#D3FF4B'

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



  ready(() => {
    registerDesigner({ startDesigning,inhibitsEventsFrom })
    console.log('WAD is running')
  })

//----------------------------------------------------------------------------//
//                                 Monitoring                                 //
//----------------------------------------------------------------------------//

  import { AppletList } from './AppletList.js'

  let Monitor:any
  ready(() => {
    Monitor = setInterval(() => {
    /**** monitor Applets ****/

      let AppletsInDocument = AppletPeersInDocument().map(
        (AppletPeer:HTMLElement) => VisualForElement(AppletPeer)
      ).filter((Applet:WAT_Visual) => (Applet as WAT_Applet).mayBeDesigned)

      if (ValuesDiffer(AppletsInDocument,$AppletList)) {
        (AppletList as Writable<WAT_Visual[]>).set(AppletsInDocument)
      }

    /**** monitor chosen Applet ****/

      if ($chosenApplet != null) {
// @ts-ignore "$chosenApplet" is definitely not undefined
        if (AppletsInDocument.indexOf($chosenApplet) < 0) {
          chooseApplet(undefined)
        }
      }

      updateLayerListsOfApplet($chosenApplet)

    /**** monitor Masters ****/
/*
  import { MasterList } from './MasterList.js'
*/

    }, 300)
  })

//----------------------------------------------------------------------------//
//                                  Choices                                   //
//----------------------------------------------------------------------------//

  import { chosenApplet }      from './chosenApplet.js'
  import { chosenCardList }    from './chosenCardList.js'
  import { chosenOverlayList } from './chosenOverlayList.js'

/**** chooseApplet ****/

  function chooseApplet (Applet:WAT_Applet | undefined):void {
    if (Applet !== $chosenApplet) {
      (chosenApplet as Writable<WAT_Applet | undefined>).set(Applet)
      updateLayerListsOfApplet(Applet)
    }
  }

/**** updateLayerListsOfApplet ****/

  function updateLayerListsOfApplet (Applet:WAT_Applet | undefined):void {
    if (Applet == null) {
      (chosenCardList as Writable<WAT_Card[]>).set([]);// semicolon is important
      (chosenOverlayList as Writable<WAT_Overlay[]>).set([])
    } else {
      (chosenCardList as Writable<WAT_Card[]>).set(Applet.CardList);     // dto.
      (chosenOverlayList as Writable<WAT_Overlay[]>).set(Applet.OverlayList)
    }
  }





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