import test from 'node:test'
import assert from 'node:assert/strict'
import {
  episodeCards, formatBirthDate, applyVideoLayerZIndex, castCard, castOrder, controlButtons, playerTitleLines, reportParams, needsAudioRequest } from '../src/lib/playerLayout.js'

test('playerTitleLines: film -> subtitle null', () => {
  const film = { type: 'Movie', name: 'Inception' }
  assert.deepEqual(playerTitleLines(film), {
    title: 'Inception',
    subtitle: null,
  })
})

test('playerTitleLines: episode -> "S2 E12 · Hard Decisions"', () => {
  const episode = {
    type: 'Episode',
    seriesName: 'The Agency',
    seasonNumber: 2,
    episodeNumber: 12,
    name: 'Hard Decisions',
  }
  assert.deepEqual(playerTitleLines(episode), {
    title: 'The Agency',
    subtitle: 'S2 E12 · Hard Decisions',
  })
})

test('playerTitleLines: missing numbers -> the line is only the episode title', () => {
  const episode = {
    type: 'Episode',
    seriesName: 'The Agency',
    name: 'Hard Decisions',
  }
  assert.deepEqual(playerTitleLines(episode), {
    title: 'The Agency',
    subtitle: 'Hard Decisions',
  })
})

test('playerTitleLines: missing everything -> title only, no "undefined"', () => {
  const empty = { type: 'Episode' }
  const res = playerTitleLines(empty)
  assert.deepEqual(res, {
    title: '',
    subtitle: null,
  })
  assert.ok(!res.title.includes('undefined'))
})

test('playerTitleLines: null or empty argument', () => {
  assert.deepEqual(playerTitleLines(null), { title: '', subtitle: null })
  assert.deepEqual(playerTitleLines(undefined), { title: '', subtitle: null })
})

test('playerTitleLines: episode with only season or episode number', () => {
  const onlySeason = {
    type: 'Episode',
    seriesName: 'The Agency',
    seasonNumber: 2,
    name: 'Hard Decisions',
  }
  assert.deepEqual(playerTitleLines(onlySeason), {
    title: 'The Agency',
    subtitle: 'S2 · Hard Decisions',
  })

  const onlyEpisode = {
    type: 'Episode',
    seriesName: 'The Agency',
    episodeNumber: 12,
    name: 'Hard Decisions',
  }
  assert.deepEqual(playerTitleLines(onlyEpisode), {
    title: 'The Agency',
    subtitle: 'E12 · Hard Decisions',
  })
})

test('playerTitleLines: episode with numbers but missing episode title', () => {
  const noTitle = {
    type: 'Episode',
    seriesName: 'The Agency',
    seasonNumber: 2,
    episodeNumber: 12,
  }
  assert.deepEqual(playerTitleLines(noTitle), {
    title: 'The Agency',
    subtitle: 'S2 E12',
  })
})

test('applyVideoLayerZIndex sets and restores style.zIndex', () => {
  const el = { style: { zIndex: '1' } }
  const orig = applyVideoLayerZIndex(el, true, undefined)
  assert.equal(orig, '1')
  assert.equal(el.style.zIndex, '0')

  applyVideoLayerZIndex(el, false, orig)
  assert.equal(el.style.zIndex, '1')
})

test('reportParams builds unified parameters for start and progress reports', () => {
  const view = {
    itemId: 'item1',
    _source: { id: 'src1', directPlay: true },
    _playSessionId: 'sess1',
    _audioIndex: 1,
    _subtitleIndex: 2,
  }
  const params = reportParams(view, { positionTicks: 50000000, isPaused: true })
  assert.deepEqual(params, {
    itemId: 'item1',
    mediaSourceId: 'src1',
    playSessionId: 'sess1',
    audioStreamIndex: 1,
    subtitleStreamIndex: 2,
    playMethod: 'DirectPlay',
    canSeek: true,
    positionTicks: 50000000,
    isPaused: true,
  })
})

test('controlButtons: film -> 3 buttons', () => {
  assert.deepEqual(controlButtons({ hasNext: false }), ['restart', 'subtitles', 'audio'])
  assert.deepEqual(controlButtons(), ['restart', 'subtitles', 'audio'])
  assert.deepEqual(controlButtons({}), ['restart', 'subtitles', 'audio'])
})

test('controlButtons: episode with next -> 4 buttons', () => {
  assert.deepEqual(controlButtons({ hasNext: true }), ['restart', 'next', 'subtitles', 'audio'])
})

test('controlButtons: last episode -> 3 buttons', () => {
  assert.deepEqual(controlButtons({ hasNext: false }), ['restart', 'subtitles', 'audio'])
})

test('castOrder: order kept, actors only, cap 15, long role cut', () => {
  const people = []
  // 18 actors and 2 directors
  for (let i = 1; i <= 20; i++) {
    if (i === 3 || i === 7) {
      people.push({ Id: `dir${i}`, Name: `Director ${i}`, Type: 'Director', Role: 'Director' })
    } else {
      people.push({
        Id: `act${i}`,
        Name: `Actor ${i}`,
        Type: 'Actor',
        Role: i === 1 ? 'A very long role name that should definitely exceed the character limit' : `Role ${i}`,
      })
    }
  }

  const actors = castOrder(people)
  assert.equal(actors.length, 15)
  // Non-actors are excluded
  assert.ok(!actors.some(a => a.name.includes('Director')))
  // Order kept
  assert.equal(actors[0].name, 'Actor 1')
  assert.equal(actors[1].name, 'Actor 2')
  assert.equal(actors[2].name, 'Actor 4') // because 3 was Director

  // Long role cut
  assert.match(actors[0].roleLine, /^Interpreta: A very long role name/)
  assert.ok(actors[0].roleLine.endsWith('...'))
  assert.ok(actors[0].roleLine.length <= 32 + 'Interpreta: '.length)

  // Actor without role
  const noRole = castOrder([{ Id: 'a99', Name: 'Silent Extra', Type: 'Actor', Role: '' }])
  assert.equal(noRole[0].roleLine, null)
})

