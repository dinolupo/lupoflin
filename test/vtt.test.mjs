import test from 'node:test'
import assert from 'node:assert/strict'
import { parseVtt, parseVttTimestamp, findActiveCue } from '../src/lib/vtt.js'

test('parseVttTimestamp parses hours, minutes, seconds and millis', () => {
  assert.equal(parseVttTimestamp('01:02:03.456'), 3600 + 120 + 3.456)
  assert.equal(parseVttTimestamp('00:00:34.000'), 34)
  assert.equal(parseVttTimestamp('01:14,492'), 74.492)
  assert.equal(parseVttTimestamp('05:30.100'), 330.1)
  assert.equal(parseVttTimestamp(''), 0)
})

test('parseVtt parses standard WebVTT cues with timestamps and strips tags', () => {
  const vtt = `WEBVTT

NOTE this is a comment

1
00:00:10.000 --> 00:00:14.500
Hello <b>world</b>!

00:00:15.200 --> 00:00:18.000 align:start size:50%
<i>Line 1 of italic</i>
Line 2 of cue
`

  const cues = parseVtt(vtt)
  assert.equal(cues.length, 2)

  assert.equal(cues[0].start, 10)
  assert.equal(cues[0].end, 14.5)
  assert.equal(cues[0].text, 'Hello world!')
  assert.equal(cues[0].italic, false)

  assert.equal(cues[1].start, 15.2)
  assert.equal(cues[1].end, 18)
  assert.equal(cues[1].text, 'Line 1 of italic\nLine 2 of cue')
  assert.equal(cues[1].italic, true)
})

test('parseVtt handles empty input and malformed cues gracefully', () => {
  assert.deepEqual(parseVtt(''), [])
  assert.deepEqual(parseVtt(null), [])
  assert.deepEqual(parseVtt('WEBVTT\n\nSome invalid text'), [])
})

test('findActiveCue finds the cue corresponding to currentTime', () => {
  const cues = [
    { start: 10, end: 15, text: 'First' },
    { start: 20, end: 25, text: 'Second' },
  ]

  assert.equal(findActiveCue(cues, 5), null)
  assert.equal(findActiveCue(cues, 10)?.text, 'First')
  assert.equal(findActiveCue(cues, 12.5)?.text, 'First')
  assert.equal(findActiveCue(cues, 15)?.text, 'First')
  assert.equal(findActiveCue(cues, 16), null)
  assert.equal(findActiveCue(cues, 22)?.text, 'Second')
  assert.equal(findActiveCue(cues, 30), null)
  assert.equal(findActiveCue([], 12), null)
})
