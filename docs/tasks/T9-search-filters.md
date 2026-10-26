# Task: Stage 10 - search, sort and filters

## Goal
Find anything fast: a Netflix-style search screen with the on-screen keyboard and live results, and in the
library grids sort and filter options ("Non visti", "Preferiti", by year, by rating).

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV.**
- You may create/change: `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `scripts/api-smoke.mjs` (add checks
  only), `src/views/SearchView.js` (new), `src/views/GridView.js`, `src/views/HomeView.js` (header only),
  `src/App.js`, `src/components/` (any file; reuse `Keyboard`, `Tile`, `Row`), `src/theme.js` (new
  sizes/colours only), `test/ui/scenarios.json`, `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules".

## Before you start
Procedure: `docs/AUTOPILOT.md`. `/Items` parameters and enums: `docs/ref/jellyfin-api.md` "Verified for Stages
4, 6-10".

## Prerequisite
Task T8 is merged into `develop`.

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `10.N` without its commit.

## Required result, per step
**10.1 Search.** Header: a "Cerca" entry (magnifier drawn with Lightning shapes or text "Cerca") left of the
avatar, reached with Up like the avatar. `SearchView`: keyboard on the left (the `Keyboard` of Stage 6 with
a `Spazio` key added), results grid on the right (poster tiles, 4 columns). Results come from `/Items` with
`searchTerm, recursive: true, includeItemTypes: Movie,Series,Episode, limit: 40`, asked 300 ms after the last
key (older answers are dropped if a newer query was sent). Empty query: "Cerca titoli, serie ed episodi".
No results: "Nessun risultato per «…»". Right from the keyboard enters the results; Enter opens the details.
Probe: `probe.view('search')`, `probe.data('query', text)`, `probe.data('results', n)`.
- Check: L0 (search URL); UI: `... profile:dev wait:home "until:s.data.rows && s.data.rows.length>1" key:Up key:Left key:Enter wait:search type:toy "until:s.data.results>0" sleep:1000 visible:20 shot:search key:Right key:Enter wait:details`.
  (If the header order differs because of the billboard of Stage 8, use the keys that reach "Cerca" and say so in the commit body.)

**10.2 Sort and filter in the grid.** A bar above the grid: "Ordina: A-Z" and "Filtro: Tutti"; Up from the
first grid row reaches it. Ordina cycles A-Z (`SortName`), Aggiunti di recente (`DateCreated`, descending),
Anno (`ProductionYear`, descending), Voto (`CommunityRating`, descending); Filtro cycles Tutti, Non visti
(`filters: IsUnplayed`), Preferiti (`filters: IsFavorite`). Changing either reloads from the first page;
paging and virtualisation keep working. The choice is remembered per library in `localStorage`.
- Check: L0 (items URL with sort and filter); UI on "Film": `... wait:grid "until:s.data.loaded>0" key:Up key:Enter "until:s.data.sort==='DateCreated'" "until:s.data.loaded>0" visible:20 shot:grid-sorted`.

## How to work
As in `docs/AUTOPILOT.md`.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre".
