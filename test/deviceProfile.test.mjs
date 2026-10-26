import test from 'node:test'
import assert from 'node:assert/strict'
import { deviceProfile } from '../src/lib/deviceProfile.js'

test('deviceProfile(webos) enables hardware decoders for modern codecs', () => {
  const profile = deviceProfile('webos')
  assert.equal(profile.Name, 'LupoFlin LG webOS')
  assert.equal(profile.DirectPlayProfiles.length, 1)

  const dp = profile.DirectPlayProfiles[0]
  assert.equal(dp.Type, 'Video')
  assert.ok(dp.Container.includes('mkv'))
  assert.ok(dp.Container.includes('mp4'))
  assert.ok(dp.VideoCodec.includes('hevc'))
  assert.ok(dp.VideoCodec.includes('h264'))
  assert.ok(dp.AudioCodec.includes('ac3'))
  assert.ok(dp.AudioCodec.includes('aac'))

  assert.equal(profile.TranscodingProfiles.length, 1)
  const tp = profile.TranscodingProfiles[0]
  assert.deepEqual(tp, { Container: 'ts', Type: 'Video', Protocol: 'hls', VideoCodec: 'h264', AudioCodec: 'aac' })

  assert.equal(profile.SubtitleProfiles.length, 3)
  assert.deepEqual(profile.SubtitleProfiles.map(s => s.Format), ['vtt', 'srt', 'ass'])
  assert.ok(profile.SubtitleProfiles.every(s => s.Method === 'External'))
})

test('deviceProfile(browser) limits direct play to mp4, h264, aac', () => {
  const profile = deviceProfile('browser')
  assert.equal(profile.Name, 'LupoFlin Browser')

  const dp = profile.DirectPlayProfiles[0]
  assert.equal(dp.Container, 'mp4')
  assert.equal(dp.Type, 'Video')
  assert.equal(dp.VideoCodec, 'h264')
  assert.equal(dp.AudioCodec, 'aac')

  const tp = profile.TranscodingProfiles[0]
  assert.deepEqual(tp, { Container: 'ts', Type: 'Video', Protocol: 'hls', VideoCodec: 'h264', AudioCodec: 'aac' })
})
