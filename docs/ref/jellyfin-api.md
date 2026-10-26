# Jellyfin API used by LupoFlin

Server: Jellyfin **12.3.0**. The spec of *this* server is `ref/jellyfin-openapi.json`: it wins over memory,
blog posts and older clients. Older endpoints such as `/Users/{userId}/Items` or `/Users/{userId}/Views`
**do not exist** on 12.x (checked 24/10/2026): use `/Items?userId=` and `/UserViews?userId=`.

## Authentication header
Every request sends `Authorization: MediaBrowser Client="LupoFlin", Device="LG webOS TV", DeviceId="<id>",
Version="0.1.0"` plus `, Token="<token>"` once logged in (security scheme `CustomAuthentication` = header
`Authorization`). Built by `authHeader()` in `src/lib/jellyfin.js`. Do not use `X-Emby-Token` / `X-Emby-Authorization`.

## Endpoints in use (all in `src/lib/jellyfin.js`)
| Method + path | Params we send | Response we read | Code name |
|---|---|---|---|
| GET `/System/Info/Public` | - | `Version`, `ServerName` | `publicInfo` |
| GET `/Users/Public` | - | array of `UserDto`: `Id`, `Name`, `HasPassword`, `PrimaryImageTag` | `publicUsers` |
| GET `/Users/Me` | - | `UserDto` (401 if the token is invalid) | `me` |
| POST `/Users/AuthenticateByName` | body `{ Username, Pw }` | `AccessToken`, `User.Id`, `User.Name`; 401 bad login | `authenticateByName` |
| GET `/QuickConnect/Enabled` | - | `true`/`false` | `quickConnectEnabled` |
| POST `/QuickConnect/Initiate` | - | `Code` (6 digits), `Secret` | `quickConnectInitiate` |
| GET `/QuickConnect/Connect` | `secret` | `Authenticated` | `quickConnectAuthorized` |
| POST `/Users/AuthenticateWithQuickConnect` | body `{ Secret }` | as AuthenticateByName | `authenticateWithQuickConnect` |
| GET `/UserViews` | `userId` | `Items[]`: `Id`, `Name`, `CollectionType`, `ImageTags.Primary` | `views` |
| GET `/Items/Latest` | `userId, parentId, limit, fields` | **array** (not `{Items}`) of `BaseItemDto` | `latest` |
| GET `/Items` | `userId, parentId, includeItemTypes, recursive, sortBy, sortOrder, startIndex, limit, fields` | `Items[]`, `TotalRecordCount` | `items` |
| GET `/Genres` | `userId, parentId, sortBy` | `Items[]`: `Id`, `Name` | `genres` |
| GET `/Items/{itemId}/Images/{imageType}` | `tag, maxWidth, maxHeight, quality` | JPEG | `imageUrl` |
| GET `/UserImage` | `userId, tag` | image | `userImageUrl` |
| POST `/Items/{itemId}/PlaybackInfo` | `userId`, body `PlaybackInfoDto` | `PlaySessionId`, `MediaSources[]` | `playbackInfo` |
| GET `/Videos/{itemId}/stream` | `static, mediaSourceId, playSessionId, deviceId, ApiKey` | stream (206 with `Range`) | `streamUrl` |
| POST `/Sessions/Playing` | body `PlaybackStartInfo` | 204 | `reportStart` |
| POST `/Sessions/Playing/Progress` | body `PlaybackProgressInfo` | 204 | `reportProgress` |
| POST `/Sessions/Playing/Stopped` | body `PlaybackStopInfo` | 204 | `reportStopped` |
| GET `/UserItems/{itemId}/UserData` | `userId` | `UserItemDataDto` | `userData` |
| POST `/UserItems/{itemId}/UserData` | `userId`, body `UpdateUserItemDataDto` | `UserItemDataDto` | `updateUserData` |

