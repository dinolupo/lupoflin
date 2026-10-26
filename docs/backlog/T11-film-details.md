# Task: Stage 13 - complete title details page (cast, info, chapters, file details)

Mode: one step at a time

## Goal
The Jellyfin web page of a film shows much more than our `DetailsView`: tagline, ratings, genres, director and
writer, studios, the cast with photos (and what else each person did), chapters, and the technical details of the
file. Bring the useful part of that to the TV in a Netflix look: the page scrolls down in sections, the d-pad
reaches every focusable section, nothing is a wall of text. The same sections appear for series (the seasons and
episodes rows stay where they are).

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV.**
- You may create/change: `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `scripts/api-smoke.mjs` (add checks only),
  `src/lib/playback.js` and `test/playback.test.mjs` (only the "play from chapter" helper), `src/views/DetailsView.js`,
  `src/views/GridView.js` (only the `personId` / `studioId` source, see 13.3), `src/views/PlayerView.js` (only
  `startTicks`, already supported: do not change playback), `src/App.js`, `src/components/` (any file; new:
  `DetailsHeader.js`, `InfoBlock.js`, `CastRow.js`, `ChapterRow.js`, `TechInfo.js` or similar names),
  `src/theme.js` (new sizes/colours only), `test/ui/scenarios.json` (add scenarios only), `docs/ref/jellyfin-api.md`
  (add verified rows), `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules". No trailers: unsupported things are not built (decision of Dino, 25/10/2026). Do not
  show `RemoteTrailers`, do not launch other apps, no iframe.
- `DetailsView.js` is already over 600 lines. **Every new section goes into its own component file**; the
  step must leave `DetailsView.js` shorter or equal in size, not longer.