test('castCard: details with birth/bio', () => {
  const actor = { id: 'act1', name: 'Jesse Eisenberg', role: 'Mark Zuckerberg', imageTag: 'tag1' }
  const longBio = 'B'.repeat(350)
  const details = {
    birthDate: '1983-10-05',
    birthPlace: 'New York, USA',
    biography: longBio,
    titles: ['The Social Network', 'Now You See Me', 'Zombieland', 'The Squid and the Whale', 'Café Society'],
  }

  const card = castCard(actor, details)
  assert.equal(card.id, 'act1')
  assert.equal(card.name, 'Jesse Eisenberg')
  assert.equal(card.role, 'Mark Zuckerberg') // full role
  assert.equal(card.roleLine, 'Interpreta: Mark Zuckerberg')
  assert.equal(card.birthDate, '1983-10-05')
  assert.equal(card.birthPlace, 'New York, USA')
  assert.equal(card.biography.length, 300)
  assert.equal(card.biography, 'B'.repeat(300))
  assert.equal(card.titles.length, 4) // capped at 4
  assert.deepEqual(card.titles, ['The Social Network', 'Now You See Me', 'Zombieland', 'The Squid and the Whale'])
  assert.equal(card.hasDetails, true)
})

test('castCard: details without birth/bio', () => {
  const actor = { id: 'act2', name: 'Actor Two', role: 'Hero' }
  const details = {
    titles: ['Movie Alpha'],
  }

  const card = castCard(actor, details)
  assert.equal(card.name, 'Actor Two')
  assert.equal(card.role, 'Hero')
  assert.equal(card.birthDate, null)
  assert.equal(card.birthPlace, null)
  assert.equal(card.biography, null)
  assert.deepEqual(card.titles, ['Movie Alpha'])
  assert.equal(card.hasDetails, true)

  const emptyCard = castCard(actor, {})
  assert.equal(emptyCard.birthDate, null)
  assert.equal(emptyCard.birthPlace, null)
  assert.equal(emptyCard.biography, null)
  assert.deepEqual(emptyCard.titles, [])
  assert.equal(emptyCard.hasDetails, false)

  assert.equal(castCard(null), null)
})


test('formatBirthDate: Italian long date, other input unchanged', () => {
  assert.equal(formatBirthDate('1974-07-28'), '28 luglio 1974')
  assert.equal(formatBirthDate('1982-06-01'), '1 giugno 1982')
  assert.equal(formatBirthDate('1974'), '1974')
  assert.equal(formatBirthDate(null), null)
})

test('episodeCards: current marked, progress from playbackPositionTicks/runTimeTicks, an episode without number', () => {
  const episodes = [
    {
      id: 'ep1',
      episodeNumber: 1,
      name: 'Pilot',
      playbackPositionTicks: 15000000000,
      runTimeTicks: 30000000000,
      imageTag: 'tag1',
    },
    {
      id: 'ep2',
      episodeNumber: 2,
      name: 'Second Episode',
      playbackPositionTicks: 0,
      runTimeTicks: 30000000000,
      imageTag: 'tag2',
    },
    {
      id: 'ep3',
      name: 'Special without number',
      UserData: { PlaybackPositionTicks: 10000000000 },
      RunTimeTicks: 20000000000,
    },
  ]

  const cards = episodeCards(episodes, 'ep2')
  assert.equal(cards.length, 3)

  // Current marked
  assert.equal(cards[0].current, false)
  assert.equal(cards[1].current, true)
  assert.equal(cards[2].current, false)

  // Progress from playbackPositionTicks / runTimeTicks
  assert.equal(cards[0].progress, 0.5)
  assert.equal(cards[1].progress, null)
  assert.equal(cards[2].progress, 0.5)

  // Episode labels & titles
  assert.equal(cards[0].label, 'E1')
  assert.equal(cards[0].title, 'Pilot')
  assert.equal(cards[1].label, 'E2')
  assert.equal(cards[1].title, 'Second Episode')

  // Episode without number
  assert.equal(cards[2].label, '')
  assert.equal(cards[2].title, 'Special without number')
})

test('episodeCards: null / invalid input', () => {
  assert.deepEqual(episodeCards(null), [])
  assert.deepEqual(episodeCards(undefined), [])
  assert.deepEqual(episodeCards([]), [])
})


test('needsAudioRequest: direct play always plays the file default track', () => {
  const streams = [
    { index: 1, type: 'Audio', isDefault: true },
    { index: 2, type: 'Audio', isDefault: false },
  ]
  assert.equal(needsAudioRequest({ directPlay: true, streams, defaultAudioStreamIndex: 2 }, 2), true)
  assert.equal(needsAudioRequest({ directPlay: true, streams, defaultAudioStreamIndex: 1 }, 1), false)
  assert.equal(needsAudioRequest({ directPlay: false, streams, defaultAudioStreamIndex: 2 }, 2), false)
  assert.equal(needsAudioRequest({ directPlay: false, streams, defaultAudioStreamIndex: 1 }, 2), true)
  assert.equal(needsAudioRequest(null, 2), false)
  assert.equal(needsAudioRequest({ directPlay: true, streams }, null), false)
})
