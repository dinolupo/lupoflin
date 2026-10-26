# Lupoflix: work plan

Source of truth for stages, steps and progress. Written for pi.dev on a local model (~64K context,
compaction near 48K) and for the reviewer. Rules: `AGENTS.md`. References: `docs/ref/`.

## How the work runs
Since 24/10/2026 the stages run with the autopilot (`docs/AUTOPILOT.md`, Antigravity + Gemini Flash) and are
reviewed by Claude (`docs/JUDGE.md`). The pi.dev session rules below are kept for a local model.
1. One **task file** per stage in `docs/tasks/`, written just before the stage starts (so it never goes stale).
2. One **part** = 2 steps = one pi.dev session, new each time: `/task docs/tasks/<file>.md`. The agent reads
   the Progress log and `git log --oneline`, finds the first step without its commit, summarises and stops.
   The reviewer answers `ok, do Part X`.
3. One **step** = one small change + its check run in the session + one commit `lupoflix: step S.N - ...` +
   one Progress log row. A step that fails its check 3 times is logged `BLOCKED` and the session stops.
4. A **gate** closes each stage: all checks green, then the judge review (`docs/JUDGE.md`, Claude), then
   Dino's L4 check when the TV is involved. The next task file is written only after the gate.

### Context budget per session (why parts are 2 steps)
Fixed cost ~5K tokens (global + project AGENTS.md, task file, `docs/ref/lightning.md`). Each UI step reads
2-3 source files (~1.5K tokens each), writes small edits, runs 2-3 checks with capped output: ~10-15K.
Two steps ≈ 35K, below the 48K compaction point with margin for one retry.

## Verification levels
| Level | Proves | Command | Who |
|---|---|---|---|
| L0 unit | Pure logic (URLs, mapping, paging maths) | `npm test` | agent |
| L1 API | Real server answers as the client expects | `npm run check:api` | agent |
| L1 UI | App boots, logs in, screen and focus are right, no errors (headless Chromium, WebGL via SwiftShader) | `npm run check:ui`, custom `ui-check` scenarios | agent |
| L3 TV | Same app on the TV: install, launch, probe events and fps read from the TV | Stage 3 scripts | agent, after Dino's TV setup |
| L4 human | Smoothness with the real remote, picture, audio | Dino, one line in the log | Dino |

Screenshots (`.tmp/ui/*.png`) are for the reviewer: the gate review looks at them. The local Chromium
(153) plays H.264, VP9 and AV1 but **not HEVC** (`canPlayType`, checked 24/10/2026): playback logic can be
smoke-tested in the browser with an H.264 file, but HEVC, 4K and the hardware decoder are **certified only on the TV**.

## Stage 0: bootstrap (done by Claude, 24/10/2026)
From scratch, PoC removed (still in commit `63491b4`). Working and verified: splash with the Lupoflix logo
→ "Chi vuole guardare?" profiles from `/Users/Public` → login (Quick Connect; dev shortcut with
`devUser` in `static/config.local.json`) → home with "Le tue librerie" row and one "Aggiunti di recente" row
per library, real posters, D-pad navigation, saved session. Checks: L0 13/13, L1 API 9/9, L1 UI ok.

## Autopilot (from 24/10/2026)
Stages 1-2 run unattended with `docs/AUTOPILOT.md` (browser only, no TV). Claude reviews with `docs/JUDGE.md`
when the run stops, before any new task file is written.
From 25/10/2026 the agent manages branches itself: `task/<task>` from `develop`, merged back into `develop` at
the gate; `master` is moved only by the reviewer after an OK verdict (fast-forward from `develop`).

## Stage 1: library grid (first stage for pi.dev, low risk)
Task: `docs/tasks/T1-library-grid.md`.
| Step | Do | Files | Check |
|---|---|---|---|
| 1.1 | Enter on a library tile opens `GridView`: first 60 items, 7 columns, poster + label | new `src/views/GridView.js`; `src/App.js`; `src/views/HomeView.js` | UI: open "Bambini" → `s.view==='grid' && s.data.loaded>0` |
| 1.2 | Grid navigation: Left/Right inside a row, Up/Down by 7, the focused row stays visible | `GridView.js` | UI: `Down Down Right` → `s.focus.index===15` |
| 1.3 | Back from the grid returns home with the same row and card focused | `App.js`, `HomeView.js`, `GridView.js` | UI: home → `Right Enter Back` → `s.view==='home' && s.focus.row===0 && s.focus.index===1` |
| 1.4 | Paging: near the last loaded row, load the next 60 (`startIndex`) | new `src/lib/paging.js` + test; `GridView.js` | L0 paging tests; UI on "Film" (107): 9x `Down` → `s.data.loaded>60` |