## Before you start
Procedure: `docs/AUTOPILOT.md`. Fields that exist on `GET /Items/{id}` (checked on 25/10/2026 on "The Social
Network" and in the spec): `Taglines[]`, `OfficialRating`, `CommunityRating`, `CriticRating`, `Genres[]`,
`Studios[{Name, Id}]`, `ProductionLocations[]`, `PremiereDate`, `OriginalTitle`, `ExternalUrls[{Name, Url}]`,
`People[{Id, Name, Role, Type, PrimaryImageTag}]` (`Type`: Actor, Director, Writer, Producer; 21 people on that
film), `Chapters[{Name, StartPositionTicks, ImageTag}]` (16, no images), `MediaSources[0]` with `Container`,
`Size`, `Bitrate`, `MediaStreams[{Type, Codec, DisplayTitle, Language, Width, Height, ...}]`, `LocalTrailerCount`
(0 on this server), `RemoteTrailers[{Url, Name}]` (YouTube links; 1 on the sample film). `GET /Items` accepts `personIds` and `studioIds`; `GET /Items/{itemId}/LocalTrailers` exists. The 13.1 mapping also keeps
`remoteTrailers` (`{ url, name }`).
Anything else (collections of a film, special features): query the spec first (snippets in
`docs/ref/jellyfin-api.md`) and say so in the commit if you skip it.

## Prerequisite
Task T10 is merged into `develop` (`git log --oneline develop | grep -c "merge task/T10-tv-findings"` = 1).

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `13.N` without its commit.

## Required result, per step
**13.1 Data.** Extend the item mapping (`mapItemDetails` or the function `client.item` uses) with `tagline`,
`officialRating`, `communityRating`, `criticRating`, `genres`, `studios`, `countries`, `premiereDate`,
`people` (`{ id, name, role, type, imageTag }`), `chapters` (`{ name, startTicks }`; if Stage 14 already added it, reuse it), and a
`file` summary `{ container, sizeBytes, bitrate, video: { codec, width, height, label }, audio: [label],
subtitles: [label] }` taken from the first media source. Missing fields give `null` or `[]`, never an error. Add
the verified rows to `docs/ref/jellyfin-api.md`.
- Check: L0 (mapping of a full item and of an almost empty one); `api-smoke` check `details` on `{{movieId}}`:
  people count > 0, chapters ≥ 0, `file.video.width` > 0.

**13.2 Info block.** Under the title/logo and buttons, a block with: tagline (italic), a line of chips
(`officialRating` in a bordered box, "★ 7.4" from `communityRating` rounded to one decimal, "Critica 96%" when
there is a `criticRating`, year, duration), genres separated by " · ", "Regia: …" and "Sceneggiatura: …"
(names from `people`, at most 3 each, then "+N"), "Studio: …" (first 2). Absent data hides its line, no
empty labels. Component `InfoBlock`. Probe: `probe.data('info', { lines })` with the visible lines' text.
- Check: scenario `13.2-details-info`: `query:item={{movieId}} profile:dev wait:details
  "until:s.data.info && s.data.info.lines.length>=3" visible:20 shot:details-info`. Look at it: text not cut,
  nothing overlapping the buttons, readable on the backdrop.

**13.3 Cast.** A row "Cast" under the info block: round photos (140 px) with the name below and the role
under it (one line each, ellipsis), actors first, then director and writer, at most 30. Photo from
`/Items/{personId}/Images/Primary?tag=...` with `hasAlpha` not needed (JPEG); people without a photo show the
initial on a dark circle, like the profile avatars. Focus moves along the row like `Row`; Enter opens a grid of
the titles of that person (`GridView` fed by `/Items?personIds=...&recursive=true&includeItemTypes=Movie,Series`,
sorted by name, title "Con <name>"), Back returns to the details with the focus kept. Probe:
`probe.data('cast', n)`, `probe.focus({ section: 'cast', index, label })`.
- Check: L0 (URL with `personIds`); scenario `13.3-details-cast`: `query:item={{movieId}} profile:dev wait:details
  "until:s.data.cast>0" key:Down ... ` (as many Down as needed to reach the cast row, say how many)
  `"expect:s.focus.section==='cast'" visible:20 shot:details-cast key:Enter wait:grid "until:s.data.loaded>0"
  shot:person-grid key:Back wait:details "expect:s.focus.section==='cast'"`. Look at both screenshots: round
  photos aligned, names under them, the grid shows posters.

**13.4 Chapters.** A row "Capitoli" (only when the film has chapters): chips with the chapter name or "Capitolo
N" and its start time ("12:30"); Enter plays from that chapter (`PlayerView` already takes `startTicks`). Chips,
not images (this server has none). Probe: `probe.focus({ section: 'chapters', index, label })`.
- Check: L0 for the label/time formatting; scenario `13.4-details-chapters`: reach the chapters row,
  `"expect:s.focus.section==='chapters'" visible:20 shot:details-chapters`; do **not** press Enter in the
  scenario (it would write a real watch position).

**13.5 File details.** The last section "Dettagli del file", not focusable, reached by scrolling down with the
d-pad (Down from the last focusable row scrolls the page to it): container, size ("1,2 GB"), bitrate
("1,4 Mb/s"), video ("1080p H264 SDR"), audio tracks, subtitles (names, "Nessuno" when none), original title and
countries when different from the title. Component `TechInfo`. Probe: `probe.data('techLines', n)`.
- Check: L0 for the size and bitrate formatting; scenario `13.5-details-file`: `... key:Down` until
  `"expect:s.data.techLines>0 && s.focus.section==='file'"`, `visible:20`, `shot:details-file`. Look at it: the
  block is fully on screen and readable.

## How to work
As in `docs/AUTOPILOT.md`. Each step: look at the screenshot your check saved and write what you see in the
`Screenshot:` line (text cut? overlapping? empty area? the focused element readable?). Keep a section's
elements near the focus only if it has more than ~30 (the cast is capped at 30, so no virtualisation needed).

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre". List for the
reviewer what only the TV can show: scrolling smoothness of the long page, round photo loading speed, image
transparency.
