// @flow
//-------------------------------------------------------------------------------
// Folder-level Functions

import { logDebug, logInfo, logWarn } from './dev'

/**
 * Return list of folders, excluding those on the given list (and any of their sub-folders).
 * Optionally exclude all special @... folders as well.
 * @author @jgclark
 *
 * @param {Array<string>} exclusions
 * @param {boolean} excludeSpecialFolders?
 * @returns {Array<string>} array of folder names
 */
export function getFilteredFolderList(exclusions: Array<string>, excludeSpecialFolders: boolean = true): Array<string> {
  // Get all folders as array of strings (other than @Trash).
  const folderList = DataStore.folders
  // logDebug('filteredFolderList', `List of DataStore.folders: ${folderList.toString()}`)
  const reducedList: Array<string> = []
  logDebug('filteredFolderList', `filteredFolderList: Starting with exclusions ${exclusions.toString()}`)
  if (exclusions.length > 0) {
    const exclusionsTerminatedWithSlash: Array<string> = []
    for (const e of exclusions) {
      exclusionsTerminatedWithSlash.push(e.endsWith('/') ? e : `${e}/`)
    }
    const folderListTerminatedWithSlash: Array<string> = []
    for (const f of folderList) {
      folderListTerminatedWithSlash.push(f.endsWith('/') ? f : `${f}/`)
    }
    for (const ff of folderListTerminatedWithSlash) {
      let matchedAnExcludedFolder = false
      for (const ee of exclusionsTerminatedWithSlash) {
        if (ff.startsWith(ee)) {
          matchedAnExcludedFolder = true
          // console.log(`  ${ee} starts with ${ff}`)
          break
        }
      }
      if (!matchedAnExcludedFolder && !(excludeSpecialFolders && ff.startsWith('@'))) {
        reducedList.push(ff.substr(0, ff.length - 1))
          // console.log(`  ${ff} didn't match`)
      }
    }
    logDebug('filteredFolderList', `-> filteredList: ${reducedList.toString()}`)
  } else {
    logInfo('filteredFolderList', `empty excluded folder list`)
    reducedList.push(...folderList.slice())
  }
  return reducedList
}

/**
 * Get the folder name from the full NP (project) note filename, without leading or trailing slash.
 * @author @jgclark
 *
 * @param {string} fullFilename - full filename to get folder name part from
 * @returns {string} folder/subfolder name
 */
export function getFolderFromFilename(fullFilename: string): string {
  // drop first character if it's a slash
  const filename = (fullFilename.startsWith('/')) ? fullFilename.substr(1) : fullFilename
  const filenameParts = filename.split('/')
  return filenameParts.slice(0, filenameParts.length - 1).join('/')
}
