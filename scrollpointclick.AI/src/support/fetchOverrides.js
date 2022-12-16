import mercury from './fetchResponses/completions.mercury.json' // a JSON file with a sample server response
import mercuryKeyTopics from './fetchResponses/completions.mercuryKeyTopics.json'
import { FetchMock, type FetchMockResponse } from '@mocks/Fetch.mock'
const OVERRIDE_FETCH = false // set to true to override the global fetch() function with fake responses passed below
if (OVERRIDE_FETCH) {
  const mockResponses = [
{ match: { url: 'completions', optionsBody: 'topic of Mercury' }, response: JSON.stringify(mercury) },
{ match: { url: 'completions', optionsBody: 'key topics associated with Mercury' }, response: JSON.stringify(mercuryKeyTopics) }
]
  const fm = new FetchMock(mockResponses) // add one object to array for each mock response
  fetch = async (url, opts) => fm.fetch(url, opts) //override the global fetch
}