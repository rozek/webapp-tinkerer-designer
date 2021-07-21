<style>
  .WAD-Inspector {
    min-width:300px; min-height:420px;
  }
</style>

<script context="module" lang="ts">
  import type {
    WAT_Applet, WAT_Dimension, WAT_Position
  } from 'webapp-tinkerer-runtime'
  import type { WAD_DialogState } from './Dialog.svelte'

  import       Dialog       from './Dialog.svelte'
  import     IconButton     from './IconButton.svelte'
  import {  chosenApplet  } from './chosenApplet.js'
//import { InspectorState } from './InspectorState.js' // causes Svelte warnings
  import AppletOverviewPane from './AppletOverviewPane.svelte'
  import {  MessageState  } from './MessageState.js'
  import    MessageView     from './MessageView.svelte'

/**** normal IconButton images as Data URLs ****/

  let AppletImageURL       = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA8UlEQVRYR+1XQQ7DIAxrv8uD+G4nKqXKsqQhpoEetsMmsYXYxvHovi1+7Yv7b+8BUGs9ZqpRSjnJn2+tOS3MAkE90wBIRSXBNADUWGvY1KX1VAAWW37UKQA0L9Ga9fmoByQA2ZQbPl0Brfl0ANx0NN4S2KNH4GVKugkJgMXcHUPLRHJjLbatuSfpu4Io4mJPbi/S1SnwZlY2HfkPCQPgjGScemy1780cuAuPdAUQJmjNjwLoRiN17SivIBrZCK19DwAeNCibaN3XnTBarAFG75Twtdy78/WS+gOAFLAeYhAfhAD0Pj1FgIQA9Bor8rvlAD4fTngwzU/HXwAAAABJRU5ErkJggg=='
  let MasterImageURL       = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABY0lEQVRYR82Xaw7CMAyD2XV3oF0XVKSg4NlOuoeAf7DSfnGdx5bHjz/L2fO3bXvGHuu6Tu83/YcMPA7Phx6BuRQA4TrKHAbA6Mdh7Lf4XcHcBuBg8rXtAOIelaHyPY+oYh3zA3uG674A8kNlMARjxsN9ApQF9wHAjfJiJafKCBUIg30DsD84NVjtiPXd6GNdCaDcnu8/gFBiBZODngZQJmRK5rsf3mGq3gqAWXAJQC4sLCPYoajE1BW4Cuf6AvPFIQXOAGBmtAEwzcJAHeerhoS9oEzDLKFquViK3XdVb3ZZ4AqTU4BF2OkVJQC2U1YFWat1zWmXBcxoqhl1ALqHj72+mpHL60qJTltmvpLt2JkwH5blryJnStOBBF1fKaNqRQeIjmRV/6+GEOYTtaecCR0Ea7MsRdU1ZkA7lCoINSOwObJS878BuuaaWYf+KN8LcAJiVc/ViOp9sQRwle+KZz8HeAHatLA/TmjFBQAAAABJRU5ErkJggg=='
  let CardImageURL         = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABBElEQVRYR+2WQRLEIAgEk+/6IL+7Wx5IEQPMkBi9ZE/ZUqGZUXHfFv/2xfm3D4BWoNb6y9hVSqFiw0k6MRu0rWHnugCSWAKhoHo+mquVvAD0iWUyCirj3nrPvgMALYwArDEUT4BOAJFvWQCtXPv2Yp8suJMEWYNApgF4IOYmtOTyfGaPm96EOtZ0gL4Q8x5gqmW974/fUgALOrwJtb968ajqmzrTADzosBlZVY+sPlSgDY4CiKCpdtz2Anu3W01nKQCyDCogVkQNJXopLQVAyeEm7O9v/Z/pAa8A6CdaZAuTPKWA5/PdJ9zlRZR5cntHTRRhqx+igNXtMieGOoZP1YnWfwB/a0o8MCIQpw0AAAAASUVORK5CYII='
  let OverlayImageURL      = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAs0lEQVRYR+2W0Q6AIAhF9Xf9IH+35gObI/Qi0qyNXmoT5HZAIafDTz4cP4UAkUCt9fJITSkFEn4YUPDm3L75e1UYEjEUsBpoZG8SgJy04ojgzF4k8FsBmuLlP+dK4BMCZumTasKdAB1bXnj9ce7XXhEwqvogEASCQBBQEWiXiOZOn/V/yV99E2p7vWSH+r+agFVEP8KZe4E1OKVuuxvuCkD+cCBBG3ivw7ndOyDfLwQcJ3AD7On8Ic5p3nwAAAAASUVORK5CYII='
  let ComponentImageURL    = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABAklEQVRYR+1WQRLEIAhrv+uD/O7ueGCGYQOh1FoP21OnFhMiBM/j5ed8Gf/Ym0Dv/WMVaq1B0ujfTKyrQLShJZEBFzI2lmajAzQQ+u6pM8AllhLwQCQDtK43z7zro/lRADEd36KMEagGGbGXFRBAljGSNxMjBPdVYDBERcWyu10DWlJLYkkXoGpnhjLdByISy5xw1ZB6bBh5fW8Te4SArYnIouksqB5FZGTUiiPGjJCV3voCHUbWBxigt15WoAqo427XwEwS7DhpF2TbqUo6JHBFyqkEoolXBfKmK7wPoBvMjKOwN6tBihoRaqeqCqgg96wB1NOsnaqq0DasbpyN+xP4ArhxGDBtdoDkAAAAAElFTkSuQmCC'
  let ImportExportImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA0klEQVRYR+2VYQ6AIAiF67oeyOvWbKPRExCdaW32p5qO94Hw3LfJzz5Zf1sA/61AjPEIIVwJpO/0pv+avmqqAAoOBSAxnvEwAC4+HADFhwJI4p8EwO73TEXXKeAAHvG0XwWQup0EtDGkdfQHyyNEAG4ykqlYAFrmWswMAB1OClhjRKV4D4BS5tYReM8cNW4Ayc28QJb3YwzUMQFqLhXv3iqAKRXAUfJmVtqn3SPZEZQC9Vqnps2moJeAFYdPjGpEb4BIo9p0F/SEWwCrAqsC0ytwArCqxCFYK1feAAAAAElFTkSuQmCC'
  let SearchImageURL       = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA00lEQVRYR+2WQRKAIAgA87s+yO/WcHCGEBAV8WKnmqxdkKD0HD7SYf7jLlBKeWlQOWeR4ybAgS0iLgIYzkWr3V8W6MFrFqR1bgLaPlMJvHZJoEZlgUsSV+BmYCkDUFi0EOFaKkquaN0EQKaCuW/etQ9obXd7J8Rp5M616crJDW0Bt9849bgmsIjLNJSKTSs6y7+GKQO74CDYFdgJ7wrshqsCEXBRIArOCkTCG4Fo+E/gBLwRwMMEzlebzFAjotMqAi7WAO3vlkhm13Q74eyLrc9dgQ9itQQwkRB2awAAAABJRU5ErkJggg=='

  let SelectionImageURL              = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAUklEQVRYR+3UwREAIAgDQWiXgtKuFqA+MTzOAiSzBjPMJ83zgwAIXAUkrY5yVtUxjwAzBTre/3UnazizA/wDdgHW0C5g7wAB7AL2EhIAAQR+CmweoTAhD/IaqwAAAABJRU5ErkJggg=='
  let SelectionGlobalsImageURL       = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA+UlEQVRYR+2XUQ7EIAhE2+t6IK+7Gz5oKAEZ1IZusv3ZJlV5DgO651H8nMXxjwug9/5hmNZaCLZrvAtAAQhk9CuBs+N57nsUqPLCLdcs41Mw1vqh2SwYacCMca21UgpwYK4SuSP9zQPXFQYroOXTrueA2TRCCnjBvaAexJQHouBZCJ2aUIGdAGkFrAkZeRE/DDshunskDd7ZAQEgfX50bhDgEgBaYiPFQgC0cTzmAZZJdyrUB8i4dBVYUKgCSAXQ+mEfQCCQ3XsK/8ZZIKuA3ktOQ1klZfeB1ZvSVBWsBo3mv+dWrFsl0v///wui/CLf4UaELDYzphzgC1oI5DDpfBDzAAAAAElFTkSuQmCC'
  let SelectionResourcesImageURL     = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA7ElEQVRYR+2XUQ6EMAhE9bo9UK+7m35gugSYEWl0N+uPMVIYnhTqvt187TfH3w4BvfeXiGmtQWFV9q6AEWAIie6z4LP2sjZFYM5+OLpCDKJeXSMfAgTjqqCW/98hIHUR1cNSAowA69NSNYCc6/eefZpAlYAUgbPBJYi1LkWgUkBIwOrt2eAWBW92hK340QKQuEFhtoEEvPYbbaloEDECx3rYB7xqRlOwbBdolNazpsdmTxHwviXq+RahVB+4kh0z1mENME5YmxICbDDW7k8gdSqedwbqB3ouaPvv/C9YQoCt2mq7Zx3Lq7Nj/L0BoDBwMIhTLVUAAAAASUVORK5CYII='
  let SelectionPropertiesImageURL    = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABM0lEQVRYR+1XQQ7DMAhrv9sH5bubcqDykMEQReoO3WWHJsUY20nP4+Hf+XD94wYwxvgYmOu6JLBd60MAs8AEkv0j4O562/s/DHS1YB2zfTaeyih/Zp29FAtFBVAXuN6AsPdLsfkOI/FFxZWw2wxUAGDHTKjYVJkBT7unkwGrWLXEgKfX7Dk7Yd0yYaKlWwyw2bJ8mC9VImTASgxEQmRMIBBvwy0uMDBR8nXzZDkJfacqfCJBlgBkaq4y0QaAHfnNzJLmiEpKojbCHFDJhha0cUSizHSRuoB1k826ogPvDMqASjD1HBlRrqAMqAJKlL5o+zRcBRCJ1esljOLogMG5dTXg3VTSQJbr7KKB6eiP3+X7QCcH2G1p641IaYIpnR086WnYLbJr/ftdUL4TqkRbff4C+AI8xegwDnQdAwAAAABJRU5ErkJggg=='
  let SelectionConfigurationImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABGUlEQVRYR82WXQ4DIQiEd6/rgbxuGx9oKOFnQBLdl+42qJ/jAL7P4ec9vP7zA5hzfghmjBGCdcWbAGuBBeL9cuBsPI29R4FTXvg7a5KRYOQ3Ckn+kF7S5jPNljUZh17viJFXXKhAJjNWrKdiSoHqjrj81lHwo3QV4IGIH/ixacqVFEAhqp6BFfAyA118WwENAl3cSuGWSoiknQXaBhBBtALIyWQj0uQOAbJllsdrXROdL5UF2s659JESW1lgSSirXQQhlYF7gdcTUIiUAtmajkLAClTuBhqE5hGzGVnORbqa7J4yS8JKqPVy+i8qMnJyz7DyohJev9F8rsa1lGLk+hVWwqi8yvzejSfF7lGgeoa74+4x4e5OquO/i3SsMOeJ2OQAAAAASUVORK5CYII='
  let SelectionScriptImageURL        = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABFElEQVRYR+1XUQ5CMQh777o70K6r4QODCKPAkmmiPyaGja4t3byvw5/7cP/rBWDO+WAwY4wQ2K56FwA1ICCrbwk4W89rv4eBU15405pptMBIzbNg2VPW/qHZqFmneWTskIGs27mhBi0NLRkMGeCNkNH0mtPv3nqYAamjHj95Ij6p1bTkAc2AlsSjenVqVwILYUcCTfsWBpARzIAOk9CTQGqt6bYAeNP0ewCqEoQMeBtn9NQ5gGRHKwdY+5VP5MG2TAEy9xnW0gxUPcCXmpbFvAt23H6tJESeV8hzrZyEUsMKGPT0VOd6oCODN36lKUBM16kJozgKKJTuMAmtex4xmgyjTP3/f8EHAx0jddaGr+LO5sjaJ0cgzDAHqlx2AAAAAElFTkSuQmCC'
  let SelectionContentsImageURL      = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAqklEQVRYR+2X3QqAIAxG9XV9oL1u4YVh5JyOb2yQ3QSx9HD2I+bk/GTn/dMDQERXgymliGCoeBagblBBZu8eeDe+/RvHgFctvHLdNFrBjNYXi80K5lMD9UNIA3277dpYaWexBpAAqhpAAowMigZ2tc/iVQaQAFMD3GxHpYBbXxzF/wGwzjW3fvwuQNWA2gASQDUHkABnEh4DqrOAa59zL4AbCHEWeEC43wtuK9YEMALX8OsAAAAASUVORK5CYII='

