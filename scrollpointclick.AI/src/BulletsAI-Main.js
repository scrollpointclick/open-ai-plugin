// @flow
import { JSONData } from './support/AIFlowTypes'
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import pluginJson from '../plugin.json'
import { makeRequest } from './NPAI'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'
import { removeContentUnderHeading } from '@helpers/NPParagraph'
import { generateSubjectSummaryPrompt, generateKeyTermsPrompt, generateExplorationPrompt } from './support/prompts'
import { formatSubtitle, formatKeyTermsForSummary, formatBulletSummary, formatFurtherLink, formatModelInformation, formatTableOfContents } from './support/formatters'
import { scrollToEntry } from './support/helpers'

const availableModels = ['text-davinci-003', 'text-curie-001', 'text-babbage-001', 'text-ada-001']
type CompletionsRequest = { model: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }
const completionsComponent = 'completions'

/* ACTION PLAN
// Get Input Text
// Generate 3 prompts { promptMain, !promptLink!, promptList } -- Actually just the two
// Perform queries to API for each prompt
// Build Summary
    // Format Title
    // Format Subtitle
        // Generate backlinks for each existing summary
    // Format 'Going Further?' Links
    // Build Final Output
// Check all bullets for matches with pre-existing bullets
*/

/**
 * Prompt for new research tunnel
 *
 */
export async function createResearchDigSite(promptIn?: string | null = null) {
  const { researchDirectory } = DataStore.settings
  const subject = promptIn ?? (await CommandBar.showInput('Type in your subject..', 'Start Research'))
  logDebug(pluginJson, `createResearchDigSite subject="${subject}" dir="${researchDirectory}" defaultExtension="${DataStore.defaultFileExtension}"`)
  const filename = `${researchDirectory}/${subject}.${DataStore.defaultFileExtension || '.txt'}`
  logDebug(pluginJson, `createResearchDigSite filename="${filename}" Now trying to open note by filename`)
  await Editor.openNoteByFilename(filename, false, 0, 0, false, true, `# ${subject} Research\n`)
  logDebug(pluginJson, `createResearchDigSite opened Editor note by filename title is now:"${String(Editor.title)}" Editor.filename="${String(Editor.filename)}"`)
  if (Editor.title === `${subject} Research`) {
    await bulletsAI(subject)
  } else {
    logDebug(pluginJson, `createResearchDigSite Wanted Editor.title to be "${subject} Research" but Editor.title is "${Editor.title || ''}"`)
  }
}

export async function createRemix() {
  return await CommandBar.showInput('Type in your remix request', 'Start Remix')
}

/**
 * Generative Research Tree
 * @param {string} promptIn - Prompt to generate from
 * @param {string} prevSubjectIn - Previous prompt to use for context
 * @param {string} initialSubject - Rooting context string
 * @param {string} userIn - A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.
 * @returns
 */
export async function bulletsAI(
  promptIn: string,
  prevSubjectIn: string | null = '',
  initialSubject: string | null = '',
  isCustomRemix: boolean = false,
  fullHistory?: string = '',
  useFullHistory?: boolean = false,
  fullHistoryText?: string = '',
  userIn: string = '',
) {
  try {
    const { defaultModel } = DataStore.settings

    const start = new Date()
    const chosenModel = defaultModel != 'Choose Model' ? defaultModel : 'text-davinci-003'
    const paragraphs = Editor.paragraphs
    let promptMain = ''
    let promptList = ''
    const state = await checkInitialState(promptIn, prevSubjectIn, initialSubject, isCustomRemix)
    logDebug(pluginJson, `bulletsAI state=${state}`)
    switch (state) {
      case 'initialQuery':
        initializeData(promptIn)
        promptMain = await generateSubjectSummaryPrompt(promptIn)
        promptList = await generateKeyTermsPrompt(promptIn)
        break

      case 'followedLink':
        logDebug(pluginJson, `\n----\n-----bulletsAI-----\nFollowed Link\nLink: ${promptIn}\nPrevious Subject: ${prevSubjectIn}\n----\n\n${typeof useFullHistory}`)
        initializeData()
        updateClickedLinksJsonData(promptIn)
        promptMain = await generateSubjectSummaryPrompt(useFullHistory == 'true' ? fullHistoryText : promptIn, useFullHistory == 'true' ? '' : prevSubjectIn)
        promptList = await generateKeyTermsPrompt(promptIn, prevSubjectIn)
        break

      case 'remix':
        // promptIn = await createRemix()

        initializeData()
        promptMain = await generateExplorationPrompt(promptIn, prevSubjectIn)
        promptList = await generateKeyTermsPrompt(promptIn, prevSubjectIn)
        break
    }
    const { newFullHistoryText, formattedSubtitle } = formatSubtitle(promptIn, prevSubjectIn ? prevSubjectIn : '', fullHistory, useFullHistory, fullHistoryText)
    if (useFullHistory == 'true') {
      promptMain = await generateSubjectSummaryPrompt(newFullHistoryText)
    }
    let { reqBody, reqListBody } = await generateReqBodies(useFullHistory == true ? newFullHistoryText : promptMain, promptList, chosenModel)
    let { request, listRequest } = await generateRequests(reqBody, reqListBody, chosenModel)
    const summary = await parseResponse(request, listRequest, promptIn, '', formattedSubtitle, newFullHistoryText)

    updateBulletLinks()
    Editor.appendParagraph(summary)
    formatTableOfContents()
    scrollToEntry(promptIn, false)
  } catch (error) {
    logError(pluginJson, error)
  }
}

