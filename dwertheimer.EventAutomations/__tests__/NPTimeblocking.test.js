// @flow
// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, jest, expect, beforeAll */

// Note: expect(spy).toHaveBeenNthCalledWith(2, expect.stringMatching(/ERROR/))

import * as mainFile from '../src/NPTimeblocking'
import * as configFile from '../src/config'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph, mockWasCalledWithString } from '@mocks/index'
import { unhyphenatedDate } from '@helpers/dateTime'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = {
    log: jest.fn(),
    debug: console.debug, //these will pass through
    trace: console.trace,
    // map other methods that you want to use like console.table
  }
  DataStore.settings['logLevel'] = 'none' // change to DEBUG to see more output
})

const paragraphs = [new Paragraph({ content: 'line1' }), new Paragraph({ content: 'line2' })]
const note = new Note({ paragraphs })
note.filename = `${unhyphenatedDate(new Date())}.md`
Editor.note = note
Editor.filename = note.filename

describe('dwertheimer.EventAutomations' /* pluginID */, () => {
  describe('NPTimeblocking.js' /* file */, () => {
    /*
     * getConfig()
     */
    describe('getConfig()' /* function */, () => {
      // test('should XXX', () => {
      //   const result = mainFile.getConfig()
      //   expect(result).toEqual(true)
      // })
      test('should return default config if getting config fails', () => {
        const result = mainFile.getConfig()
        expect(Object.keys(result).length).toBeGreaterThan(1)
      })
      test('should return default config if no settings set', () => {
        const oldSettings = DataStore.settings
        DataStore.settings = undefined
        const spy = jest.spyOn(console, 'log')
        const result = mainFile.getConfig()
        expect(mockWasCalledWithString(spy, /config was empty/)).toBe(true)
        expect(Object.keys(result).length).toBeGreaterThan(1)
        spy.mockRestore()
        DataStore.settings = oldSettings
      })
      test('should return default config', () => {
        const result = mainFile.getConfig()
        expect(Object.keys(result).length).toBeGreaterThan(1)
      })
      test('should complain about improper config', () => {
        const oldSettings = { ...DataStore.settings }
        DataStore.settings = { improper: 'key', __logLevel: 'DEBUG' }
        const spy = jest.spyOn(console, 'log')
        mainFile.getConfig()
        expect(mockWasCalledWithString(spy, /Running with default settings/)).toBe(true)
        spy.mockRestore()
        DataStore.settings = oldSettings
      })
      test('should return a proper config', () => {
        const oldSettings = DataStore.settings
        DataStore.settings = configFile.getTimeBlockingDefaults()
        const c = mainFile.getConfig()
        expect(c).toEqual(DataStore.settings)
        DataStore.settings = oldSettings
      })
    })
    /*
     * editorIsOpenToToday()
     */
    describe('editorIsOpenToToday()' /* function */, () => {
      /* template:
      test('should XXX', () => {
        const result = mainFile.editorIsOpenToToday()
        expect(result).toEqual(true)
      })
      */
      test('should return false if filename is null', () => {
        Editor.filename = null
        const result = mainFile.editorIsOpenToToday()
        expect(result).toEqual(false)
      })
      test('should return false if Editor is open to another day', () => {
        Editor.filename = `${unhyphenatedDate(new Date('2020-01-01'))}.md`
        const result = mainFile.editorIsOpenToToday()
        expect(result).toEqual(false)
      })
      test('should return true if Editor is open to is today', () => {
        Editor.filename = `${unhyphenatedDate(new Date())}.md`
        const result = mainFile.editorIsOpenToToday()
        expect(result).toEqual(true)
      })
    })

    /*
     * deleteParagraphsContainingString()
     */
    describe('deleteParagraphsContainingString()' /* function */, () => {
      /* template:
      test('should XXX', () => {
        const result = mainFile.deleteParagraphsContainingString()
        expect(result).toEqual(true)
      })
      */
      test('should not delete anything if no matches', () => {
        const paras = [new Paragraph({ content: 'line1', type: 'open' }), new Paragraph({ content: 'line2', type: 'open' })]
        const note = new Note({ paragraphs: paras })
        const spy = jest.spyOn(note, 'removeParagraphs')
        mainFile.deleteParagraphsContainingString(note, 'xxx')
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })
      test('should call delete with matching line', () => {
        const paras = [new Paragraph({ content: 'line1', type: 'open' }), new Paragraph({ content: 'line2', type: 'open' })]
        const note = new Note({ paragraphs: paras })
        const spy = jest.spyOn(note, 'removeParagraphs')
        mainFile.deleteParagraphsContainingString(note, 'line1')
        expect(spy).toHaveBeenCalledWith([paras[0]])
        spy.mockRestore()
      })
    })
    /*
     * insertItemsIntoNote()
     */
    describe('insertItemsIntoNote()' /* function */, () => {
      /* template:
      test('should XXX', () => {
        const result = mainFile.insertItemsIntoNote()
        expect(result).toEqual(true)
      })
      */
      test('should fail gracefully with missing list', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = null
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list)
        expect(spy).not.toHaveBeenCalled() //inserts nothing
        spy.mockRestore()
      })
      test('should fail gracefully with empty list', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = []
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list)
        expect(spy).not.toHaveBeenCalled() //inserts nothing
        spy.mockRestore()
      })
      test('should work with null/default params', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = ['line1', 'line2']
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 1, 'text')
        spy.mockRestore()
      })

      test('should work with empty heading', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = ['line1', 'line2']
        const heading = ''
        const config = configFile.getTimeBlockingDefaults()
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list, heading, false, config)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 1, 'text')
        spy.mockRestore()
      })
      test('should call insert content under heading', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = ['line1', 'line2']
        const heading = 'heading'
        const config = configFile.getTimeBlockingDefaults()
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list, heading, false, config)
        const text = `## ${heading}\n`.concat(list.join('\n')).concat('\n')
        expect(spy).toHaveBeenCalledWith(text, 1, 'text')
        spy.mockRestore()
      })
      test('should ignore folding if heading is empty', () => {
        const note = new Note({ paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = ['line1', 'line2']
        const heading = ''
        const config = configFile.getTimeBlockingDefaults()
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list, heading, true, config)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 1, 'text') //inserts nothing
        spy.mockRestore()
      })
      //TODO FIXME: stopped working here:
      test.skip('should find heading and insert under it', () => {
        const note = new Note({
          paragraphs: [
            new Paragraph({ content: 'old1head', type: 'title' }),
            new Paragraph({ content: 'old1head', type: 'title' }),
            new Paragraph({ content: 'old2', type: 'open' }),
          ],
        })
        const list = ['new1', 'new2']
        const heading = 'old1head'
        const config = configFile.getTimeBlockingDefaults()
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list, heading, true, config)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 1, 'text') //inserts nothing
        spy.mockRestore()
      })
    })
    /*
     * insertTodosAsTimeblocks()
     */
    describe('insertTodosAsTimeblocks()' /* function */, () => {
      test.skip('should tell user there was a problem with config', async () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        await mainFile.insertTodosAsTimeblocks()
        expect(spy.mock.calls[0][1]).toMatch(/Plugin Settings Error/)
        spy.mockRestore()
      })
      test.skip('should do nothing if there are no backlinks', async () => {
        // DataStore.settings = {} //should get default settings
        Editor.note.backlinks = []
        const spy = jest.spyOn(CommandBar, 'prompt')
        await mainFile.insertTodosAsTimeblocks()
        // $FlowIgnore - jest doesn't know about this param
        expect(mockWasCalledWithString(spy, /No todos\/references marked for >today/)).toBe(true)
        spy.mockRestore()
      })
      // [WIP]
      test.skip('should do something if there are backlinks', async () => {
        Editor.note.backlinks = [{ subItems: [{ content: 'line1' }] }]
        const spy = jest.spyOn(CommandBar, 'prompt')
        await mainFile.insertTodosAsTimeblocks()
        // $FlowIgnore - jest doesn't know about this param
        expect(spy.mock.lastCall[1]).toEqual(`No todos/references marked for >today`)
        spy.mockRestore()
      })
    })
  })
})
