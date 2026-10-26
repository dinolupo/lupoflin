// L1 API smoke test against the real server in static/config.local.json, with the same client the app uses.
// Without devUser it checks only the public endpoints. Prints a JSON report, never the token.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { authHeader, createClient } from '../src/lib/jellyfin.js'
import { deviceProfile } from '../src/lib/deviceProfile.js'

const report = { ok: true, checks: [] }
const check = async (name, fn) => {
  const started = Date.now()
  try {
    const detail = await fn()
    report.checks.push({ name, ok: true, ms: Date.now() - started, ...(detail || {}) })
    return true
  } catch (e) {
    report.ok = false
    report.checks.push({ name, ok: false, error: e.message, status: e.status })
    return false
  }
}

const config = JSON.parse(await readFile('static/config.local.json', 'utf8'))
const client = createClient({ server: config.server, deviceId: 'lupoflix-api-smoke' })

await check('publicInfo', async () => {
  const info = await client.publicInfo()
  return { version: info.Version }
})
await check('publicUsers', async () => ({ count: (await client.publicUsers()).length }))
await check('quickConnectEnabled', async () => ({ enabled: await client.quickConnectEnabled() }))
await check('badPasswordIs401', async () => {
  try {
    await client.authenticateByName('lupoflix-no-such-user', 'x')
  } catch (e) {
    if (e.status === 401) return {}
    throw e
  }
  throw new Error('login with a wrong password did not fail')
})

