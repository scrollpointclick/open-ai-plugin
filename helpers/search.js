// @flow
//-----------------------------------------------------------------------------
// Search helpers
// Jonathan Clark
//-----------------------------------------------------------------------------

import { trimString } from '@helpers/dataManipulation'
import { clo, logDebug, logError } from '@helpers/dev'
import { getNoteByFilename } from '@helpers/note'

/**
 * Perform string exact match, ignoring case
 * @author @jgclark
 * @param {string} searchTerm 
 * @param {string} textToSearch 
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveMatch(searchTerm: string, textToSearch: string): boolean {
  const re = new RegExp(`^${searchTerm}$`, "i") // = case insensitive match
  return re.test(textToSearch)
}

/**
 * Perform substring match, ignoring case
 * @author @jgclark
 * @param {string} searchTerm 
 * @param {string} textToSearch 
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveSubstringMatch(searchTerm: string, textToSearch: string): boolean {
  const re = new RegExp(`${searchTerm}`, "i") // = case insensitive match
  return re.test(textToSearch)
}

/**
 * Returns true if A is a strict subset of B, starting from the beginning.
 * i.e. won't match if A===B
 * @author @jgclark
 * @param {string} searchTerm 
 * @param {string} textToSearch 
 * @returns {boolean}
 * @tests available in jest file
 */
export function caseInsensitiveStartsWith(searchTerm: string, textToSearch: string): boolean {
  const re = new RegExp(`^${searchTerm}.+`, "i") // = case insensitive 'starts with' regex
  return re.test(textToSearch)
}

/**
 * Check if 'searchTerm' is or isn't a member of wanted or excluded arrays. The check is done ignoring case
 * @author @jgclark
 * @param {string} hashtagToTest 
 * @param {$ReadOnlyArray<string>} wantedHashtags
 * @param {$ReadOnlyArray<string>} excludedHashtags
 * @returns {boolean}
 * @tests available in jest file
 */
export function isHashtagWanted(hashtagToTest: string,
  wantedHashtags: $ReadOnlyArray<string>,
  excludedHashtags: $ReadOnlyArray<string>
): boolean {
  if (wantedHashtags.length > 0) {
    const hashtagsMatchingIncludeList = wantedHashtags.filter((a) => caseInsensitiveMatch(a, hashtagToTest))
    return hashtagsMatchingIncludeList.length > 0
  }
  else if (excludedHashtags.length > 0) {
    const hashtagsMatchingExcludeList = excludedHashtags.filter((a) => caseInsensitiveMatch(a, hashtagToTest))
    return hashtagsMatchingExcludeList.length === 0
  }
  else {
    return true
  }
}

/**
 * Check if 'searchTerm' is or isn't a member of wanted or excluded arrays. The check is done ignoring case
 * @author @jgclark
 * @param {string} mentionToTest 
 * @param {$ReadOnlyArray<string>} wantedMentions
 * @param {$ReadOnlyArray<string>} excludedMentions
 * @returns {boolean}
 * @tests available in jest file
 */
export function isMentionWanted(mentionToTest: string,
  wantedMentions: $ReadOnlyArray<string>,
  excludedMentions: $ReadOnlyArray<string>
): boolean {
  if (wantedMentions.length > 0) {
    const mentionsMatchingIncludeList = wantedMentions.filter((a) => caseInsensitiveMatch(a, mentionToTest))
    return mentionsMatchingIncludeList.length > 0
  }
  else if (excludedMentions.length > 0) {
    const mentionsMatchingExcludeList = excludedMentions.filter((a) => caseInsensitiveMatch(a, mentionToTest))
    return mentionsMatchingExcludeList.length === 0
  }
  else {
    return true
  }
}

/**
 * Take a line's .rawContent and return any starting metadata markers
 * for open/closed/cancelled/sched tasks, quotes, lists, headings (not quite the same as .content)
 * @author @jgclark
 * @param {string} input
 * @returns {string} simplified output
 * @tests in jest file
 */
