// @flow

//-----------------------------------------------------------------------------
// Index for Reviews plugin
// Jonathan Clark
// Last updated 17.9.2022 for v0.8.0-betas, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
// import { generateCSSFromTheme } from '@helpers/HTMLView'
import pluginJson from '../plugin.json'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { JSP, logError, logInfo } from '@helpers/dev'

export {
  logReviewList,
  makeReviewList,
  startReviews,
  nextReview,
  finishReview,
} from './reviews'
export {
  makeProjectLists,
  makeProjectListsHTML,
  redisplayProjectListHTML,
  redisplayProjectListMarkdown
} from './projectLists'
export {
  completeProject,
  cancelProject
} from './projects'
export {
  generateCSSFromTheme
} from '@helpers/HTMLView'

// NB: There are other possible exports, including:
// export { testNoteplanStateFont } from '../test/noteplanstateFontTest.js'

export {
  testGenerateCSSFromTheme,
  testButtonTriggerCommand,
  testButtonTriggerOpenNote,
  testCSSCircle,
  testRedToGreenInterpolation,
} from './HTMLtests'

const pluginID = 'jgclark.Reviews'

export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
      pluginUpdated(pluginJson, r),
    )
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function testUpdated(): Promise<void> {
  await onUpdateOrInstall(true)
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(forceUpdated: boolean = false): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    if (forceUpdated) {
      logInfo('', `- Forcing pluginUpdated() ...`)
      updateSettingsResult = 1
    }
    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused?' })

  } catch (error) {
    logError(pluginID, error.message)
  }
  logInfo(pluginID, `- finished`)
}
