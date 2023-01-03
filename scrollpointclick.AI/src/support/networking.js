import pluginJson from '../../plugin.json'
import { showMessage } from '@helpers/userInput'
import { logDebug, logError, clo, JSP } from '@helpers/dev'

/*
 * CONSTANTS
 */

const baseURL = 'https://api.openai.com/v1'
const modelsComponent = 'models'
const completionsComponent = 'completions'

const availableModels = ['text-davinci-003', 'text-curie-001', 'text-babbage-001', 'text-ada-001']

/**
 * Make a request to the GPT API
 * @param {string} component - the last part of the URL (after the base URL), e.g. "models" or "images/generations"
 * @param {string} requestType - GET, POST, PUT, etc.
 * @param {string} data - body of a POST/PUT request - can be an object (it will get stringified)
 * @returns {any|null} JSON results or null
 */
export async function makeRequest(component: string, requestType: string = 'GET', data: any = null): any | null {
    const url = `${baseURL}/${component}`
    logDebug(pluginJson, `makeRequest: about to fetch ${url}`)
    const result = await fetch(url, getRequestObj(requestType, data))
    if (result) {
      clo(result, `makeRequest() result of fetch to: "${url}"`)
      const resultJSON = JSON.parse(result)
      if (resultJSON) {
        return resultJSON
      } else if (resultJSON.error) {
        logError(pluginJson, `makeRequest received error: ${JSP(resultJSON.error)}`)
        await showMessage(`GPT API Returned Error: ${resultJSON.error.message}`)
      }
      return null
    } else {
      // must have failed, let's find out why
      fetch(url, getRequestObj(requestType, data))
        .then((result) => {
          logError(pluginJson, `makeRequest failed the first time but the second response was: ${JSP(result)}`)
        })
        .catch((error) => {
          logError(pluginJson, `makeRequest failed and response was: ${JSP(error)}`)
          showMessage(`Fetch failed: ${JSP(error)}`)
        })
    }
    return null
  }

export const getRequestObj = (method: string = 'GET', body: any = null): any => {
    const { apiKey } = DataStore.settings
    if (apiKey.length) {
      const obj = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
      if (body && method !== 'GET') {
        // $FlowFixMe
        obj.body = JSON.stringify(body)
      }
      clo(obj, 'getRequestObj returning:')
      return obj
    } else {
      showMessage('Please set your API key in the plugin settings')
      logError(pluginJson, 'No API Key found')
    }
  }