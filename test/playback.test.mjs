import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ticksToSeconds,
  secondsToTicks,
  formatTime,
  formatRemaining,
  formatEndTime,
  buildStartReport,
  buildProgressReport,
  buildStopReport,
  findActiveSegment,
  findNextEpisode,
  isPlaybackErrorIgnored,
  layoutButtonPositions,
  mapSegment,
  nextAction,
  playerErrorMessage,
  segmentLabel,
  selectDefaultTracks,
} from '../src/lib/playback.js'

test('ticks and seconds conversion', () => {
  assert.equal(ticksToSeconds(0), 0)
  assert.equal(ticksToSeconds(10000000), 1)
  assert.equal(ticksToSeconds(650000000), 65)
  assert.equal(ticksToSeconds(null), 0)

  assert.equal(secondsToTicks(0), 0)
  assert.equal(secondsToTicks(1), 10000000)
  assert.equal(secondsToTicks(120), 1200000000)
  assert.equal(secondsToTicks(undefined), 0)
})

test('formatTime formats MM:SS and H:MM:SS', () => {
  assert.equal(formatTime(0), '00:00')
  assert.equal(formatTime(9), '00:09')
  assert.equal(formatTime(65), '01:05')
  assert.equal(formatTime(3599), '59:59')
  assert.equal(formatTime(3600), '1:00:00')
  assert.equal(formatTime(3665), '1:01:05')
  assert.equal(formatTime(7325), '2:02:05')
  assert.equal(formatTime(-10), '00:00')
  assert.equal(formatTime(null), '00:00')
})

test('formatRemaining formats negative remaining time', () => {
  assert.equal(formatRemaining(65, 3600), '-58:55')
  assert.equal(formatRemaining(3500, 3600), '-01:40')
  assert.equal(formatRemaining(0, 7200), '-2:00:00')
  assert.equal(formatRemaining(100, 0), '')
  assert.equal(formatRemaining(100, Infinity), '')
})

test('formatEndTime calculates end wall clock time', () => {
  // Fix "now" to 20:00:00
  const now = new Date('2026-10-25T20:00:00Z')
  // 1 hour remaining (3600s) -> 21:00
  const end1 = formatEndTime(0, 3600, now)
  assert.match(end1, /^Fine alle \d{2}:\d{2}$/)

  // 15 minutes remaining (900s) -> +15m
  const hh = String(new Date(now.getTime() + 900000).getHours()).padStart(2, '0')
  const mm = String(new Date(now.getTime() + 900000).getMinutes()).padStart(2, '0')
  assert.equal(formatEndTime(100, 1000, now), `Fine alle ${hh}:${mm}`)

  assert.equal(formatEndTime(0, 0, now), '')
  assert.equal(formatEndTime(0, Infinity, now), '')
})

test('buildStartReport, buildProgressReport, buildStopReport', () => {
  const start = buildStartReport({
    itemId: 'it1',
    mediaSourceId: 'ms1',
    playSessionId: 'ps1',
    positionTicks: 10000000,
    isPaused: false,
    canSeek: true,
    playMethod: 'DirectPlay',
    audioStreamIndex: 1,
    subtitleStreamIndex: 2,
  })
  assert.deepEqual(start, {
    ItemId: 'it1',
    MediaSourceId: 'ms1',
    PlaySessionId: 'ps1',
    PositionTicks: 10000000,
    IsPaused: false,
    CanSeek: true,
    PlayMethod: 'DirectPlay',
    AudioStreamIndex: 1,
    SubtitleStreamIndex: 2,
  })

  const progress = buildProgressReport({
    itemId: 'it1',
    mediaSourceId: 'ms1',
    playSessionId: 'ps1',
    positionTicks: 20000000,
    isPaused: true,
  })
  assert.equal(progress.PositionTicks, 20000000)
  assert.equal(progress.IsPaused, true)

  const stop = buildStopReport({
    itemId: 'it1',
    mediaSourceId: 'ms1',
    playSessionId: 'ps1',
    positionTicks: 30000000,
    failed: false,
  })
  assert.deepEqual(stop, {
    ItemId: 'it1',
    MediaSourceId: 'ms1',
    PlaySessionId: 'ps1',
    PositionTicks: 30000000,
    Failed: false,
  })
})

test('selectDefaultTracks: audio preferences and fallbacks', () => {
  const streams = [
    { index: 1, type: 'Audio', language: 'ita', displayTitle: 'Italian', isDefault: false },
    { index: 2, type: 'Audio', language: 'eng', displayTitle: 'English', isDefault: true },
  ]

  // AudioLanguagePreference matches ita
  const res1 = selectDefaultTracks({ streams, userConfig: { AudioLanguagePreference: 'ita' } })
  assert.equal(res1.audio, 1)

  // AudioLanguagePreference matches eng
  const res2 = selectDefaultTracks({ streams, userConfig: { AudioLanguagePreference: 'eng' } })
  assert.equal(res2.audio, 2)

  // No preference, falls back to defaultAudioIndex
  const res3 = selectDefaultTracks({ streams, defaultAudioIndex: 1, userConfig: {} })
  assert.equal(res3.audio, 1)

  // No preference, falls back to isDefault track
  const res4 = selectDefaultTracks({ streams, userConfig: {} })
  assert.equal(res4.audio, 2)
})

