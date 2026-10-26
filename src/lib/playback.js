// Pure playback helpers: ticks conversion, time formatting, report bodies.
// 1 second = 10 000 000 Jellyfin ticks (1 tick = 100 ns).

export const TICKS_PER_SECOND = 10000000

export function ticksToSeconds(ticks) {
  if (typeof ticks !== 'number' || isNaN(ticks) || ticks <= 0) return 0
  return Math.floor(ticks / TICKS_PER_SECOND)
}

export function secondsToTicks(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return 0
  return Math.round(seconds * TICKS_PER_SECOND)
}

export function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return '00:00'
  const total = Math.floor(seconds)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const mStr = String(mins).padStart(2, '0')
  const sStr = String(secs).padStart(2, '0')
  if (hrs > 0) {
    return `${hrs}:${mStr}:${sStr}`
  }
  return `${mStr}:${sStr}`
}

export function formatRemaining(seconds, duration) {
  if (typeof duration !== 'number' || isNaN(duration) || duration <= 0 || !isFinite(duration)) return ''
  const current = typeof seconds === 'number' && !isNaN(seconds) && seconds > 0 ? seconds : 0
  const remaining = Math.max(0, duration - current)
  return `-${formatTime(remaining)}`
}

export function formatEndTime(seconds, duration, now = new Date()) {
  if (typeof duration !== 'number' || isNaN(duration) || duration <= 0 || !isFinite(duration)) return ''
  const current = typeof seconds === 'number' && !isNaN(seconds) && seconds > 0 ? seconds : 0
  const remainingMs = Math.max(0, duration - current) * 1000
  const end = new Date(now.getTime() + remainingMs)
  const hh = String(end.getHours()).padStart(2, '0')
  const mm = String(end.getMinutes()).padStart(2, '0')
  return `Fine alle ${hh}:${mm}`
}

export function buildStartReport({
  itemId,
  mediaSourceId,
  playSessionId,
  positionTicks = 0,
  isPaused = false,
  canSeek = true,
  playMethod = 'DirectPlay',
  audioStreamIndex,
  subtitleStreamIndex,
}) {
  return {
    ItemId: itemId,
    MediaSourceId: mediaSourceId,
    PlaySessionId: playSessionId,
    PositionTicks: positionTicks,
    IsPaused: isPaused,
    CanSeek: canSeek,
    PlayMethod: playMethod,
    AudioStreamIndex: audioStreamIndex,
    SubtitleStreamIndex: subtitleStreamIndex,
  }
}

export function buildProgressReport(args) {
  return buildStartReport(args)
}

export function buildStopReport({
  itemId,
  mediaSourceId,
  playSessionId,
  positionTicks = 0,
  failed = false,
}) {
  return {
    ItemId: itemId,
    MediaSourceId: mediaSourceId,
    PlaySessionId: playSessionId,
    PositionTicks: positionTicks,
    Failed: failed,
  }
}

export function matchLang(streamLang, prefLang) {
  if (!streamLang || !prefLang) return false
  const s = String(streamLang).trim().toLowerCase()
  const p = String(prefLang).trim().toLowerCase()
  return s === p || s.startsWith(p) || p.startsWith(s)
}

export function isTextSubtitle(s) {
  if (!s || s.type !== 'Subtitle') return false
  if (s.isTextSubtitleStream) return true
  const codec = (s.codec || '').toLowerCase()
  const imageCodecs = ['pgs', 'pgssub', 'dvd_subtitle', 'dvbsub', 'sub']
  return codec.length > 0 && !imageCodecs.includes(codec)
}

