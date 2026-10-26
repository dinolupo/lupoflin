# Task: Stage 16 - player controls (timeline focus, fast seek, chapters, technical info, subtitle style)

Mode: one step at a time

PAUSED 26/10/2026 after step 16.0 (merged): Dino wants to stabilize the app before new features. To resume,
move this file back to `docs/tasks/` and continue from 16.1.

## Goal
The comforts of Netflix, Prime Video and the Jellyfin player that are not about the screen layout (that was Stage 14,
`T12-player-layout.md`): the timeline reachable with the d-pad, fast seeking that accelerates and commits once, chapters, a technical
info box, subtitle appearance and delay, and (last, risky) image subtitles. Only what Jellyfin gives. No thumbnails
on the bar (the server has no trickplay; Dino decided to leave them out). No playback speed (Dino, 26/10/2026:
not useful now).

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`, fixtures `{{browserPlayableId}}` and
  `{{subtitledPlayableId}}` (mp4 H.264). **No TV**; what only the TV can show is listed at the end of every
  report for the reviewer.
- You may create/change: `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `scripts/api-smoke.mjs` (add checks
  only), `src/lib/playback.js` + `test/playback.test.mjs`, `src/lib/scrub.js` (new) + `test/scrub.test.mjs`
  (new), `src/lib/prefs.js` (new, per-user player preferences in `localStorage`, storage injected) +
  `test/prefs.test.mjs` (new), `src/views/PlayerView.js`, `src/components/` (any file; new:
  `StatsBox.js`, `ScrubLabel.js` or similar), `src/components/TrackPanel.js`, `src/lib/trackLabels.js` + `test/trackLabels.test.mjs`, `src/components/Osd.js`,
  `src/components/Subtitles.js`, `src/lib/deviceProfile.js`, `src/theme.js` (new sizes/colours only), `test/ui/scenarios.json` (add scenarios only),
  `docs/ref/webos.md` (keys table, only verified keys), `docs/ref/jellyfin-api.md` (add verified rows),
  `docs/PLAN.md` (Progress log rows only).
- Authorized DOM, in addition to the one of T6 and the `audioTracks` list the reviewer already uses: **on the same
  `<video id="video-player">` element only**, the method `getVideoPlaybackQuality()`. Nothing else.
- Forbidden: everything in `AGENTS.md` "Hard rules"; `<track>` elements; thumbnails/trickplay.
- **`PlayerView.js` must not be longer after any step than it is at the start of this task (803 lines)**: new logic goes into the new
  pure modules and components above, not into the view.

## Before you start
Procedure: `docs/AUTOPILOT.md`. After Stage 14 the layer, `ControlsRow`, `CastPanel` and `EpisodesPanel` exist: read them too. Read `src/views/PlayerView.js` `_handleLeft/_handleRight/_handleUp/_handleDown`
(today every Left/Right press calls `VideoPlayer.seek` and `_sendProgress` at once: a held key floods both),
`src/components/TrackPanel.js` (reviewer, 26/10/2026, approved by Dino on the TV: the "Sottotitoli" / "Audio"
buttons open a Prime-like panel at the bottom of the video, fields as pills, OK opens a list above the pill, OK on an
entry applies it and closes the list; keep this look and these keys for every new field or list) and `docs/ref/webos.md` "Keys".

## Prerequisite
Task T12 (Stage 14) is merged into `develop` (`git log --oneline develop | grep -c "merge task/T12-player-layout"` = 1): the control layer, the buttons row and the episode panel exist.

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `16.N` without its commit.

## Required result, per step
**16.0 The timeline is a focus row (Dino, 25/10/2026, found on the TV).** With the control layer open, Up/Down go
Cast pill -> **timeline** -> buttons -> episode list; today the timeline is skipped and there is no way to reach it. With
the focus on the timeline Left/Right move the playback position (16.1 gives them the accelerating behaviour; until
then use the single ±10 s), OK pauses/resumes, Up/Down move to the neighbouring row. The focused timeline shows its
knob clearly (a visible handle and a brighter bar). Probe: `probe.focus({ area: 'timeline' })`. The `PlayerView.js`
line limit still holds. Check: scenario `16.0-timeline-focus`: layer open, `key:Up key:Up` reaches the pill, `key:Down`
reaches `s.focus.area==='timeline'`, `key:Right` increases `s.data.time` by about 10 s, `key:Down` reaches the buttons;
look at the picture.

**16.1 Fast seek that accelerates and commits once.** Pure `src/lib/scrub.js`:
`scrubStep(repeatCount)` → seconds: presses 1-3 → 10, 4-8 → 30, 9-15 → 60, 16 or more → 120; a "press run"
continues while the next press (or key repeat) comes within 400 ms of the previous one, then `repeatCount` starts
again at 1. `nextTarget({ current, target, direction, repeatCount, duration })` clamps to `[0, duration]`.
With the control layer **closed** (Stage 14: the layer opens with Up/Down; with it open Left/Right move between buttons and are not seeks), Left/Right, and the remote keys Rewind/FastForward, only move a **target time** while the run
lasts. A **single** press shows only the bar, the time and a small "+10 s" / "-10 s" icon (no buttons, no cast, no
episodes); a held key shows the level as "2x", "3x", "4x" (1st to 4th band of `scrubStep`; it is the size of the jump, not a real
speed) next to the target time: the OSD shows the target time and the name of the chapter it falls in (when chapters are known, 16.2;
nothing before that), the video keeps playing/pausing as it is and **no `seek` is sent**. The seek happens once,
700 ms after the last press, or at once with Enter; Back cancels the move (target dropped, no seek). One
progress report per committed seek. Probe: `probe.data('scrub', { target, committed })` and
`probe.event('seek', { from, to })` on each committed seek.
- Check: L0 (`scrubStep` at the boundaries 1, 3, 4, 8, 9, 15, 16; clamping at 0 and at the end; a run that
  restarts after 400 ms); UI: `"query:item={{browserPlayableId}}" profile:dev wait:details key:Enter wait:player
  "until:s.data.time>3" key:Right key:Right key:Right key:Right key:Right key:Right
  "until:s.events.filter(e=>e.type==='seek').length===1" "expect:s.events.filter(e=>e.type==='seek')[0].to-
  s.events.filter(e=>e.type==='seek')[0].from>=60" visible:5 shot:scrub` (the six presses must give exactly one
  seek of at least 60 s: 3x10 + 3x30 = 120 s unless the file is shorter; if the clip is shorter, say so and use
  the clamped value). Look at `scrub.png`: target time visible on the bar, readable.