`CollectionType` values: unknown, movies, tvshows, music, musicvideos, trailers, homevideos, boxsets, books,
photos, livetv, playlists, folders. Mapping to `includeItemTypes`: `TYPES_BY_COLLECTION` in `src/lib/jellyfin.js`.

## Real data on the home server (api-smoke, 24/10/2026)
Libraries: Bambini (movies, 30), Collections (boxsets, 24), Film (movies, 107), Serie TV (tvshows, 6).
`/Items/Latest` on boxsets returns 0 items: normal, not a bug. Poster at `maxHeight=330` is ~26 KB.

## Verified for Stage 2, not used yet (24/10/2026)
| Method + path | Params | Response |
|---|---|---|
| GET `/Items/{itemId}` | `itemId`* (path), `userId` | one `BaseItemDto` |
| GET `/Shows/{seriesId}/Seasons` | `seriesId`* (path), `userId`, `fields`, `enableImages`, `enableUserData` | `Items[]`, `TotalRecordCount` |
| GET `/Shows/{seriesId}/Episodes` | `seriesId`* (path), `userId`, `seasonId`, `season`, `startIndex`, `limit`, `fields`, `sortBy` | `Items[]`, `TotalRecordCount` |

`BaseItemDto` fields for the details page (all exist in the schema): `Overview`, `RunTimeTicks` (1 tick = 100 ns,
so minutes = ticks / 600000000), `Genres`, `OfficialRating`, `CommunityRating`, `Taglines`, `BackdropImageTags`,
`ParentBackdropImageTags` + `ParentBackdropItemId` (episodes/seasons borrow the series backdrop), `SeriesId`,
`IndexNumber`, `ParentIndexNumber`, `UserData`. Backdrop image: `/Items/{id}/Images/Backdrop?tag=...&maxWidth=1920`.

## Verified for Stage 5a (24/10/2026)
| Method + path | Params | Response |
|---|---|---|
| GET `/UserItems/Resume` | `userId`, `startIndex`, `limit`, `parentId`, `fields`, `mediaTypes`, `includeItemTypes`, `excludeItemTypes`, `enableUserData`, `enableImages` | `Items[]`, `TotalRecordCount` |

`UserItemDataDto` (in `BaseItemDto.UserData`): `PlayedPercentage` (0-100), `PlaybackPositionTicks`, `Played`.
On the home server it returns 9 items today (movies and episodes, e.g. 89 %, 5 %, 46 %).

## Verified for Stages 4, 6-10 (25/10/2026, spec + live server)
Use exactly these names. Anything not here: query the spec first (snippets below) and add the row.