export function selectDefaultTracks({
  streams = [],
  defaultAudioIndex = null,
  defaultSubtitleIndex = null,
  userConfig = {},
} = {}) {
  const audioStreams = streams.filter(s => s.type === 'Audio')
  const subtitleStreams = streams.filter(isTextSubtitle)

  // 1. Audio selection
  let selectedAudio = null
  const audioPref = userConfig.AudioLanguagePreference
  if (audioPref) {
    selectedAudio = audioStreams.find(s => matchLang(s.language, audioPref))
  }
  if (!selectedAudio && typeof defaultAudioIndex === 'number') {
    selectedAudio = audioStreams.find(s => s.index === defaultAudioIndex)
  }
  if (!selectedAudio && audioStreams.length > 0) {
    selectedAudio = audioStreams.find(s => s.isDefault) || audioStreams[0]
  }
  const audio = selectedAudio ? selectedAudio.index : null

  // 2. Subtitle selection
  let selectedSub = null
  const subMode = userConfig.SubtitleMode || 'Default'
  const subPref = userConfig.SubtitleLanguagePreference || ''
  const selectedAudioLang = selectedAudio ? selectedAudio.language : ''

  if (subtitleStreams.length > 0 && subMode !== 'None') {
    if (subMode === 'Always') {
      if (subPref) {
        selectedSub = subtitleStreams.find(s => matchLang(s.language, subPref) && !s.isForced) ||
                      subtitleStreams.find(s => matchLang(s.language, subPref))
      }
      if (!selectedSub) {
        selectedSub = subtitleStreams.find(s => s.isDefault && !s.isForced) ||
                      subtitleStreams.find(s => !s.isForced) ||
                      subtitleStreams[0]
      }
    } else if (subMode === 'OnlyForced') {
      if (subPref) {
        selectedSub = subtitleStreams.find(s => matchLang(s.language, subPref) && s.isForced)
      }
      if (!selectedSub && selectedAudioLang) {
        selectedSub = subtitleStreams.find(s => matchLang(s.language, selectedAudioLang) && s.isForced)
      }
      if (!selectedSub) {
        selectedSub = subtitleStreams.find(s => s.isForced)
      }
    } else if (subMode === 'Default') {
      if (audioPref && selectedAudioLang && !matchLang(selectedAudioLang, audioPref) && subPref) {
        selectedSub = subtitleStreams.find(s => matchLang(s.language, subPref))
      } else {
        if (typeof defaultSubtitleIndex === 'number') {
          selectedSub = subtitleStreams.find(s => s.index === defaultSubtitleIndex)
        }
        if (!selectedSub) {
          selectedSub = subtitleStreams.find(s => s.isDefault)
        }
        if (!selectedSub && selectedAudioLang) {
          selectedSub = subtitleStreams.find(s => matchLang(s.language, selectedAudioLang) && s.isForced)
        }
      }
    }
  }

  const subtitle = selectedSub ? selectedSub.index : null

  return { audio, subtitle }
}

export function nextAction({
  time = 0,
  duration = 0,
  outroStart = null,
  hasNext = false,
  episodesWithoutKeys = 0,
} = {}) {
  if (!hasNext) return 'none'
  if (typeof duration !== 'number' || duration <= 0 || !isFinite(duration)) return 'none'

  let isNearEnd = false
  if (typeof outroStart === 'number' && outroStart > 0) {
    isNearEnd = time >= outroStart
  } else {
    isNearEnd = (duration - time) <= 30 && time > 0
  }

  if (!isNearEnd) return 'none'
  if (episodesWithoutKeys >= 3) return 'askStillWatching'
  return 'showNext'
}

export function findNextEpisode(episodes = [], currentEpisodeId) {
  if (!Array.isArray(episodes) || episodes.length === 0 || !currentEpisodeId) return null
  const idx = episodes.findIndex(e => e.id === currentEpisodeId)
  if (idx === -1 || idx === episodes.length - 1) return null
  return episodes[idx + 1]
}

export function mapSegment(raw) {
  if (!raw) return null
  const startTicks = typeof raw.StartTicks === 'number' ? raw.StartTicks : 0
  const endTicks = typeof raw.EndTicks === 'number' ? raw.EndTicks : 0
  return {
    id: raw.Id,
    itemId: raw.ItemId,
    type: raw.Type || 'Intro',
    startTicks,
    endTicks,
    startSec: ticksToSeconds(startTicks),
    endSec: ticksToSeconds(endTicks),
  }
}

export function segmentLabel(type) {
  if (type === 'Recap') return 'Salta riassunto'
  if (type === 'Intro') return 'Salta intro'
  return 'Salta'
}

export function findActiveSegment(segments = [], currentSeconds = 0) {
  if (!Array.isArray(segments) || segments.length === 0 || typeof currentSeconds !== 'number') return null
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (currentSeconds >= s.startSec && currentSeconds < s.endSec) {
      return s
    }
  }
  return null
}

export function layoutButtonPositions(labels, measureFn) {
  if (!Array.isArray(labels)) return []
  let curX = 0
  return labels.map(label => {
    const textW = measureFn ? measureFn(label) : (label ? label.length * 18 : 0)
    const w = Math.ceil(textW + 80)
    const item = { label, x: curX, w }
    curX += w + 20
    return item
  })
}

export function isPlaybackErrorIgnored(msg) {
  if (!msg || typeof msg !== 'string') return false
  return msg.includes('interrupted by a call to pause') || msg.includes('AbortError')
}

export function playerErrorMessage(error) {
  if (!error) return 'Impossibile riprodurre il titolo'
  const msg = typeof error === 'string' ? error : (error.message || '')
  if (isPlaybackErrorIgnored(msg)) return null
  return 'Impossibile riprodurre il titolo'
}



