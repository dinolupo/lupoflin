import test from 'node:test'
import assert from 'node:assert/strict'
import { loadHome, saveHome } from '../src/lib/homeCache.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
  }
}

test('round trip: saves and loads compact rows for a user', () => {
  const storage = fakeStorage()
  const rows = [
    {
      title: 'Continua a guardare',
      tile: { w: 400, h: 225 },
      showLabels: true,
      loaded: true,
      entries: [
        { kind: 'item', id: 'i1', label: 'Film 1', imageUrl: 'http://img/1', progress: 0.5, played: true, ignoredExtra: 'skip' },
      ],
    },
    {
      title: 'Animazione · Bambini',
      tile: { w: 220, h: 330 },
      isGenre: true,
      genreId: 'g1',
      libraryView: { id: 'lib1', name: 'Bambini', collectionType: 'movies' },
      loaded: false,
      entries: [
        { kind: 'placeholder', id: null, label: '', imageUrl: null },
      ],
    },
  ]

  const saved = saveHome(storage, 'user-1', rows)
  assert.equal(saved, true)

  const loaded = loadHome(storage, 'user-1')
  assert.equal(loaded.length, 2)
  assert.equal(loaded[0].title, 'Continua a guardare')
  assert.equal(loaded[0].entries[0].label, 'Film 1')
  assert.equal(loaded[0].entries[0].played, true)
  assert.equal(loaded[0].entries[0].ignoredExtra, undefined)
  assert.equal(loaded[1].title, 'Animazione · Bambini')
  assert.equal(loaded[1].genreId, 'g1')
  assert.equal(loaded[1].loaded, false)
})

test('other user cache is not returned', () => {
  const storage = fakeStorage()
  saveHome(storage, 'user-1', [{ title: 'Row 1', tile: { w: 200, h: 200 }, entries: [] }])

  const loadedForOther = loadHome(storage, 'user-2')
  assert.equal(loadedForOther, null)
})

test('size cap: drops tail rows if payload exceeds 150 KB', () => {
  const storage = fakeStorage()
  // Create large rows (~30 KB each)
  const createLargeRow = i => ({
    title: `Row ${i}`,
    tile: { w: 220, h: 330 },
    entries: Array.from({ length: 100 }, (_, j) => ({
      kind: 'item',
      id: `item-${i}-${j}`,
      label: `Very Long Movie Title ${i}-${j} with lots of text to fill bytes `.repeat(3),
      imageUrl: `http://server:8096/Items/Images/Primary?tag=longtag1234567890&maxHeight=330&quality=80&id=${i}-${j}`,
    })),
  })

  // 10 large rows would be > 250 KB
  const rows = Array.from({ length: 10 }, (_, i) => createLargeRow(i))
  const saved = saveHome(storage, 'user-1', rows)
  assert.equal(saved, true)

  const loaded = loadHome(storage, 'user-1')
  assert.ok(loaded.length > 0)
  assert.ok(loaded.length < 10, `Expected tail rows to be dropped, got ${loaded.length}`)

  const storedString = storage.getItem('lupoflix:home:user-1')
  const byteSize = new TextEncoder().encode(storedString).length
  assert.ok(byteSize <= 150 * 1024, `Size ${byteSize} should be <= 150 KB`)
})

test('corrupted or empty storage returns null gracefully', () => {
  const storage = fakeStorage()
  assert.equal(loadHome(storage, 'user-1'), null)

  storage.setItem('lupoflix:home:user-1', 'not valid json')
  assert.equal(loadHome(storage, 'user-1'), null)

  storage.setItem('lupoflix:home:user-1', JSON.stringify({ userId: 'user-1', rows: 'not an array' }))
  assert.equal(loadHome(storage, 'user-1'), null)
})