Gate 1: checks green, judge review of the 4 commits and screenshots.

## Stage 2: title details (Netflix "title page")
Task: `docs/tasks/T2-title-details.md` (written 24/10/2026; endpoints pre-verified in `docs/ref/jellyfin-api.md`).
| Step | Do | Check |
|---|---|---|
| 2.1 | `client.item(userId, itemId)` (verify GET `/Items/{itemId}` in the spec first) + mapping with overview, runtime, genres, backdrop tag | L0 + new check in `api-smoke` |
| 2.2 | `DetailsView`: backdrop 1920 wide with dark gradient, title, year, runtime, overview (4 lines), focused "Riproduci" button (no playback yet: probe event) | UI: poster → Enter → `s.view==='details'` + screenshot |
| 2.3 | Open details from home rows and from the grid; Back returns with focus kept | UI scenarios from both sides |
| 2.4 | Series: seasons row + episodes row in `DetailsView` (verify `/Shows/{id}/Seasons`, `/Shows/{id}/Episodes` in the spec) | L0 + UI on "Serie TV" |

## Stage 3: TV bring-up (needs Dino) - steps 3.1-3.4 and 3.7 done by Claude on 24/10/2026
Done: TV registered (`tv`, LG 55QNED85T6C, Chrome 120), `scripts/package.mjs`, `scripts/tv.mjs`, telemetry
(`npm run telemetry`) and fps meter (`--perf`). 3.7 is solved differently: the TV's remote DevTools accept
keys and screenshots, so `ui-check --tv` runs the same scenarios on the TV. Left: 3.6 L4 (Dino: "funziona una
meraviglia", 24/10/2026, first impression).

Baseline on the TV (24/10/2026, ES6 build, perf meter on):
| Metric | Value | How |
|---|---|---|
| Cold start, launch command → home drawn | 2.77-2.90 s (3 runs) | `npm run tv startup 3` |
| App boot done (ms since page load) | 630-790 ms | same, `boot_done` |
| Home ready (ms since page load) | 2.10-2.22 s, of which ≥1.5 s is the minimum splash time (`SPLASH_MIN_MS`) | same, `home_ready` |
| Idle | 60 fps, worst frame 17-18 ms | telemetry |
| Scrolling home rows (keys every 350 ms via DevTools) | 59-60 fps, worst frame 18-38 ms | telemetry during `ui-check --tv` |
| Known spike | ~360 ms when `ui-check` takes a TV screenshot (the capture itself, not the app) | same run |
| Step | Do | Check |
|---|---|---|
| 3.1 | 🧑 Dino: Developer Mode on, `npx ares-setup-device` (name `tv`), `npx ares-novacom --device tv --getkey` | agent: `npx ares-device -i -d tv` prints the webOS version → fill `docs/ref/webos.md` |
| 3.2 | `scripts/package.mjs`: `lng dist` (ES6, or ES5 if webOS < 5), copy `appinfo.json`, write a config **without** `devUser`/`devPassword`, drop `static/Lupoflix.jpeg`, `ares-package` | ipk < 1.5 MB; extracted config has 0 matches for `devPassword` |
| 3.3 | `scripts/tv.mjs install|launch|stop` around `ares-install` / `ares-launch` | exit 0; `npx ares-launch -d tv --running` lists the app |
| 3.4 | Telemetry: when the config has `telemetry: "http://<pc-ip>:8765"`, the probe also POSTs its events; `scripts/telemetry-server.mjs` writes `.tmp/telemetry/<run>.jsonl` | after a launch the file has `ready` and `view` events **from the TV** |
| 3.5 | Fps in the probe (frames counted per second on the stage), sent with telemetry | baseline numbers in this file: idle and while scrolling |
| 3.6 | 🧑 Dino: Quick Connect login on the TV, navigation with the real remote | L4 line in the log; telemetry shows `home` and the rows |
| 3.7 | Optional, **hypothesis**: send remote keys from the PC (LG SSAP websocket, pairing once on the TV) so L3 scenarios run without Dino | the key sequence appears in telemetry |

## Roadmap from 25/10/2026 (Dino: "completa il piano + quality of life best of breed")
Autopilot works the task files in name order, browser only; the reviewer (Claude) reviews each merge and runs
the TV stage. Each task file is self-contained (scope, checks, scenarios).
| Order | Task file | Stage | What | Who certifies |
|---|---|---|---|---|
| 1 | `T4-accounts.md` | 6 | Server screen with on-screen keyboard (saved until "Disconnetti"), password-less profiles with cached tokens, header avatar: "Cambia profilo" / "Disconnetti" | browser; TV in Stage 11 |
| 1b | `T4b-avatar-picker.md` | 6b | "Scegli un'icona" from the GetAvatar plugin (951 icons, 5 categories): list fetched once, category tabs, virtual grid with recycled elements, images loaded only near the screen, confirm before applying; from the header menu and "Gestisci profili" | browser; real change certified with Dino |
| 2 | `T5-browse-engine.md` | 7 | Probe counters, genre rows loaded on demand, virtual home and grid, image prefetch, instant home from cache | browser counters; fps on TV in Stage 11 |
| 3 | `T6-playback.md` | 4 | PlaybackInfo + device profiles, `PlayerView` (SDK VideoPlayer), Netflix OSD, resume, media keys, reporting | browser (mp4 H.264); TV matrix in Stage 11 |
| 4 | `T7-home-details-qol.md` | 8 | Billboard, "Prossimi episodi", "La mia lista", watched marks, title logos, "Altri titoli simili" | browser |
| 5 | `T8-player-qol.md` | 9 | Audio/subtitle menu with user preferences, subtitles drawn by Lightning, next episode + "Sei ancora lì?", "Salta intro" | browser + TV |
| 6 | `T9-search-filters.md` | 10 | Search with live results, grid sort and filters | browser |
| 7 | `T10-tv-findings.md` | 12 | Fixes for defects Dino saw on the TV (focused pill text, profile picture transparency, detail buttons, grid first row, profile menu cover, error screens) | browser, then TV with Dino |
| 8 (closed) | `docs/backlog/T13-tv-findings-2.md` | 15 | Second TV round: 15.1 keyboard and 15.2 exit dialog fixed by the reviewer (judge 12, certified on the TV); 15.3 (OK after the webOS Home button, not reproducible) and 15.4 (browser error dialog, not needed) dropped by Dino | done |
| 9 | `T12-player-layout.md` | 14 | Player screen: title block (series/season/episode), buttons row (Dall'inizio, Prossimo episodio, Sottotitoli, Audio), Cast panel with details Jellyfin has, episode list with "In riproduzione", arrows open the layer without pausing | browser, then TV with Dino |
| 10 (paused after 16.0) | `docs/backlog/T14-player-controls.md` | 16 | Timeline reachable with Up/Down (16.0), accelerating fast seek (no thumbnails), chapters, no speed (removed), technical info (Info key), subtitle style and delay, image subtitles (risky). After T12 | browser, then TV with Dino |
| 11 (waiting) | `docs/backlog/T11-film-details.md` | 13 | Complete title page: info block (tagline, ratings, genres, director), cast with photos and person grid, chapters, file details, no trailers (unsupported things are not built). **Not in `docs/tasks/` yet**: move it there (`git mv`) once T10 is certified on the TV, so the autopilot does not start it in the same session | browser, then TV with Dino |

### Stage 11: TV certification (reviewer + Dino, after T6 and again at the end)
| Step | Do | Check |
|---|---|---|
| 11.1 | `package.mjs`: the packaged config has **no `server`** any more (the TV uses the server screen); bump `version` | extracted config has 0 matches for `server`, `devUser`, `devPassword` |
| 11.2 | Install, first run on the TV: server screen, profiles, home | `ui-check --tv` screenshots; 🧑 Dino types the address once with the remote |
| 11.3 | Launcher icon: the red "L" (`static/icon.png`, `static/largeIcon.png`); if the launcher shows an old icon, remove + install (`docs/ref/webos.md`) | 🧑 Dino: icon in the LG menu |
| 11.4 | Playback matrix: mkv HEVC AAC, mkv HEVC EAC3, mkv H.264 DTS, avi MPEG-4 (→ HLS transcode), mp4 with subtitles; audio track change; resume; reporting | telemetry `playing` + time-to-first-frame per file; 🧑 picture and audio |
| 11.5 | Fps with genre rows and virtual lists (Stage 7) vs the 24/10 baseline | `npm run tv startup 3` + telemetry while scrolling |

### Backlog (not planned yet)
Trickplay thumbnails while seeking and "Salta intro" data (both need Dino to enable them on the server: today 0);
settings page (max bitrate, subtitle size, autoplay); screensaver after inactivity with backdrops; cast/people row;
deep link from the LG search (launch params); parental PIN per profile.

## Stage 5a: polish (autopilot, done)
Task: `docs/tasks/T3-home-polish.md`. 5.1 series page layout, 5.2 "Continua a guardare" row with progress bar,
5.3 episode details page. Reviews: `docs/reviews/2026-10-24-stage-1-2.md` (FIX, fixed), `docs/reviews/2026-10-25-stage-5a.md` (OK).

## Decisions
| ID | Decision | Date |
|---|---|---|
| D1 | Start from scratch; the PoC stays only in git history | 24/10/2026 |
| D2 | Login without keyboard: profiles from `/Users/Public` + Quick Connect; dev shortcut via `devUser` (local file only) | 24/10/2026, replaced by D7 |
| D3 | No dependencies beyond the Lightning SDK/CLI and the webOS CLI; tests with `node --test`, browser checks with raw CDP on Node's built-in WebSocket | 24/10/2026 |
| D4 | Stage resolution 1920x1080 also on 4K TVs; images requested at drawn size | 24/10/2026 |
| D5 | Agent-facing docs in English, user-facing text in Italian | 24/10/2026 |
| D6 | The server address is typed in the app (Lightning keyboard) and saved in `localStorage` until "Disconnetti"; `config.local.json` `server` is only a development default and is not packaged | 25/10/2026 |
| D7 | Every profile tries the empty password (all users are password-less; `HasPassword` is unreliable); Quick Connect only on 401. One token per user is kept, so switching profile is instant | 25/10/2026 |
| D8 | Many categories stay fast by creating only elements near the focus and fetching rows on demand; Lightning already loads textures only near the screen (`boundsMargin` for prefetch). Claims are measured with probe counters | 25/10/2026 |
| D9 | Player: SDK VideoPlayer with the `<video>` tag (hardware decoder) under a transparent canvas; device profile per platform (webOS: direct play HEVC/H.264/AC3/EAC3..., else HLS H.264/AAC); subtitles parsed and drawn by Lightning | 25/10/2026 |
| D11 | Profile pictures come from the GetAvatar plugin (Dino, 25/10/2026); its API is not in the OpenAPI spec, so `docs/ref/jellyfin-api.md` documents it from the plugin source + live calls. Plugin missing → the feature is hidden | 25/10/2026 |
| D10 | Tests that change Dino's watch data (favourites, played, positions) put the original values back in the same run | 25/10/2026 |

## Progress log
| Step | Commit | Check command | Result | Date |
|---|---|---|---|---|
| 0 | (this commit) | `npm run check` | L0 13/13, L1 API ok, L1 UI ok (home, 4 rows) | 24/10/2026 |
| 1.1 | (this) | `node scripts/ui-check.mjs ... wait:grid "until:s.data.loaded>0"` | ok:true, focus index 0, 60 loaded | 24/10/2026 |
| 1.2 | (this) | `node scripts/ui-check.mjs ... key:Down key:Down key:Right` | ok:true, focus index 15, shot:grid-nav | 24/10/2026 |
| 1.3 | (this) | `node scripts/ui-check.mjs ... key:Back wait:home` | ok:true, row 0 index 1 restored | 24/10/2026 |
| 1.4 | (this) | `node scripts/ui-check.mjs ... key:Down x9 "until:s.data.loaded>60"` | ok:true, focus index 63, loaded>60 | 24/10/2026 |
| Gate 1 | - | `npm run check` | self-check ok | 24/10/2026 |
| 2.1 | (this) | `npm test && npm run check:api` | L0 22/22, L1 itemDetails ok | 24/10/2026 |
| 2.2 | (this) | `node scripts/ui-check.mjs ... wait:details` | ok:true, play_requested event, row 1 index 0 restored | 24/10/2026 |
| 2.3 | (this) | `node scripts/ui-check.mjs ... wait:details key:Back wait:grid` | ok:true, grid focus index 2 restored | 24/10/2026 |
| 2.4 | (this) | `node scripts/ui-check.mjs ... "until:s.data.episodes>0"` | ok:true, seasons 2, episodes 10, shot:series | 24/10/2026 |
| Gate 2 | - | `npm run check` | self-check ok | 24/10/2026 |
| Judge 1-2 | (this) | `npm run check` + task scenarios | FIX: library images regression fixed, rule added; L0 23/23 | 24/10/2026 |
| 5.1 | (this) | `node scripts/ui-check.mjs ... key:Down sleep:600 "expect:s.data.focusRect.top>=330 && s.data.focusRect.bottom<=1060"` | ok:true, focusRect { top: 340, bottom: 671 }, shot:series-episodes | 25/10/2026 |
| 5.2 | (this) | `npm test && npm run check:api && node scripts/ui-check.mjs ... "expect:s.data.rows[0].title==='Continua a guardare' && s.data.rows[0].count>0"` | ok:true, row 0 "Continua a guardare" count 9, shot:home-resume, enter opens details | 25/10/2026 |
| 5.3 | (this) | `node scripts/ui-check.mjs ... "expect:/^S\\d+:E\\d+ /.test(s.data.name)" visible:20 shot:episode key:Back wait:details "until:s.focus && s.focus.section==='episodes' && s.focus.index===1"` | ok:true, title "S1:E2 Il test", shot:episode, back restored episode 1 focus | 25/10/2026 |
| Gate 5a | (this) | `npm run check + check:regress` | self-check ok: L0 26/26, L1 API ok, L1 UI ok, regress 12/12 ok | 25/10/2026 |
| Judge 5a | (this) | `npm run check` + `check:regress` + mutation | OK: L0 26/26, regress 12/12; judge fix: Row passes progress, ResumeRow removed | 25/10/2026 |
| 6.1 | (this) | `npm test && npm run check && npm run check:regress` | L0 31/31, check ok, regress 12/12 ok | 25/10/2026 |
| 6.2 | (this) | `node scripts/ui-check.mjs query:server= wait:server ...` | ok:true, shot:server, server saved, reload goes to profiles, error case ok | 25/10/2026 |
| 6.3 | (this) | `node scripts/ui-check.mjs profile:dev wait:home ... reload wait:profiles key:Enter` | ok:true, shot:profiles, login cached:true, regress 14/14 ok | 25/10/2026 |
| 6.4 | (this) | `npm test && node scripts/ui-check.mjs ... (switch & disconnect)` | L0 32/32, switch ok, disconnect ok, regress 16/16 ok | 25/10/2026 |
| Gate 6 | (this) | npm run check + check:regress | self-check ok: L0 32/32, L1 API ok, L1 UI ok, regress 16/16 ok | 25/10/2026 |
| 6b.1 | (this) | npm test && npm run check:api | L0 44/44, api avatars 951 in 5 cats, regress 16/16 ok | 25/10/2026 |
| 6b.2 | (this) | `node scripts/ui-check.mjs ... wait:avatars ...` | ok:true, shot:avatars shot:avatars-deep, tiles 40 images 141, regress 17/17 ok | 25/10/2026 |
| 6b.3 | (this) | npm test && npm run check && npm run check:regress | L0 45/45, check ok, confirm dialog ok, manage profiles ok, regress 19/19 ok | 25/10/2026 |
| Gate 6b | (this) | npm run check + check:regress | self-check ok: L0 45/45, L1 API ok, L1 UI ok, regress 19/19 ok | 25/10/2026 |
| 7.1 | (this) | `npm test && npm run check && npm run check:regress` | L0 45/45, check ok, baseline: home 59/21, home 10dn 59/36, grid 107/114, regress 20/20 ok | 25/10/2026 |
| 7.2 | (this) | `node scripts/ui-check.mjs ... shot:genres && check:regress` | ok:true, genres on demand, ready 251/21, after 8dn 277/76, shot:genres, regress 21/21 ok | 25/10/2026 |
| 7.3 | (this) | `node scripts/ui-check.mjs ... 12dn shot:home-deep 12up && check:regress` | ok:true, virtual home focus-1..+2, tiles 33 ready / 40 deep (vs 251/277), regress 22/22 ok | 25/10/2026 |
| 7.4 | (this) | `node scripts/ui-check.mjs ... 12dn "expect:s.focus.index===84 && s.data.counters.tiles<=80"` | ok:true, virtual grid visible rows ±2, focus 84 tiles 51 (vs 107), back ok, regress 23/23 ok | 25/10/2026 |
| 7.5 | (this) | `npm test && node scripts/ui-check.mjs ... fromCache===true` | L0 53/53, check ok, instant home fromCache:true, regress 24/24 ok | 25/10/2026 |
| Gate 7 | (this) | `npm run check + check:regress` | self-check ok: L0 53/53, regress 24/24 ok; baseline vs now: home ready 59->33 tiles, home deep 59->40 tiles (with 32 genre rows, vs 277 unvirtualized), grid deep 107->51 tiles | 25/10/2026 |
| 4.1 | (this) | `npm test && npm run check:api > .tmp/api.json && npm run check` | L0 59/59, check:api playback directPlay:true status:206 video/mp4, check ok | 25/10/2026 |
| 4.2 | (this) | `node scripts/ui-check.mjs ... shot:player && check:regress` | ok:true, playing event, time>3, visible:5 ok, shot:player picture visible, regress 25/25 ok | 25/10/2026 |
| 4.3 | (this) | `npm test && node scripts/ui-check.mjs ... shot:osd && check:regress` | L0 64/64, ok:true, pause ok, seek +10s ok, shot:osd Netflix look, resume buttons ok, regress 26/26 ok | 25/10/2026 |
| 4.4 | (this) | `npm test && npm run check:api && node scripts/ui-check.mjs ... && check:regress` | L0 65/65, check:api reportRoundTrip ok (restore ok), ui-check stopped report 204, regress 27/27 ok | 25/10/2026 |
| Gate 4 | (this) | `npm run check + check:regress` | self-check ok: L0 65/65, check:api ok (playback + reportRoundTrip), regress 27/27 ok, full check ok (browser playback, layering, OSD, resume buttons, reporting) | 25/10/2026 |
| 8.1 | (this) | `npx lng build && node scripts/ui-check.mjs ... shot:billboard ... && check:regress` | ok:true, billboard picked random candidate with backdrop+logo, shot:billboard picture ok, visible:30 ok, Up focuses billboard, Enter opens details, regress 28/28 ok | 25/10/2026 |
| 8.2 | (this) | `npm test && node scripts/ui-check.mjs ... shot:nextup && check:regress` | L0 69/69, ok:true, Prossimi episodi row rendered, episode labels formatted <series> · S1:E2, regress 29/29 ok | 25/10/2026 |
| 8.3 | (this) | `npm test && node scripts/ui-check.mjs ... shot:mylist && check:regress` | L0 70/70, ok:true, my list toggle and watched toggle buttons, my list row in home, played check badge on tiles, regress 30/30 ok | 25/10/2026 |
| 8.4 | (this) | `npm test && node scripts/ui-check.mjs ... shot:details-logo && check:regress` | L0 71/71, ok:true, title logo replaces text title when present, Altri titoli simili row rendered below buttons/episodes, regress 31/31 ok | 25/10/2026 |
| Gate 8 | (this) | `npm run check + check:regress` | self-check ok: L0 71/71, L1 API ok, L1 UI ok, regress 31/31 ok (billboard hero, next episodes, my list & watched mark, title logo, similar titles) | 25/10/2026 |
| 9.1 | (this) | `npm test && node scripts/ui-check.mjs ... shot:tracks && check:regress` | L0 73/73, ok:true, track menu shows audio & subtitle columns with default checks per user preference, Up opens tracks dialog, regress 32/32 ok | 25/10/2026 |
| 9.2 | (this) | `npm test && node scripts/ui-check.mjs ... shot:subtitles && check:regress` | L0 78/78, ok:true, vtt parsing and subtitles drawn by Lightning with shadow above OSD, cue readable on bright scenes, regress 33/33 ok | 25/10/2026 |
| 9.3 | (this) | `npm test && node scripts/ui-check.mjs ... expect:!s.data.nextCard && check:regress` | L0 80/80, ok:true, pure nextAction logic & findNextEpisode across seasons/series, NextCard & StillWatching dialog, film never shows nextCard, regress 34/34 ok | 25/10/2026 |
| 9.4 | (this) | `npm test && npm run check:api && node scripts/ui-check.mjs ... expect:s.data.segments===0 shot:player-clean && check:regress` | L0 82/82, api-smoke segments count:0 ok, skip button gracefully hidden on 0 segments without errors, regress 35/35 ok | 25/10/2026 |
| Gate 9 | (this) | `npm run check + check:regress` | self-check ok: L0 82/82, L1 API ok (segments count:0), L1 UI ok, regress 35/35 ok (track menu & defaults, WebVTT subtitles on WebGL, next episode & still watching, skip intro) | 25/10/2026 |
| 10.1 | (this) | `npx lng build && node scripts/ui-check.mjs ... shot:search && check:regress` | L0 83/83, ok:true, search in header, on-screen keyboard with Spazio and live results grid 4 cols, debounce 300ms, shot:search, regress 36/36 ok | 25/10/2026 |
| 10.2 | (this) | `npm test && node scripts/ui-check.mjs ... shot:grid-sorted && check:regress` | L0 84/84, ok:true, grid sort (A-Z, DateCreated, ProductionYear, CommunityRating) and filter (Tutti, IsUnplayed, IsFavorite) with per-library localStorage persistence, shot:grid-sorted, regress 37/37 ok | 25/10/2026 |
| Gate 10 | (this) | `npm run check + check:regress` | self-check ok: L0 84/84, L1 API ok, L1 UI ok, regress 37/37 ok (search with live results & on-screen keyboard, grid sort & filters with per-library persistence) | 25/10/2026 |

| Judge 6-10 | (this) | `npm test` + `npm run check` + `check:regress` + mutations + screenshots | FIX: L0 85/85, check 0, regress 37/37; judge fixes: manage-profile fallback, user image tag, grid bar label, logo alpha, clearAll caches, played button width | 25/10/2026 |
| 12.1 | (this) | `npx lng build && node scripts/ui-check.mjs ... shot:search-focus && check:regress` | ok:true, focused Cerca dark text on white pill, textColor and fillColor contrast on header and grid, shot:search-focus, regress 38/38 ok | 25/10/2026 |
| 12.2 | (this) | `npx lng build && node scripts/ui-check.mjs ... shot:profiles-alpha && check:regress` | ok:true, hasAlpha:true on all user/avatar images (4 userImageUrl call sites + GetAvatar tiles & confirm dialog), shot:profiles-alpha no green borders, regress 39/39 ok | 25/10/2026 |
| 12.3 | (this) | `npm test && npx lng build && node scripts/ui-check.mjs ... shot:details-buttons && check:regress` | L0 85/85, ok:true, buttons dynamically sized (label width + 80px) with 20px gap, shot:details-buttons no overlaps, regress 40/40 ok | 25/10/2026 |
| 12.4 | (this) | `npx lng build && node scripts/ui-check.mjs ... shot:grid-first-row && check:regress` | ok:true, grid top moved to y=170 with header h=140 (>12px gap to bar), shot:grid-first-row border complete on 4 sides, regress 41/41 ok | 25/10/2026 |
| 12.5 | (this) | `npx lng build && node scripts/ui-check.mjs ... shot:profile-menu && check:regress` | ok:true, profile menu zIndex:10 on colors.background covers home completely, arrows swallowed, back restores home header focus, regress 42/42 ok | 25/10/2026 |
| 12.6 | (this) | `npm test && npm run check && npm run check:regress` | L0 86/86, check ok, player error dialog with Indietro button on startPlayback/video error, $fatal on non-401 login error (App.js line 252), regress 42/42 ok | 25/10/2026 |
| Judge 12 | (this) | `npm run check` 0; `check:regress` 44/44 (new `15.1-search-keyboard`, `15.2-exit-on-top`; `10.1-search` now presses Right 10 times to reach the results) | search keyboard: Right no longer blocked in search mode (Dino saw it on the TV), keys 74x92 and font 36, box aligned; `ExitDialog` `zIndex: 10` (exit buttons were behind the posters); screenshots `search-kbd.png`, `exit-dialog.png` seen | 25/10/2026 |
| Gate 12 | (this) | `npm run check + check:regress` | self-check ok: L0 86/86, L1 API ok, L1 UI ok, regress 42/42 ok (contrast, alpha, button layout, grid spacing, profile menu cover, player error & login error) | 25/10/2026 |
| 14.1 | (this) | `npm test && npx lng build && node scripts/ui-check.mjs ... shot:player-title shot:player-episode && check:regress` | L0 95/95, ok:true, PlayerHeader title block (44px bold + subtitle S{season} E{episode} · {title}), PlayerView shrunk from 771 to 724 lines, shot:player-title & player-episode readable with top gradient, regress 45/45 ok | 25/10/2026 |
| 14.2 | (this) | `npm test && npx lng build && node scripts/ui-check.mjs ... shot:player-controls && check:regress` | L0 98/98, ok:true, ControlsRow (Dall'inizio, Prossimo episodio, Sottotitoli, Audio) under progress bar, layer opens on Up/Down without pausing, auto-hide 5s, Back closes layer, regress 46/46 ok | 25/10/2026 |
| 14.3 | (this) | `npm test && npm run check:api && node scripts/ui-check.mjs ... shot:cast-panel shot:cast-card && check:regress` | L0 104/104, L1 API ok (cast >= 1 actor), ok:true, Cast pill above bar opens CastPanel on left side, 15 actors with round photos, in-memory cached details with bio/titles, Back closes panel to pill, regress 47/47 ok | 25/10/2026 |
| Judge 14.3 | (this) | `npm test` 105/105, `npm run check` 0, regress 47/47 (14.3 alone re-run), real cast of a series episode with updated metadata seen in `judge-cast-fixed.png` | cast photos drawn at 20% opacity (tint `0x33ffffff` on the textured element) -> full opacity; birth date shown as "28 luglio 1974" (`formatBirthDate`, tested) | 25/10/2026 |
| 14.4 | (this) | `npm test && npx lng build && node scripts/ui-check.mjs ... shot:player-episodes && check:regress` | L0 108/108, ok:true, EpisodesPanel at bottom with 16:9 cards, E{n} and title, progress bar, current episode marked 'In riproduzione' and focused with scroll, shot:player-episodes readable on dark gradient, regress 48/48 ok | 25/10/2026 |
| 14.5 | (this) | `npm run check && npm run check:regress` | L0 108/108, check 0, regress 49/49 ok, key map verified: film/episode x closed/open x Up/Down/Left/Right/OK/Back (closed: Up/Down open layer without pause, Left/Right seek +-10s, OK play/pause, Back exits; open: Up/Down moves pill/controls/episodes, Left/Right moves items, OK executes button/episode/cast, Back closes layer without exit) | 25/10/2026 |
| Gate 14 | (this) | `npm run check + check:regress` | self-check ok: L0 108/108, L1 API ok, L1 UI ok, regress 49/49 ok (title block, controls row with auto-hide, cast panel with in-memory cache, episode list of the season, key map verified) | 25/10/2026 |
| Judge 14 | (this) | `npm test` 108/108; scenario `14.6-player-episode-switch` (reproduced the bug first: ended on details, no player) | (1) PlaybackInfo without `MediaSourceId` ignores `AudioStreamIndex` (transcoding URL kept audio 1; with the id it gets 2): `mediaSourceId` sent when the audio changes; (2) choosing an episode / next episode did `_close()` (goes back, view destroyed) and then `fireAncestors('$playItem')` found nobody: now `_stopPlayback()` + `$playItem(..., {replace:true})`, which also passes `episodesWithoutKeys` (it was dropped) | 25/10/2026 |




| Judge 14b-d | (this) | `npm test` 113/113, `npm run check` 0, regress 52/52; Dino on the TV: audio change at once on "Brand New Day", "Riprendi da" kept after Back, panel OK ("funziona tutto adesso") | (b, c) audio: TV plays the raw file (direct play), whose default track wins; the chosen track is now applied at start and on change. Back sent the position after `VideoPlayer.close()` (0) and erased the resume point. (d) `TrackPanel` (Prime-like pills and lists) replaces the full-screen `TrackMenu`; on direct play audio switches through `<video>.audioTracks` (present on the TV), server stream as fallback. T14: 16.3 speed removed, menu references moved to `TrackPanel` | 26/10/2026 |
| 16.0 | (this) | `npx lng build && node scripts/ui-check.mjs ... shot:timeline-focus && check:regress` | ok:true, timeline focus row between pill and buttons (Up/Down navigation), visible knob and brighter bar on focus, Left/Right seek +-10s, OK play/pause, shot:timeline-focus, regress 53/53 ok | 26/10/2026 |
| Judge 16.0 | (this) | `npm test` 113/113, `npm run check` 0, regress 53/53; extra browser check: OK on the timeline pauses and resumes | Approved. Notes: statements joined on one line in `PlayerView.js` to stay under the line limit (method issue); 14.3/14.5 scenarios edited (needed, declared); knob 20 px, to judge on the TV. T14 merged with 16.0 only and paused: stabilization first (Dino) | 26/10/2026 |
| Public alpha prep | (this) | `npm test`, `npm run check:ui`, `npm run check:regress`, `npm run package` (+ `--private`), browser first launch without server, public ipk on the TV | 113/113; check:ui ok:true; regress 53/53; public ipk: config `{}`, id `com.dinuxnode.lupoflin`, amber assets; private ipk: server + red brand, id `com.dinuxnode.lupoflix`; browser: server screen → typed address → Connetti → profiles; TV: public build installed next to the private one, opens on the server screen | 26/10/2026 |
