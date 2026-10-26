// WebVTT parser and active cue lookup.
// Pure JavaScript: no DOM, no Lightning. Tested by test/vtt.test.mjs (L0).

export function parseVttTimestamp(timeStr) {
  if (!timeStr) return 0
  const normalized = timeStr.trim().replace(',', '.')
  const parts = normalized.split(':')
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0
    const m = parseFloat(parts[1]) || 0
    const s = parseFloat(parts[2]) || 0
    return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0
    const s = parseFloat(parts[1]) || 0
    return m * 60 + s
  }
  return parseFloat(normalized) || 0
}

export function parseVtt(vttString) {
  if (!vttString || typeof vttString !== 'string') return []
  const lines = vttString.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const cues = []

  let inNote = false
  let currentStart = null
  let currentEnd = null
  let currentTextLines = []
  let isItalic = false

  function flushCue() {
    if (currentStart !== null && currentEnd !== null && currentTextLines.length > 0) {
      const text = currentTextLines.join('\n').trim()
      if (text.length > 0) {
        cues.push({
          start: currentStart,
          end: currentEnd,
          text,
          italic: isItalic,
        })
      }
    }
    currentStart = null
    currentEnd = null
    currentTextLines = []
    isItalic = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (inNote) {
      if (!line) inNote = false
      continue
    }

    if (line.startsWith('NOTE')) {
      flushCue()
      inNote = true
      continue
    }

    if (line.startsWith('WEBVTT') || line.startsWith('STYLE') || line.startsWith('REGION')) {
      flushCue()
      continue
    }

    const arrowIdx = line.indexOf('-->')
    if (arrowIdx !== -1) {
      flushCue()
      const before = line.slice(0, arrowIdx).trim()
      const after = line.slice(arrowIdx + 3).trim().split(/\s+/)[0]
      currentStart = parseVttTimestamp(before)
      currentEnd = parseVttTimestamp(after)
      continue
    }

    if (currentStart !== null) {
      if (!line) {
        flushCue()
      } else {
        if (/<i[ >]/i.test(line) || /<\/i>/i.test(line)) {
          isItalic = true
        }
        const stripped = line.replace(/<[^>]+>/g, '').trim()
        if (stripped) {
          currentTextLines.push(stripped)
        }
      }
    }
  }

  flushCue()
  return cues
}

export function findActiveCue(cues, currentTime) {
  if (!Array.isArray(cues) || cues.length === 0 || typeof currentTime !== 'number') return null
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]
    if (currentTime >= cue.start && currentTime <= cue.end) {
      return cue
    }
    // Since cues are generally ordered by start, we could optimize, but cues length is typically a few hundred
  }
  return null
}
