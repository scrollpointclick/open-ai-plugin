// @flow
import pluginJson from '../plugin.json'
import { type JSONData } from './support/AIFlowTypes'
import { makeRequest } from './NPAI'
import { generateSubjectSummaryPrompt, generateKeyTermsPrompt, generateExplorationPrompt } from './support/prompts'
import { formatSubtitle, formatKeyTermsForSummary, formatBulletSummary, formatFurtherLink, formatModelInformation, formatTableOfContents } from './support/formatters'
import { capitalizeFirstLetter, scrollToEntry } from './support/helpers'
// import { removeContentUnderHeading } from '@helpers/NPParagraph'
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'
import { showMessage } from '@helpers/userInput'

// const availableModels = ['text-davinci-003', 'text-curie-001', 'text-babbage-001', 'text-ada-001']
type CompletionsRequest = { model: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }
const completionsComponent = 'completions'

/**
 * Prompt for new research tunnel
 *
 */

export async function createResearchDigSite(promptIn?: string | null = null) {
  const { researchDirectory } = DataStore.settings
  const options = [
    {
      label: 'Default',
      value: 'Default'
    },
    {
      label: 'Custom',
      value: 'Custom'
    }
  ]
  let subject = ''
  subject = promptIn ?? (await CommandBar.showInput((Editor.selectedText) ? `${capitalizeFirstLetter(Editor.selectedText)}`: 'Type in your subject..', 'Start Research'))
  if (subject == '' && Editor.selectedText) {
    subject = capitalizeFirstLetter(Editor.selectedText)
    // const useSelectedFolder = await chooseOption('g', options)
    createOuterLink()
  } 
  // logDebug(pluginJson, `createResearchDigSite subject="${subject}" dir="${researchDirectory}" defaultExtension="${DataStore.defaultFileExtension}"`)
  const filename = `${researchDirectory}/${subject}.${DataStore.defaultFileExtension || '.txt'}`
  // logDebug(pluginJson, `createResearchDigSite filename="${filename}" Now trying to open note by filename`)
  await Editor.openNoteByFilename(filename, false, 0, 0, false, true, `# ${subject} Research\n`)
  // logDebug(pluginJson, `createResearchDigSite opened Editor note by filename title is now:"${String(Editor.title)}" Editor.filename="${String(Editor.filename)}"`)
  if (Editor.title === `${subject} Research`) {
    await bulletsAI(subject)
  } else {
    // logDebug(pluginJson, `createResearchDigSite Wanted Editor.title to be "${subject} Research" but Editor.title is "${Editor.title || ''}"`)
  }
}

