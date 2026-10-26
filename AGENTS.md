# Project rules: Lupoflix (Jellyfin client for LG webOS, LightningJS)

These add to `~/.pi/agent/AGENTS.md` and win on conflict. Reply to the user in Italian.

## What this is
A Netflix-like Jellyfin client for LG webOS TV. The UI is drawn by LightningJS on WebGL: **no HTML for UI**.
The Jellyfin server is only a REST API. Plan and progress log: `docs/PLAN.md`. Your task: the file given
to `/task` (in `docs/tasks/`).

## Map (read only what your step needs)
| Path | What |
|---|---|
| `src/lib/jellyfin.js` | REST client, pure JS. Every endpoint lives here and only here |
| `src/lib/session.js`, `src/lib/probe.js` | localStorage session; test probe (`window.__jlt`) |
| `src/App.js` | Boot, config, swaps one full-screen view at a time |
| `src/views/*View.js` | One screen per file |
| `src/components/` | `Tile` (card), `Row` (horizontal list), `Button`, `ExitDialog`; later `Keyboard`, `ProfileMenu`, `Osd`, ... (see the task) |
| `src/lib/*.js` | Pure logic with L0 tests: `paging`, later `avatarGrid`, `homeCache`, `deviceProfile`, `playback`, `vtt` |
| `src/theme.js` | Colours and sizes: the only place for them |
| `test/*.test.mjs` | L0 unit tests (`node --test`) |
| `scripts/api-smoke.mjs`, `scripts/ui-check.mjs` | L1 checks against the real server and in headless Chromium |
| `docs/ref/` | **Read these instead of searching the web or `ref/`**: API, Lightning, webOS facts |

## Never read
`node_modules/` (except the grep in `docs/ref/lightning.md`), `build/`, `dist/`, `.tmp/` (except the file a
check names), `package-lock.json`, `*.map`, `static/fonts/`, `ref/` whole files. `ref/jellyfin-openapi.json`
only through the Python snippets in `docs/ref/jellyfin-api.md`. Every `grep` ends with `| cut -c1-200 | head -20`.

## Checks (run them, never claim them)
| Level | Command | Pass |
|---|---|---|
| L0 unit | `npm test 2>&1 \| tail -8` | `# fail 0` |
| L1 API | `npm run check:api > .tmp/api.json; echo $?` then `grep -c '"ok": false' .tmp/api.json` | exit 0 and count 0 |
| L1 UI | `npm run check:ui 2>&1 \| tail -1` | one JSON line with `"ok":true` |
| Custom UI scenario | `npx lng build > .tmp/build.log 2>&1; node scripts/ui-check.mjs --brief profile:dev wait:home ...` | `"ok":true` |
| Everything | `npm run check > .tmp/check.log 2>&1; echo $?; tail -1 .tmp/check.log` | `0` |
| Regression (all finished steps) | `npm run check:regress 2>&1 \| tail -15` | last line `N/N scenarios ok` |
| L3 on the TV | `npm run package -- --private --perf && npm run tv install .tmp/ipk/*.ipk && npm run tv -- --private launch`, then `node scripts/ui-check.mjs --brief --tv wait:any ...` | `"ok":true` |

TV commands only when the task authorizes them and the TV is on (`npm run tv info` answers).

`ui-check` steps: `wait:<view>`, `key:<Left|Right|Up|Down|Enter|Back>`, `profile:dev`, `sleep:<ms>`,
`type:<text>` (typed characters), `query:<k=v>` (reload with a URL query), `reload` (localStorage kept),
`{{name}}` (real ids from `.tmp/fixtures.json`, written by `npm run check:api`: `movieId`, `seriesId`,
`episodeId`, `browserPlayableId`, `subtitledPlayableId`, `serverHost`),
`shot:<name>` (PNG in `.tmp/ui/`), `expect:<js on s>`, `until:<js on s>`, `visible:<percent>` (share of the
screen that is not background: home ≈ 50, profiles ≈ 5; **every scenario that checks a screen ends with
`visible:`**, because the probe can be right while nothing is drawn). `s` is the probe state:
`{ view, focus, data, events }`. A new screen must call `probe.view(name, data)` and `probe.focus(...)` so it
can be tested. If a run fails, rerun without `--brief` and read only `steps` and `appErrors`.

## Hard rules
- UI only in Lightning. Allowed DOM: none so far (the SDK `VideoPlayer` `<video>` will be the only exception).
- No new dependencies of any kind unless the task authorizes them.
- Endpoint or field not in `docs/ref/jellyfin-api.md`: query the spec (snippets there) **before** writing code,
  and add the verified row to that file in the same commit.
- Lightning: before adding a method `_name`, run the reserved-name grep in `docs/ref/lightning.md` (must be 0).
- Never write server addresses, user names, passwords or tokens in tracked files. They live only in
  `static/config.local.json` (git-ignored). Tests use `http://jellyfin.test`, `token-test`.
- One commit per step: `lupoflix: step S.N - <what>`, containing the step's files and one new row in the
  Progress log of `docs/PLAN.md` (step, `(this)`, check command, real result, date). Touch only the files the
  step lists.
- No unrequested behaviour changes, even inside files you may edit. If you think something else needs fixing,
  write it under "Non verificato / da proporre" in your report and leave the code alone. (24/10/2026: step 2.1
  silently switched library images to `ParentId`, so every library showed the same picture.)
- A step is done only when its check passes in **this** session. Failed 3 times: stop, write what you tried
  in the log row with result `BLOCKED`, and report.