| Method + path | Params (query unless noted) | Body / response | Stage |
|---|---|---|---|
| POST `/Sessions/Logout` | - (the token in the header is the session that ends) | 204 | 6 |
| POST `/Items/{itemId}/PlaybackInfo` | `userId` (other tuning params exist, send them in the body) | body `PlaybackInfoDto`: `UserId, MaxStreamingBitrate, StartTimeTicks, AudioStreamIndex, SubtitleStreamIndex, MediaSourceId, DeviceProfile, EnableDirectPlay, EnableDirectStream, EnableTranscoding, AutoOpenLiveStream`; response `PlaySessionId`, `MediaSources[]`, `ErrorCode` | 4 |
| GET `/Videos/{itemId}/stream` | `static=true, mediaSourceId, playSessionId, deviceId, ApiKey` | the file (206 with `Range`) | 4 |
| POST `/Sessions/Playing` | - | body `PlaybackStartInfo`: `ItemId, MediaSourceId, PlaySessionId, PositionTicks, IsPaused, CanSeek, PlayMethod, AudioStreamIndex, SubtitleStreamIndex` | 4 |
| POST `/Sessions/Playing/Progress` | - | body `PlaybackProgressInfo` (same fields as start) | 4 |
| POST `/Sessions/Playing/Stopped` | - | body `PlaybackStopInfo`: `ItemId, MediaSourceId, PlaySessionId, PositionTicks, Failed` | 4 |
| GET `/UserItems/{itemId}/UserData` | `userId` | `UserItemDataDto`: `PlaybackPositionTicks, Played, PlayCount, IsFavorite, LastPlayedDate` | 4 |
| POST `/UserItems/{itemId}/UserData` | `userId`, body `UpdateUserItemDataDto` | `UserItemDataDto` | 4 |
| GET `/Videos/{routeItemId}/{routeMediaSourceId}/Subtitles/{routeIndex}/Stream.{routeFormat}` | path only; `routeFormat` = `vtt` | WebVTT text | 9 |
| GET `/MediaSegments/{itemId}` | `includeSegmentTypes` (`Intro`, `Outro`, `Recap`, `Preview`, `Commercial`) | `Items[]`: `Type, StartTicks, EndTicks` | 9 |
| GET `/Videos/{itemId}/Trickplay/{width}/{index}.jpg` | `mediaSourceId` | JPEG tile sheet; layout from item field `Trickplay` (`TrickplayInfoDto`: `Width, Height, TileWidth, TileHeight, ThumbnailCount, Interval`) | 9 |
| GET `/Shows/NextUp` | `userId, limit, fields, seriesId, parentId, enableResumable, enableRewatching` | `Items[]` | 8 |
| POST / DELETE `/UserFavoriteItems/{itemId}` | `userId` | `UserItemDataDto` | 8 |
| POST / DELETE `/UserPlayedItems/{itemId}` | `userId` | `UserItemDataDto` | 8 |
| GET `/Items/{itemId}/Similar` | `userId, limit, fields` | `Items[]` | 8 |
| GET `/Genres` | `userId, parentId, includeItemTypes, sortBy, sortOrder, limit` | `Items[]`: `Id, Name` | 7 |
| GET `/Items` (more params) | `searchTerm, genreIds, isFavorite, isPlayed, filters, sortBy, sortOrder, nameStartsWith, years, includeItemTypes, recursive` | `Items[]`, `TotalRecordCount` | 7, 8, 10 |
| GET `/Users/Me` | - | `Configuration`: `AudioLanguagePreference, SubtitleLanguagePreference, SubtitleMode, PlayDefaultAudioTrack, EnableNextEpisodeAutoPlay, RememberAudioSelections, RememberSubtitleSelections` | 9 |
| GET `/Persons/{name}` | `name`* (path), `userId` | `BaseItemDto`: `Name, PremiereDate, ProductionLocations, Overview` | 14 |
| GET `/Items` (person) | `userId, personIds, recursive=true, includeItemTypes='Movie,Series', limit` | `Items[]`, `TotalRecordCount` | 14 |

Enums: `sortBy` (`ItemSortBy`): `SortName, DateCreated, PremiereDate, ProductionYear, CommunityRating, Runtime,
DatePlayed, Random, ...`; `filters` (`ItemFilter`): `IsUnplayed, IsPlayed, IsFavorite, IsResumable`; `fields`
(`ItemFields`): `Overview, Genres, MediaSources, MediaStreams, Chapters, Trickplay, People, Taglines, ...`;
image types: `Primary, Backdrop, Logo, Thumb, Banner, Art`.
Useful `BaseItemDto` fields: `SeriesName, SeriesId, ParentIndexNumber, IndexNumber, UserData` (`Played,
IsFavorite, PlaybackPositionTicks, PlayedPercentage, UnplayedItemCount`), `ImageTags.Logo`, `ParentLogoItemId`,
`ParentLogoImageTag`, `MediaSources[]` (`Id, Container, SupportsDirectPlay, SupportsDirectStream,
TranscodingUrl, MediaStreams[], DefaultAudioStreamIndex, DefaultSubtitleStreamIndex`), `MediaStreams[]`
(`Index, Type` Video/Audio/Subtitle, `Codec, Language, DisplayTitle, IsDefault, IsForced, IsExternal,
IsTextSubtitleStream, DeliveryUrl`). Ticks: 1 s = 10 000 000 ticks.

