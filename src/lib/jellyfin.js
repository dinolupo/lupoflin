// Jellyfin REST client. Pure JavaScript: no Lightning, no DOM, no storage.
// Every endpoint here is checked against ref/jellyfin-openapi.json (server 12.3.0): see docs/ref/jellyfin-api.md.
// Tested by test/jellyfin.test.mjs (L0) and scripts/api-smoke.mjs (L1).

export const CLIENT = { name: 'LupoFlin', version: '0.1.1' }

export class JellyfinError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export function normalizeServerUrl(input) {
  let url = String(input || '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url
  return url.replace(/\/+$/, '')
}

export function authHeader({ deviceId, device = 'LG webOS TV', token } = {}) {
  const clean = value => String(value).replace(/"/g, '')
  let header =
    `MediaBrowser Client="${CLIENT.name}", Device="${clean(device)}", ` +
    `DeviceId="${clean(deviceId)}", Version="${CLIENT.version}"`
  if (token) header += `, Token="${clean(token)}"`
  return header
}

export function query(params = {}) {
  const parts = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    const text = Array.isArray(value) ? value.join(',') : String(value)
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`)
  }
  return parts.length ? '?' + parts.join('&') : ''
}

// Item types shown for each library type; unknown types list their direct children.
const TYPES_BY_COLLECTION = {
  movies: ['Movie'],
  tvshows: ['Series'],
  boxsets: ['BoxSet'],
  music: ['MusicAlbum'],
  musicvideos: ['MusicVideo'],
  homevideos: ['Video'],
}

export const urls = {
  publicInfo: base => `${base}/System/Info/Public`,
  publicUsers: base => `${base}/Users/Public`,
  me: base => `${base}/Users/Me`,
  authenticateByName: base => `${base}/Users/AuthenticateByName`,
  logout: base => `${base}/Sessions/Logout`,
  quickConnectEnabled: base => `${base}/QuickConnect/Enabled`,
  quickConnectInitiate: base => `${base}/QuickConnect/Initiate`,
  quickConnectConnect: (base, secret) => `${base}/QuickConnect/Connect${query({ secret })}`,
  authenticateWithQuickConnect: base => `${base}/Users/AuthenticateWithQuickConnect`,
  views: (base, userId) => `${base}/UserViews${query({ userId })}`,
  latest: (base, userId, parentId, limit = 20) =>
    `${base}/Items/Latest${query({ userId, parentId, limit, fields: 'PrimaryImageAspectRatio,Overview' })}`,
  items: (base, userId, view, { startIndex = 0, limit = 50, genreId, sortBy = 'SortName', sortOrder = 'Ascending', filters } = {}) => {
    const types = TYPES_BY_COLLECTION[view.collectionType]
    return `${base}/Items${query({
      userId,
      parentId: view.id,
      genreIds: genreId,
      includeItemTypes: types,
      recursive: types ? true : undefined,
      sortBy,
      sortOrder: sortBy === 'Random' ? undefined : sortOrder,
      filters,
      startIndex,
      limit,
      fields: 'PrimaryImageAspectRatio',
    })}`
  },
  genres: (base, userId, parentId) =>
    `${base}/Genres${query({ userId, parentId, sortBy: 'SortName' })}`,
  // Ask the server for the size we draw: smaller textures, less GPU memory on the TV.
  image: (base, itemId, { type = 'Primary', tag, maxWidth, maxHeight, quality = 80 } = {}) =>
    `${base}/Items/${itemId}/Images/${type}${query({ tag, maxWidth, maxHeight, quality })}`,
  userImage: (base, userId, tag) => `${base}/UserImage${query({ userId, tag })}`,
  item: (base, userId, itemId) => `${base}/Items/${itemId}${query({ userId })}`,
  seasons: (base, userId, seriesId) =>
    `${base}/Shows/${seriesId}/Seasons${query({ userId, fields: 'PrimaryImageAspectRatio' })}`,
  episodes: (base, userId, seriesId, seasonId) =>
    `${base}/Shows/${seriesId}/Episodes${query({ userId, seasonId, fields: 'PrimaryImageAspectRatio' })}`,
  resume: (base, userId) =>
    `${base}/UserItems/Resume${query({
      userId,
      limit: 20,
      mediaTypes: 'Video',
      fields: 'PrimaryImageAspectRatio',
    })}`,
  nextUp: (base, userId, limit = 20) =>
    `${base}/Shows/NextUp${query({
      userId,
      limit,
      fields: 'PrimaryImageAspectRatio,SeriesName',
    })}`,
  avatars: base => `${base}/GetAvatar/Avatars`,
  avatarImage: (base, avatarId) => `${base}/GetAvatar/Image/${avatarId}`,
  setAvatar: base => `${base}/GetAvatar/SetAvatar`,
  playbackInfo: (base, userId, itemId) => `${base}/Items/${itemId}/PlaybackInfo${query({ userId })}`,
  stream: (base, itemId, { mediaSourceId, playSessionId, deviceId, apiKey } = {}) =>
    `${base}/Videos/${itemId}/stream${query({
      static: true,
      mediaSourceId,
      playSessionId,
      deviceId,
      ApiKey: apiKey,
    })}`,
  sessionPlaying: base => `${base}/Sessions/Playing`,
  sessionProgress: base => `${base}/Sessions/Playing/Progress`,
  sessionStopped: base => `${base}/Sessions/Playing/Stopped`,
  userData: (base, userId, itemId) => `${base}/UserItems/${itemId}/UserData${query({ userId })}`,
  userFavorite: (base, userId, itemId) => `${base}/UserFavoriteItems/${itemId}${query({ userId })}`,
  userPlayed: (base, userId, itemId) => `${base}/UserPlayedItems/${itemId}${query({ userId })}`,
  favorites: (base, userId, limit = 50) =>
    `${base}/Items${query({
      userId,
      isFavorite: true,
      recursive: true,
      includeItemTypes: 'Movie,Series',
      limit,
      fields: 'PrimaryImageAspectRatio',
    })}`,
  similar: (base, itemId, userId, limit = 12) =>
    `${base}/Items/${itemId}/Similar${query({
      userId,
      limit,
      fields: 'PrimaryImageAspectRatio',
    })}`,
  subtitles: (base, itemId, mediaSourceId, index, format = 'vtt') =>
    `${base}/Videos/${itemId}/${mediaSourceId}/Subtitles/${index}/Stream.${format}`,
  segments: (base, itemId) =>
    `${base}/MediaSegments/${itemId}${query({ includeSegmentTypes: 'Intro,Recap' })}`,
  search: (base, userId, searchTerm, limit = 40) =>
    `${base}/Items${query({
      userId,
      searchTerm,
      recursive: true,
      includeItemTypes: 'Movie,Series,Episode',
      limit,
      fields: 'PrimaryImageAspectRatio,SeriesName',
    })}`,
  person: (base, userId, name) => `${base}/Persons/${encodeURIComponent(name)}${query({ userId })}`,
  itemsOfPerson: (base, userId, personId, limit = 10) =>
    `${base}/Items${query({
      userId,
      personIds: personId,
      recursive: true,
      includeItemTypes: 'Movie,Series',
      limit,
      fields: 'PrimaryImageAspectRatio',
    })}`,
}

export function mapUser(raw) {
  return {
    id: raw.Id,
    name: raw.Name,
    hasPassword: !!raw.HasPassword,
    imageTag: raw.PrimaryImageTag || null,
  }
}

export function mapAvatar(raw, base) {
  const url = raw.Url
    ? (raw.Url.startsWith('http') ? raw.Url : `${base}${raw.Url.startsWith('/') ? '' : '/'}${raw.Url}`)
    : `${base}/GetAvatar/Image/${raw.Id}`
  return {
    id: raw.Id,
    name: raw.Name || '',
    category: raw.Category || '',
    url,
  }
}

export function mapGenre(raw) {
  return {
    id: raw.Id,
    name: raw.Name || '',
  }
}

export function mapPerson(raw) {
  if (!raw) return null
  let birthDate = null
  if (raw.PremiereDate) {
    birthDate = raw.PremiereDate.includes('T') ? raw.PremiereDate.split('T')[0] : raw.PremiereDate
  }
  let birthPlace = null
  if (raw.ProductionLocations && raw.ProductionLocations.length > 0) {
    birthPlace = raw.ProductionLocations[0]
  }
  let biography = null
  if (raw.Overview) {
    biography = raw.Overview.length > 300 ? raw.Overview.slice(0, 300) : raw.Overview
  }
  return {
    id: raw.Id,
    name: raw.Name || '',
    birthDate,
    birthPlace,
    biography,
  }
}

// The library image is the library's own Primary image. Not ParentId: all libraries share the same parent
// (the root folder), so every tile showed the same picture (regression of step 2.1, fixed 24/10/2026).
export function mapView(raw) {
  return {
    id: raw.Id,
    name: raw.Name,
    collectionType: raw.CollectionType || null,
    imageTag: (raw.ImageTags && raw.ImageTags.Primary) || null,
  }
}

export function mapItem(raw) {
  let backdrop = null
  if (raw.BackdropImageTags && raw.BackdropImageTags.length > 0) {
    backdrop = { itemId: raw.Id, tag: raw.BackdropImageTags[0] }
  } else if (raw.ParentBackdropItemId && raw.ParentBackdropImageTags && raw.ParentBackdropImageTags.length > 0) {
    backdrop = { itemId: raw.ParentBackdropItemId, tag: raw.ParentBackdropImageTags[0] }
  }
  const logoTag = (raw.ImageTags && raw.ImageTags.Logo) || null

  let seriesBackdrop = null
  if (raw.ParentBackdropItemId && raw.ParentBackdropImageTags && raw.ParentBackdropImageTags.length > 0) {
    seriesBackdrop = { itemId: raw.ParentBackdropItemId, tag: raw.ParentBackdropImageTags[0] }
  }

  return {
    id: raw.Id,
    name: raw.Name,
    type: raw.Type,
    year: raw.ProductionYear || null,
    imageTag: (raw.ImageTags && raw.ImageTags.Primary) || null,
    aspect: raw.PrimaryImageAspectRatio || null,
    overview: raw.Overview || '',
    backdrop,
    logoTag,
    seriesName: raw.SeriesName || null,
    seasonNumber: typeof raw.ParentIndexNumber === 'number' ? raw.ParentIndexNumber : null,
    episodeNumber: typeof raw.IndexNumber === 'number' ? raw.IndexNumber : null,
    seriesBackdrop,
    played: raw.UserData ? !!raw.UserData.Played : false,
    isFavorite: raw.UserData ? !!raw.UserData.IsFavorite : false,
  }
}

export function formatCardLabel(item) {
  if (item && item.type === 'Episode' && item.seriesName && typeof item.seasonNumber === 'number' && typeof item.episodeNumber === 'number') {
    return `${item.seriesName} · S${item.seasonNumber}:E${item.episodeNumber}`
  }
  return (item && item.name) || ''
}

export function mapDetails(raw) {
  let backdrop = null
  if (raw.BackdropImageTags && raw.BackdropImageTags.length > 0) {
    backdrop = { itemId: raw.Id, tag: raw.BackdropImageTags[0] }
  } else if (raw.ParentBackdropItemId && raw.ParentBackdropImageTags && raw.ParentBackdropImageTags.length > 0) {
    backdrop = { itemId: raw.ParentBackdropItemId, tag: raw.ParentBackdropImageTags[0] }
  }

  let logo = null
  if (raw.ImageTags && raw.ImageTags.Logo) {
    logo = { itemId: raw.Id, tag: raw.ImageTags.Logo }
  } else if (raw.ParentLogoItemId && raw.ParentLogoImageTag) {
    logo = { itemId: raw.ParentLogoItemId, tag: raw.ParentLogoImageTag }
  }

  const minutes =
    typeof raw.RunTimeTicks === 'number' && raw.RunTimeTicks > 0
      ? Math.round(raw.RunTimeTicks / 600000000)
      : null

  let name = raw.Name || ''
  if (typeof raw.ParentIndexNumber === 'number' && typeof raw.IndexNumber === 'number') {
    name = `S${raw.ParentIndexNumber}:E${raw.IndexNumber} ${name}`
  }

  const res = {
    id: raw.Id,
    name,
    type: raw.Type,
    year: raw.ProductionYear || null,
    overview: raw.Overview || '',
    minutes,
    genres: raw.Genres || [],
    rating: raw.OfficialRating || null,
    communityRating: typeof raw.CommunityRating === 'number' ? Math.round(raw.CommunityRating * 10) / 10 : null,
    backdrop,
    logo,
    seriesId: raw.SeriesId || null,
    seriesName: raw.SeriesName || null,
    seasonId: raw.SeasonId || raw.ParentId || null,
    seasonNumber: typeof raw.ParentIndexNumber === 'number' ? raw.ParentIndexNumber : null,
    episodeNumber: typeof raw.IndexNumber === 'number' ? raw.IndexNumber : null,
    episodeTitle: raw.Name || '',
    runTimeTicks: typeof raw.RunTimeTicks === 'number' ? raw.RunTimeTicks : null,
    playbackPositionTicks:
      raw.UserData && typeof raw.UserData.PlaybackPositionTicks === 'number'
        ? raw.UserData.PlaybackPositionTicks
        : 0,
    isFavorite: raw.UserData ? !!raw.UserData.IsFavorite : false,
    isPlayed: raw.UserData ? !!raw.UserData.Played : false,
  }
  if (raw.People) {
    res.people = raw.People.map(p => ({
      id: p.Id,
      name: p.Name,
      role: p.Role || '',
      type: p.Type || '',
      imageTag: p.PrimaryImageTag || null,
    }))
  }
  return res
}

export function mapAuth(raw) {
  if (!raw || !raw.AccessToken || !raw.User) throw new JellyfinError('Invalid authentication response', 0)
  return { token: raw.AccessToken, userId: raw.User.Id, userName: raw.User.Name, imageTag: raw.User.PrimaryImageTag || null }
}

export function mapMediaSource(raw) {
  if (!raw) return null
  return {
    id: raw.Id,
    container: raw.Container || '',
    directPlay: !!raw.SupportsDirectPlay,
    transcodingUrl: raw.TranscodingUrl || null,
    defaultAudioStreamIndex: typeof raw.DefaultAudioStreamIndex === 'number' ? raw.DefaultAudioStreamIndex : null,
    defaultSubtitleStreamIndex: typeof raw.DefaultSubtitleStreamIndex === 'number' ? raw.DefaultSubtitleStreamIndex : null,
    streams: (raw.MediaStreams || []).map(s => ({
      index: s.Index,
      type: s.Type,
      codec: s.Codec || '',
      language: s.Language || '',
      displayTitle: s.DisplayTitle || '',
      isDefault: !!s.IsDefault,
      isForced: !!s.IsForced,
      isExternal: !!s.IsExternal,
      isTextSubtitleStream: !!s.IsTextSubtitleStream,
      deliveryUrl: s.DeliveryUrl || null,
    })),
  }
}

// fetchFn is injected so tests can replace the network.
export function createClient({ server, deviceId, token = null, fetchFn = globalThis.fetch }) {
  const base = normalizeServerUrl(server)
  const state = { token }

  async function request(url, { method = 'GET', body, token } = {}) {
    const headers = { Authorization: authHeader({ deviceId, token: token || state.token }) }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let res
    try {
      res = await fetchFn(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    } catch (e) {
      throw new JellyfinError(`Network error: ${e.message}`, 0)
    }
    if (!res.ok) throw new JellyfinError(`${method} ${url.replace(base, '')} -> HTTP ${res.status}`, res.status)
    if (res.status === 204) return null
    return res.json()
  }

  async function login(raw) {
    const auth = mapAuth(raw)
    state.token = auth.token
    return auth
  }

  return {
    base,
    get token() {
      return state.token
    },
    publicInfo: () => request(urls.publicInfo(base)),
    publicUsers: async () => (await request(urls.publicUsers(base))).map(mapUser),
    me: () => request(urls.me(base)),
    logout: token => request(urls.logout(base), { method: 'POST', token }),
    authenticateByName: async (username, password) =>
      login(await request(urls.authenticateByName(base), { method: 'POST', body: { Username: username, Pw: password || '' } })),
    quickConnectEnabled: () => request(urls.quickConnectEnabled(base)),
    quickConnectInitiate: async () => {
      const raw = await request(urls.quickConnectInitiate(base), { method: 'POST' })
      return { code: raw.Code, secret: raw.Secret }
    },
    quickConnectAuthorized: async secret => !!(await request(urls.quickConnectConnect(base, secret))).Authenticated,
    authenticateWithQuickConnect: async secret =>
      login(await request(urls.authenticateWithQuickConnect(base), { method: 'POST', body: { Secret: secret } })),
    views: async userId => ((await request(urls.views(base, userId))).Items || []).map(mapView),
    latest: async (userId, parentId, limit) => (await request(urls.latest(base, userId, parentId, limit))).map(mapItem),
    items: async (userId, view, page) => {
      const raw = await request(urls.items(base, userId, view, page))
      return { items: (raw.Items || []).map(mapItem), total: raw.TotalRecordCount || 0 }
    },
    genres: async (userId, parentId) =>
      ((await request(urls.genres(base, userId, parentId))).Items || []).map(mapGenre),
    item: async (userId, itemId) => mapDetails(await request(urls.item(base, userId, itemId))),
    seasons: async (userId, seriesId) => ((await request(urls.seasons(base, userId, seriesId))).Items || []).map(mapItem),
    episodes: async (userId, seriesId, seasonId) =>
      ((await request(urls.episodes(base, userId, seriesId, seasonId))).Items || []).map(raw => ({
        ...mapItem(raw),
        index: typeof raw.IndexNumber === 'number' ? raw.IndexNumber : null,
        seasonId: raw.SeasonId || null,
        playbackPositionTicks:
          raw.UserData && typeof raw.UserData.PlaybackPositionTicks === 'number'
            ? raw.UserData.PlaybackPositionTicks
            : null,
        runTimeTicks: typeof raw.RunTimeTicks === 'number' ? raw.RunTimeTicks : null,
      })),
    resume: async userId =>
      ((await request(urls.resume(base, userId))).Items || []).map(raw => ({
        ...mapItem(raw),
        progress:
          raw.UserData && typeof raw.UserData.PlayedPercentage === 'number'
            ? raw.UserData.PlayedPercentage / 100
            : null,
      })),
    nextUp: async (userId, limit = 20) =>
      ((await request(urls.nextUp(base, userId, limit))).Items || []).map(mapItem),
    avatars: async () => {
      try {
        const raw = await request(urls.avatars(base))
        if (!Array.isArray(raw)) return []
        return raw.map(item => mapAvatar(item, base))
      } catch (err) {
        if (err.status === 404) return null
        throw err
      }
    },
    setAvatar: async avatarId =>
      request(urls.setAvatar(base), {
        method: 'POST',
        body: { AvatarId: avatarId },
      }),
    playbackInfo: async (userId, itemId, { profile, startTicks, audioIndex, subtitleIndex, mediaSourceId, directPlay = true } = {}) => {
      const body = {
        UserId: userId,
        DeviceProfile: profile,
        StartTimeTicks: typeof startTicks === 'number' ? startTicks : 0,
        AudioStreamIndex: typeof audioIndex === 'number' ? audioIndex : undefined,
        SubtitleStreamIndex: typeof subtitleIndex === 'number' ? subtitleIndex : undefined,
        // Without MediaSourceId the server ignores the two stream indexes (checked 25/10/2026: the transcoding URL kept the default audio).
        MediaSourceId: mediaSourceId || undefined,
        // A direct play stream is the raw file: the server cannot pick another audio track in it.
        EnableDirectPlay: directPlay,
        EnableDirectStream: directPlay,
        EnableTranscoding: true,
        AutoOpenLiveStream: true,
      }
      const data = await request(urls.playbackInfo(base, userId, itemId), { method: 'POST', body })
      return {
        playSessionId: data.PlaySessionId,
        source: mapMediaSource(data.MediaSources && data.MediaSources[0]),
      }
    },
    streamUrl: (itemId, source, playSessionId) => {
      if (source && source.directPlay) {
        return urls.stream(base, itemId, {
          mediaSourceId: source.id,
          playSessionId,
          deviceId,
          apiKey: state.token,
        })
      }
      if (source && source.transcodingUrl) {
        return source.transcodingUrl.startsWith('http') ? source.transcodingUrl : `${base}${source.transcodingUrl}`
      }
      return urls.stream(base, itemId, {
        mediaSourceId: source ? source.id : itemId,
        playSessionId,
        deviceId,
        apiKey: state.token,
      })
    },
    imageUrl: (itemId, options) => urls.image(base, itemId, options),
    userImageUrl: (userId, tag) => urls.userImage(base, userId, tag),
    reportStart: async info => {
      try {
        const res = await fetchFn(urls.sessionPlaying(base), {
          method: 'POST',
          headers: {
            Authorization: authHeader({ deviceId, token: state.token }),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(info),
        })
        return res.status
      } catch (e) {
        return 0
      }
    },
    reportProgress: async info => {
      try {
        const res = await fetchFn(urls.sessionProgress(base), {
          method: 'POST',
          headers: {
            Authorization: authHeader({ deviceId, token: state.token }),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(info),
        })
        return res.status
      } catch (e) {
        return 0
      }
    },
    reportStopped: async info => {
      try {
        const res = await fetchFn(urls.sessionStopped(base), {
          method: 'POST',
          headers: {
            Authorization: authHeader({ deviceId, token: state.token }),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(info),
        })
        return res.status
      } catch (e) {
        return 0
      }
    },
    userData: (userId, itemId) => request(urls.userData(base, userId, itemId)),
    updateUserData: (userId, itemId, data) =>
      request(urls.userData(base, userId, itemId), { method: 'POST', body: data }),
    setFavorite: async (userId, itemId, favorite) =>
      request(urls.userFavorite(base, userId, itemId), { method: favorite ? 'POST' : 'DELETE' }),
    setPlayed: async (userId, itemId, played) =>
      request(urls.userPlayed(base, userId, itemId), { method: played ? 'POST' : 'DELETE' }),
    favorites: async (userId, limit = 50) =>
      ((await request(urls.favorites(base, userId, limit))).Items || []).map(mapItem),
    similar: async (itemId, userId, limit = 12) =>
      ((await request(urls.similar(base, itemId, userId, limit))).Items || []).map(mapItem),
    subtitles: async (itemId, mediaSourceId, index, format = 'vtt') => {
      const url = urls.subtitles(base, itemId, mediaSourceId, index, format)
      const res = await fetchFn(url, {
        method: 'GET',
        headers: { Authorization: authHeader({ deviceId, token: state.token }) },
      })
      if (!res.ok) throw new JellyfinError(`Failed to fetch subtitles: ${res.status}`, res.status)
      return res.text()
    },
    segments: async itemId => {
      try {
        const res = await request(urls.segments(base, itemId))
        return (res && res.Items) || []
      } catch (e) {
        return []
      }
    },
    search: async (userId, searchTerm, limit = 40) =>
      ((await request(urls.search(base, userId, searchTerm, limit))).Items || []).map(mapItem),
    person: async (userId, name) => {
      try {
        const raw = await request(urls.person(base, userId, name))
        return mapPerson(raw)
      } catch (e) {
        if (e.status === 404) return null
        throw e
      }
    },
    itemsOfPerson: async (userId, personId, { exclude } = {}) => {
      const raw = await request(urls.itemsOfPerson(base, userId, personId))
      const items = ((raw && raw.Items) || []).map(mapItem)
      if (exclude) {
        return items.filter(item => item.id !== exclude)
      }
      return items
    },
  }
}
