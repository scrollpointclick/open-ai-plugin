// @flow

const pluginJson = `scrollpointclick.AI/helpers`
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'
import { removeContentUnderHeading } from '@helpers/NPParagraph'
import { getProjectNotesInFolder } from '@helpers/note'

export const modelOptions = {
  'text-davinci-003': 0.02,
  'text-curie-001': 0.002,
  'text-babbage-001': 0.0005,
  'text-ada-001': 0.0004,
}

const commandsPath = "/support/.readme_text/commands.md"
const { bulletsAIKeyTerms, bulletsSummaryParagraphs } = DataStore.settings

/**
 * Calculates the cost of the request.
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} model - the text AI model used.
 * @param {number} total_tokens - The total amount of tokens used during the generation.
 */
export function calculateCost(model: string, total_tokens: number): number {
  logDebug(pluginJson, `calculateCost(): attempting to calculate cost.`)
  const request_cost = (modelOptions[model] / 1000) * total_tokens
  logDebug(
    pluginJson,
    `calculateCost():
    Model: ${model}
    Total Tokens: ${total_tokens}
    Model Cost/1k: ${modelOptions[model]}
    Total Cost: ${request_cost}\n`,
  )
  clo(modelOptions, 'model cost object')

  return request_cost
}

/**
 * Generates the Commands section of the README.md
 */
 export function generateREADMECommands() {
  logDebug(pluginJson, `generateREADMECommands(): starting generation.`)
  let output = ''
  const commands = pluginJson["plugin.commands"]
  logDebug(pluginJson, `generateREADMECommands(): found commands.`)
  clo(commands, "COMMANDS")
  if (Array.isArray(commands)) {
    logDebug(pluginJson, `generateREADMECommands(): found array.`)
    output.push(`### Commands`)
    commands.forEach((command) => {
      const linkText = `try it`
      const rpu = createPrettyRunPluginLink(linkText, pluginJson["plugin.id"], command.name)
      const aliases = commmand.aliases && command.aliases.length ?
      `\r\t*Aliases:${command.aliases.toString()}*` : ''
      output.push(`- /${command.name} ${rpu}${aliases}\r\t*${command.description}*`)
    })
    logDebug(pluginJson, `generateREADMECommands(): finished generation.`)
  }
  if ( output != '' ) {
    logDebug(pluginJson, `generateREADMECommands(): writing to file.`)
    fs.writeFile(commandsPath, output)
  }
}


/**
 * Sets the prompt format for the summary part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function rerollSingleKeyTerm(promptIn: string, exclusions: string) {
  let prompt = `Return a single topic that is related to the topic of ${promptIn}. No numbers.
  Exclude the following topics from the result: ${exclusions}
  Example: Maple Syrup, Economic Growth in Nigeria (2020)
  List:
  `
  return prompt
}

/**
 * Get the model list from OpenAI and ask the user to choose one
 * @returns {string|null} the model ID chosen
 */
export async function adjustPreferences() {
  const settings = await DataStore.settings
  logDebug(pluginJson, `Settings:\n\n${settings}\n`)
}

export function removeEntry(heading: string) {
  logError(pluginJson, `\n\n----- ----- -----\n${heading}\n\n---- ----- ---- \n\n`)
  const paraBeforeDelete = Editor.paragraphs.find((p) => p.content === heading)
  if (paraBeforeDelete) {
    const contentRange = paraBeforeDelete.contentRange
    const characterBeforeParagraph = contentRange.start - 1 // back up one character
    removeContentUnderHeading(Editor, heading, true, false) // delete the paragraph
    Editor.highlightByIndex(characterBeforeParagraph,0) // scroll to where it was
  }
}

export function scrollToEntry(heading: string, deleteItem?: bool = false, foldHeading?: bool = false) {
  logError(pluginJson, `\n\n----- ----- -----\n${heading}\n\n${deleteItem}\n\n---- ----- ---- \n\n`)
  const selectedHeading = Editor.paragraphs.find((p) => p.content === heading)
  if (selectedHeading) {
    const contentRange = selectedHeading.contentRange
    let firstCharacter
    if (deleteItem) {
      
      firstCharacter = contentRange.start - 1 // back up one character
      logError(pluginJson, `\n\n----- ----- -----\n${firstCharacter}\n\n---- ----- ---- \n\n`)
      // removeContentUnderHeading(Editor, heading, true, false)
      removeEntry(heading)
    } else {
      firstCharacter = contentRange.start // back up one character
      Editor.highlightByIndex(firstCharacter,0) // scroll to where it was
    }
    if (foldHeading == true && !Editor.isFolded(selectedHeading)) {
      Editor.toggleFolding(selectedHeading)
    }
  }
}

export async function retrieveResearchNotes() {

  // FIXME: This doesn't do anything. Figure out why.

  const notes = getProjectNotesInFolder('Research')
  items = []
  for (var item in notes) {
    items.push(item)
  }
  const selection = await CommandBar.showOptions(items, 'Research Notes')
}