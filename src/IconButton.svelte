<style>
  .WAD-IconButton {
    display:block; position:absolute;
    width:32px; height:32px;
    background:var(--normal-image-url);
  }

  .WAD-IconButton:hover {
    background:var(--hovered-image-url);
  }

  .WAD-IconButton.active {
    background:var(--active-image-url);
  }
</style>

<script context="module" lang="ts">
  import { tintedBitmapAsURL } from 'tinted-bitmap'

/**** Colors ****/

  const normalColor  = '#969696'
  const hoveredColor = '#FFEC2E'
  const activeColor  = '#D3FF4B'


</script>

<script lang="ts">
  export let ImageURL:string                               // bitmap as Data URL
  export let active:boolean = false

  let normalImageURL:string  = ''                      // just for the beginning
  let hoveredImageURL:string = ''                                        // dto.
  let activeImageURL:string  = ''                                        // dto.

  function tintOriginalImage () {
    hoveredImageURL = tintedBitmapAsURL(auxImage as HTMLImageElement,hoveredColor)
    activeImageURL  = tintedBitmapAsURL(auxImage as HTMLImageElement,activeColor)

    auxImage = undefined
  }

  let auxImage:HTMLImageElement | undefined
  $:{
    if (ImageURL == null) {
      normalImageURL = hoveredImageURL = activeImageURL = ''
    } else {
      normalImageURL = ImageURL

      auxImage = document.createElement('img')
        auxImage.src = ImageURL as string
      if (auxImage.complete) {                                   // just in case
        tintOriginalImage()
      } else {
        auxImage.addEventListener('load', tintOriginalImage)
      }
    }
  }
</script>

<div class="WAD-IconButton" class:active={active} {...$$restProps} style="
  --normal-image-url:url({normalImageURL});
  --hovered-image-url:url({hoveredImageURL});
  --active-image-url:url({activeImageURL});
"></div>

