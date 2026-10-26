// L0 tests for src/lib/jellyfin.js. Fake server and token only: never real values here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { authHeader, createClient, formatCardLabel, JellyfinError, mapDetails, mapGenre, mapItem, mapMediaSource, mapPerson, mapUser, normalizeServerUrl, query, urls, mapView } from '../src/lib/jellyfin.js'

const BASE = 'http://jellyfin.test:8096'

// Returns a fetch stub that records calls and answers from a { 'METHOD path': [status, body] } table.
function fakeFetch(routes) {
  const calls = []
  const fn = async (url, init = {}) => {
    calls.push({ url, ...init })
    const method = init.method || 'GET'
    const key = `${method} ${url.replace(BASE, '').split('?')[0]}`
    const [status, body] = routes[key] || [404, {}]
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    }
  }
  fn.calls = calls
  return fn
}

test('normalizeServerUrl adds scheme and strips trailing slashes', () => {
  assert.equal(normalizeServerUrl(' jellyfin.test:8096/ '), 'http://jellyfin.test:8096')
  assert.equal(normalizeServerUrl('https://jf.example//'), 'https://jf.example')
  assert.equal(normalizeServerUrl(''), '')
})

test('authHeader has client fields, token only when given, no stray quotes', () => {
  const h = authHeader({ deviceId: 'dev"1' })
  assert.match(h, /^MediaBrowser Client="LupoFlin", Device="LG webOS TV", DeviceId="dev1", Version="/)
  assert.ok(!h.includes('Token='))
  assert.match(authHeader({ deviceId: 'd', token: 'token-test' }), /, Token="token-test"$/)
})

test('query skips empty values, joins arrays, encodes', () => {
  assert.equal(query({ a: 1, b: undefined, c: null, d: '', e: ['Movie', 'Series'], f: 'x y' }), '?a=1&e=Movie%2CSeries&f=x%20y')
  assert.equal(query({}), '')
})

test('items url: movies library is recursive and filtered by type', () => {
  const u = urls.items(BASE, 'u1', { id: 'lib1', collectionType: 'movies' }, { startIndex: 50, limit: 25 })
  assert.match(u, /^http:\/\/jellyfin\.test:8096\/Items\?/)
  for (const part of ['userId=u1', 'parentId=lib1', 'includeItemTypes=Movie', 'recursive=true', 'startIndex=50', 'limit=25']) {
    assert.ok(u.includes(part), `${part} missing in ${u}`)
  }
})

test('items url supports genreId and Random sortBy', () => {
  const u = urls.items(BASE, 'u1', { id: 'lib1', collectionType: 'movies' }, { genreId: 'g1', sortBy: 'Random', limit: 20 })
  assert.match(u, /^http:\/\/jellyfin\.test:8096\/Items\?/)
  assert.ok(u.includes('genreIds=g1'))
  assert.ok(u.includes('sortBy=Random'))
  assert.ok(!u.includes('sortOrder'))
  assert.ok(u.includes('limit=20'))
})

test('items url supports sortBy, sortOrder and filters', () => {
  const u = urls.items(BASE, 'u1', { id: 'lib1', collectionType: 'movies' }, {
    sortBy: 'DateCreated',
    sortOrder: 'Descending',
    filters: 'IsUnplayed',
    startIndex: 0,
    limit: 60,
  })
  assert.match(u, /^http:\/\/jellyfin\.test:8096\/Items\?/)
  assert.ok(u.includes('sortBy=DateCreated'))
  assert.ok(u.includes('sortOrder=Descending'))
  assert.ok(u.includes('filters=IsUnplayed'))
  assert.ok(u.includes('limit=60'))
})

test('genres url sends userId, parentId, sortBy SortName', () => {
  const u = urls.genres(BASE, 'u1', 'lib1')
  assert.match(u, /^http:\/\/jellyfin\.test:8096\/Genres\?/)
  assert.ok(u.includes('userId=u1'))
  assert.ok(u.includes('parentId=lib1'))
  assert.ok(u.includes('sortBy=SortName'))
})

test('items url: unknown library type lists direct children only', () => {
  const u = urls.items(BASE, 'u1', { id: 'lib2', collectionType: 'folders' })
  assert.ok(!u.includes('recursive'))
  assert.ok(!u.includes('includeItemTypes'))
})

test('image url asks for the drawn size', () => {
  assert.equal(
    urls.image(BASE, 'i1', { tag: 't', maxWidth: 240, quality: 70 }),
    `${BASE}/Items/i1/Images/Primary?tag=t&maxWidth=240&quality=70`
  )
})

test('mapView keeps only the library own image, never the parent folder', () => {
  const v = mapView({ Id: 'lib1', Name: 'Film', CollectionType: 'movies', ParentId: 'root', ImageTags: { Primary: 'p' } })
  assert.deepEqual(v, { id: 'lib1', name: 'Film', collectionType: 'movies', imageTag: 'p' })
})

test('mapItem tolerates missing optional fields', () => {
  assert.deepEqual(mapItem({ Id: 'i', Name: 'N', Type: 'Movie' }), {
    id: 'i', name: 'N', type: 'Movie', year: null, imageTag: null, aspect: null,
    overview: '', backdrop: null, logoTag: null,
    seriesName: null, seasonNumber: null, episodeNumber: null, seriesBackdrop: null,
    played: false, isFavorite: false,
  })
})

test('mapItem maps backdrop, logoTag, overview when provided', () => {
  assert.deepEqual(mapItem({
    Id: 'i2',
    Name: 'Film',
    Type: 'Movie',
    ProductionYear: 2024,
    Overview: 'A good film',
    BackdropImageTags: ['bd1'],
    ImageTags: { Primary: 'p1', Logo: 'l1' },
    PrimaryImageAspectRatio: 1.5,
    UserData: { Played: true, IsFavorite: true },
  }), {
    id: 'i2',
    name: 'Film',
    type: 'Movie',
    year: 2024,
    imageTag: 'p1',
    aspect: 1.5,
    overview: 'A good film',
    backdrop: { itemId: 'i2', tag: 'bd1' },
    logoTag: 'l1',
    seriesName: null,
    seasonNumber: null,
    episodeNumber: null,
    seriesBackdrop: null,
    played: true,
    isFavorite: true,
  })
})

test('urls.nextUp builds correct URL', () => {
  const url = urls.nextUp(BASE, 'u1', 20)
  assert.strictEqual(url, `${BASE}/Shows/NextUp?userId=u1&limit=20&fields=PrimaryImageAspectRatio%2CSeriesName`)
})

test('formatCardLabel formats episode label as <series> · S1:E2 and keeps film name', () => {
  assert.strictEqual(
    formatCardLabel({ type: 'Episode', name: 'Come comete', seriesName: 'Due spicci', seasonNumber: 1, episodeNumber: 8 }),
    'Due spicci · S1:E8'
  )
  assert.strictEqual(
    formatCardLabel({ type: 'Movie', name: 'Iron Man' }),
    'Iron Man'
  )
  assert.strictEqual(
    formatCardLabel({ type: 'Episode', name: 'Fallback', seriesName: null }),
    'Fallback'
  )
})

test('client.nextUp requests /Shows/NextUp and maps items', async () => {
  const fetchFn = fakeFetch({
    'GET /Shows/NextUp': [200, {
      Items: [{
        Id: 'ep1',
        Name: 'Ep 1',
        Type: 'Episode',
        SeriesName: 'Show',
        ParentIndexNumber: 1,
        IndexNumber: 1,
        ImageTags: { Primary: 'p' },
      }],
    }],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', fetchFn })
  const items = await client.nextUp('u1', 10)
  assert.strictEqual(items.length, 1)
  assert.strictEqual(items[0].id, 'ep1')
  assert.strictEqual(items[0].seriesName, 'Show')
  assert.strictEqual(formatCardLabel(items[0]), 'Show · S1:E1')
})

test('authenticateByName sends credentials and keeps the token for later calls', async () => {
  const fetchFn = fakeFetch({
    'POST /Users/AuthenticateByName': [200, { AccessToken: 'token-test', User: { Id: 'u1', Name: 'Test', PrimaryImageTag: 'img1' } }],
    'GET /UserViews': [200, { Items: [{ Id: 'v1', Name: 'Film', CollectionType: 'movies', ImageTags: { Primary: 'p' } }] }],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', fetchFn })
  const auth = await client.authenticateByName('Test', 'pw')
  assert.deepEqual(auth, { token: 'token-test', userId: 'u1', userName: 'Test', imageTag: 'img1' })
  assert.deepEqual(JSON.parse(fetchFn.calls[0].body), { Username: 'Test', Pw: 'pw' })
  const views = await client.views('u1')
  assert.deepEqual(views, [{ id: 'v1', name: 'Film', collectionType: 'movies', imageTag: 'p' }])
  assert.match(fetchFn.calls[1].headers.Authorization, /Token="token-test"/)
})

test('HTTP errors become JellyfinError with the status', async () => {
  const client = createClient({ server: BASE, deviceId: 'd1', fetchFn: fakeFetch({}) })
  await assert.rejects(client.me(), e => e instanceof JellyfinError && e.status === 404)
})

test('network failures become JellyfinError with status 0', async () => {
  const fetchFn = async () => {
    throw new Error('offline')
  }
  const client = createClient({ server: BASE, deviceId: 'd1', fetchFn })
  await assert.rejects(client.publicInfo(), e => e instanceof JellyfinError && e.status === 0)
})

test('quick connect: initiate, poll, authenticate', async () => {
  const fetchFn = fakeFetch({
    'POST /QuickConnect/Initiate': [200, { Code: '123456', Secret: 's1', Authenticated: false }],
    'GET /QuickConnect/Connect': [200, { Authenticated: true }],
    'POST /Users/AuthenticateWithQuickConnect': [200, { AccessToken: 'token-test', User: { Id: 'u1', Name: 'Test' } }],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', fetchFn })
  assert.deepEqual(await client.quickConnectInitiate(), { code: '123456', secret: 's1' })
  assert.equal(await client.quickConnectAuthorized('s1'), true)
  assert.ok(fetchFn.calls[1].url.endsWith('/QuickConnect/Connect?secret=s1'))
  assert.equal((await client.authenticateWithQuickConnect('s1')).token, 'token-test')
  assert.deepEqual(JSON.parse(fetchFn.calls[2].body), { Secret: 's1' })
})

test('stage 2 URLs: item, seasons, episodes', () => {
  assert.equal(urls.item(BASE, 'u1', 'item123'), `${BASE}/Items/item123?userId=u1`)
  assert.equal(
    urls.seasons(BASE, 'u1', 'series123'),
    `${BASE}/Shows/series123/Seasons?userId=u1&fields=PrimaryImageAspectRatio`
  )
  assert.equal(
    urls.episodes(BASE, 'u1', 'series123', 'season123'),
    `${BASE}/Shows/series123/Episodes?userId=u1&seasonId=season123&fields=PrimaryImageAspectRatio`
  )
})

test('client.episodes maps index, seasonId, playbackPositionTicks and runTimeTicks', async () => {
  const fetchFn = fakeFetch({
    'GET /Shows/s1/Episodes': [
      200,
      {
        Items: [
          {
            Id: 'ep1',
            Name: 'Pilot',
            Type: 'Episode',
            IndexNumber: 1,
            ParentIndexNumber: 1,
            SeasonId: 'season1',
            RunTimeTicks: 30000000000,
            UserData: { PlaybackPositionTicks: 15000000000, Played: false },
          },
        ],
      },
    ],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', fetchFn })
  const res = await client.episodes('u1', 's1', 'season1')
  assert.equal(res.length, 1)
  assert.equal(res[0].id, 'ep1')
  assert.equal(res[0].index, 1)
  assert.equal(res[0].seasonId, 'season1')
  assert.equal(res[0].runTimeTicks, 30000000000)
  assert.equal(res[0].playbackPositionTicks, 15000000000)
})

test('mapDetails: with backdrop, runtime, genres and ratings', () => {
  const raw = {
    Id: 'm1',
    Name: 'Inception',
    Type: 'Movie',
    ProductionYear: 2010,
    Overview: 'A thief steals corporate secrets through dream-sharing technology.',
    RunTimeTicks: 88800000000, // 148 minutes (148 * 60 * 10^7)
    Genres: ['Action', 'Sci-Fi'],
    OfficialRating: 'PG-13',
    CommunityRating: 8.8,
    BackdropImageTags: ['bd-tag-1', 'bd-tag-2'],
    ImageTags: { Logo: 'logo-tag-1' },
    SeriesId: null,
    UserData: { IsFavorite: true, Played: true },
  }
  const details = mapDetails(raw)
  assert.deepEqual(details, {
    id: 'm1',
    name: 'Inception',
    type: 'Movie',
    year: 2010,
    overview: 'A thief steals corporate secrets through dream-sharing technology.',
    minutes: 148,
    genres: ['Action', 'Sci-Fi'],
    rating: 'PG-13',
    communityRating: 8.8,
    backdrop: { itemId: 'm1', tag: 'bd-tag-1' },
    logo: { itemId: 'm1', tag: 'logo-tag-1' },
    seriesId: null,
    seriesName: null,
    seasonId: null,
    seasonNumber: null,
    episodeNumber: null,
    episodeTitle: 'Inception',
    runTimeTicks: 88800000000,
    playbackPositionTicks: 0,
    isFavorite: true,
    isPlayed: true,
  })
})

test('mapDetails: parent backdrop fallback and parent logo fallback', () => {
  const raw = {
    Id: 'ep1',
    Name: 'Pilot',
    Type: 'Episode',
    ParentBackdropItemId: 'series1',
    ParentBackdropImageTags: ['series-bd-tag'],
    ParentLogoItemId: 'series1',
    ParentLogoImageTag: 'series-logo-tag',
    SeriesId: 'series1',
  }
  const details = mapDetails(raw)
  assert.deepEqual(details.backdrop, { itemId: 'series1', tag: 'series-bd-tag' })
  assert.deepEqual(details.logo, { itemId: 'series1', tag: 'series-logo-tag' })
  assert.equal(details.seriesId, 'series1')
})

test('mapDetails: without backdrop and missing runtime', () => {
  const raw = {
    Id: 'm2',
    Name: 'Short Film',
    Type: 'Movie',
  }
  const details = mapDetails(raw)
  assert.equal(details.backdrop, null)
  assert.equal(details.logo, null)
  assert.equal(details.minutes, null)
  assert.equal(details.overview, '')
  assert.deepEqual(details.genres, [])
  assert.equal(details.rating, null)
  assert.equal(details.communityRating, null)
  assert.equal(details.year, null)
  assert.equal(details.runTimeTicks, null)
  assert.equal(details.playbackPositionTicks, 0)

  const withUserData = mapDetails({ ...raw, UserData: { PlaybackPositionTicks: 123450000 } })
  assert.equal(withUserData.playbackPositionTicks, 123450000)
})

test('resume URL has userId, limit 20, mediaTypes Video and fields PrimaryImageAspectRatio', () => {
  assert.equal(
    urls.resume(BASE, 'u1'),
    `${BASE}/UserItems/Resume?userId=u1&limit=20&mediaTypes=Video&fields=PrimaryImageAspectRatio`
  )
})

test('client.resume maps items and progress from UserData.PlayedPercentage', async () => {
  const fetchFn = fakeFetch({
    'GET /UserItems/Resume': [
      200,
      {
        Items: [
          { Id: 'i1', Name: 'Item 1', Type: 'Movie', UserData: { PlayedPercentage: 45.5 } },
          { Id: 'i2', Name: 'Item 2', Type: 'Episode', UserData: {} },
          { Id: 'i3', Name: 'Item 3', Type: 'Movie' },
        ],
      },
    ],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', fetchFn })
  const items = await client.resume('u1')
  assert.equal(items.length, 3)
  assert.equal(items[0].progress, 0.455)
  assert.equal(items[1].progress, null)
  assert.equal(items[2].progress, null)
  assert.equal(items[0].id, 'i1')
})

test('mapDetails formats episode name with season and episode numbers', () => {
  const raw = {
    Id: 'ep1',
    Name: 'Il ritorno',
    Type: 'Episode',
    SeriesName: 'La Serie',
    ParentIndexNumber: 1,
    IndexNumber: 2,
  }
  const details = mapDetails(raw)
  assert.equal(details.name, 'S1:E2 Il ritorno')
  assert.equal(details.seriesName, 'La Serie')
  assert.equal(details.seasonNumber, 1)
  assert.equal(details.episodeNumber, 2)
  assert.equal(details.episodeTitle, 'Il ritorno')
})

test('logout sends POST /Sessions/Logout with the token in Authorization header', async () => {
  const fetchFn = fakeFetch({
    'POST /Sessions/Logout': [204, null],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok-primary', fetchFn })
  await client.logout()
  assert.equal(fetchFn.calls.length, 1)
  assert.equal(fetchFn.calls[0].method, 'POST')
  assert.equal(fetchFn.calls[0].url, `${BASE}/Sessions/Logout`)
  assert.match(fetchFn.calls[0].headers.Authorization, /Token="tok-primary"/)

  await client.logout('tok-explicit')
  assert.equal(fetchFn.calls.length, 2)
  assert.equal(fetchFn.calls[1].method, 'POST')
  assert.equal(fetchFn.calls[1].url, `${BASE}/Sessions/Logout`)
  assert.match(fetchFn.calls[1].headers.Authorization, /Token="tok-explicit"/)
})

test('avatars URL and setAvatar URL', () => {
  assert.equal(urls.avatars(BASE), `${BASE}/GetAvatar/Avatars`)
  assert.equal(urls.setAvatar(BASE), `${BASE}/GetAvatar/SetAvatar`)
})

test('client.avatars maps items with absolute url and category', async () => {
  const fetchFn = fakeFetch({
    'GET /GetAvatar/Avatars': [
      200,
      [
        { Id: 'av1', Name: 'Avatar 1', Category: 'Netflix', Url: '/GetAvatar/Image/av1' },
        { Id: 'av2', Name: 'Avatar 2', Category: 'Disney', Url: 'http://cdn.test/av2.png' },
        { Id: 'av3', Name: 'Avatar 3' },
      ],
    ],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', token: 'tok1', fetchFn })
  const avatars = await client.avatars()
  assert.equal(avatars.length, 3)
  assert.deepEqual(avatars[0], { id: 'av1', name: 'Avatar 1', category: 'Netflix', url: `${BASE}/GetAvatar/Image/av1` })
  assert.deepEqual(avatars[1], { id: 'av2', name: 'Avatar 2', category: 'Disney', url: 'http://cdn.test/av2.png' })
  assert.deepEqual(avatars[2], { id: 'av3', name: 'Avatar 3', category: '', url: `${BASE}/GetAvatar/Image/av3` })
})

test('client.avatars returns null on 404 (plugin missing)', async () => {
  const fetchFn = fakeFetch({
    'GET /GetAvatar/Avatars': [404, 'Not Found'],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', token: 'tok1', fetchFn })
  const avatars = await client.avatars()
  assert.equal(avatars, null)
})

test('client.setAvatar sends POST /GetAvatar/SetAvatar with AvatarId body', async () => {
  const fetchFn = fakeFetch({
    'POST /GetAvatar/SetAvatar': [200, { message: 'ok' }],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', token: 'tok-user', fetchFn })
  await client.setAvatar('av-target')
  assert.equal(fetchFn.calls.length, 1)
  assert.equal(fetchFn.calls[0].method, 'POST')
  assert.equal(fetchFn.calls[0].url, `${BASE}/GetAvatar/SetAvatar`)
  assert.deepEqual(JSON.parse(fetchFn.calls[0].body), { AvatarId: 'av-target' })
  assert.match(fetchFn.calls[0].headers.Authorization, /Token="tok-user"/)
})

test('mapUser extracts refreshed PrimaryImageTag from me response', () => {
  const me = {
    Id: 'u1',
    Name: 'Dino',
    HasPassword: true,
    PrimaryImageTag: 'tag-refreshed-123',
  }
  const user = mapUser(me)
  assert.equal(user.id, 'u1')
  assert.equal(user.name, 'Dino')
  assert.equal(user.imageTag, 'tag-refreshed-123')
})

test('mapGenre extracts Id and Name', () => {
  assert.deepEqual(mapGenre({ Id: 'g1', Name: 'Azione' }), { id: 'g1', name: 'Azione' })
  assert.deepEqual(mapGenre({ Id: 'g2' }), { id: 'g2', name: '' })
})

test('client.genres queries Genres endpoint and maps items', async () => {
  const fetchFn = fakeFetch({
    'GET /Genres': [200, { Items: [{ Id: 'g1', Name: 'Animazione' }, { Id: 'g2', Name: 'Commedia' }] }],
  })
  const client = createClient({ server: BASE, deviceId: 'd1', token: 'tok-user', fetchFn })
  const genres = await client.genres('u1', 'lib1')
  assert.equal(genres.length, 2)
  assert.deepEqual(genres[0], { id: 'g1', name: 'Animazione' })
  assert.deepEqual(genres[1], { id: 'g2', name: 'Commedia' })
  assert.match(fetchFn.calls[0].url, /^http:\/\/jellyfin\.test:8096\/Genres\?/)
  assert.ok(fetchFn.calls[0].url.includes('parentId=lib1'))
  assert.ok(fetchFn.calls[0].url.includes('sortBy=SortName'))
})

test('playback URLs build expected endpoints and query parameters', () => {
  assert.equal(
    urls.playbackInfo(BASE, 'u1', 'item1'),
    `${BASE}/Items/item1/PlaybackInfo?userId=u1`
  )
  assert.equal(
    urls.stream(BASE, 'item1', {
      mediaSourceId: 'ms1',
      playSessionId: 'ps1',
      deviceId: 'dev1',
      apiKey: 'tok1',
    }),
    `${BASE}/Videos/item1/stream?static=true&mediaSourceId=ms1&playSessionId=ps1&deviceId=dev1&ApiKey=tok1`
  )
})

test('mapMediaSource maps properties and media streams', () => {
  assert.equal(mapMediaSource(null), null)
  const mapped = mapMediaSource({
    Id: 'src1',
    Container: 'mp4',
    SupportsDirectPlay: true,
    TranscodingUrl: '/Videos/transcode.m3u8',
    MediaStreams: [
      {
        Index: 0,
        Type: 'Video',
        Codec: 'h264',
        Language: 'ita',
        DisplayTitle: '1080p H264',
        IsDefault: true,
        IsForced: false,
        IsExternal: false,
        DeliveryUrl: null,
      },
      {
        Index: 1,
        Type: 'Subtitle',
        Codec: 'subrip',
        Language: 'eng',
        DisplayTitle: 'English (SRT)',
        IsDefault: false,
        IsForced: true,
        IsExternal: true,
        DeliveryUrl: '/Videos/sub.vtt',
      },
    ],
  })
  assert.equal(mapped.id, 'src1')
  assert.equal(mapped.container, 'mp4')
  assert.equal(mapped.directPlay, true)
  assert.equal(mapped.transcodingUrl, '/Videos/transcode.m3u8')
  assert.equal(mapped.defaultAudioStreamIndex, null)
  assert.equal(mapped.defaultSubtitleStreamIndex, null)
  assert.equal(mapped.streams.length, 2)
  assert.deepEqual(mapped.streams[0], {
    index: 0,
    type: 'Video',
    codec: 'h264',
    language: 'ita',
    displayTitle: '1080p H264',
    isDefault: true,
    isForced: false,
    isExternal: false,
    isTextSubtitleStream: false,
    deliveryUrl: null,
  })
  assert.deepEqual(mapped.streams[1], {
    index: 1,
    type: 'Subtitle',
    codec: 'subrip',
    language: 'eng',
    displayTitle: 'English (SRT)',
    isDefault: false,
    isForced: true,
    isExternal: true,
    isTextSubtitleStream: false,
    deliveryUrl: '/Videos/sub.vtt',
  })
})

test('client.playbackInfo sends POST body with profile and start ticks and returns mapped source', async () => {
  const fetchFn = fakeFetch({
    'POST /Items/item99/PlaybackInfo': [
      200,
      {
        PlaySessionId: 'sess-abc',
        MediaSources: [
          {
            Id: 'src99',
            Container: 'mp4',
            SupportsDirectPlay: true,
            MediaStreams: [],
          },
        ],
      },
    ],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1', fetchFn })
  const res = await client.playbackInfo('u1', 'item99', {
    profile: { Name: 'Custom Profile' },
    startTicks: 123450000,
    audioIndex: 1,
    subtitleIndex: 2,
    mediaSourceId: 'src99',
  })
  assert.equal(fetchFn.calls.length, 1)
  assert.equal(fetchFn.calls[0].url, `${BASE}/Items/item99/PlaybackInfo?userId=u1`)
  const body = JSON.parse(fetchFn.calls[0].body)
  assert.equal(body.UserId, 'u1')
  assert.deepEqual(body.DeviceProfile, { Name: 'Custom Profile' })
  assert.equal(body.StartTimeTicks, 123450000)
  assert.equal(body.MediaSourceId, 'src99')
  assert.equal(body.AudioStreamIndex, 1)
  assert.equal(body.SubtitleStreamIndex, 2)
  assert.equal(body.EnableDirectPlay, true)
  assert.equal(body.EnableDirectStream, true)
  assert.equal(body.EnableTranscoding, true)

  await client.playbackInfo('u1', 'item99', { profile: {}, audioIndex: 2, mediaSourceId: 'src99', directPlay: false })
  const body2 = JSON.parse(fetchFn.calls[1].body)
  assert.equal(body2.EnableDirectPlay, false)
  assert.equal(body2.EnableDirectStream, false)

  assert.equal(res.playSessionId, 'sess-abc')
  assert.equal(res.source.id, 'src99')
  assert.equal(res.source.directPlay, true)
})

test('client.streamUrl builds directPlay and transcoding URLs', () => {
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1' })
  const directSource = { id: 'ms1', directPlay: true }
  const directUrl = client.streamUrl('item1', directSource, 'sess1')
  assert.equal(
    directUrl,
    `${BASE}/Videos/item1/stream?static=true&mediaSourceId=ms1&playSessionId=sess1&deviceId=dev1&ApiKey=tok1`
  )

  const transcodeSource = { id: 'ms2', directPlay: false, transcodingUrl: '/Videos/transcode.m3u8' }
  const transcodeUrl = client.streamUrl('item1', transcodeSource, 'sess1')
  assert.equal(transcodeUrl, `${BASE}/Videos/transcode.m3u8`)

  const absoluteTranscodeSource = { id: 'ms3', directPlay: false, transcodingUrl: 'http://cdn.test/live.m3u8' }
  const absoluteUrl = client.streamUrl('item1', absoluteTranscodeSource, 'sess1')
  assert.equal(absoluteUrl, 'http://cdn.test/live.m3u8')
})

test('reporting and userData URLs and client methods', async () => {
  assert.equal(urls.sessionPlaying(BASE), `${BASE}/Sessions/Playing`)
  assert.equal(urls.sessionProgress(BASE), `${BASE}/Sessions/Playing/Progress`)
  assert.equal(urls.sessionStopped(BASE), `${BASE}/Sessions/Playing/Stopped`)
  assert.equal(urls.userData(BASE, 'u1', 'item1'), `${BASE}/UserItems/item1/UserData?userId=u1`)

  const fetchFn = fakeFetch({
    'POST /Sessions/Playing': [204, null],
    'POST /Sessions/Playing/Progress': [204, null],
    'POST /Sessions/Playing/Stopped': [204, null],
    'GET /UserItems/item1/UserData': [200, { PlaybackPositionTicks: 10000000, Played: false }],
    'POST /UserItems/item1/UserData': [200, { PlaybackPositionTicks: 0, Played: false }],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1', fetchFn })

  const s1 = await client.reportStart({ ItemId: 'item1', PositionTicks: 0 })
  assert.equal(s1, 204)
  const s2 = await client.reportProgress({ ItemId: 'item1', PositionTicks: 50000000 })
  assert.equal(s2, 204)
  const s3 = await client.reportStopped({ ItemId: 'item1', PositionTicks: 100000000 })
  assert.equal(s3, 204)

  const uData = await client.userData('u1', 'item1')
  assert.equal(uData.PlaybackPositionTicks, 10000000)

  const upd = await client.updateUserData('u1', 'item1', { PlaybackPositionTicks: 0 })
  assert.equal(upd.PlaybackPositionTicks, 0)
})

test('favorite and played URLs and client methods', async () => {
  assert.equal(urls.userFavorite(BASE, 'u1', 'item1'), `${BASE}/UserFavoriteItems/item1?userId=u1`)
  assert.equal(urls.userPlayed(BASE, 'u1', 'item1'), `${BASE}/UserPlayedItems/item1?userId=u1`)
  assert.equal(
    urls.favorites(BASE, 'u1', 50),
    `${BASE}/Items?userId=u1&isFavorite=true&recursive=true&includeItemTypes=Movie%2CSeries&limit=50&fields=PrimaryImageAspectRatio`
  )

  const fetchFn = fakeFetch({
    'POST /UserFavoriteItems/item1': [200, { Id: 'item1', IsFavorite: true }],
    'DELETE /UserFavoriteItems/item1': [200, { Id: 'item1', IsFavorite: false }],
    'POST /UserPlayedItems/item1': [200, { Id: 'item1', Played: true }],
    'DELETE /UserPlayedItems/item1': [200, { Id: 'item1', Played: false }],
    'GET /Items': [200, {
      Items: [{
        Id: 'fav1',
        Name: 'Fav Item',
        Type: 'Movie',
        UserData: { IsFavorite: true },
      }],
    }],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1', fetchFn })

  const favOn = await client.setFavorite('u1', 'item1', true)
  assert.equal(favOn.IsFavorite, true)
  const favOff = await client.setFavorite('u1', 'item1', false)
  assert.equal(favOff.IsFavorite, false)

  const playedOn = await client.setPlayed('u1', 'item1', true)
  assert.equal(playedOn.Played, true)
  const playedOff = await client.setPlayed('u1', 'item1', false)
  assert.equal(playedOff.Played, false)

  const favList = await client.favorites('u1')
  assert.equal(favList.length, 1)
  assert.equal(favList[0].id, 'fav1')
  assert.equal(favList[0].isFavorite, true)
})

test('similar URLs and client methods', async () => {
  assert.equal(
    urls.similar(BASE, 'item1', 'u1', 12),
    `${BASE}/Items/item1/Similar?userId=u1&limit=12&fields=PrimaryImageAspectRatio`
  )

  const fetchFn = fakeFetch({
    'GET /Items/item1/Similar': [200, {
      Items: [{
        Id: 'sim1',
        Name: 'Similar Item',
        Type: 'Movie',
      }],
    }],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1', fetchFn })
  const res = await client.similar('item1', 'u1', 12)
  assert.equal(res.length, 1)
  assert.equal(res[0].id, 'sim1')
  assert.equal(res[0].name, 'Similar Item')
})

test('subtitles URLs and client method', async () => {
  assert.equal(
    urls.subtitles(BASE, 'item1', 'ms1', 2, 'vtt'),
    `${BASE}/Videos/item1/ms1/Subtitles/2/Stream.vtt`
  )

  const fetchFn = fakeFetch({
    'GET /Videos/item1/ms1/Subtitles/2/Stream.vtt': [200, 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello'],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1', fetchFn })
  const vtt = await client.subtitles('item1', 'ms1', 2, 'vtt')
  assert.equal(vtt, 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello')
})

test('segments URLs and client method', async () => {
  assert.equal(
    urls.segments(BASE, 'item1'),
    `${BASE}/MediaSegments/item1?includeSegmentTypes=Intro%2CRecap`
  )

  const fetchFn = fakeFetch({
    'GET /MediaSegments/item1': [200, {
      Items: [{
        Id: 'seg1',
        ItemId: 'item1',
        Type: 'Intro',
        StartTicks: 100000000,
        EndTicks: 300000000,
      }],
    }],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1', fetchFn })
  const segs = await client.segments('item1')
  assert.equal(segs.length, 1)
  assert.equal(segs[0].Id, 'seg1')
  assert.equal(segs[0].Type, 'Intro')
})

test('search URL and client method', async () => {
  const u = urls.search(BASE, 'user1', 'toy', 40)
  assert.match(u, /^http:\/\/jellyfin\.test:8096\/Items\?/)
  for (const part of [
    'userId=user1',
    'searchTerm=toy',
    'recursive=true',
    'includeItemTypes=Movie%2CSeries%2CEpisode',
    'limit=40',
    'fields=PrimaryImageAspectRatio%2CSeriesName',
  ]) {
    assert.ok(u.includes(part), `${part} missing in ${u}`)
  }

  const fetchFn = fakeFetch({
    'GET /Items': [200, {
      Items: [
        { Id: 'm1', Name: 'Toy Story', Type: 'Movie', ProductionYear: 1995 },
      ],
      TotalRecordCount: 1,
    }],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1', fetchFn })
  const results = await client.search('user1', 'toy')
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'm1')
  assert.equal(results[0].name, 'Toy Story')
  assert.equal(results[0].type, 'Movie')
})

test('mapPerson maps birthDate, birthPlace, and truncates biography to 300 chars', () => {
  const longBio = 'A'.repeat(350)
  const mapped = mapPerson({
    Id: 'p1',
    Name: 'Jesse Eisenberg',
    PremiereDate: '1983-10-05T00:00:00.0000000Z',
    ProductionLocations: ['New York City, New York, USA'],
    Overview: longBio,
  })
  assert.equal(mapped.id, 'p1')
  assert.equal(mapped.name, 'Jesse Eisenberg')
  assert.equal(mapped.birthDate, '1983-10-05')
  assert.equal(mapped.birthPlace, 'New York City, New York, USA')
  assert.equal(mapped.biography.length, 300)
  assert.equal(mapped.biography, 'A'.repeat(300))

  const empty = mapPerson({ Id: 'p2', Name: 'Actor Without Data' })
  assert.equal(empty.id, 'p2')
  assert.equal(empty.name, 'Actor Without Data')
  assert.equal(empty.birthDate, null)
  assert.equal(empty.birthPlace, null)
  assert.equal(empty.biography, null)
  assert.equal(mapPerson(null), null)
})

test('mapDetails maps people list with id, name, role, type, imageTag', () => {
  const details = mapDetails({
    Id: 'm1',
    Name: 'The Social Network',
    Type: 'Movie',
    People: [
      { Id: 'act1', Name: 'Jesse Eisenberg', Role: 'Mark Zuckerberg', Type: 'Actor', PrimaryImageTag: 'tag1' },
      { Id: 'dir1', Name: 'David Fincher', Role: 'Director', Type: 'Director', PrimaryImageTag: null },
    ],
  })
  assert.ok(Array.isArray(details.people))
  assert.equal(details.people.length, 2)
  assert.deepEqual(details.people[0], {
    id: 'act1',
    name: 'Jesse Eisenberg',
    role: 'Mark Zuckerberg',
    type: 'Actor',
    imageTag: 'tag1',
  })
  assert.deepEqual(details.people[1], {
    id: 'dir1',
    name: 'David Fincher',
    role: 'Director',
    type: 'Director',
    imageTag: null,
  })
})

test('person and itemsOfPerson URLs and client methods', async () => {
  assert.equal(
    urls.person(BASE, 'user1', 'Jesse Eisenberg'),
    `${BASE}/Persons/Jesse%20Eisenberg?userId=user1`
  )
  assert.equal(
    urls.itemsOfPerson(BASE, 'user1', 'act1', 10),
    `${BASE}/Items?userId=user1&personIds=act1&recursive=true&includeItemTypes=Movie%2CSeries&limit=10&fields=PrimaryImageAspectRatio`
  )

  const fetchFn = fakeFetch({
    'GET /Persons/Jesse%20Eisenberg': [200, {
      Id: 'act1',
      Name: 'Jesse Eisenberg',
      PremiereDate: '1983-10-05T00:00:00.0000000Z',
      ProductionLocations: ['New York City, New York, USA'],
      Overview: 'American actor.',
    }],
    'GET /Persons/Unknown': [404, {}],
    'GET /Items': [200, {
      Items: [
        { Id: 'm1', Name: 'The Social Network', Type: 'Movie' },
        { Id: 'm2', Name: 'Now You See Me', Type: 'Movie' },
      ],
      TotalRecordCount: 2,
    }],
  })
  const client = createClient({ server: BASE, deviceId: 'dev1', token: 'tok1', fetchFn })

  const person = await client.person('user1', 'Jesse Eisenberg')
  assert.equal(person.id, 'act1')
  assert.equal(person.name, 'Jesse Eisenberg')
  assert.equal(person.birthDate, '1983-10-05')
  assert.equal(person.birthPlace, 'New York City, New York, USA')
  assert.equal(person.biography, 'American actor.')

  const unknown = await client.person('user1', 'Unknown')
  assert.equal(unknown, null)

  const allItems = await client.itemsOfPerson('user1', 'act1')
  assert.equal(allItems.length, 2)
  assert.equal(allItems[0].id, 'm1')
  assert.equal(allItems[1].id, 'm2')

  const excluded = await client.itemsOfPerson('user1', 'act1', { exclude: 'm1' })
  assert.equal(excluded.length, 1)
  assert.equal(excluded[0].id, 'm2')
})