test('selectDefaultTracks: subtitle modes None, Always, OnlyForced, Default', () => {
  const streams = [
    { index: 1, type: 'Audio', language: 'eng', displayTitle: 'English' },
    { index: 10, type: 'Subtitle', language: 'ita', codec: 'subrip', isForced: false, isDefault: false, isTextSubtitleStream: true },
    { index: 11, type: 'Subtitle', language: 'ita', codec: 'subrip', isForced: true, isDefault: false, isTextSubtitleStream: true },
    { index: 12, type: 'Subtitle', language: 'eng', codec: 'subrip', isForced: false, isDefault: true, isTextSubtitleStream: true },
    { index: 13, type: 'Subtitle', language: 'eng', codec: 'pgssub', isForced: false, isDefault: false, isTextSubtitleStream: false }, // image sub
  ]

  // SubtitleMode: None -> always null
  const resNone = selectDefaultTracks({
    streams,
    userConfig: { SubtitleMode: 'None', SubtitleLanguagePreference: 'ita' },
  })
  assert.equal(resNone.subtitle, null)

  // SubtitleMode: Always with language preference
  const resAlways = selectDefaultTracks({
    streams,
    userConfig: { SubtitleMode: 'Always', SubtitleLanguagePreference: 'ita' },
  })
  assert.equal(resAlways.subtitle, 10)

  // SubtitleMode: Always without language preference (picks default text stream)
  const resAlwaysDef = selectDefaultTracks({
    streams,
    userConfig: { SubtitleMode: 'Always' },
  })
  assert.equal(resAlwaysDef.subtitle, 12)

  // SubtitleMode: OnlyForced with language preference
  const resForced = selectDefaultTracks({
    streams,
    userConfig: { SubtitleMode: 'OnlyForced', SubtitleLanguagePreference: 'ita' },
  })
  assert.equal(resForced.subtitle, 11)

  // SubtitleMode: OnlyForced without matching forced stream -> null
  const resForcedNone = selectDefaultTracks({
    streams: [
      { index: 1, type: 'Audio', language: 'eng' },
      { index: 10, type: 'Subtitle', language: 'ita', codec: 'subrip', isForced: false, isTextSubtitleStream: true },
    ],
    userConfig: { SubtitleMode: 'OnlyForced' },
  })
  assert.equal(resForcedNone.subtitle, null)

  // SubtitleMode: Default with audio language differing from user preference -> enables subtitles in preferred language
  const resDefaultDiffLang = selectDefaultTracks({
    streams,
    userConfig: {
      AudioLanguagePreference: 'ita',
      SubtitleLanguagePreference: 'ita',
      SubtitleMode: 'Default',
    },
  })
  assert.equal(resDefaultDiffLang.audio, 1) // no ita audio in streams? wait, audio index 1 is eng
  // In our streams audio 1 is eng, user audioPref is ita, so audio 1 doesn't match ita!
  // Therefore subtitles in ita should be selected (index 10)
  assert.equal(resDefaultDiffLang.subtitle, 10)

  // SubtitleMode: Default with matching audio and no default sub -> null
  const resDefaultMatching = selectDefaultTracks({
    streams: [
      { index: 1, type: 'Audio', language: 'ita', displayTitle: 'Italian' },
      { index: 10, type: 'Subtitle', language: 'ita', codec: 'subrip', isForced: false, isDefault: false, isTextSubtitleStream: true },
    ],
    userConfig: {
      AudioLanguagePreference: 'ita',
      SubtitleLanguagePreference: 'ita',
      SubtitleMode: 'Default',
    },
  })
  assert.equal(resDefaultMatching.subtitle, null)
})

test('nextAction: all branches', () => {
  // 1. hasNext false -> 'none'
  assert.equal(nextAction({ time: 100, duration: 110, hasNext: false }), 'none')

  // 2. invalid duration -> 'none'
  assert.equal(nextAction({ time: 100, duration: 0, hasNext: true }), 'none')

  // 3. time not near end (duration 100, time 50, remaining 50s > 30s) -> 'none'
  assert.equal(nextAction({ time: 50, duration: 100, hasNext: true }), 'none')

  // 4. time near end (remaining <= 30s) and episodesWithoutKeys < 3 -> 'showNext'
  assert.equal(nextAction({ time: 75, duration: 100, hasNext: true, episodesWithoutKeys: 0 }), 'showNext')
  assert.equal(nextAction({ time: 90, duration: 100, hasNext: true, episodesWithoutKeys: 2 }), 'showNext')

  // 5. time near end and episodesWithoutKeys >= 3 -> 'askStillWatching'
  assert.equal(nextAction({ time: 75, duration: 100, hasNext: true, episodesWithoutKeys: 3 }), 'askStillWatching')
  assert.equal(nextAction({ time: 95, duration: 100, hasNext: true, episodesWithoutKeys: 5 }), 'askStillWatching')

  // 6. with outroStart: time before outroStart -> 'none'
  assert.equal(nextAction({ time: 120, duration: 200, outroStart: 180, hasNext: true }), 'none')

  // 7. with outroStart: time at or after outroStart -> 'showNext' or 'askStillWatching'
  assert.equal(nextAction({ time: 180, duration: 200, outroStart: 180, hasNext: true, episodesWithoutKeys: 0 }), 'showNext')
  assert.equal(nextAction({ time: 190, duration: 200, outroStart: 180, hasNext: true, episodesWithoutKeys: 3 }), 'askStillWatching')
})

