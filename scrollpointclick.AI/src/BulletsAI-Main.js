// @flow

import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import pluginJson from '../plugin.json'
import { makeRequest } from './NPAI'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'
import { removeContentUnderHeading } from '@helpers/NPParagraph'
import { generateSubjectSummaryPrompt, generateKeyTermsPrompt, generateExplorationPrompt } from './support/prompts'
import { formatSubtitle, formatKeyTermsForSummary, formatBulletSummary, formatFurtherLink, formatModelInformation, formatTableOfContents } from './support/formatters'
import { scrollToEntry } from './support/helpers'

const { apiKey, defaultModel, showStats, max_tokens, researchDirectory, bulletsAIKeyTerms, bulletsSummaryParagraphs } = DataStore.settings

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
  const subject = promptIn ?? (await CommandBar.showInput('Type in your subject..', 'Start Research'))
  logDebug(pluginJson, `createResearchDigSite subject="${subject}" dir="${researchDirectory}" defaultExtension="${DataStore.defaultFileExtension}"`)
  //   const filename = DataStore.newNoteWithContent(`# ${subject} Research\n`, `${researchDirectory}`, `${subject}.${DataStore.defaultFileExtension}`)
  // logDebug(pluginJson, `createResearchDigSite note created; filename="${filename}" in DataStore. Editor.title is now:${String(Editor?.title)}`)
  const filename = `${researchDirectory}/${subject}.${DataStore.defaultFileExtension || '.txt'}`
  logDebug(pluginJson, `createResearchDigSite filename="${filename}" Now trying to open note by filename`)
  await Editor.openNoteByFilename(filename, false, 0, 0, false, true, `# ${subject} Research\n`)
  //   await Editor.openNoteByFilename(filename)
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

function updateUnclickedList(unclickedLinks: [string]) {
    const loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    let unclickedLinksList = []
    let clickedLinksList = []

    for (const unclicked of loadedJSON['unclickedLinks']) {
        logDebug(pluginJson, `\n\n------\n\nValue of unclicked in JSON:\n${unclicked}\n\n`)
        unclickedLinksList.push(unclicked)
    }

    for (const clicked of loadedJSON['clickedLinks']) {
        // logDebug(pluginJson, `\n\n------\n\nValue of unclicked in JSON:\n${unclicked}\n\n`)
        clickedLinksList.push(clicked)
    }

    for (let unclicked of unclickedLinks) {
        // logDebug(pluginJson, `\n\n------\n\nValue of Unclicked:\n${unclicked}\n\n`)

        if (unclicked.slice(0,1) == '\n') {
            unclicked = unclicked.slice(1)
        }
        if ( unclicked[0] == ' ') {
            unclicked = unclicked.slice(1)
        }
        // logDebug(pluginJson, `\n\n------\n\nValue of Modified:\n${unclicked}\n\n`)
        if (!unclickedLinksList.includes(unclicked)) {
            if (!clickedLinksList.includes(unclicked)) {
                unclickedLinksList.push(unclicked)
                logDebug(pluginJson, `\n\n------\n\nAdded:\n${unclicked}\n\n`)
            } else {
                logDebug(pluginJson, `\n\n------\n\nAlready in Clicked Links:\n${unclicked}\n\n`)
            }
        } else {
            logDebug(pluginJson, `\n\n------\n\nAlready in Unclicked Links:\n${unclicked}\n\n`)
        }
    
    loadedJSON['unclickedLinks'] = unclickedLinksList

    DataStore.saveJSON(loadedJSON, `Query Data/${Editor.title}/data.json`)
    }
}

function updateClickedLinksJsonData(clickedLink: string) {
    const loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    let unclickedLinks = []
    let clickedLinks = [clickedLink]

    for (const clicked of loadedJSON['clickedLinks']) {
        if (!clickedLinks.includes(clicked)) {
            clickedLinks.push(clicked)
        }
    }

    for (const unclicked of loadedJSON['unclickedLinks']) {
        if (unclicked != clickedLink && !clickedLinks.includes(unclicked)) {
            logDebug(pluginJson, `\n\n------\n\nPUSHED:\n${unclicked}\n\n`)
            unclickedLinks.push(unclicked)
        } else {
            logDebug(pluginJson, `\n\n------\n\nPOPPED:\n${unclicked}\n\n`)
            unclickedLinks.pop(unclicked)
        }
    }
    
    if (loadedJSON['unclickedLinks'].includes(clickedLink)) {
        logDebug(pluginJson, `\n\n------\n\nPOPPED:\n${unclicked}\n\n`)
        unclickedLinks.pop(clickedLink)
    }

    loadedJSON['unclickedLinks'] = unclickedLinks
    loadedJSON['clickedLinks'] = clickedLinks
    DataStore.saveJSON(loadedJSON, `Query Data/${Editor.title}/data.json`)
    // return loadedJSON
}

function updateBulletLinks(keyTerm?: string = '') {
    let loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    let prettyKeyTerm = ''

    for (const paragraph in Editor.paragraphs) {
        if (Editor.paragraphs[paragraph].type == 'list' && Editor.paragraphs[paragraph].content[1] == '╠') {
            const p = Editor.paragraphs[paragraph]
            const splitParagraph1 = p.content.split('[')
            if (splitParagraph1 != undefined) {
                const bulletAsString = splitParagraph1[2].split(']')[0]
                logError(pluginJson, `\n\nPARAGRAPH SPLIT]\n\n${bulletAsString}\n\n`)
            }       
    }
        if (Editor.paragraphs[paragraph].type == 'list' && loadedJSON['clickedLinks'].includes(Editor.paragraphs[paragraph].content)) {
            prettyKeyTerm = createPrettyOpenNoteLink(Editor.paragraphs[paragraph].content, Editor.filename, true, Editor.paragraphs[paragraph].content)
            Editor.paragraphs[paragraph].content = prettyKeyTerm
            Editor.updateParagraph(Editor.paragraphs[paragraph])
            Editor.highlight(Editor.paragraphs[paragraph])
        }
    }
    if (keyTerm) {
        prettyKeyTerm = createPrettyOpenNoteLink(keyTerm, Editor.filename, true, keyTerm)
        return prettyKeyTerm
    }       
}

async function createTableOfContents() {
  //TODO Add functionality
}

async function parseResponse(request: Object | null, listRequest: Object | null, subject: string, remixText?: string = '', subtitle: string, fullHistoryText: string) {
    let summary = ''
    if (request) {
        const responseText = request.choices[0].text.trim()
        const keyTermsList = listRequest.choices[0].text.split(',')
        updateUnclickedList(keyTermsList)
        const totalTokens = (request.usage.total_tokens + listRequest.usage.total_tokens)
        summary = await formatBulletSummary(subject, responseText, keyTermsList, remixText, subtitle, fullHistoryText)
        return summary
    }
    for (const keyTerm of keyTermsList) {
      if (!keyTerms.includes(keyTerm)) {
        keyTerms.push(keyTerm)
      }
    }
    jsonData['unclickedLinks'] = keyTerms
    DataStore.saveJSON(jsonData, `Query Data/${Editor.title}/data.json`)
    // clo(subtitle, 'subtitle')

    const totalTokens = request.usage.total_tokens + listRequest.usage.total_tokens
    summary = await formatBulletSummary(subject, responseText, keyTermsList, remixText, subtitle, fullHistoryText)
    // clo(summary, 'summary after now writing')
    return summary
}


async function generateReqBodies(promptMain, promptList, chosenModel) {
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