export function getLineMainContentPos(input: string): number {
  try {
    // const trimmed = input.trim()
    // const res = input.match(/^((?:#{1,5}\s+|[*\-]\s(?:\[[ x\->]\]\s+)?|>\s+)).*/) // regex which needs input left trimming first
    if (input && input !== '') {
      const res = input.match(/^(\s*(?:\#{1,5}\s+|(?:[*\-]\s(?:\[[ x\->]\])?|>))\s*)/) // regex which doesn't need input left trimming first
      if (res) {
        return res[0].length
      } else {
        return 0
      }
    } else {
      throw new Error(`input is null or empty`)
    }
  } catch (error) {
    logError('getLineMainContentPos', error.message)
    return 0 // for completeness
  }
}

/**
 * Take a line and simplify if needed.
 * Note: a different function deals with start-of-line Markdown markers (for open/closed/cancelled/sched tasks, quotes, lists, headings).
 * Also trim the output.
 * @author @jgclark
 * @param {string} input 
 * @returns {string} simplified output
 * @tests in jest file
 */
export function simplifyRawContent(input: string): string {
  try {
    let output = input
    // Remove blockIDs (which otherwise can mess up the other sync'd copies)
    output = output.replace(/\^[A-z0-9]{6}([^A-z0-9]|$)/g, '')
    // Trim whitespace at start/end
    output = output.trim()
    return output
  } catch (error) {
    logError('simplifyRawContent', error.message)
    return '<error>' // for completeness
  }
}

type noteAndLine = {
  noteFilename: string,
  line: string,  // contents of the paragraph
  index: number, // index number of the paragraph, to do any necessary further lookups
}

/**
 * Takes a line of text and prepares it for display, in 'Simplified' or 'NotePlan' style.
 * - if its NotePlan and an 'open' task we need to make it a sync results using blockIDs
 * - shortens it to maxChars characters around the first matching term (if maxChars > 0 and Simplified style). This uses some very powerful regex magic.
 *   - TODO: Ideally doesn't chop in the middle of a URI
 * - adds ==highlight== to matching terms if wanted (and if not already highlighted)
 * @author @jgclark
 * 
 * @param {noteAndLine} nalInput noteAndLine data structure for this result
 * @param {Array<string>} terms to find/highlight (without search operator prefixes)
 * @param {boolean} simplifyLine trim off leading markdown markers?
 * @param {string} resultPrefix string to use if line is simplified
 * @param {boolean} addHighlight add highlighting to the matched terms?
 * @param {number} maxChars to return around first matching term. If zero, or missing, then use the full line
 * @returns {string}
 * @tests in jest file
 */
export function trimAndHighlightTermInLine(
  nalInput: noteAndLine,
  terms: Array<string>,
  simplifyLine: boolean,
  addHighlight: boolean,
  resultPrefix: string = '- ',
  maxChars: number = 0,
): string {
  try {
    let output = ''
    const input = nalInput.line
    const inputShort = trimString(input, 20)
    // Take off starting markdown markers, and right trim
    const startOfMainLineContentPos = getLineMainContentPos(input)
    const startOfLineMarker = input.slice(0, startOfMainLineContentPos)
    let mainPart = input.slice(startOfMainLineContentPos)

    // If using Simplified style ...
    if (simplifyLine) {
      // Simplify rawContent line by trimming and removing any block IDs
      mainPart = simplifyRawContent(mainPart)

      // Now trim the line content if necessary
      if (maxChars > 0 && mainPart.length > maxChars) {
        // this split point ensures we put the term with a little more context before it than after it
        const LRSplit = Math.round(maxChars * 0.55)
        // regex:
        const re = new RegExp(`(?:^|\\b)(.{0,${String(LRSplit)}}${terms.join('|')}.{0,${String(maxChars - LRSplit)}})\\b\\w+`, "gi")
        const matches = mainPart.match(re) ?? [] // multiple matches
        if (matches.length > 0) {
          // If we have more than 1 match in the line, join the results together with '...'
          output = matches.join(' ...')
          // If starts with a non-word character, then (it's approximately right that) we have landed in the middle of sentence, so prepend '...'
          if (output.match(/^\W/)) {
            output = `...${output}`
          }
          // If we now have a shortened string, then (it's approximately right that) we have trimmed off the end, so append '...'
          if (output.length < mainPart.length) {
            output = `${output} ...`
          }
          //
        } else {
          // For some reason we didn't find the matching term, so return the first part of line
          output = (output.length >= maxChars) ? output.slice(0, maxChars) : output
        }
      }

      // Now add on the appropriate prefix
      output = resultPrefix + output
    }
    // If using NotePlan style, then ...
    else {
      // - if this is an open task line, then sync lines by adding a blockID (having checked there isn't one already)
      // - don't do any shortening, as that would mess up sync'd lines

      // Get the line details (have to get from DataStore)
      const thisNote = getNoteByFilename(nalInput.noteFilename)
      const thisPara = thisNote?.paragraphs?.[nalInput.index]
      const thisType = thisPara?.type ?? ''
      if (thisNote && thisPara && thisType === 'open') {
        if (thisPara.blockId) {
          // Don't do anything as it has a blockID already
          const thisBlockID = thisPara.blockId
          logDebug('trimAndHighlight...', `- existing blockId ${thisBlockID} in line '${input}', so not adding again`)
        } else {
          // Add blockID to source, and append to result
          logDebug('trimAndHighlight...', `- will add blockId to source line '${inputShort}'`)
          thisNote.addBlockID(thisPara)
          thisNote.updateParagraph(thisPara)
          const thisBlockID = thisPara.blockId ?? '<error>'
          logDebug('trimAndHighlight...', `- added blockId '${thisBlockID}' to source line`)
          mainPart += ` ${thisBlockID}`
          logDebug('trimAndHighlight...', `- appended blockId to result -> '${mainPart}'`)
        }
      } else {
        logDebug('trimAndHighlight...', `- not an 'open' type: ${thisType}: '${inputShort}'`)
      }
      // Now add on the appropriate prefix
      output = startOfLineMarker + mainPart
    }

    // Add highlighting if wanted (using defined Regex so can use 'g' flag)
    // (A simple .replace() command doesn't work as it won't keep capitalisation)
    if (addHighlight) {
      // regex: find any of the match terms in all the text
      const re = new RegExp(`(?:[^=](${terms.join('|')})(?=$|[^=]))`, "gi")
      const termMatches = output.matchAll(re)
      let offset = 0
      for (const tm of termMatches) {
        // logDebug('trimAndHighlight...', `${tm[0]}, ${tm[0].length}, ${tm.index}, ${offset}`)
        const leftPos = tm.index + offset + 1 // last adds previous ==...== additions
        const rightPos = leftPos + tm[1].length // as terms change have to get feedback from this match
        const highlitOutput = `${output.slice(0, leftPos)}==${output.slice(leftPos, rightPos)}==${output.slice(rightPos,)}`
        output = highlitOutput
        // logDebug('trimAndHighlight', `highlight ${highlitOutput}`)
        offset += 4
      }
    }
    return output
  }
  catch (error) {
    logError('trimAndHighlight...', error.message)
    return 'error' // for completeness
  }
}
