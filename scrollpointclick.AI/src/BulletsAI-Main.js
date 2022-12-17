import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import pluginJson from '../plugin.json'
import { makeRequest } from './NPAI'
import { formatBullet, formatBulletKeyTerms, formatFurtherLink } from './support/helpers'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'

const { apiKey, defaultModel, showStats, max_tokens, researchDirectory, aiToolsDirectory, bulletsAIKeyTerms, bulletsSummaryParagraphs} = DataStore.settings

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
export async function createResearchDigSite() {
    const subject = await CommandBar.showInput('Type in your subject..', 'Start Research')
    DataStore.newNoteWithContent(`# ${subject} Research\n`, `${aiToolsDirectory}`, `${subject}.txt`) 
    await Editor.openNoteByFilename(`${aiToolsDirectory}/${subject}.txt`)
    DataStore.invokePluginCommandByName(`Bullets AI`, `scrollpointclick.AI`, [`${subject}`])
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
    isCustomRemix: bool = false,
    fullHistory?: string = '',
    useFullHistory?: bool = false,
    fullHistoryText?: string = '',
    userIn: string = '') {

    try {
        const start = new Date()
        const chosenModel = (defaultModel != 'Choose Model') ? defaultModel : 'text-davinci-003'
        const paragraphs = Editor.paragraphs
        let promptMain = ''
        let promptList = ''
        const state = await checkInitialState(promptIn, prevSubjectIn, initialSubject, isCustomRemix)
        switch (state) {
            case 'initialQuery':
                initializeData(promptIn)
                promptMain = await formatBullet(promptIn)
                promptList = await formatBulletKeyTerms(promptIn)
                break
                
            case 'followedLink':
                logError(pluginJson, `\n----\n-----bulletsAI-----\nFollowed Link\nLink: ${promptIn}\nPrevious Subject: ${prevSubjectIn}\n----\n\n${typeof(useFullHistory)}`)
                initializeData()
                updateClickedLinksJsonData(promptIn)
                updateBulletLinks()
                promptMain = await formatBullet((useFullHistory == 'true') ? fullHistoryText : promptIn, (useFullHistory == 'true') ? '' : prevSubjectIn)
                promptList = await formatBulletKeyTerms(promptIn)
                break
                
            case 'remix':
                promptIn = await createRemix()
                initializeData()
                promptMain = await formatBullet(promptIn)
                promptList = await formatBulletKeyTerms(promptIn)
                break
        }
        const { newFullHistoryText, formattedSubtitle } = formatSubtitle(promptIn, (prevSubjectIn) ? prevSubjectIn : '', fullHistory, useFullHistory, fullHistoryText)
        if (useFullHistory == 'true') {
            promptMain = await formatBullet(newFullHistoryText)
        }
        let { reqBody, reqListBody } = await generateReqBodies((useFullHistory == true) ? newFullHistoryText : promptMain, promptList, chosenModel)
        let { request, listRequest } = await generateRequests(reqBody, reqListBody, chosenModel)
        const summary = await parseResponse(request, listRequest, promptIn, '', formattedSubtitle, newFullHistoryText)
        
        Editor.appendParagraph(summary)

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
    let loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    if (!loadedJSON) {
        if (query) {
            let newJSON = {
                'initialSubject': query,
                'unclickedLinks': [],
                'clickedLinks': [],
                'remixes': []
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

function updateClickedLinksJsonData(clickedLink: string) {
    let loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    let unclickedLinks = []
    let clickedLinks = [clickedLink]
    for (const clicked of loadedJSON['clickedLinks']) {
        // logError(pluginJson, `CLICKED == ${clicked}`)
        clickedLinks.push(clicked)
    }
    for (const unclickedLink of loadedJSON['unclickedLinks']) {
        const cleanLink = unclickedLink.trim()
        if (clickedLinks.includes(unclickedLink.trim())) {
            // FIXME Should do something
        }
        if (unclickedLink.trim() == clickedLink.trim()) {
            unclickedLinks.pop(clickedLink)
        } else {
            unclickedLinks.push(unclickedLink)
        }
    }
    for (const unclickedLink of unclickedLinks) {
        if (clickedLinks.includes(unclickedLink.trim())) {
            unclickedLinks.pop(unclickedLink)
        }
    }
    
    loadedJSON['unclickedLinks'] = unclickedLinks.filter((v, i, a) => a.indexOf(v) === i)
    loadedJSON['clickedLinks'] = clickedLinks.filter((v, i, a) => a.indexOf(v) === i)
    DataStore.saveJSON(loadedJSON, `Query Data/${Editor.title}/data.json`)
    return loadedJSON
}

function updateBulletLinks(keyTerm?: string = '') {
    let loadedJSON = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    let prettyKeyTerm = ''

    // logError(pluginJson, `Parsing Paragraphs`)
    for (const paragraph in Editor.paragraphs) {
        // logError(pluginJson, `paragraph:\nTYPE: ${paragraph.type}\nCONTENT: ${paragraph.content}\n`)
        if (Editor.paragraphs[paragraph].type == 'list' && Editor.paragraphs[paragraph].content.includes(loadedJSON['clickedLinks'])) {
            prettyKeyTerm = createPrettyOpenNoteLink(Editor.paragraphs[paragraph].content, Editor.filename, true, Editor.paragraphs[paragraph].content)
            // logError(pluginJson, `prettyKeyTerm: ${prettyKeyTerm}`)
            Editor.paragraphs[paragraph].content = prettyKeyTerm
            Editor.updateParagraph(Editor.paragraphs[paragraph])
        }
    }
    if (keyTerm) {
        prettyKeyTerm = createPrettyOpenNoteLink(keyTerm, Editor.filename, true, keyTerm)
        return prettyKeyTerm
    }
        
}


async function parseResponse(request: Object | null, listRequest: Object | null, subject: string, remixText?: string = '', subtitle: string, fullHistoryText: string) {
    let summary = ''
    if (request) {
        const responseText = request.choices[0].text.trim()
        const keyTermsList = listRequest.choices[0].text.split(',')
        let keyTerms = []
        let jsonData = {...DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)}
        for (const keyTerm of jsonData['unclickedLinks']) {
            keyTerms.push(keyTerm)
        }
        for (const keyTerm of keyTermsList) {
            if (!keyTerms.includes(keyTerm)) {
            keyTerms.push(keyTerm)
            }
        }
        jsonData['unclickedLinks'] = keyTerms
        DataStore.saveJSON(jsonData, `Query Data/${Editor.title}/data.json`)
        // clo(subtitle, 'subtitle')

        const totalTokens = (request.usage.total_tokens + listRequest.usage.total_tokens)
        summary = await formatBulletSummary(subject, responseText, keyTermsList, remixText, subtitle, fullHistoryText)
        // clo(summary, 'summary after now writing')
        return summary
    }
}

async function generateReqBodies(promptMain, promptList, chosenModel) {
    const reqBody: CompletionsRequest = {prompt: promptMain, model: chosenModel, max_tokens: max_tokens }
    // clo(reqBody, 'reqBody\n\n\n\n\n\n\n\----------')
    const reqListBody: CompletionsRequest = {prompt: promptList, model: chosenModel, max_tokens: max_tokens }
    return { reqBody, reqListBody }
}

async function generateRequests(reqBody: CompletionsRequest, reqListBody: CompletionsRequest) {
    const request = await makeRequest(completionsComponent, 'POST', reqBody)
    const listRequest = await makeRequest(completionsComponent, 'POST', reqListBody)
    return { request, listRequest }
}


/*
FORMATTING
*/

function formatSubtitle(subject: string, prevSubject?: string = '', fullHistory: string, useFullHistory: bool, fullHistoryText: string) {
    logError(pluginJson, `\n\nHERE---------${subject}\n${prevSubject}`)
    let fullHistoryTextOut = ''
    let backLink = ''
    let subtitle = ''
    let newFullHistoryLink = ''
    if (prevSubject) {
        
        logError(pluginJson, useFullHistory)
        logError(pluginJson, typeof(useFullHistory))
        if (useFullHistory == true || useFullHistory == 'true') {
            logError(pluginJson, useFullHistory)
            if (fullHistory.includes(prevSubject)) {
                logError(pluginJson, useFullHistory)
                const prettyPrev = createPrettyOpenNoteLink(prevSubject, Editor.filename, true, prevSubject)
                newFullHistoryLink = fullHistory.replace(prevSubject, prettyPrev)
                logError(pluginJson, newFullHistoryLink)
            }
            backLink = createPrettyOpenNoteLink(prevSubject, Editor.filename, true, prevSubject)
            fullHistoryTextOut = `${subject} in the context of ${fullHistoryText}`
            subtitle = `${subject} in the context of ${(newFullHistoryLink) ? newFullHistoryLink : fullHistory}` 
        } else {
            fullHistoryTextOut = `${subject} in the context of ${prevSubject}`
            backLink = createPrettyOpenNoteLink(prevSubject, Editor.filename, true, prevSubject)
            subtitle = `${subject} in the context of ${backLink}`
        }
    } else {
        fullHistoryTextOut = subject
        subtitle = subject
    }

    let outputFullHistoryText = fullHistoryTextOut,
        outputSubtitle = subtitle 
    return { 
        'newFullHistoryText': outputFullHistoryText,
        'formattedSubtitle': outputSubtitle
    }
}

/**
 * Formats the bullet summary response
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatBulletSummary(subject: string, summary: string, keyTerms: string, remixText?: string = '', subtitle: string, fullHistoryText: string) {
    // logDebug(pluginJson, `\n\nformatBulletSummary\nSubject: ${subject}\nResponse: ${summary}\nLink: ${link})}`)
    
    // let title = subject.replace('- ', '')
    let title = subject.trim()
    const jsonData = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    const keyTermsOutput = await formatKeyTermsForSummary(keyTerms, subject, remixText, (subtitle) ? subtitle : '', fullHistoryText)
  
    const remixPrompt = createPrettyRunPluginLink(`Remix`, 'scrollpointclick.AI', 'Bullets AI', ['', subject, jsonData['initialSubject'], true])
    // let output = `## ${title}${(subject != subtitle) ? `\n#### ${subtitle}` : ''}\n#### ${remixPrompt}\n${summary}\n${keyTermsOutput}`
    let output = `## ${title}${(subject != subtitle) ? `\n#### ${subtitle}` : ''}\n${summary}\n${keyTermsOutput}`
    return output
}

/**
 * Formats the key terms part of the summary response
 * @params {[string]} keyTerms - List of key terms
 * Currently under construction.
 */
export async function formatKeyTermsForSummary(keyTerms: [string], subject: string, remixText?: string = '', subtitle: string = '', fullHistoryText: string) {
    // logDebug(pluginJson, `\n\nformatBulletSummary\nSubject: ${subject}\nResponse: ${summary}\nLink: ${link})}`)
    let keyString = '#### Go Deeper?\n'
    const jsonData = DataStore.loadJSON(`Query Data/${Editor.title}/data.json`)
    let prettyKeyTerm = ''

    for (const keyTerm of keyTerms) {
        // TODO: Once JSON is working, have it check for clicked links to determine how to format the following.
        if (jsonData['clickedLinks'].includes(keyTerm)) {
            prettyKeyTerm = updateBulletLinks(keyTerm)
            keyString = `\t${prettyKeyTerm}\n`
        } else {
            prettyKeyTerm = createPrettyRunPluginLink(`${keyTerm.trim()}`, 'scrollpointclick.AI', 'Bullets AI', 
            [
                keyTerm.trim(), 
                `${subject}`, 
                jsonData['initialSubject'],
                false,
                subtitle,
                false,
                fullHistoryText
            ])
            
            const prettyPlus = createPrettyRunPluginLink(`╠`, 'scrollpointclick.AI', 'Bullets AI', 
            [
                keyTerm.trim(), 
                (remixText) ? remixText : subject, 
                jsonData['initialSubject'], 
                false, 
                subtitle, 
                true, 
                fullHistoryText])
            keyString += `\t- ${prettyPlus}${prettyKeyTerm}\n`
        }
    }
    return keyString
}
