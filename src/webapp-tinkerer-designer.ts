/*******************************************************************************
*                                                                              *
*                        WebApp Tinkerer (WAT) Runtime                         *
*                                                                              *
*******************************************************************************/

  import WAD from './WAD.svelte'

/**** get a reference to the "global" object ****/

  export const global = /*#__PURE__*/ Function('return this')()
// see https://stackoverflow.com/questions/3277182/how-to-get-the-global-object-in-javascript

/**** check WAT presence ****/

  const WAT = global.WAT
  if (typeof WAT?.ready !== 'function') {
    window.alert(
      '"WebApp Tinkerer" not found\n\n' +
      'The WAT Designer needs the WAT Runtime to be loaded first'
    )
    throw new Error('MissingDependency: "WAT" not found')
  }

/**** ready to attach designer ****/

  WAT.ready(() => {
    const Designer = new WAD({
      target:document.body
    })
  })

