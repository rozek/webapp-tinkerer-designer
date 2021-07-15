<!----------------------------------------------------------------------------//
//                       WebApp Tinkerer Designer (WAD)                       //
//----------------------------------------------------------------------------->

<style>

</style>

<script context="module" lang="ts">
  import {
    global, throwError
  } from 'javascript-interface-library'

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
    WAT_Text, WAT_Textline, WAT_Color, WAT_URL
  } from 'webapp-tinkerer-runtime'

  import {
    WAT_Categories,
    WAT_horizontalAnchorings, WAT_verticalAnchorings,
    WAT_FontWeights, WAT_FontWeightValues, WAT_FontStyles,
    WAT_TextDecorationLines, WAT_TextDecorationStyles, WAT_TextAlignments,
    WAT_BackgroundModes, WAT_BorderStyles, WAT_Cursors,
    WAT_Overflows, WAT_TextOverflows
  } from 'webapp-tinkerer-runtime'
</script>

<script lang="ts">
  export const Version = '0.1.0'

/**** get a reference to the "global" object ****/

  export const global = /*#__PURE__*/ Function('return this')()
// see https://stackoverflow.com/questions/3277182/how-to-get-the-global-object-in-javascript

/**** check WAT presence ****/

  if (typeof global.WAT?.ready !== 'function') {
    window.alert(
      '"WebApp Tinkerer" not found\n\n' +
      'The WAT Designer needs the WAT Runtime to be loaded first'
    )
    throw new Error('MissingDependency: "WAT" not found')
  }

//----------------------------------------------------------------------------//
//                             Designer Interface                             //
//----------------------------------------------------------------------------//

/**** startDesigning ****/

  export function startDesigning (
    Target:WAT_Visual|WAT_Name, Property?:WAT_Identifier,
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




</script>

<div id="webapp-tinkerer-designer" style="
  display:block; position:absolute;
  left:0px; top:0px; width:0px; height:0px; overflow:visible;
  pointer-events:none;
  margin:0px; padding:0px; border:none; background:transparent;
">

</div>