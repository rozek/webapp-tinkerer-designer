<style>
  .WAD-IconImage {
    display:block; position:relative;
    width:32px; height:32px;
    background:var(--normal-image-url);
  }

  .WAD-IconImage[disabled="false"]:hover {
    background:var(--hovered-image-url);
  }

  .WAD-IconImage.active[disabled="false"]:not(:hover) {
    background:var(--active-image-url);
  }

  .WAD-IconImage[disabled="true"] { opacity:0.3 }
</style>

<script context="module" lang="ts">
  import { tintedBitmapAsURL } from 'tinted-bitmap'
  import { Globals } from '../stores/Globals.js'
</script>

<script lang="ts">
  export let ImageURL:string                               // bitmap as Data URL
  export let activeURL:string = undefined     // opt. image URL for active state
  export let active:boolean   = false
  export let style:string     = ''    // because {...restProps} do not help here

  let normalImageURL:string         = ''               // just for the beginning
  let hoveredImageURL:string        = ''                                 // dto.
  let activeImageURL:string         = ''                                 // dto.
  let activeHoveredImageURL:string  = ''                                 // dto.

  let auxImage:HTMLImageElement | undefined
  $:{
    switch (true) {
      case (ImageURL == null):
        normalImageURL = hoveredImageURL = activeImageURL = ''
      case (ImageURL === normalImageURL):       // prevents multiple conversions
        break
      default:
        auxImage = document.createElement('img')
          auxImage.src = ImageURL as string
        if (auxImage.complete) {                                 // just in case
          tintOriginalImage()
        } else {
          auxImage.addEventListener('load', tintOriginalImage)
        }
    }
  }

  function tintOriginalImage () {
    normalImageURL  = tintedBitmapAsURL(auxImage as HTMLImageElement,$Globals.normalColor)
    hoveredImageURL = tintedBitmapAsURL(auxImage as HTMLImageElement,$Globals.hoveredColor)

    if (activeURL == null) {
      activeImageURL        = tintedBitmapAsURL(auxImage as HTMLImageElement,$Globals.activeColor)
      activeHoveredImageURL = hoveredImageURL
      auxImage = undefined
    } else {
      auxImage = document.createElement('img')    // new image element necessary
        auxImage.src = activeURL as string
      if (auxImage.complete) {                                   // just in case
        tintActiveImage()
      } else {
        auxImage.addEventListener('load', tintActiveImage)
      }
    }
  }

  function tintActiveImage () {
    activeImageURL        = tintedBitmapAsURL(auxImage as HTMLImageElement,$Globals.activeColor)
    activeHoveredImageURL = tintedBitmapAsURL(auxImage as HTMLImageElement,$Globals.hoveredColor)
    auxImage = undefined
  }
</script>

<div {...$$restProps} class:WAD-IconImage={true} class:active={active} style="
  --normal-image-url:url({normalImageURL});
  --hovered-image-url:url({active ? activeHoveredImageURL : hoveredImageURL});
  --active-image-url:url({activeImageURL}); {style}
"></div>

