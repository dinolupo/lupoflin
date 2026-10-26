# Task: Stage 14 - the player screen: title block, buttons, cast, episode list

Mode: one step at a time

## Goal
Give `PlayerView` the layout of Prime Video / Netflix, with **only data and functions Jellyfin really gives**:
- a title block (big title; for an episode a second, smaller line "S2 E12 · episode title");
- under the progress bar a row of buttons: "Dall'inizio", "Prossimo episodio" (episodes only), "Sottotitoli", "Audio";
- a "Cast" pill that opens the cast list (actors by importance, with role); the focused actor shows more details;
- Down: the episode list of the season with the current one marked "In riproduzione" (episodes only);
- the arrow keys open this control layer **without pausing** the video; OK pauses and resumes.
Nothing here is invented: if Jellyfin has no value, the line is not drawn. No thumbnails on the bar (Dino decided).
Films never show the episode line, "Prossimo episodio" or the episode list.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`; fixtures `{{browserPlayableId}}` (film),
  `{{subtitledPlayableId}}`, `{{episodeId}}`. **No TV**; what only the TV can show is listed at the end of every report.
- You may create/change: `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `scripts/api-smoke.mjs` (add checks only),
  `src/lib/playback.js` + `test/playback.test.mjs`, `src/lib/playerLayout.js` (new, pure) +
  `test/playerLayout.test.mjs` (new), `src/views/PlayerView.js`, `src/components/` (any file; new: `PlayerHeader.js`,
  `ControlsRow.js`, `CastPanel.js`, `EpisodesPanel.js`), `src/components/Osd.js`, `src/components/TrackMenu.js`,
  `src/App.js` (only to pass the data `PlayerView` needs), `src/theme.js` (new sizes/colours only),
  `test/ui/scenarios.json` (add scenarios only), `docs/ref/jellyfin-api.md` (add verified rows),
  `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules"; new DOM; `<track>`; thumbnails/trickplay; trailers.
- **`PlayerView.js` is 771 lines and must not get longer in any step.** New logic goes into the new pure module and
  components; step 14.1 starts by moving things out so there is room.
- Left/Right keep today's behaviour (±10 s) in this stage: Stage 16 replaces them. They must never open the layer.

## Before you start
Procedure: `docs/AUTOPILOT.md`. Read `src/views/PlayerView.js` (all key handlers, `_openTrackMenu`, `_getFocused`,
the OSD show/hide timer), `src/components/Osd.js`, `src/components/TrackMenu.js`, `mapItem` / `formatCardLabel`
in `src/lib/jellyfin.js`. Look at the screenshots your checks save, and write what you really see in `Screenshot:`.

## Prerequisite
`git log --oneline develop | grep -c "merge task/T10-tv-findings"` is 1.

## Data that exists on this server (checked by the reviewer, 25/10/2026)
- Episode: `SeriesName`, `ParentIndexNumber` (season), `IndexNumber`, `Name`, `SeasonId`, `SeriesId`; `mapItem` already
  maps `seriesName`, `seasonNumber`, `episodeNumber`.
- Film or episode `People`: `[{ Id, Name, Role, Type, PrimaryImageTag }]` in order of importance (actors first as
  the metadata provider gives them); `Type` is Actor, Director, Writer, Producer...
- `GET /Persons/{name}?userId=` exists, **but on this server the fields are empty** (no birth date, no biography,
  no place). Show them only when present. The titles of the person in the library come from `GET /Items?personIds=<id>
  &recursive=true&includeItemTypes=Movie,Series` (verified: Jesse Eisenberg → 2 titles).
- There is **no** age, height, spouse or "who is on screen now" in Jellyfin: do not draw those.

## Required result, per step

**14.1 Title block and room in `PlayerView`.** First move code out of `PlayerView.js` into `PlayerHeader.js` and
`ControlsRow.js` (empty at first) so the file shrinks by at least 40 lines. Then the header: big title (40-48 px
bold: the film title, or the series name for an episode) and, **only for episodes**, a second line in a smaller
size "S{season} E{episode} · {episode title}". Pure `playerTitleLines(item)` → `{ title, subtitle|null }` in
`src/lib/playerLayout.js`. The header fades in and out with the OSD. Probe: `probe.data('titleLines', { title,
subtitle })`.
- Check: L0 (film → subtitle null; episode → "S2 E12 · Hard Decisions"; missing numbers → the line is only the
  episode title; missing everything → title only, no "undefined"); UI on `{{browserPlayableId}}`:
  `... wait:player "until:s.data.titleLines && s.data.titleLines.subtitle===null" visible:5 shot:player-title`;
  for `{{episodeId}}`: `"until:s.data.titleLines && s.data.titleLines.subtitle"` (if the episode does not
  start in headless Chromium, say so; L0 covers it and the reviewer certifies it on the TV). Look at the picture:
  title readable on a bright frame.

**14.2 Buttons under the progress bar and the control layer.** `ControlsRow`: "Dall'inizio" (seek to 0), "Prossimo
episodio" (only if `findNextEpisode` gives one; the same action as the end-of-episode card), "Sottotitoli" and
"Audio" (open the existing `TrackMenu` already on that column). Focus: when the layer is open, Left/Right move
between the buttons, OK activates, Up goes to the "Cast" pill (14.3), Down to the episode list (14.4, episodes
only; on a film nothing happens). **The layer opens with Up or Down, never pauses the video**, and closes by itself
after 5 s without a key (fade), by Back (Back never exits the player while the layer is open), or when the
user acts. OK with the layer closed pauses and shows only title and bar (as today); OK again resumes. Left/Right with
the layer closed behave as today (±10 s, bar and title only). Pure `controlButtons({ hasNext })` → list of ids,
tested.
- Probe: `probe.data('layer', 'open'|'closed')`, `probe.focus({ area: 'controls', button })`.
- Check: L0 for `controlButtons` (film → 3 buttons; episode with next → 4; last episode → 3); UI on a film:
  `... wait:player "until:s.data.time>2" key:Down "expect:s.data.layer==='open'" "expect:!s.data.paused"
  "expect:s.focus.area==='controls'" visible:5 shot:player-controls key:Back "expect:s.data.layer==='closed'"
  "expect:s.view==='player'"` (the video is not paused when the layer opens: use the probe field the OSD already has,
  or add `probe.data('paused', bool)` if there is none). Look at the picture: four labels, the focused one clear.

**14.3 Cast panel.** A "Cast" pill above the progress bar (left, like Prime's "In scene / Cast" row; only "Cast",
we have no scene data). OK opens `CastPanel` on the left side over the video: a vertical list, one row each (round
photo 64 px with `hasAlpha: true`, the name, "Interpreta: {role}" cut with "..." when long; no role → no second
line), **actors only, in the order Jellyfin gives, at most 15**; if there are no actors the pill is hidden. Up/Down move
the focus; the focused row grows into a card with: photo, name, role in full, "Visto in" and up to 4 titles of that
person found in the library (current title excluded, loaded only when the row gets focus, once per person,
cached in memory), and, **only when `GET /Persons/{name}` returns them**, birth date, birth place, and the first
300 characters of the biography. A row without any of these stays a simple row (no empty headings). Back closes the
panel and goes back to the pill; the video keeps playing. New client functions with L0 tests:
`client.person(userId, name)` and `client.itemsOfPerson(userId, personId, { exclude })` (verify both in the spec
first and add the rows to `docs/ref/jellyfin-api.md`). Pure `castOrder(people)` and `castCard(person, details)`.
Probe: `probe.data('cast', n)`, `probe.focus({ area: 'cast', index, name })`.
- Check: L0 (order kept, actors only, cap 15, long role cut, details with and without birth/bio; mapping of
  `person` and `itemsOfPerson` with the fake `fetch`); `api-smoke` check `cast`: the first film has ≥ 1 actor
  and `itemsOfPerson` answers (count ≥ 0); UI on a film with cast (`{{movieId}}` may not play: use
  `{{browserPlayableId}}`; if it has no cast, say so and test with L0): `... key:Up "expect:s.focus.area==='controls'"
  ...` then the way to the pill and OK, `"expect:s.data.cast>0" visible:10 shot:cast-panel`, `key:Down` `shot:cast-card`.
  Look at both pictures: text not cut badly, the focused card readable on a bright frame.

**14.4 Episode list (series only).** Down from the buttons row moves to a row of episode cards of the **season being
played**, at the bottom: the episode image (16:9, 280 px wide), "E{n}", the title, a progress bar for those started, and
"In riproduzione" on the current one, which is the focused one when the row opens, scrolled into view. Left/Right
move, Up goes back to the buttons, Back closes the layer. OK on another episode: send the stop report of the current
one, then start the chosen one exactly as the next-episode action does (same code path: do not copy it). Films
never have this row. Client: `client.episodes(userId, seriesId, seasonId)` already exists; use it. Pure
`episodeCards(episodes, currentId)` → `{ id, label, title, progress, current }`.
- Probe: `probe.data('episodes', n)`, `probe.focus({ area: 'episodes', index, id })`.
- Check: L0 for `episodeCards` (current marked, progress from `playbackPositionTicks`/`runTimeTicks`, an episode
  without number); UI with `{{episodeId}}`: `... wait:player "until:s.data.episodes>0" key:Down key:Down
  "expect:s.focus.area==='episodes'" visible:10 shot:player-episodes` (if the episode does not start in headless
  Chromium, prove with L0, say it, and the reviewer certifies it on the TV).

**14.5 Polish and key map check.** One scenario per case in a table of the report: film / episode × layer closed /
open × Up, Down, Left, Right, OK, Back: what each does (copy the table into the log row). Fix any contradiction with
this task. Nothing else changes: the speed, the chapters, the stats and the fast-seek belong to Stage 16.
- Check: `npm run check`, `npm run check:regress` all green; the table is in the report.

## How to work
As in `docs/AUTOPILOT.md`. One commit per step with "Requirements -> changes" and the `Screenshot:` line.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre". List for the
reviewer what only the TV can show: the real remote keys on the layer, auto-hide timing, episode playing from the
panel, round photos loading, a long cast list.
