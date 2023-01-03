import { logDebug, logError, JSP } from '@helpers/dev'
import pluginJson from '../../plugin.json'

/**
 * Generative Research Tree by loading or creating the JSON file
 * @param {string} jsonData - the JSON data to save to the file.
 * @returns {*}
 */
export function initializeData(query?: string) {
    logDebug(pluginJson, `initializeData Editor.title=${Editor.title}`)
    let loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    if (!loadedJSON) {
      if (query) {
        const newJSON = {
          initialSubject: query,
          unclickedLinks: [],
          clickedLinks: [],
          remixes: [],
        }
        DataStore.saveJSON(newJSON, `Query Data/${Editor.title}/data.json`)
        loadedJSON = newJSON
        return loadedJSON
      }
    } else {
      // logDebug(pluginJson, `\n----\n-----initializeData-----\nLoaded!\n\n----\n`)
    }
    return loadedJSON
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
  
/**
 * Load the stored JSON file and update it with the clicked link
 * @param {string} clickedLink - the link that was clicked
 * @returns {void}
 */
export function updateClickedLinksJsonData(clickedLink: string) {
if (Editor.title) {
    const filename = `Query Data/${Editor.title}/data.json`
    const loadedJSON = DataStore.loadJSON(filename)
    if (!loadedJSON['clickedLinks'].includes(clickedLink)) {
    const updatedJSON = saveClickedLink(loadedJSON, clickedLink.trim())
    DataStore.saveJSON(updatedJSON, filename)
    }
}
}