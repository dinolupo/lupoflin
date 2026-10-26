# Task: Stage 5a - details layout, "Continua a guardare", episode page

## Goal
Fix the series page layout (title must never leave the screen), add the Netflix "Continua a guardare" row at
the top of the home with a progress bar, and open a details page for a single episode.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV.**
- You may create/change: `src/views/DetailsView.js`, `src/views/HomeView.js`, `src/components/Tile.js`
  (only the optional `progress` prop of step 5.2), `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`,
  `scripts/api-smoke.mjs` (add checks only), `src/App.js` (only if step 5.3 needs it), `src/theme.js`
  (new sizes/colours only), `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules", in particular **no unrequested behaviour changes**.

## Before you start
This task uses the procedure in `docs/AUTOPILOT.md` as updated on 25/10/2026: self-review of the diff,
look at the screenshots, scenario in `test/ui/scenarios.json`, commit message with "Requirements -> changes".

## Prerequisite
Steps 1.1-1.4 and 2.1-2.4 have their commits, and commit "judge fix: library images" exists
(`git log --oneline | grep -c "judge fix"` ≥ 1).

## Material
- `src/views/DetailsView.js` (~240 lines, written in step 2.2/2.4): read it in ranges.
- `docs/ref/jellyfin-api.md`: section "Verified for Stage 5a" (Resume endpoint, `UserData` fields).
- Reviewer screenshot of the bug (`.tmp/ui/judge-series.png` if present): with the focus on "Stagioni" the
  content scrolls up so far that the title and the year are cut at the top of the screen.

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `5.N` without its commit.

## Required result, per step
**5.1 Series layout.** In `DetailsView`, title and meta line are fixed (not inside the part that moves).
Overview, button, seasons row and episodes row live in one container (`Body`). Focus on the button: `Body`
at its original position, overview visible. Focus on seasons or episodes: overview `alpha 0`, `Body` moves up
(`setSmooth('y', ...)`, 0.25 s) so that the focused row is fully on screen, below the meta line, labels
included. Publish where the focused row is: `probe.data('focusRect', { top, bottom })` in screen pixels
(= Body y + row y, + row height for bottom; plain arithmetic on your own layout numbers), and make every
focus report say where it is: `probe.focus({ section: 'button' | 'seasons' | 'episodes', index, label })`.
- Check (Serie TV, home row 0 index 3, first series): `... key:Right key:Right key:Right key:Enter wait:grid "until:s.data.loaded>0" key:Enter wait:details "until:s.data.seasons>0" key:Down key:Enter "until:s.data.episodes>0" key:Down sleep:600 "expect:s.data.focusRect.top>=330 && s.data.focusRect.bottom<=1060" visible:20 shot:series-episodes`
  and the same scenario stopping after the first `key:Down` (seasons focused) with the same `expect`.

**5.2 "Continua a guardare".** Client: `urls.resume(base, userId)` → `/UserItems/Resume` with `userId`,
`limit: 20`, `mediaTypes: 'Video'`, `fields: 'PrimaryImageAspectRatio'`; `client.resume(userId)` returns
`mapItem` items plus `progress` (0-1, from `UserData.PlayedPercentage / 100`, `null` if missing).
Home: first row titled "Continua a guardare" (wide tiles, labels) when the list is not empty; nothing when
empty. `Tile` gets an optional `progress` prop: a 6 px bar at the bottom of the card, grey track
(`0xff555555`), red fill (`colors.brand`) `w * progress` wide. Enter → details page of that item.
- Check: L0 tests (URL, progress mapping incl. missing `UserData`), `api-smoke` check `resume` (count ≥ 0, no
  error), UI: `... wait:home "until:s.data.rows && s.data.rows.length>1" "expect:s.data.rows[0].title==='Continua a guardare' && s.data.rows[0].count>0" sleep:1500 visible:20 shot:home-resume key:Enter wait:details`.
  Note: the libraries row becomes row 1, so home focus indices in older scenarios shift by one row. This is
  the one case where you **must** update existing scenarios in `test/ui/scenarios.json` (`1.1`-`2.4`, `exit-dialog`
  if needed): add one `key:Down` after the `until:` that waits for the rows, adjust `s.focus.row` numbers by +1,
  nothing else. List them in the commit body. Do not edit old task files.

**5.3 Episode page.** Enter on an episode opens `DetailsView` for that episode (push, like a film): title
`"S<season>:E<episode> <name>"` when `ParentIndexNumber`/`IndexNumber` exist, the series backdrop
(`mapDetails` already falls back to `ParentBackdropItemId`), overview, "Riproduci". No seasons/episodes rows
for an episode. The probe `name` of the episode page is the displayed title. Back returns to the series page
with the episodes row focused on the same episode.
- Check: series scenario of 5.1 up to the episodes row, **with one extra `key:Down` right after `wait:home`**
  (since 5.2 the libraries row is row 1), then `key:Right key:Enter wait:details "expect:/^S\\d+:E\\d+ /.test(s.data.name)" visible:20 shot:episode key:Back wait:details "until:s.focus && s.focus.section==='episodes' && s.focus.index===1"`

## How to work
As in `docs/AUTOPILOT.md`: full check after each step, log row in the same commit `lupoflix: step 5.N - ...`.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre".