test('findNextEpisode: next in season, next across seasons, last in series', () => {
  const episodes = [
    { id: 's1e1', season: 1, episode: 1 },
    { id: 's1e2', season: 1, episode: 2 },
    { id: 's2e1', season: 2, episode: 1 },
  ]

  // next in same season
  assert.equal(findNextEpisode(episodes, 's1e1')?.id, 's1e2')

  // last of season 1 -> first of season 2
  assert.equal(findNextEpisode(episodes, 's1e2')?.id, 's2e1')

  // last of series -> null
  assert.equal(findNextEpisode(episodes, 's2e1'), null)

  // invalid episode id or empty list -> null
  assert.equal(findNextEpisode(episodes, 'nonexistent'), null)
  assert.equal(findNextEpisode([], 's1e1'), null)
})

test('segments: mapSegment, segmentLabel, findActiveSegment', () => {
  const rawIntro = {
    Id: 'seg1',
    ItemId: 'item1',
    Type: 'Intro',
    StartTicks: 100000000, // 10s
    EndTicks: 400000000,   // 40s
  }
  const mapped = mapSegment(rawIntro)
  assert.equal(mapped.id, 'seg1')
  assert.equal(mapped.type, 'Intro')
  assert.equal(mapped.startSec, 10)
  assert.equal(mapped.endSec, 40)

  assert.equal(segmentLabel('Intro'), 'Salta intro')
  assert.equal(segmentLabel('Recap'), 'Salta riassunto')
  assert.equal(segmentLabel('Preview'), 'Salta')

  const segments = [
    mapped,
    { id: 'seg2', type: 'Recap', startSec: 50, endSec: 70 },
  ]

  assert.equal(findActiveSegment(segments, 5), null)
  assert.equal(findActiveSegment(segments, 10)?.id, 'seg1')
  assert.equal(findActiveSegment(segments, 25)?.id, 'seg1')
  assert.equal(findActiveSegment(segments, 40), null)
  assert.equal(findActiveSegment(segments, 60)?.id, 'seg2')
  assert.equal(findActiveSegment(segments, 75), null)
  assert.equal(findActiveSegment([], 10), null)
})

test('layoutButtonPositions: sizes by label plus 40px padding on each side and 20px gap', () => {
  const labels = ['Riproduci', '+ La mia lista', 'Segna come visto']
  // Mock measureFn returning 10px per character
  const measure = str => str.length * 10
  const items = layoutButtonPositions(labels, measure)

  assert.equal(items.length, 3)
  // 'Riproduci' length 9 -> 90 + 80 = 170
  assert.equal(items[0].label, 'Riproduci')
  assert.equal(items[0].x, 0)
  assert.equal(items[0].w, 170)

  // '+ La mia lista' length 14 -> 140 + 80 = 220, x = 170 + 20 = 190
  assert.equal(items[1].label, '+ La mia lista')
  assert.equal(items[1].x, 190)
  assert.equal(items[1].w, 220)

  // 'Segna come visto' length 16 -> 160 + 80 = 240, x = 190 + 220 + 20 = 430
  assert.equal(items[2].label, 'Segna come visto')
  assert.equal(items[2].x, 430)
  assert.equal(items[2].w, 240)

  // Check gap between every pair is >= 20
  assert.ok(items.every((b, i, a) => i === 0 || a[i - 1].x + a[i - 1].w + 20 <= b.x))
})

test('player error helpers: isPlaybackErrorIgnored and playerErrorMessage', () => {
  assert.equal(isPlaybackErrorIgnored('The play() request was interrupted by a call to pause()'), true)
  assert.equal(isPlaybackErrorIgnored('AbortError: The operation was aborted.'), true)
  assert.equal(isPlaybackErrorIgnored('PIPELINE_ERROR_DECODE'), false)
  assert.equal(isPlaybackErrorIgnored(null), false)

  assert.equal(playerErrorMessage('The play() request was interrupted by a call to pause()'), null)
  assert.equal(playerErrorMessage('PIPELINE_ERROR_DECODE'), 'Impossibile riprodurre il titolo')
  assert.equal(playerErrorMessage(new Error('Network error')), 'Impossibile riprodurre il titolo')
  assert.equal(playerErrorMessage(null), 'Impossibile riprodurre il titolo')
})



