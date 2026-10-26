// Prime-like names for audio and subtitle tracks: the language in its own language ("Italiano", "English"),
// with a short suffix only when two tracks would otherwise read the same.

const NAMES = {
  ita: 'Italiano', it: 'Italiano',
  eng: 'English', en: 'English',
  ger: 'Deutsch', deu: 'Deutsch', de: 'Deutsch',
  fre: 'Français', fra: 'Français', fr: 'Français',
  spa: 'Español', es: 'Español',
  por: 'Português', pt: 'Português',
  dut: 'Nederlands', nld: 'Nederlands', nl: 'Nederlands',
  pol: 'Polski', pl: 'Polski',
  swe: 'Svenska', sv: 'Svenska',
  dan: 'Dansk', da: 'Dansk',
  nor: 'Norsk', nob: 'Norsk', no: 'Norsk',
  fin: 'Suomi', fi: 'Suomi',
  tur: 'Türkçe', tr: 'Türkçe',
  rus: 'Русский', ru: 'Русский',
  jpn: '日本語', ja: '日本語',
  kor: '한국어', ko: '한국어',
  chi: '中文', zho: '中文', zh: '中文',
}

export function languageName(code) {
  if (!code) return null
  return NAMES[String(code).trim().toLowerCase()] || null
}

// "Ita - AC3 - 5.1 - Default" -> "AC3 5.1"
function details(displayTitle) {
  const parts = String(displayTitle || '').split(' - ').map(p => p.trim()).filter(Boolean)
  return parts.slice(1).filter(p => !/^(default|predefinit[oa]|forced|forzat[oi])$/i.test(p)).join(' ')
}

// tracks: mapped streams ({ index, language, displayTitle, isForced }); kind: 'audio' | 'subtitle'.
// Returns [{ index, label }] in the same order.
export function trackLabels(tracks = [], kind = 'audio') {
  const base = tracks.map((t, i) => {
    let label = languageName(t.language) || (t.displayTitle ? t.displayTitle.split(' - ')[0] : '') ||
      `${kind === 'audio' ? 'Audio' : 'Sottotitoli'} ${i + 1}`
    if (kind === 'subtitle' && t.isForced) label += ' (forzati)'
    return label
  })
  const labels = base.map((label, i) => {
    if (base.filter(b => b === label).length < 2) return label
    const extra = details(tracks[i].displayTitle)
    return extra ? `${label} (${extra})` : label
  })
  return tracks.map((t, i) => {
    const same = labels.filter((l, j) => l === labels[i] && j < i).length
    return { index: t.index, label: same ? `${labels[i]} ${same + 1}` : labels[i] }
  })
}

// Position of a Jellyfin audio stream among the file's audio tracks, as the <video> element lists them.
// -1 when the element does not list the same number of tracks (then the mapping cannot be trusted).
export function audioTrackPosition(streams = [], audioIndex, nativeCount) {
  const audio = streams.filter(s => s.type === 'Audio')
  if (!nativeCount || nativeCount !== audio.length) return -1
  return audio.findIndex(s => s.index === audioIndex)
}
