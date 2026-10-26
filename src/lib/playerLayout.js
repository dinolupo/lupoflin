// Pure functions for the player view layout and formatting.
// Tested by test/playerLayout.test.mjs (L0).
import { buildProgressReport, buildStartReport, buildStopReport, secondsToTicks } from './playback.js'
import { probe } from './probe.js'

export function playerTitleLines(item) {
  if (!item) {
    return { title: '', subtitle: null }
  }

  const isEpisode = item.type === 'Episode'
  if (!isEpisode) {
    return {
      title: item.title || item.name || '',
      subtitle: null,
    }
  }

  const season = typeof item.seasonNumber === 'number'
    ? item.seasonNumber
    : (typeof item.season === 'number' ? item.season : (typeof item.ParentIndexNumber === 'number' ? item.ParentIndexNumber : null))

  const episode = typeof item.episodeNumber === 'number'
    ? item.episodeNumber
    : (typeof item.episode === 'number' ? item.episode : (typeof item.IndexNumber === 'number' ? item.IndexNumber : null))

  const seriesName = item.seriesName || item.SeriesName || ''
  const episodeTitle = item.episodeTitle || item.episodeName || (seriesName ? (item.name || item.Name || '') : '')

  const title = seriesName || item.title || item.name || item.Name || ''

  const prefixParts = []
  if (season !== null && season !== undefined) {
    prefixParts.push(`S${season}`)
  }
  if (episode !== null && episode !== undefined) {
    prefixParts.push(`E${episode}`)
  }
  const prefix = prefixParts.join(' ')

  let subtitle = null
  if (prefix && episodeTitle) {
    subtitle = `${prefix} · ${episodeTitle}`
  } else if (prefix) {
    subtitle = prefix
  } else if (episodeTitle) {
    subtitle = episodeTitle
  }

  return {
    title: title || '',
    subtitle: subtitle || null,
  }
}

export function applyVideoLayerZIndex(videoEl, active, origZIndex) {
  if (!videoEl) return origZIndex
  if (active) {
    const orig = origZIndex === undefined ? videoEl.style.zIndex : origZIndex
    videoEl.style.zIndex = '0'
    return orig
  }
  if (origZIndex !== undefined) {
    videoEl.style.zIndex = origZIndex
  }
  return origZIndex
}

export function reportParams(view, extra = {}) {
  return {
    itemId: view.itemId,
    mediaSourceId: view._source ? view._source.id : view.itemId,
    playSessionId: view._playSessionId,
    audioStreamIndex: view._audioIndex,
    subtitleStreamIndex: view._subtitleIndex,
    playMethod: (view._source && view._source.directPlay) ? 'DirectPlay' : 'Transcode',
    canSeek: true,
    ...extra,
  }
}

export const CONTROL_BUTTON_LABELS = {
  restart: "Dall'inizio",
  next: 'Prossimo episodio',
  subtitles: 'Sottotitoli',
  audio: 'Audio',
}

export function controlButtons({ hasNext = false } = {}) {
  if (hasNext) {
    return ['restart', 'next', 'subtitles', 'audio']
  }
  return ['restart', 'subtitles', 'audio']
}

export async function sendStartReport(client, view) {
  if (view._startReported || !view._playSessionId) return
  view._startReported = true
  const startTicks = typeof view.startTicks === 'number' ? view.startTicks : 0
  const body = buildStartReport(reportParams(view, { positionTicks: startTicks, isPaused: false }))
  const status = await client.reportStart(body)
  probe.event('report', { kind: 'start', status })
}

export async function sendProgressReport(client, view, currentTime, isPaused = false) {
  if (!view._playSessionId || view._stoppedReported) return
  const sec = typeof currentTime === 'number' ? currentTime : (view.currentTime || 0)
  const body = buildProgressReport(reportParams(view, { positionTicks: secondsToTicks(sec), isPaused: !!isPaused }))
  const status = await client.reportProgress(body)
  probe.event('report', { kind: 'progress', status })
}

export async function sendStopReport(client, view, currentTime, failed = false) {
  if (!view._playSessionId || view._stoppedReported) return
  view._stoppedReported = true
  const sec = typeof currentTime === 'number' ? currentTime : (view.currentTime || 0)
  const body = buildStopReport({
    itemId: view.itemId,
    mediaSourceId: view._source ? view._source.id : view.itemId,
    playSessionId: view._playSessionId,
    positionTicks: secondsToTicks(sec),
    failed: !!failed,
  })
  const status = await client.reportStopped(body)
  probe.event('report', { kind: 'stopped', status })
}

