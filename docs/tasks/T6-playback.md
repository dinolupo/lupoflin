# Task: Stage 4 - playback (browser part; the TV certification is the reviewer's)

## Goal
"Riproduci" plays the title full screen with a Netflix-style on-screen display, resumes where it was left,
and reports progress to Jellyfin so "Continua a guardare" stays right on every device.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`, on the fixture `{{browserPlayableId}}` (mp4 H.264
  AAC: the only kind headless Chromium plays). **No TV**: HEVC, 4K, AC3/EAC3/DTS and HLS are certified by the
  reviewer on the TV after this task.
- You may create/change: `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `src/lib/deviceProfile.js` (new) +
  `test/deviceProfile.test.mjs` (new), `src/lib/playback.js` (new, pure helpers: ticks, times, report bodies) +
  `test/playback.test.mjs` (new), `src/views/PlayerView.js` (new), `src/components/Osd.js` (new),
  `src/views/DetailsView.js` (button wiring only), `src/App.js`, `settings.json` (media keys only),
  `scripts/api-smoke.mjs` (add checks only), `src/theme.js` (new sizes/colours only), `docs/ref/webos.md`
  (keys table only), `test/ui/scenarios.json`, `docs/PLAN.md` (Progress log rows only).
- Authorized DOM: the single `<video>` element created by the SDK `VideoPlayer`, and its `style.zIndex`. Nothing else.
- Forbidden: everything in `AGENTS.md` "Hard rules"; hls.js or any player library.

## Before you start
Procedure: `docs/AUTOPILOT.md`. Read `docs/ref/jellyfin-api.md` "Verified for Stages 4, 6-10" and
`docs/ref/lightning.md` "Facts for the next stages" (VideoPlayer: where its docs are, the `<video>` is above
the canvas by default).

## Prerequisite
Task T5 is merged into `develop`.

## Deep link for tests
`App` opens `DetailsView` for the query parameter `item` once the home is shown (`query:item={{browserPlayableId}}`
then `profile:dev`). Add it in step 4.2; it is also how the TV will open a title from a launch parameter later.

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `4.N` without its commit.

## Required result, per step
**4.1 Client.** `src/lib/deviceProfile.js`: `deviceProfile('webos')` → `DirectPlayProfiles` video
`mp4,m4v,mkv,webm,ts,mov` with `h264,hevc,vp9,av1` and audio `aac,mp3,ac3,eac3,opus,flac`;
`TranscodingProfiles` HLS (`Container: 'ts', Protocol: 'hls', VideoCodec: 'h264', AudioCodec: 'aac'`);
`SubtitleProfiles` `vtt`/`srt`/`ass` with `Method: 'External'`. `deviceProfile('browser')` → direct play only
`mp4` + `h264` + `aac`, same transcoding. `client.playbackInfo(userId, itemId, { profile, startTicks,
audioIndex, subtitleIndex })` → `{ playSessionId, source: { id, container, directPlay, transcodingUrl,
streams } }`. `client.streamUrl(itemId, source, playSessionId)` → direct play: `/Videos/{id}/stream` with
`static=true, mediaSourceId, playSessionId, deviceId, ApiKey`; otherwise `base + transcodingUrl`.
- Check: L0 (profile shapes, body fields, both URL kinds); `api-smoke` check `playback`: playbackInfo of
  `browserPlayableId` with the browser profile has `directPlay` true, and a `Range: bytes=0-1023` GET of its
  stream URL answers 206 with `video/*`.

**4.2 Player.** `PlayerView` (props `client`, `session`, `itemId`, `startTicks`) with the SDK `VideoPlayer`,
pushed by "Riproduci". Profile: `'webos'` when `window.PalmSystem` exists, else `'browser'`. While it is
shown, the video is visible under the Lightning layer: put the `<video>` behind the canvas and make the
stage transparent (`stage.setClearColor`, App `Background` hidden), restore both on close. Probe:
`probe.view('player', { id })`, events `playing` and `ended`, `probe.data('time', seconds)` every second.
Back closes: `VideoPlayer.close()`, then `$back`.
- Check: `npx lng build > .tmp/build.log 2>&1; npm run check:api > .tmp/api.json; node scripts/ui-check.mjs --brief "query:item={{browserPlayableId}}" profile:dev wait:details key:Enter wait:player "until:s.events.some(e=>e.type==='playing')" "until:s.data.time>3" sleep:500 visible:5 shot:player key:Back wait:details`.
  Look at `player.png`: the picture must be visible (not the empty background).

**4.3 OSD.** `Osd` component (Netflix look): title top-left, bottom bar with progress (red fill on grey),
elapsed and remaining time, "Fine alle HH:MM". Shows on any key, hides after 4 s without keys. OK =
play/pause; Left/Right = -10/+10 s (OSD visible); media keys mapped in `settings.json`: 415 `Play`, 19
`Pause`, 413 `Stop`, 412 `Rewind`, 417 `FastForward` (update the keys table in `docs/ref/webos.md`). Resume:
"Riproduci" on a title with `UserData.PlaybackPositionTicks > 0` shows two buttons, "Riprendi da MM:SS" (focused) and
"Dall'inizio" (only these two buttons in `DetailsView`, nothing else there).
- Check: L0 for the time helpers (`playback.js`); UI: `... wait:player "until:s.data.time>3" key:Enter "until:s.data.paused===true" key:Enter key:Right "until:s.data.time>12" visible:5 shot:osd`.

**4.4 Report to Jellyfin.** `POST /Sessions/Playing` on start, `/Sessions/Playing/Progress` every 10 s and on
pause/seek, `/Sessions/Playing/Stopped` on Back or end (body fields from the verified table; `PlayMethod`
`DirectPlay` or `Transcode`). Each report fires `probe.event('report', { kind: 'start'|'progress'|'stopped', status })`;
a failed report never stops playback.
Note: Jellyfin ignores positions under 5 % of the runtime, so 15 s of a film leave no resume point: that is
normal, do not "fix" it.
- Check: L0 for the bodies; UI: `... wait:player "until:s.data.time>3" key:Back wait:details "until:s.events.some(e=>e.type==='report' && e.kind==='stopped' && e.status===204)"`;
  `api-smoke` check `reportRoundTrip` on `browserPlayableId`: read its user data (GET `/UserItems/{itemId}/UserData`),
  report start + stopped at 50 % of `RunTimeTicks` with the client, read again (`PlaybackPositionTicks > 0`), then
  **restore** the original values (POST `/UserItems/{itemId}/UserData`, body `UpdateUserItemDataDto` with the
  fields read) so Dino's real history is untouched; add both endpoints to the verified table.

## How to work
As in `docs/AUTOPILOT.md`. Step 4.2 is the risky one (video layering): if after 3 attempts the screenshot
shows no picture, stop as BLOCKED with what you tried; do not switch to texture mode.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre". List what
the reviewer must certify on the TV.
