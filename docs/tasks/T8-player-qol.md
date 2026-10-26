# Task: Stage 9 - player comforts (audio, subtitles, next episode)

## Goal
What makes Netflix pleasant while watching: choose audio and subtitles (with each user's Jellyfin
preferences as defaults), subtitles drawn nicely by the app, "Episodio successivo" with a countdown, "Sei
ancora lì?" after three episodes without keys, and "Salta intro" when the server knows the intro.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`, fixture `{{subtitledPlayableId}}` (mp4 H.264, two
  audio tracks, external SubRip subtitles). **No TV**. Episodes do not play in headless Chromium (none is mp4):
  next-episode logic is a pure function tested in L0; the reviewer certifies it on the TV.
- You may create/change: `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `src/lib/playback.js`,
  `test/playback.test.mjs`, `src/lib/vtt.js` (new) + `test/vtt.test.mjs` (new), `src/views/PlayerView.js`,
  `src/components/` (any file; new: `TrackMenu.js`, `Subtitles.js`, `NextCard.js`), `src/lib/deviceProfile.js`,
  `scripts/api-smoke.mjs` (add checks only), `src/theme.js` (new sizes/colours only), `test/ui/scenarios.json`,
  `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules"; `<track>` elements or any DOM for subtitles.

## Before you start
Procedure: `docs/AUTOPILOT.md`. `docs/ref/jellyfin-api.md` rows marked 9 and the server facts: **0 media
segments and 0 trickplay today**, so "Salta intro" must simply never appear on this server, without errors.

## Prerequisite
Task T7 is merged into `develop`.

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `9.N` without its commit.

## Required result, per step
**9.1 Track menu.** Up (or Down) while the OSD is shown opens "Audio e sottotitoli": two columns, audio tracks
(`DisplayTitle`) and subtitles ("Disattivati" + text subtitle streams; image subtitles PGS/DVD are not
listed). Defaults when playback starts: audio = first track matching `Configuration.AudioLanguagePreference`
of `/Users/Me`, else `DefaultAudioStreamIndex`; subtitles per `SubtitleLanguagePreference` / `SubtitleMode`
(`Default`, `Always`, `OnlyForced`, `None`), else off. Choosing another audio track asks a new
`playbackInfo` with `AudioStreamIndex` and restarts at the same position. Probe:
`probe.data('tracks', { audio, subtitle })` (indexes), `probe.data('dialog', 'tracks')` while open.
- Check: L0 for the default choice (a pure function in `playback.js`, all four subtitle modes); UI:
  `"query:item={{subtitledPlayableId}}" profile:dev wait:details key:Enter wait:player "until:s.data.time>2" key:Up "expect:s.data.dialog==='tracks'" visible:5 shot:tracks`.

**9.2 Subtitles drawn by Lightning.** `src/lib/vtt.js` parses WebVTT (cues with start, end, text; tags
stripped, `<i>` kept as italic flag). The chosen text subtitle is fetched as `vtt` (verified route) and shown
by `Subtitles`: white text, black outline/shadow, bottom centre, max 2 lines, above the OSD when it is open.
- Check: L0 (`vtt.js`: timestamps with and without hours, multi-line cues, tags); UI: choose the Italian
  subtitles in the menu, then `"until:s.data.subtitle && s.data.subtitle.length>0" sleep:300 visible:5 shot:subtitles`
  (`probe.data('subtitle', text)` = the cue on screen). Look at the screenshot: readable on bright scenes.

**9.3 Next episode and "Sei ancora lì?".** Pure function `nextAction({ time, duration, outroStart, hasNext,
episodesWithoutKeys })` → `'none' | 'showNext' | 'askStillWatching'`: `showNext` from `outroStart` or the last
30 s; `askStillWatching` instead when 3 episodes ended with no key pressed. `NextCard`: "Episodio successivo"
with the next episode's image and a 10 s countdown; OK or the end → plays the next one (next episode =
`/Shows/{seriesId}/Episodes` after the current one; respect `EnableNextEpisodeAutoPlay`). "Sei ancora lì?":
"Continua" / "Esci".
- Check: L0 for `nextAction` (all branches) and for the next-episode pick (last episode of a season → first of
  the next; last of the series → none). UI only that a film never shows the card:
  `... wait:player "until:s.data.time>2" "expect:!s.data.nextCard"`.

**9.4 Skip intro (when the server has segments).** On start, `GET /MediaSegments/{itemId}` with
`includeSegmentTypes: Intro, Recap`; during a segment a "Salta intro" / "Salta riassunto" button appears
bottom right (focused, OK jumps to `EndTicks`), hides after the segment. No segments → nothing, no error.
- Check: L0 (segment lookup by time, ticks → seconds); `api-smoke` check `segments` (answers, count ≥ 0);
  UI: `... wait:player "until:s.data.time>2" "expect:s.data.segments===0"`.

## How to work
As in `docs/AUTOPILOT.md`.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre". List
what the reviewer must certify on the TV (next episode, HLS when the audio track changes).