if (config.devUser) {
  let auth
  let views = []
  const loggedIn = await check('login', async () => {
    auth = await client.authenticateByName(config.devUser, config.devPassword || '')
    return { user: auth.userName }
  })
  if (loggedIn) {
    await check('views', async () => {
      views = await client.views(auth.userId)
      if (!views.length) throw new Error('no libraries')
      return { libraries: views.map(v => `${v.name} (${v.collectionType})`) }
    })
    await check('latestPerLibrary', async () => {
      const counts = {}
      for (const v of views) counts[v.name] = (await client.latest(auth.userId, v.id, 20)).length
      return { counts }
    })
    await check('itemsFirstPage', async () => {
      const counts = {}
      for (const v of views) {
        const { items, total } = await client.items(auth.userId, v, { limit: 5 })
        counts[v.name] = { total, firstPage: items.length }
      }
      return { counts }
    })
    await check('posterImage', async () => {
      const v = views.find(x => x.collectionType === 'movies') || views[0]
      const { items } = await client.items(auth.userId, v, { limit: 1 })
      const item = items.find(i => i.imageTag)
      if (!item) throw new Error(`no item with an image in ${v.name}`)
      const res = await fetch(client.imageUrl(item.id, { tag: item.imageTag, maxHeight: 330 }))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return { contentType: res.headers.get('content-type'), bytes: (await res.arrayBuffer()).byteLength }
    })
    await check('itemDetails', async () => {
      const v = views.find(x => x.collectionType === 'movies')
      if (!v) throw new Error('no movies library')
      const { items } = await client.items(auth.userId, v, { limit: 1 })
      if (!items.length) throw new Error(`no items in ${v.name}`)
      const details = await client.item(auth.userId, items[0].id)
      if (!details.name) throw new Error('missing name')
      if (!details.minutes || details.minutes <= 0) throw new Error('missing or non-positive minutes')
      return { id: details.id, itemName: details.name, minutes: details.minutes, hasBackdrop: !!details.backdrop }
    })
    await check('resume', async () => {
      const items = await client.resume(auth.userId)
      return { count: items.length }
    })
    await check('avatars', async () => {
      const avatars = await client.avatars()
      if (avatars === null) return { plugin: 'missing' }
      const categories = {}
      for (const a of avatars) {
        categories[a.category || 'Altre'] = (categories[a.category || 'Altre'] || 0) + 1
      }
      return { count: avatars.length, categories }
    })
    await check('genres', async () => {
      const v = views.find(x => x.collectionType === 'movies')
      if (!v) throw new Error('no movies library')
      const genres = await client.genres(auth.userId, v.id)
      if (!genres.length) throw new Error(`no genres in ${v.name}`)
      const itemsRes = await client.items(auth.userId, v, { genreId: genres[0].id, sortBy: 'Random', limit: 20 })
      return { library: v.name, count: genres.length, sampleGenre: genres[0].name, sampleItems: itemsRes.items.length }
    })
    // Real ids for UI scenarios ({{name}} in ui-check steps). Test infrastructure: raw requests on purpose,
    // the app's endpoints stay in src/lib/jellyfin.js.
    await check('fixtures', async () => {
      const get = async path => {
        const res = await fetch(client.base + path, { headers: { Authorization: authHeader({ deviceId: 'lupoflix-api-smoke', token: client.token }) } })
        if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
        return res.json()
      }
      const list = async query => (await get(`/Items?userId=${auth.userId}&recursive=true&sortBy=SortName&${query}`)).Items || []
      const movies = await list('includeItemTypes=Movie&fields=MediaStreams&limit=200')
      const codec = (item, type) => ((item.MediaStreams || []).find(s => s.Type === type) || {}).Codec
      const h264 = movies.find(m => codec(m, 'Video') === 'h264')
      const hevc = movies.find(m => codec(m, 'Video') === 'hevc')
      // The only kind headless Chromium plays without transcoding: mp4 + H.264 + AAC (3 films on 25/10/2026).
      // Prefer one Dino has not started: player tests report positions that would overwrite his own.
      const videos = await list('includeItemTypes=Movie,Episode&fields=MediaStreams&limit=1000')
      const playable = videos.filter(m => /mp4/.test(m.Container || '') && codec(m, 'Video') === 'h264' && codec(m, 'Audio') === 'aac')
      const untouched = m => !m.UserData || (!m.UserData.Played && !m.UserData.PlaybackPositionTicks)
      const browser = playable.find(untouched) || playable[0]
      const count = (item, type) => (item.MediaStreams || []).filter(s => s.Type === type).length
      const subtitled = playable.find(m => count(m, 'Subtitle') > 0 && count(m, 'Audio') > 1)
      const series = (await list('includeItemTypes=Series&limit=1'))[0]
      const episode = series && (await get(`/Shows/${series.Id}/Episodes?userId=${auth.userId}&limit=2`)).Items[1]
      const fixtures = {
        movieId: movies[0] && movies[0].Id,
        h264MovieId: h264 && h264.Id,
        hevcMovieId: hevc && hevc.Id,
        browserPlayableId: browser && browser.Id,
        subtitledPlayableId: subtitled && subtitled.Id,
        serverHost: client.base.replace(/^https?:\/\//, ''),
        seriesId: series && series.Id,
        episodeId: episode && episode.Id,
      }
      await mkdir('.tmp', { recursive: true })
      await writeFile('.tmp/fixtures.json', JSON.stringify(fixtures, null, 2))
      return { written: '.tmp/fixtures.json', names: Object.keys(fixtures).filter(k => fixtures[k]) }
    })
    await check('playback', async () => {
      const fixtures = JSON.parse(await readFile('.tmp/fixtures.json', 'utf8'))
      if (!fixtures.browserPlayableId) throw new Error('no browserPlayableId in fixtures')
      const profile = deviceProfile('browser')
      const info = await client.playbackInfo(auth.userId, fixtures.browserPlayableId, { profile })
      if (!info.source || !info.source.directPlay) {
        throw new Error(`expected directPlay true, got ${info.source && info.source.directPlay}`)
      }
      const streamUrl = client.streamUrl(fixtures.browserPlayableId, info.source, info.playSessionId)
      const res = await fetch(streamUrl, { headers: { Range: 'bytes=0-1023' } })
      if (res.status !== 206) {
        throw new Error(`expected HTTP 206 for Range GET, got ${res.status}`)
      }
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.startsWith('video/')) {
        throw new Error(`expected content-type video/*, got ${contentType}`)
      }
      return { directPlay: info.source.directPlay, status: res.status, contentType }
    })
    await check('reportRoundTrip', async () => {
      const fixtures = JSON.parse(await readFile('.tmp/fixtures.json', 'utf8'))
      if (!fixtures.browserPlayableId) throw new Error('no browserPlayableId in fixtures')
      const itemId = fixtures.browserPlayableId

      const orig = await client.userData(auth.userId, itemId)
      const origTicks = orig.PlaybackPositionTicks || 0

      const details = await client.item(auth.userId, itemId)
      const runTimeTicks = details.runTimeTicks || (details.minutes ? details.minutes * 600000000 : 36000000000)
      const halfTicks = Math.round(runTimeTicks * 0.5)

      try {
        await client.reportStart({
          ItemId: itemId,
          MediaSourceId: itemId,
          PlaySessionId: 'smoke-session',
          PositionTicks: 0,
          IsPaused: false,
          CanSeek: true,
          PlayMethod: 'DirectPlay',
        })
        await client.reportStopped({
          ItemId: itemId,
          MediaSourceId: itemId,
          PlaySessionId: 'smoke-session',
          PositionTicks: halfTicks,
          Failed: false,
        })

        const updated = await client.userData(auth.userId, itemId)
        if (!updated || updated.PlaybackPositionTicks <= 0) {
          throw new Error(`expected PlaybackPositionTicks > 0, got ${updated && updated.PlaybackPositionTicks}`)
        }
        return {
          reportedTicks: halfTicks,
          recordedTicks: updated.PlaybackPositionTicks,
          restored: true,
        }
      } finally {
        await client.updateUserData(auth.userId, itemId, {
          PlaybackPositionTicks: origTicks,
          Played: !!orig.Played,
          PlayCount: orig.PlayCount || 0,
          IsFavorite: !!orig.IsFavorite,
          LastPlayedDate: orig.LastPlayedDate,
          PlayedPercentage: orig.PlayedPercentage || 0,
        })
      }
    })
    await check('segments', async () => {
      const fixtures = JSON.parse(await readFile('.tmp/fixtures.json', 'utf8'))
      const itemId = fixtures.subtitledPlayableId || fixtures.browserPlayableId || fixtures.movieId
      const segments = await client.segments(itemId)
      if (!Array.isArray(segments)) throw new Error('expected array of segments')
      return { count: segments.length }
    })
    await check('cast', async () => {
      const fixtures = JSON.parse(await readFile('.tmp/fixtures.json', 'utf8'))
      const film = await client.item(auth.userId, fixtures.movieId || fixtures.browserPlayableId)
      const actors = (film.people || []).filter(p => p.type === 'Actor')
      if (actors.length === 0) throw new Error('expected at least 1 actor in film')
      const firstActor = actors[0]
      const titles = await client.itemsOfPerson(auth.userId, firstActor.id, { exclude: film.id })
      if (!Array.isArray(titles)) throw new Error('expected array from itemsOfPerson')
      return { actor: firstActor.name, count: titles.length }
    })
  }
} else {
  report.checks.push({ name: 'login', skipped: 'devUser not set in static/config.local.json' })
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