/**
 * Looks at inputs to determine the type of generation request
 * @param {string} promptIn -
 * @param {string} prevSubjectIn -
 * @param {string} initialSubject -
 * @param {bool} isCustomRemix -
 * Currently under construction.
 */
async function checkInitialState(promptIn: string, prevSubjectIn: string | null, initialSubject: string | null, isCustomRemix: boolean) {
  if (isCustomRemix == true) {
    return 'remix'
  } else if (prevSubjectIn && isCustomRemix != true) {
    return 'followedLink'
  } else {
    return 'initialQuery'
  }
}

/**
 * Generative Research Tree by loading or creating the JSON file
 * @param {string} jsonData - the JSON data to save to the file.
 * @returns {*}
 */
function initializeData(query?: string) {
  logDebug(pluginJson, `initializeData Editor.title=${Editor.title}`)
  let loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
  if (!loadedJSON) {
    if (query) {
      let newJSON = {
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
function updateClickedLinksJsonData(clickedLink: string) {
  if (Editor.title) {
    const filename = `Query Data/${Editor.title}/data.json`
    const loadedJSON = DataStore.loadJSON(filename)
    if (!loadedJSON['clickedLinks'].includes(clickedLink)) {
      const updatedJSON = saveClickedLink(loadedJSON, clickedLink.trim())
      DataStore.saveJSON(updatedJSON, filename)
    }
  }
}

function updateBulletLinks(keyTerm?: string = '') {
  let loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
  let prettyKeyTerm = ''

  let bulletsToUpdate = Editor.paragraphs.forEach(f=> {
    // logDebug(pluginJson, `\n\n---- WHAT IS F ----\n\n ${f}\n\n`)
    if (f.type == 'list') {
      for (const c of loadedJSON['clickedLinks']) {
        const encodedLink = encodeURI(c)
        logDebug(pluginJson, `\n\n---- WHAT IS F.CONTENT ----\n\n ${f.content}\n\n`)



        if (f.content.includes(`arg0=${encodedLink}`)) {
          logDebug(pluginJson, `\n\n---- MATCHES C ----\n\n ${c}\n\n`)
          prettyKeyTerm = createPrettyOpenNoteLink(c, Editor.filename, true, c)
          logDebug(pluginJson, `\n\n---- Pretty Key Term ----\n\n ${prettyKeyTerm}\n\n`)
          f.type = 'text'
          f.content = `### ${prettyKeyTerm}`
          Editor.updateParagraph(f)
        }
      }
    }
  })
}

async function parseResponse(request: Object | null, listRequest: Object | null, subject: string, remixText?: string = '', subtitle: string, fullHistoryText: string) {
  let summary = ''
  if (request) {
    const responseText = request.choices[0].text.trim()
    const keyTermsList = listRequest.choices[0].text.split(',')
    let keyTerms = []
    logDebug(pluginJson, `parseResponse Editor.title="${Editor.title}"`)
    let jsonData = { ...DataStore.loadJSON(`Query Data/${Editor.title}/data.json`) }
    clo(jsonData, 'parseResponse jsonData BEFORE')
    for (const keyTerm of jsonData['unclickedLinks']) {
      keyTerms.push(keyTerm.trim())
    }
    for (const keyTerm of keyTermsList) {
      if (!keyTerms.includes(keyTerm)) {
        keyTerms.push(keyTerm.trim())
      }
    }
    jsonData['unclickedLinks'] = keyTerms
    clo(jsonData, 'parseResponse jsonData AFTER')
    DataStore.saveJSON(jsonData, `Query Data/${Editor.title}/data.json`)
    // clo(subtitle, 'subtitle')

    const totalTokens = request.usage.total_tokens + listRequest.usage.total_tokens
    summary = await formatBulletSummary(subject, responseText, keyTermsList, remixText, subtitle, fullHistoryText)
    // clo(summary, 'summary after now writing')
    return summary
  }
}

async function generateReqBodies(promptMain, promptList, chosenModel) {
  const { max_tokens } = DataStore.settings

  const reqBody: CompletionsRequest = { prompt: promptMain, model: chosenModel, max_tokens: max_tokens }
  // clo(reqBody, 'reqBody\n\n\n\n\n\n\n\----------')
  const reqListBody: CompletionsRequest = { prompt: promptList, model: chosenModel, max_tokens: max_tokens }
  return { reqBody, reqListBody }
}

async function generateRequests(reqBody: CompletionsRequest, reqListBody: CompletionsRequest) {
  const request = await makeRequest(completionsComponent, 'POST', reqBody)
  const listRequest = await makeRequest(completionsComponent, 'POST', reqListBody)
  return { request, listRequest }
}

/**
 * Remix the summary request with additional details
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} subject - The initial subject value.
 */
export async function remixQuery(subject: string) {
  const additionalDetails = await CommandBar.showInput('Rewrite this query with addional detail.', 'Remix')
  bulletsAI(subject, additionalDetails)
}

export async function explore(prevSubjectIn: string) {
  // Explore - Create a new prompt that carries over an entirely new query but is still related.

  // const selectedHeading = await CommandBar.showInput('Select unique heading.', 'OK') // Currently Disabled.
  const selectedSubtitle = await CommandBar.showInput('Type in your prompt.', 'OK')

  await bulletsAI(selectedSubtitle, prevSubjectIn)
}


