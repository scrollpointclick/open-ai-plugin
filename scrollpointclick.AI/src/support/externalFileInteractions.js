// @flow

import pluginJson from '../../plugin.json'
import { logDebug, logError, JSP, clo } from '@helpers/dev'

/**
 * Get data file name based on Editor.title
 * @returns {string} filename
 */
export function getDataFileName(): string {
  if (Editor.title) {
    return `Query Data/${Editor.title}/data.json`
  } else {
    throw 'getDataFileName: Editor.title is undefined. Cannot load data file.'
  }
}

/**
 * Load the data JSON file for the document in the Editor
 * @returns
 */
export function loadDataFile(): any {
  const filename = getDataFileName()
  return DataStore.loadJSON(filename)
}

/**
 * Save the data JSON file for the document in the Editor
 * @param {any} json to save
 * @returns write result (true if successful)
 */
export function saveDataFile(json: any) {
  const filename = getDataFileName()
  return DataStore.saveJSON(json, filename)
}

/**
 * Generative Research Tree by loading or creating the JSON file
 * @param {string} jsonData - the JSON data to save to the file.
 * @returns {*}
 */
export function initializeData(query?: string) {
  const filename = `Query Data/${Editor.title || ''}/data.json`
  logDebug(pluginJson, `initializeData Editor.title=${Editor.title || ''}; filename="${filename}"`)
  let loadedJSON = loadDataFile()
  if (!loadedJSON) {
    logDebug(pluginJson, `initializeData JSON did not exist for "${Editor.title || ''}". Initializing blanks`)
    if (query) {
      const newJSON = {
        initialSubject: query,
        unclickedLinks: [],
        clickedLinks: [],
        remixes: [],
        totalTokensUsed: 0,
      }
      clo(newJSON, `initializeData saving JSON to: ${filename}`)
      saveDataFile(newJSON)
      loadedJSON = newJSON
    }
  } else {
    clo(loadedJSON, `${filename} JSON existed. Will use it:`)
    // logDebug(pluginJson, `\n----\n-----initializeData-----\nLoaded!\n\n----\n`)
  }
  return loadedJSON
}

/**
 * Load the stored JSON file and update it with the clicked link
 * @param {string} clickedLink - the link that was clicked
 * @returns {void}
 */
export function updateClickedLinksJsonData(clickedLink: string) {
  if (Editor.title) {
    const filename = `Query Data/${Editor.title}/data.json`
    const loadedJSON = loadDataFile()
    if (!loadedJSON['clickedLinks'].includes(clickedLink)) {
      const updatedJSON = saveClickedLink(loadedJSON, clickedLink.trim())
      clo(updatedJSON, `updateClickedLinksJsonData saving JSON`)
      saveDataFile(updatedJSON)
    }
  }
}

/**
 * Update the data.json object, moving a clicked link from unclickedLinks to clickedLinks
 * @param {JSONData} json data object
 * @param {string} linkToMove
 * @returns {JSONData} the updated JSON data object
 */
export function saveClickedLink(json: JSONData, linkToMove: string): JSONData {
  const { unclickedLinks, clickedLinks } = json
  const newUnclickedLinks = unclickedLinks.filter((link) => link !== linkToMove)
  const newClickedLinks = [...clickedLinks, linkToMove]
  return { ...json, unclickedLinks: newUnclickedLinks, clickedLinks: newClickedLinks }
}

// export function saveTokenCountJsonData(tokenCount: number) {
//   if (Editor.title) {
//     const filename = `Query Data/${Editor.title}/data.json`
//     const loadedJSON = DataStore.loadJSON(filename)

//     clo(loadedJSON, `saved json before update`)
//     const updatedJSON = updateTokenCount(loadedJSON, tokenCount)
//     clo(updatedJSON, `new json that will be saved`)
//     // loadedJSON['totalTokensUsed'] = Number(loadedJSON['totalTokensUsed'] += tokenCount)
//     // logDebug(pluginJson, `\n\n updatedJson=${updatedJSON}\n\n`)
//     logDebug(pluginJson, `>>saving json to filename=${filename}`)
//     clo(updatedJSON, `updatedJSON`)
//     if (!updatedJSON.totalTokensUsed) throw 'saveTokenCountJsonData No total tokens used found in JSON data'
//     const val = DataStore.saveJSON(updatedJSON, filename)
//     // DELETE TEST CODE BELOW THIS LINE
//     logDebug(pluginJson, `>>save json to filename=${filename} returned:${val}; loading again to check it.`)
//     // DataStore.saveJSON(loadedJSON, filename)
//     const loadedJSON2 = DataStore.loadJSON(filename)
//     clo(loadedJSON2, `JSON loaded from disk after the save`)

//     // logDebug(pluginJson, `\n\n Saved Json=${updatedJSON}\n\n`)
//   }
// }

// /**
//  * Update the data.json object, moving a clicked link from unclickedLinks to clickedLinks
//  * @param {JSONData} json data object
//  * @param {number} tokensUsed
//  * @returns {JSONData} the updated JSON data object
//  */
// export function updateTokenCount(json: JSONData, tokensUsed: number): JSONData {
//   const { totalTokensUsed } = json
//   logDebug(pluginJson, `\n\n incomingTokensUsed=${tokensUsed}: ${typeof tokensUsed}\n\n`)
//   logDebug(pluginJson, `\n\n totalTokensUsed=${totalTokensUsed}: ${typeof totalTokensUsed}\n\n`)

//   const newTotalTokensUsed = totalTokensUsed + tokensUsed
//   logDebug(pluginJson, `\n\n newTotalTokensUsed=${newTotalTokensUsed}: ${typeof newTotalTokensUsed}\n\n`)
//   return { ...json, totalTokensUsed: newTotalTokensUsed }
// }
