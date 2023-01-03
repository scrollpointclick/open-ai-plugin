// @flow

/**
 * THIS IS AN NP**** FILE. ONLY FUNCTIONS WHICH TOUCH NOTEPLAN APIS GO IN THIS FILE
 * ALL SUPPORTING FUNCTIONS THAT CAN BE TESTED IN ISOLATION SHOULD GO IN A SEPARATE FILE
 * (E.G. support/helpers.js FUNCTIONS and the corresponding test files)
 */

import pluginJson from '../plugin.json'
import { makeRequest } from './support/networking'
import { calculateCost, modelOptions, generateREADMECommands, checkModel } from './support/helpers' // FIXME: Is there something better than this growth?
import { chooseOption, showMessage, showMessageYesNo, getInput } from '@helpers/userInput'
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { intro, learningOptions, openAILearningWizard, modelsInformation, externalReading } from './support/introwizard'

/*
 * TYPES
 */

// export type DallERequestOptions = { prompt?: string, n?: number, size?: string, response_format?: string, user?: string }
export type CompletionsRequest = { model: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }
type ResearchListResult = { initialQuery: string, currentQuery: string, selection?: string, options?: [string] }

/*
 * CONSTANTS
 */

const baseURL = 'https://api.openai.com/v1'
const modelsComponent = 'models'
// const imagesGenerationComponent = 'images/generations'
const completionsComponent = 'completions'

const availableModels = ['text-davinci-003', 'text-curie-001', 'text-babbage-001', 'text-ada-001']

/*
 * FUNCTIONS
 */

/**
 * Format a Fetch request object for the OpenAI API, including the Authorization header and the contents of the post if any
 * @param {string} method - GET, POST, PUT, DELETE
 * @param {string} body - JSON string to send with POST or PUT
 * @returns
 */

/**
 * Get the model list from OpenAI and ask the user to choose one
 * @returns {string|null} the model ID chosen
 */
export async function chooseModel(_tokens?: number = 1000): Promise<string | null> {
  logDebug(pluginJson, `chooseModel tokens:${_tokens}`)
  const models = (await makeRequest(modelsComponent))?.data
  const filteredModels = models.filter((m) => modelOptions.hasOwnProperty(m.id))
  if (filteredModels) {
    const modelsReturned = filteredModels.map((model) => {
      const cost = calculateCost(model.id, _tokens)
      const costStr = isNaN(cost) ? '' : ` ($${String(parseFloat(cost.toFixed(6)))} max)`
      return { label: `${model.id}${costStr}`, value: model.id }
    })
    return await chooseOption('Choose a model', modelsReturned)
  } else {
    logError(pluginJson, 'No models found')
  }
  return null
}

/**
 * Allow user to decide how to proceed with info gathered from Quick Search
 * @returns {string|null} the model ID chosen
 */
export async function chooseQuickSearchOption(query: string, summary: string): Promise<string | null> {
  logDebug(pluginJson, `chooseQuickSearchOption starting selection`)
  const quickSearchOptions = [
    { label: 'Append this summary to the current note.', value: 'append' },
    { label: 'Generate note with deeper research.', value: 'research' },
  ]
  const mappedOptions = quickSearchOptions.map((option) => ({ label: option.label, value: option.value }))
  clo(mappedOptions, 'Mapped options')

  const selection = await chooseOption('How would you like to proceed?', mappedOptions)
  logDebug(pluginJson, `chooseQuickSearchOption ${selection} selected.`)
  return selection
}

/**
 * Ask for a prompt and n results from user
 * @returns { prompt: string, n: number }
 */
export async function getPromptAndNumberOfResults(promptIn: string | null = null, nIn: number | null = null): Promise<{ prompt: string, n: number }> {
  const prompt = promptIn ?? (await CommandBar.showInput('Enter a prompt', 'Search for %@'))
  const n = nIn ?? (await CommandBar.showInput('Enter the number of results to generate', 'Ask for %@ results'))
  return { prompt, n: parseInt(n) }
}

/**
 * Generates and outputs the AI generation stats at the cursor
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {number} time - The time to completion.
 * @param {string} model - the text AI model used.
 * @param {number} total_tokens - The total amount of tokens used during the generation.
 */
export function insertStatsAtCursor(time: string, model: string, total_tokens: number) {
  Editor.insertTextAtCursor(
    `### **Stats**\n**Time to complete:** ${time}\n**Model:** ${model}\n**Total Tokens:** ${total_tokens}\n**Cost:** $${calculateCost(model, total_tokens)}`,
  )
}

/**
 * test connection to GPT API by getting models list and making a request for an image
 * Plugin entrypoint for command: "/COMMAND"
 * @param {*} incoming
 */
export async function testConnection(model: string | null = null) {
  try {
    logDebug(pluginJson, `testConnection running with model:${String(model)}`)

    let chosenModel = model
    // get models/engines (to choose pricing/capability)
    if (!model) {
      chosenModel = await chooseModel()
    }
    if (model == 'Choose Model') {
      chosenModel = await chooseModel()
    }
    if (chosenModel) {
      clo(chosenModel, 'testConnection chosenModel')
    } else {
      logWarn(pluginJson, 'No model chosen')
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/*
 * PLUGIN ENTRYPOINT
 */



// TODO: Create generic getCompletions request








/**
 * Entry point for introducing the user to the plugin
 * Plugin entrypoint for command: "/aiintro"
 * Currently under construction.
 */
export async function introWizard() {
  if ((await CommandBar.prompt(intro.title, intro.prompt, intro.buttons)) == 0) {
    console.log('Fill this in shortly.')
  }
}

/**
 * Entry point for providing help topics for the user
 * Plugin entrypoint for command: "/helpOpenAI"
 * Currently under construction.
 */
export async function helpWizard() {
  const options = learningOptions.map((option) => ({ label: option, value: option }))

  const topic = await chooseOption('Select a topic to learn more...', options)
  console.log(topic)
  const wizard = openAILearningWizard[topic]
  console.log(wizard)
  console.log(wizard.title)
  await learnMore(wizard)
}

/**
 * Allows the user to learn more about the selected option from the Help Wizard.
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function learnMore(learningTopic: Object) {
  const wizard = learningTopic

  if (wizard == openAILearningWizard.Models) {
    let options = wizard.options.map((option) => ({ label: option, value: option }))
    let externalReadingLinks = []
    externalReading.models.forEach((model) => {
      externalReadingLinks.unshift(model.link)
      options.unshift({ label: model.title, value: model.link })
    })

    const selection = await chooseOption(learningTopic.prompt2, options)

    if (externalReadingLinks.includes(selection)) {
      NotePlan.openURL(selection)
    }

    const selectedModel = modelsInformation[selection]
    const infolog = formatModelInformation(selectedModel)
    const nextSelection = await showMessage(infolog, 'Okay', selectedModel.title)
    console.log(nextSelection)
    clo(nextSelection, 'Information')
    await learnMore(wizard)
  }
}

