import mercury from './fetchResponses/completions.mercury.json' // a JSON file with a sample server response
import { FetchMock, type FetchMockResponse } from '@mocks/Fetch.mock'
const OVERRIDE_FETCH = true // set to true to override the global fetch() function with fake responses passed below
if (OVERRIDE_FETCH) {
  const mockResponses = [
{ match: { url: 'completions', optionsBody: 'mercury' }, response: JSON.stringify(mercury) }
]
  const fm = new FetchMock(mockResponses) // add one object to array for each mock response
  fetch = async (url, opts) => fm.fetch(url, opts) //override the global fetch
}