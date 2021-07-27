<style>
  .WAD-IconButton {
    display:block; position:absolute;
    width:32px; height:32px;
    background:var(--normal-image-url);

    -webkit-appearance:none; appearance:none;
    border:none; outline:inherit;
  }

  .WAD-IconButton:not([disabled]):hover,
  .WAD-IconButton[disabled="false"]:hover {
    background:var(--hovered-image-url);
  }

  .WAD-IconButton.active:not([disabled]):not(:hover),
  .WAD-IconButton.active[disabled="false"]:not(:hover) {
    background:var(--active-image-url);
  }

  .WAD-IconButton[disabled="true"] { opacity:0.3 }
</style>

<script context="module" lang="ts">
  import { tintedBitmapAsURL } from 'tinted-bitmap'

/**** Colors ****/

  const normalColor  = '#AAAAAA'
  const hoveredColor = '#FFEC2E'
  const activeColor  = '#7FFF00' /* chartreuse */


</script>

<script lang="ts">
  export let ImageURL:string                               // bitmap as Data URL
  export let active:boolean   = false
  export let activeURL:string = undefined     // opt. image URL for active state
  export let style:string     = ''  // since {...$$restProps} does not help here

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
    normalImageURL  = tintedBitmapAsURL(auxImage as HTMLImageElement,normalColor)
    hoveredImageURL = tintedBitmapAsURL(auxImage as HTMLImageElement,hoveredColor)

    if (activeURL == null) {
      activeImageURL        = tintedBitmapAsURL(auxImage as HTMLImageElement,activeColor)
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
    activeImageURL        = tintedBitmapAsURL(auxImage as HTMLImageElement,activeColor)
    activeHoveredImageURL = tintedBitmapAsURL(auxImage as HTMLImageElement,hoveredColor)
    auxImage = undefined
  }
</script>

<button {...$$restProps} class:WAD-IconButton={true} class:active={active} style="
  --normal-image-url:url({normalImageURL});
  --hovered-image-url:url({active ? activeHoveredImageURL : hoveredImageURL});
  --active-image-url:url({activeImageURL}); {style}
" on:click></button>