### Facts about the home server (25/10/2026)
- **`HasPassword` is not reliable**: `/Users/Public` says `true` for all three users, yet all three log in with
  an empty password (`Pw: ""`, checked). Always try the empty password, never decide from `HasPassword`.
- `/Videos/{id}/stream?static=true` answered 206 also with no token; send `ApiKey=<token>` anyway (a `<video>`
  cannot send headers; `ApiKey` and `api_key` both checked working).
- Files: 344 videos are mostly `mkv` + HEVC (+ AAC/AC3/EAC3), then `mkv` H.264 (+AC3/EAC3/DTS), 27 `avi` MPEG-4
  part 2 (needs transcoding), only 3 `mp4` H.264 AAC. Headless Chromium plays the `mp4` H.264 AAC ones
  (fixture `browserPlayableId`, checked: time advances); it has no HEVC and its `mkv` support is not guaranteed.
- 135/137 films have a `Logo` image. 15 genres. `/Shows/NextUp` returns 3.
- **0 media segments** (checked 30 episodes) and **0 trickplay** data: "Salta intro" and seek thumbnails show
  nothing until Dino enables them on the server. Code must handle "none" silently.

## Plugin GetAvatar (not in the OpenAPI spec; verified 25/10/2026)
Source read: `github.com/cedev-1/jellyfin-plugin-GetAvatar` commit `a84c94c` (manifest 1.7.0.0), file
`Jellyfin.Plugin.GetAvatar/Controllers/AvatarController.cs`; then called on the home server.
| Method + path | Auth | Body / response |
|---|---|---|
| GET `/GetAvatar/Avatars` | user token (401 without) | array of `{ Id, Name, FileName, DateAdded, Category, Url }`, `Url` = `/GetAvatar/Image/{Id}`. **404 = plugin not installed: hide the feature** |
| GET `/GetAvatar/Image/{avatarId}` | none (anonymous) | the image as uploaded: PNG 300x300, ~25-48 KB, **no resizing, no cache headers** |
| POST `/GetAvatar/SetAvatar` | user token | body `{ AvatarId }` (optional `UserId`: only admins may set another user's) → 200 `{ message }`. The plugin saves the picture as the user's **Jellyfin profile image**: afterwards `PrimaryImageTag` of `/Users/Public` and `/Users/Me` changes and `/UserImage` returns it |
| GET `/GetAvatar/Features` | user token | `{ gravatarEnabled }` (false here) |

Home server: **951 avatars** in 5 categories: Netflix 320, Prime Video 257, Disney Plus 210, Paramount Plus
138, Sonny Angels 26. Loading them all at once would be ~38 MB of PNG and 951 GPU textures: never do it.

## How to query the spec (copy, change the path; output stays small)
```bash
# parameters of one endpoint (required ones marked *)
python3 -I -c "import json,sys;d=json.load(open('ref/jellyfin-openapi.json'));o=d['paths'][sys.argv[1]][sys.argv[2]];print([p['name']+('*' if p.get('required') else '') for p in o.get('parameters',[])]);print(json.dumps(o.get('requestBody',{}))[:300]);print(json.dumps(o['responses'].get('200',{}))[:300])" '/Items/{itemId}/PlaybackInfo' post
# does a path exist? (search by fragment)
python3 -I -c "import json,sys;d=json.load(open('ref/jellyfin-openapi.json'));print([p for p in d['paths'] if sys.argv[1].lower() in p.lower()][:20])" Resume
# fields of a schema
python3 -I -c "import json,sys;d=json.load(open('ref/jellyfin-openapi.json'));print(list(d['components']['schemas'][sys.argv[1]]['properties']))" PlaybackInfoResponse
```
