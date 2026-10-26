import test from 'node:test'
import assert from 'node:assert/strict'
import { languageName, trackLabels, audioTrackPosition } from '../src/lib/trackLabels.js'

test('languageName: own-language names, unknown -> null', () => {
  assert.equal(languageName('ita'), 'Italiano')
  assert.equal(languageName('ENG'), 'English')
  assert.equal(languageName('xyz'), null)
  assert.equal(languageName(''), null)
})

test('trackLabels: language names, suffix only for duplicates', () => {
  const audio = [
    { index: 1, language: 'ita', displayTitle: 'Ita - AC3 - 5.1 - Default' },
    { index: 2, language: 'eng', displayTitle: 'Eng - AC3 - 5.1' },
    { index: 3, language: 'eng', displayTitle: 'Eng - AAC - Stereo' },
  ]
  assert.deepEqual(trackLabels(audio, 'audio').map(t => t.label), ['Italiano', 'English (AC3 5.1)', 'English (AAC Stereo)'])
})

test('trackLabels: forced subtitles, unknown language, identical tracks', () => {
  const subs = [
    { index: 4, language: 'ita', displayTitle: 'Ita - SUBRIP', isForced: true },
    { index: 5, language: '', displayTitle: 'Commento - SUBRIP' },
    { index: 6, language: 'eng', displayTitle: 'Eng' },
    { index: 7, language: 'eng', displayTitle: 'Eng' },
    { index: 8, language: '', displayTitle: '' },
  ]
  assert.deepEqual(trackLabels(subs, 'subtitle').map(t => t.label),
    ['Italiano (forzati)', 'Commento', 'English', 'English 2', 'Sottotitoli 5'])
})

test('audioTrackPosition: maps by order, refuses a different count', () => {
  const streams = [
    { index: 0, type: 'Video' },
    { index: 1, type: 'Audio' },
    { index: 2, type: 'Audio' },
    { index: 3, type: 'Subtitle' },
  ]
  assert.equal(audioTrackPosition(streams, 2, 2), 1)
  assert.equal(audioTrackPosition(streams, 1, 2), 0)
  assert.equal(audioTrackPosition(streams, 2, 1), -1)
  assert.equal(audioTrackPosition(streams, 2, 0), -1)
  assert.equal(audioTrackPosition(streams, 9, 2), -1)
})
