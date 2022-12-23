// @flow

import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'
import { removeEntry, scrollToEntry } from './helpers'
import { removeContentUnderHeading } from '@helpers/NPParagraph'

const pluginJson = `scrollpointclick.AI/helpers`

export function formatSubtitle(subject: string, prevSubject?: string = '', fullHistory: string, useFullHistory: boolean, fullHistoryText: string) {
  let fullHistoryTextOut = ''
  let backLink = ''
  let subtitle = ''
  let newFullHistoryLink = ''
  if (prevSubject) {
    if (useFullHistory == true || useFullHistory == 'true') {
      if (fullHistory.includes(prevSubject)) {
        const prettyPrev = createPrettyOpenNoteLink(prevSubject, Editor.filename, true, prevSubject)
        newFullHistoryLink = fullHistory.replace(prevSubject, prettyPrev)
      }
      backLink = createPrettyOpenNoteLink(prevSubject, Editor.filename, true, prevSubject)
      fullHistoryTextOut = `${subject} in the context of ${fullHistoryText}`
      subtitle = `${subject} in the context of ${newFullHistoryLink ? newFullHistoryLink : fullHistory}`
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
    newFullHistoryText: outputFullHistoryText,
    formattedSubtitle: outputSubtitle,
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
      prettyKeyTerm = createPrettyRunPluginLink(`${keyTerm.trim()}`, 'scrollpointclick.AI', 'Bullets AI', [
        keyTerm.trim(),
        `${subject}`,
        jsonData['initialSubject'],
        false,
        subtitle,
        false,
        fullHistoryText,
      ])

      const prettyPlus = createPrettyRunPluginLink(`╠`, 'scrollpointclick.AI', 'Bullets AI', [
        keyTerm.trim(),
        remixText ? remixText : subject,
        jsonData['initialSubject'],
        false,
        subtitle,
        true,
        fullHistoryText,
      ])
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
  const keyTermsOutput = await formatKeyTermsForSummary(keyTerms, subject, remixText, subtitle ? subtitle : '', fullHistoryText)
  const removeParagraphText = createPrettyRunPluginLink('**✖**', 'scrollpointclick.AI', 'Scroll to Entry', [subject, String(true)])
  const exploreText = createPrettyRunPluginLink('Explore', 'scrollpointclick.AI', 'Explore - OpenAI', [subject])

  const remixPrompt = createPrettyRunPluginLink(`Remix`, 'scrollpointclick.AI', 'Bullets AI', ['', subject, jsonData['initialSubject'], true])
  // let output = `## ${title}${(subject != subtitle) ? `\n#### ${subtitle}` : ''}\n#### ${remixPrompt}\n${summary}\n${keyTermsOutput}`
  let output = `## ${title}${subject != subtitle ? `\n#### ${subtitle}` : ''}\n${exploreText}\n${summary}\n${removeParagraphText}\n${keyTermsOutput}`
  return output
}

/**
 * Formats the Go Further link
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatFurtherLink(text: string) {
  const fileName = Editor.filename

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
  // initializeTableOfContents()
  if (!Editor.paragraphs.find((p) => p.content === 'Table of Contents')) {
    Editor.prependParagraph('---', 'text')
    Editor.prependParagraph('## Table of Contents', 'text')
    // Editor.insertParagraphAfterParagraph('---\nTable of Contents', Editor.paragraphs[0], 'title')
  } else {
    removeContentUnderHeading(Editor, 'Table of Contents', true, true) // keep the heading but delete the content
  }
  const headings = Editor.paragraphs.filter((p) => p.type === 'title' && p.headingLevel === 2 && p.content !== 'Table of Contents')
  const unlistedHeadings = headings.filter((p) => p.heading !== 'Table of Contents')

  for (const subject of unlistedHeadings) {
    const formattedSubject = createPrettyOpenNoteLink(subject.content, Editor.filename, true, subject.content)

    Editor.addParagraphBelowHeadingTitle(formattedSubject, 'list', 'Table of Contents', true, true)
  }
  Editor.addParagraphBelowHeadingTitle('---\n', 'text', 'Table of Contents', true, true)
}

// function initializeTableOfContents() {
//   const tocHeading = 'Table of Contents'
//   if (Editor.paragraphs.filter((p) => p.content !== tocHeading)) {
//     Editor.prependParagraph(tocHeading, 'title')
//     Editor.prependParagraph('---\n', 'text')
//     Editor.addParagraphBelowHeadingTitle(`---\n`, 'text', 'Table of Contents', true, false)
//   } else {
//     removeEntry(tocHeading)
//   }
// }
