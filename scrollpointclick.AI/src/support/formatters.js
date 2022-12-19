import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'
import { removeEntry, scrollToEntry } from './helpers'

const { bulletsAIKeyTerms, bulletsSummaryParagraphs } = DataStore.settings
const pluginJson = `scrollpointclick.AI/helpers`



export function formatSubtitle(subject: string, prevSubject?: string = '', fullHistory: string, useFullHistory: bool, fullHistoryText: string) {
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
            // prettyKeyTerm = updateBulletLinks(keyTerm)
            // keyString = `\t${prettyKeyTerm}\n`
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
    const removeParagraphText = createPrettyRunPluginLink('**✖**', 'scrollpointclick.AI', 'Scroll to Entry', [subject, true])
    const exploreText = createPrettyRunPluginLink('Explore', 'scrollpointclick.AI', 'Explore - OpenAI', [subject])
  
    const remixPrompt = createPrettyRunPluginLink(`Remix`, 'scrollpointclick.AI', 'Bullets AI', ['', subject, jsonData['initialSubject'], true])
    // let output = `## ${title}${(subject != subtitle) ? `\n#### ${subtitle}` : ''}\n#### ${remixPrompt}\n${summary}\n${keyTermsOutput}`
    let output = `## ${title}${(subject != subtitle) ? `\n#### ${subtitle}` : ''}\n${exploreText}\n${summary}\n${removeParagraphText}\n${keyTermsOutput}`
    return output
}

/**
 * Formats the Go Further link
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatFurtherLink(text: string) {
const fileName = Editor.filename

// logError(pluginJson, `${Editor.filename}`)
const furtherLink = createPrettyOpenNoteLink(text, fileName, true, text)
return furtherLink
}

/**
 * Formats the incoming model object to display its information in a more readable format.
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {Object} info - The info needed to provide the function with something to parse and format.
 */
export function formatModelInformation(info: Object) {
    const modelInfo = `Good At: ${info.goodAt}\n\nCost: ${info.cost}.`
    console.log(modelInfo)
    return modelInfo
  }

  export function formatTableOfContents() {
    const headings = Editor.paragraphs.filter((p) => p.type === 'title' && p.headingLevel === 2 )
    let sections = ''
    for (const subject of headings) {
        const formattedSubject = createPrettyOpenNoteLink(subject.content, Editor.filename, true, subject.content)
        sections += `- ${formattedSubject}\n`
    }
    const tableOfContents = `${sections}---`
    scrollToEntry('Table of Contents', true, true)
    // removeEntry('Table of Contents')  -- Also not deleting the Table of Contents heading...
    Editor.prependParagraph(tableOfContents, 'text')
    Editor.prependParagraph(`Table of Contents`, 'title')
  }


//   const modelsReturned = filteredModels.map((model) => {
//     const cost = calculateCost(model.id, _tokens)
//     const costStr = isNaN(cost) ? '' : ` ($${String(parseFloat(cost.toFixed(6)))} max)`
//     return { label: `${model.id}${costStr}`, value: model.id }
//   })