export function castOrder(people, { maxRoleLength = 32 } = {}) {
  if (!Array.isArray(people)) return []
  const actors = people.filter(p => (p && (p.type === 'Actor' || p.Type === 'Actor')))
  return actors.slice(0, 15).map(p => {
    const id = p.id || p.Id
    const name = p.name || p.Name || ''
    const role = p.role || p.Role || ''
    const imageTag = p.imageTag || p.PrimaryImageTag || null
    let roleLine = null
    if (role) {
      const cutRole = role.length > maxRoleLength ? `${role.slice(0, maxRoleLength - 3)}...` : role
      roleLine = `Interpreta: ${cutRole}`
    }
    return {
      id,
      name,
      role,
      roleLine,
      imageTag,
      type: 'Actor',
    }
  })
}

export function castCard(person, details = {}) {
  if (!person) return null
  const d = details || {}
  const birthDate = d.birthDate || null
  const birthPlace = d.birthPlace || null
  const biography = d.biography ? (d.biography.length > 300 ? d.biography.slice(0, 300) : d.biography) : null
  const rawTitles = Array.isArray(d.titles) ? d.titles : []
  const titles = rawTitles.slice(0, 4).map(t => (typeof t === 'string' ? t : (t.name || t.title || ''))).filter(Boolean)
  const hasDetails = !!(birthDate || birthPlace || biography || titles.length > 0)

  return {
    id: person.id,
    name: person.name,
    role: person.role || '',
    roleLine: person.role ? `Interpreta: ${person.role}` : null,
    imageTag: person.imageTag || null,
    birthDate,
    birthPlace,
    biography,
    titles,
    hasDetails,
  }
}


const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

// "1974-07-28" -> "28 luglio 1974"; anything else is returned as it is, null stays null.
export function formatBirthDate(iso) {
  const m = typeof iso === 'string' ? iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null
  if (!m) return iso || null
  const month = MONTHS_IT[Number(m[2]) - 1]
  return month ? `${Number(m[3])} ${month} ${m[1]}` : iso
}

export function episodeCards(episodes, currentId) {
  if (!Array.isArray(episodes)) return []
  return episodes.map(ep => {
    if (!ep) return null
    const id = ep.id || ep.Id
    const num = typeof ep.episodeNumber === 'number'
      ? ep.episodeNumber
      : (typeof ep.index === 'number'
        ? ep.index
        : (typeof ep.IndexNumber === 'number' ? ep.IndexNumber : null))
    const label = num !== null && num !== undefined ? `E${num}` : ''
    const title = ep.episodeTitle || ep.title || ep.name || ep.Name || ''

    let progress = null
    const pos = typeof ep.playbackPositionTicks === 'number'
      ? ep.playbackPositionTicks
      : (ep.UserData && typeof ep.UserData.PlaybackPositionTicks === 'number'
        ? ep.UserData.PlaybackPositionTicks
        : (typeof ep.PlaybackPositionTicks === 'number' ? ep.PlaybackPositionTicks : null))
    const run = typeof ep.runTimeTicks === 'number'
      ? ep.runTimeTicks
      : (typeof ep.RunTimeTicks === 'number' ? ep.RunTimeTicks : null)
    if (pos !== null && run !== null && run > 0 && pos > 0) {
      progress = Math.min(1, Math.max(0, pos / run))
    } else if (typeof ep.progress === 'number' && ep.progress > 0) {
      progress = ep.progress
    }

    const current = (id !== undefined && id !== null && currentId !== undefined && currentId !== null)
      ? id === currentId
      : false

    const imageTag = ep.imageTag || (ep.ImageTags && ep.ImageTags.Primary) || null

    return {
      id,
      label,
      title,
      progress,
      current,
      imageTag,
    }
  }).filter(Boolean)
}

// Direct play streams the raw file, which always plays its own default audio track; a converted stream follows the server's default.
export function needsAudioRequest(source, audioIndex) {
  if (!source || typeof audioIndex !== 'number') return false
  if (!source.directPlay) return audioIndex !== source.defaultAudioStreamIndex
  const audio = (source.streams || []).filter(s => s.type === 'Audio')
  const fileDefault = audio.find(s => s.isDefault) || audio[0]
  return !!fileDefault && audioIndex !== fileDefault.index
}
