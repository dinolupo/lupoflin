// Pure logic for saving/loading cached home rows in storage (localStorage injected).
// Keeps only drawn fields and caps storage size to 150 KB by dropping tail rows.

const MAX_BYTES = 150 * 1024
const PREFIX = 'lupoflix:home:'

function byteLength(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length
  }
  return String(str || '').length
}

export function saveHome(storage, userId, rows) {
  if (!storage || !userId || !Array.isArray(rows)) return false

  const compactRows = rows.map(r => ({
    title: r.title,
    tile: r.tile ? { w: r.tile.w, h: r.tile.h } : undefined,
    showLabels: !!r.showLabels,
    isGenre: !!r.isGenre,
    genreId: r.genreId,
    libraryView: r.libraryView ? { id: r.libraryView.id, name: r.libraryView.name, collectionType: r.libraryView.collectionType } : undefined,
    loaded: r.loaded !== false,
    entries: (r.entries || []).map(e => ({
      kind: e.kind,
      id: e.id,
      label: e.label,
      imageUrl: e.imageUrl,
      progress: e.progress,
      played: !!e.played,
    })),
  }))

  let candidate = compactRows
  while (candidate.length > 0) {
    const payload = JSON.stringify({ userId, rows: candidate })
    if (byteLength(payload) <= MAX_BYTES) {
      try {
        storage.setItem(PREFIX + userId, payload)
        return true
      } catch {
        return false
      }
    }
    candidate = candidate.slice(0, -1)
  }
  return false
}

export function loadHome(storage, userId) {
  if (!storage || !userId) return null
  try {
    const raw = storage.getItem(PREFIX + userId)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.userId !== userId || !Array.isArray(data.rows)) return null
    return data.rows
  } catch {
    return null
  }
}