**16.2 Chapters.** `client.item` also maps `chapters: [{ name, startTicks }]` (field `Chapters`; if T11 already
did it, reuse). On the progress bar a thin marker at each chapter start. Remote keys ChannelUp / ChannelDown
go to the next / previous chapter (if the key codes are not in `docs/ref/webos.md`, use the browser keys
`PageUp` / `PageDown` and say in "Non verificato" that the TV codes 427/428 must be certified). A "Capitoli" button in `ControlsRow` (only when the item has chapters) opens a list in the `TrackPanel`
style: "12:30 · Nome" (name or "Capitolo N"), the current chapter highlighted, OK jumps to it and closes it, Back
closes it. A film without chapters:
no markers, no tab content ("Nessun capitolo"), no error. Probe: `probe.data('chapters', n)`,
`probe.data('dialog', 'chapters')` while open, `probe.focus({ area: 'chapters', index, label })`.
- Check: L0 (chapter at a given time; next/previous with first and last edge cases; label formatting);
  `api-smoke` check `chapters` (the item maps, count ≥ 0); UI: `... wait:player "until:s.data.time>3"`, open the layer, reach the "Capitoli" button, `key:Enter
  "expect:s.data.dialog==='chapters'" visible:5 shot:chapters key:Back "expect:!s.data.dialog"`. Do **not** press
  Enter in the scenario unless it only jumps inside the same file (it is allowed: it is a seek, not a data
  change). Look at `chapters.png`.

**16.3 Removed** (playback speed, Dino 26/10/2026). There is no step 16.3: after 16.2 comes 16.4.

**16.4 Technical info.** A box `StatsBox` toggled by the remote key Info (keyCode 457; also a button "Info"
at the end of `ControlsRow`, and the key `i` in the browser). It shows: "Direct play" or "Conversione
(HLS)" with the reason when the server gives it, container, video codec + resolution, audio codec + channels,
the stream bitrate, dropped video frames from `getVideoPlaybackQuality()`. It refreshes
every second while open and the timer is cleared in `_detach`. Probe: `probe.data('stats', { method, video,
audio })`.
- Check: L0 (a pure `describePlayback(source, quality)` → lines, with direct play and with a transcoding
  source); UI: `... wait:player "until:s.data.time>2" key:i "until:s.data.stats && s.data.stats.method"
  visible:5 shot:stats`. Look at it: text not cut, readable on a bright frame (put it on a dark box).

**16.5 Subtitle appearance and delay.** In the `TrackPanel` opened by "Sottotitoli", while subtitles are on, more pills after
"Lingue (N)", each opening its list like the languages: "Dimensione" (Piccolo / Medio / Grande), "Stile" (Contorno /
Riquadro scuro), "Posizione" (Basso / Più in alto) and "Ritardo" (−5 s … +5 s in 0.5 s steps, shown in the OSD). Saved per user in `localStorage` through `src/lib/prefs.js` (storage injected,
`clearAll` in `src/lib/session.js` is not in your list: say under "da proporre" that it should also clear
`lupoflix:prefs:*`). The delay shifts the cue lookup (`findActiveCue(time - delay)`).
- Check: L0 (`prefs` round trip, other user's prefs not returned, broken JSON reads as defaults; cue lookup
  with delay); UI on `{{subtitledPlayableId}}`: choose Grande and Riquadro scuro, `"until:s.data.subtitle &&
  s.data.subtitle.length>0" sleep:300 visible:5 shot:subs-style`. Look at it: bigger text on a dark box,
  readable on a bright scene.

**16.6 Image subtitles (PGS, DVD) - optional, risky.** `isTextSubtitle` hides them today. Kept by Dino (26/10/2026): on this
server 35 of 146 films have image subtitles and 14 have only those, so today they cannot show any subtitle. Show them in the
subtitle languages list of `TrackPanel` marked "(immagine)"; choosing one asks a new `playbackInfo` with that `SubtitleStreamIndex` and the
device profile `SubtitleProfiles` entry `{ Format: 'pgssub', Method: 'Encode' }` (verify the profile fields in
the spec first), which makes the server burn the subtitles into an HLS stream; playback restarts at the same
position. **Stop condition**: if the server does not answer with a `TranscodingUrl` for that request, write what
you got in the log row as `BLOCKED` and stop; do not work around it.
- Check: `api-smoke` check `imageSubs`: for a film with a PGS stream (the library has 35, see above), the `playbackInfo` answer has `TranscodingUrl`; L0 for the request body. The picture is
  certified on the TV.

## How to work
As in `docs/AUTOPILOT.md`. One commit per step with "Requirements -> changes" and the `Screenshot:` line.
Key presses in scenarios are sent without `sleep` between them when the step is about a press run.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre". List for the
reviewer what only the TV can show: acceleration with the real remote (held key and Rewind/FastForward),
ChannelUp/ChannelDown and Info key codes, dropped frames, image subtitles.
