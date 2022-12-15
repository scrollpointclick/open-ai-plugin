import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import pluginJson from '../plugin.json'
import { makeRequest } from './NPAI'
import { formatBullet, formatBulletKeyTerms, formatFurtherLink, formatBulletSummary } from './support/helpers'

const { apiKey, defaultModel, showStats, max_tokens, researchDirectory, aiToolsDirectory, bulletsAIKeyTerms, bulletsSummaryParagraphs} = DataStore.settings

const availableModels = ['text-davinci-003', 'text-curie-001', 'text-babbage-001', 'text-ada-001']
type CompletionsRequest = { model: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }
const completionsComponent = 'completions'

const testJson = {
    'initialSubject': 'Grizzly Bears',
    'followedLinks': [
        'Alaskan Wilderness',
        'Diet'
    ],
    'remixes': [
        'Documentaries about Grizzly Bears',
        'Grizzly Bears and the Food Chain'
    ]
}

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
export async function createResearchDigSite() {
    const subject = await CommandBar.showInput('Type in your subject..', 'Start Research')
    DataStore.newNoteWithContent(`# ${subject} Research\n`, `${aiToolsDirectory}`, `${subject}.txt`) 
    await Editor.openNoteByFilename(`${aiToolsDirectory}/${subject}.txt`)
    DataStore.invokePluginCommandByName(`Bullets AI`, `scrollpointclick.AI`, [`${subject}`])
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
    isCustomRemix: bool = false, 
    userIn: string = '') {

    try {
        const start = new Date()
        const chosenModel = (defaultModel != 'Choose Model') ? defaultModel : 'text-davinci-003'
        const paragraphs = Editor.paragraphs
        let summarizedQueries = ''
        let promptMain = ''
        let promptList = ''
        const state = await checkInitialState(promptIn, prevSubjectIn, initialSubject, isCustomRemix)
        switch (state) {
            case 'initialQuery':
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nInitial Query\nLink: ${promptIn}\n----\n`)
                summarizedQueries = initializeData(promptIn)
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nSummarized Query\nLink: ${summarizedQueries}\n----\n`)
                promptMain = await formatBullet(promptIn)
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nMain Prompt\nLink: ${promptMain}\n----\n`)
                promptList = await formatBulletKeyTerms(promptIn)
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nList Prompt\nLink: ${promptList}\n----\n`)
                
            case 'followedLink':
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nFollowed Link\nLink: ${promptIn}\nPrevious Subject: ${prevSubjectIn}----\n`)
                summarizedQueries = initializeData()
                promptMain = await formatBullet(promptIn)
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nMain Prompt\nLink: ${promptMain}\n----\n`)
                promptList = await formatBulletKeyTerms(promptIn)
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nList Prompt\nLink: ${promptList}\n----\n`)
                
            case 'remix':
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nRemix\nRemix Prompt: ${promptIn}\nPrevious Subject: ${prevSubjectIn}----\n`)
                summarizedQueries = initializeData()
                promptMain = await formatBullet(promptIn)
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nMain Prompt\nLink: ${promptMain}\n----\n`)
                promptList = await formatBulletKeyTerms(promptIn)
                logDebug(pluginJson, `\n----\n-----bulletsAI-----\nList Prompt\nLink: ${promptList}\n----\n`)
                
            default:
                logError(pluginJson, 'No state detected. Bailing out.')
        }
        logError(pluginJson, "THIS HAPPENED")
        let { reqBody, reqListBody } = await generateReqBodies(promptMain, promptList, chosenModel)
        let { request, listRequest } = await generateRequests(reqBody, reqListBody, chosenModel)
        const summary = await parseResponse(request, listRequest, promptIn)
        clo(summary, 'Summary')

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
async function checkInitialState(promptIn: string, prevSubjectIn: string | null, initialSubject: string | null, isCustomRemix: bool) {
    logDebug(pluginJson, `\n----\n-----bulletsAI-----\nChecking Initial State\n----\n`)
    if (isCustomRemix) {
        logDebug(pluginJson, `\n----\n-----bulletsAI-----\nremix\n----\n`)
        return 'remix'
    } else if (prevSubjectIn) {
        logDebug(pluginJson, `\n----\n-----bulletsAI-----\nfollowedLink\n----\n`)
        return 'followedLink'
    } else {
        logDebug(pluginJson, `\n----\n-----bulletsAI-----\ninitialQuery\n----\n`)
        return 'initialQuery'
    }
}


async function parseResponse(request: Object | null, listRequest: Object | null, subject: string, remixText?: string = '') {
    let summary = ''
    if (request) {
        const responseText = request.choices[0].text
        const keyTermsList = listRequest.choices[0].text
        let keyTerms = []
        let jsonData = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
        let keyTermsData = jsonData['untouchedLinks']
        for (var index in keyTermsList) {
            keyTermsData.push(keyTermsList[index])
        }
        DataStore.saveJSON(jsonData, `Query Data/${Editor.title}/data.json`)
        const totalTokens = (request.usage.total_tokens + listRequest.usage.total_tokens)
        summary = await formatBulletSummary(subject, responseText, keyTermsList, remixText)
        return summary
    }
}

async function generateRequests(reqBody: CompletionsRequest, reqListBody: CompletionsRequest) {
    const request = await makeRequest(completionsComponent, 'POST', reqBody)
    const listRequest = await makeRequest(completionsComponent, 'POST', reqListBody)
    return { request, listRequest }
}

async function generateReqBodies(promptMain, promptList, chosenModel) {
    const reqBody: CompletionsRequest = {prompt: promptMain, model: chosenModel, max_tokens: max_tokens }
    const reqListBody: CompletionsRequest = {prompt: promptList, model: chosenModel, max_tokens: max_tokens }
    return { reqBody, reqListBody }
}

/**
 * Generative Research Tree
 * @param {string} jsonData - the JSON data to save to the file.
 * @returns {*}
 */
function initializeData(query?: string) {
    logDebug(pluginJson, `\n----\n-----initializeData-----\nAttempting to load...\n${query}\n\n----\n`)
    let loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    if (!loadedJSON) {
        if (query) {
            logDebug(pluginJson, `\n----\n-----initializeData-----\nAttempting to save...\n${query}\n\n----\n`)
            const newJSON = {'initialSubject': query}
            DataStore.saveJSON(newJSON, `Query Data/${Editor.title}/data.json`)
            loadedJSON = newJSON
            return loadedJSON
        }
    } else {
        logDebug(pluginJson, `\n----\n-----initializeData-----\nLoaded!\n\n----\n`)
    }
    return loadedJSON
}