export async function createOuterLink() {
  const settings = DataStore.settings
  const linkTitle = Editor.selectedText
  const link = `${settings['researchDirectory']}%2F${encodeURI(linkTitle)}.${DataStore.defaultFileExtension || '.txt'}`
  const outerLink = createPrettyOpenNoteLink(linkTitle, link, true, capitalizeFirstLetter(linkTitle))
  Editor.replaceSelectionWithText(outerLink)
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
    // logDebug(pluginJson, `bulletsAI state=${state}`)
    switch (state) {
      case 'initialQuery':
        initializeData(promptIn)
        promptMain = await generateSubjectSummaryPrompt(promptIn)
        promptList = await generateKeyTermsPrompt(promptIn)
        break

      case 'followedLink':
        // logDebug(pluginJson, `\n----\n-----bulletsAI-----\nFollowed Link\nLink: ${promptIn}\nPrevious Subject: ${prevSubjectIn}\n----\n\n${typeof useFullHistory}`)
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
    const { reqBody, reqListBody } = await generateReqBodies(useFullHistory == true ? newFullHistoryText : promptMain, promptList, chosenModel)
    const { request, listRequest } = await generateRequests(reqBody, reqListBody, chosenModel)
    const summary = await parseResponse(request, listRequest, promptIn, '', formattedSubtitle, newFullHistoryText)

    updateBulletLinks()
    Editor.appendParagraph(summary, 'text')
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
  const loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
  let prettyKeyTerm = ''

  const bulletsToUpdate = Editor.paragraphs.forEach((f) => {
    if (f.type == 'list') {
      for (const c of loadedJSON['clickedLinks']) {
        const encodedLink = encodeURI(c)

        if (f.content.includes(`arg0=${encodedLink}`)) {
          // logDebug(pluginJson, `\n\n---- MATCHES C ----\n\n ${c}\n\n`)
          prettyKeyTerm = createPrettyOpenNoteLink(c, Editor.filename, true, c)
          // logDebug(pluginJson, `\n\n---- Pretty Key Term ----\n\n ${prettyKeyTerm}\n\n`)
          f.type = 'text'
          f.content = `**${prettyKeyTerm}**`
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
    const keyTerms = []
    // logDebug(pluginJson, `parseResponse Editor.title="${Editor.title}"`)
    const jsonData = { ...DataStore.loadJSON(`Query Data/${Editor.title}/data.json`) }
    // clo(jsonData, 'parseResponse jsonData BEFORE')
    for (const keyTerm of jsonData['unclickedLinks']) {
      keyTerms.push(keyTerm.trim())
    }
    for (const keyTerm of keyTermsList) {
      if (!keyTerms.includes(keyTerm)) {
        keyTerms.push(keyTerm.trim())
      }
    }
    jsonData['unclickedLinks'] = keyTerms
    // clo(jsonData, 'parseResponse jsonData AFTER')
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
  await bulletsAI(subject, additionalDetails)
}

export async function explore(prevSubjectIn: string) {
  const selectedSubtitle = await CommandBar.showInput('Type in your prompt.', 'OK')
  if (selectedSubtitle?.length) {
    await bulletsAI(selectedSubtitle, prevSubjectIn)
  } else {
    await showMessage('No prompt entered. Please try again.')
  }
}

export async function researchFromSelection() {
  const selectedText = Editor.selectedText
  const matchedContent = Editor.paragraphs.find((p) => p.type === 'text' && p.content.includes(selectedText))

  logDebug(pluginJson, `\n\n---- INFO -----\n\n${selectedText}\n${matchedContent}\n\n`)

  await bulletsAI(selectedText, matchedContent.heading)
}

export async function moveNoteToResearchCollection() {
  const { researchDirectory } = DataStore.settings
  const currentNote = Editor.note
  const researchFolders = DataStore.folders.filter((p) => p.includes('Research/'))
  // logDebug(pluginJson, researchFolders)
  const selectedDirectory = await CommandBar.showInput('Which directory?', 'Choose One')
  const newPath = `${researchDirectory}/${selectedDirectory}`
  const newLocation = `${newPath}/${currentNote.title}.${DataStore.defaultFileExtension || '.txt'}`
  if (!researchFolders.includes(selectedDirectory)) {
    logDebug(pluginJson, 'Directory does not yet exist.')
    await updateResearchCollectionTableOfContents(newPath, currentNote.title, currentNote, selectedDirectory, false)
  } else {
    await updateResearchCollectionTableOfContents(newPath, currentNote.title, currentNote, selectedDirectory)
  }
  currentNote.rename(newLocation)
}

export async function updateResearchCollectionTableOfContents(newPath: string, originalNoteTitle: string, noteToAdd: NoteObject, selectedDirectory: string, exists: bool = true) {
  const noteTableOfContents = noteToAdd.paragraphs.filter((p) => p.heading.includes('Table of Contents'))
  const formattedOriginalNoteTitle = selectedDirectory.replace(' Research', '')
  const subtitleLinks = noteToAdd.paragraphs.filter((p) => p.type == 'heading' && p.content.includes('[') && !p.content.includes('Table of Contents'))
  const tocFileName = `${newPath}/Table of Contents.${DataStore.defaultFileExtension || '.txt'}`
  await Editor.openNoteByFilename(tocFileName, false, 0, 0, false, true)
  if (!Editor.content.includes('Table of Contents')) {
    Editor.insertTextAtCharacterIndex(`- Table of Contents`, 2)
  }
  Editor.appendParagraph(`### ${originalNoteTitle}`, 'heading')
  for (const para of noteTableOfContents) {
    if (!para.content.includes('---') && para.content != '') {
      const newLink = await updatePrettyLink(para.content, originalNoteTitle, newPath)
      para.content = newLink
      noteToAdd.updateParagraph(para)
      Editor.appendParagraph(newLink, 'list')
    }
  }
  // Need to figure out how to fix backlinks in the subtitles.
  // for (const para of subtitleLinks) {
  //   // logDebug(pluginJson, para.content)
  //     const newLink = await updatePrettyLink(para.content, originalNoteTitle, newPath)
  //     para.content = newLink
  //     noteToAdd.updateParagraph(para)
  //     Editor.appendParagraph(newLink, 'list')
  // }
}

export async function updatePrettyLink(link: string, originalNoteTitle: string, newPath: string) {
  // logDebug(pluginJson, link)
  let heading = link.split(']')[0].slice(1)
  const newLink = `${newPath}/${originalNoteTitle}.${DataStore.defaultFileExtension || '.txt'}`
  logDebug(pluginJson, heading)
  return createPrettyOpenNoteLink(heading, newLink, true, capitalizeFirstLetter(heading))
}