/**** keep track of every Applet's Inspector state ****/

  type WAD_InspectorState = WAD_DialogState
</script>

<script lang="ts">
  import { InspectorState } from './InspectorState.js'

  export let Applet:WAT_Applet
  export let PositionAroundPreferredPosition:(Width:WAT_Dimension,Height:WAT_Dimension) => WAT_Position

$:if (Applet != null) {                                            // needs "$:"
    if (isNaN(($InspectorState as WAD_InspectorState).Width)) {
      InspectorState.set({               // internally requires (Applet != null)
        isVisible:true, Width:300,Height:420,  // "InspectorView" knows its size
        Offset:{ x:NaN,y:NaN }       // but let "Dialog" compute actual position
      })
    }
  }
</script>

{#if $InspectorState.isVisible}
  <Dialog class="WAD-Inspector" {Applet} Title="WAT-Designer: Inspector" resizable={true}
    {PositionAroundPreferredPosition} bind:State={$InspectorState}
    minWidth={300} minHeight={420}
  >
    <div name="TabStrip" style="
      display:block; position:relative;
      top:2px; height:74px; overflow:visible;
      border:none; border-bottom: solid 1px #454545;
    ">
      <IconButton style="left:10px;  top:0px" ImageURL={AppletImageURL}
        active={$InspectorState.Mode === 'applet'}
        on:click={() => InspectorState.setMode('applet')}/>
      <IconButton style="left:50px;  top:0px" ImageURL={MasterImageURL}
        active={$InspectorState.Mode === 'master'}
        on:click={() => InspectorState.setMode('master')}/>
      <IconButton style="left:90px;  top:0px" ImageURL={CardImageURL}
        active={$InspectorState.Mode === 'card'}
        on:click={() => InspectorState.setMode('card')}/>
      <IconButton style="left:130px; top:0px" ImageURL={OverlayImageURL}
        active={$InspectorState.Mode === 'overlay'}
        on:click={() => InspectorState.setMode('overlay')}/>
      <IconButton style="left:170px; top:0px" ImageURL={ComponentImageURL}
        active={$InspectorState.Mode === 'component'}
        on:click={() => InspectorState.setMode('component')}/>
      <IconButton style="left:210px; top:0px" ImageURL={ImportExportImageURL}
        active={$InspectorState.Mode === 'import-export'}
        on:click={() => InspectorState.setMode('import-export')}/>
      <IconButton style="left:250px; top:0px" ImageURL={SearchImageURL}
        active={$InspectorState.Mode === 'search'}
        on:click={() => InspectorState.setMode('search')}/>

      <IconButton style="left:10px;  top:40px" ImageURL={SelectionImageURL}
        active={$InspectorState.Pane === 'overview'}
        disabled={'import-export search'.indexOf($InspectorState.Mode) >= 0}
        on:click={() => InspectorState.setPane('overview')}/>
      <IconButton style="left:50px;  top:40px" ImageURL={SelectionGlobalsImageURL}
        active={$InspectorState.Pane === 'selection-globals'}
        disabled={'import-export search'.indexOf($InspectorState.Mode) >= 0}
        on:click={() => InspectorState.setPane('selection-globals')}/>
      <IconButton style="left:90px;  top:40px" ImageURL={SelectionResourcesImageURL}
        active={$InspectorState.Pane === 'selection-resources'}
        disabled={'import-export search'.indexOf($InspectorState.Mode) >= 0}
        on:click={() => InspectorState.setPane('selection-resources')}/>
      <IconButton style="left:130px; top:40px" ImageURL={SelectionPropertiesImageURL}
        active={$InspectorState.Pane === 'selection-properties'}
        disabled={'import-export search'.indexOf($InspectorState.Mode) >= 0}
        on:click={() => InspectorState.setPane('selection-properties')}/>
      <IconButton style="left:170px; top:40px" ImageURL={SelectionConfigurationImageURL}
        active={$InspectorState.Pane === 'selection-configuration'}
        disabled={'import-export search'.indexOf($InspectorState.Mode) >= 0}
        on:click={() => InspectorState.setPane('selection-configuration')}/>
      <IconButton style="left:210px; top:40px" ImageURL={SelectionScriptImageURL}
        active={$InspectorState.Pane === 'selection-script'}
        disabled={'import-export search'.indexOf($InspectorState.Mode) >= 0}
        on:click={() => InspectorState.setPane('selection-script')}/>
      <IconButton style="left:250px; top:40px" ImageURL={SelectionContentsImageURL}
        active={$InspectorState.Pane === 'selection-contents'}
        disabled={'import-export search'.indexOf($InspectorState.Mode) >= 0}
        on:click={() => InspectorState.setPane('selection-contents')}/>
    </div>

    <div name="PaneArea" style="
      display:block; position:relative; flex:1 1 auto;
      border:none; border-top:solid 1px #969696; border-bottom:solid 1px #454545;
    ">
      {#if $InspectorState.Pane === 'overview'}
        {#if $InspectorState.Mode === 'applet'}<AppletOverviewPane/>{/if}
      {/if}

      {#if $InspectorState.Pane === 'selection-globals'}
      {/if}

      {#if $InspectorState.Pane === 'selection-resources'}
      {/if}

      {#if $InspectorState.Pane === 'selection-properties'}
      {/if}

      {#if $InspectorState.Pane === 'selection-configuration'}
      {/if}

      {#if $InspectorState.Pane === 'selection-script'}
      {/if}

      {#if $InspectorState.Pane === 'selection-contents'}
      {/if}

      {#if $InspectorState.Mode === 'import-export'}
      {/if}

      {#if $InspectorState.Mode === 'search'}
      {/if}
    </div>

    <MessageView/>
  </Dialog>
{/if}
