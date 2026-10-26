# Task: Stage 6 - server screen, password-less profiles, profile switch

## Goal
Netflix-style first run: the user types the Jellyfin server address on an on-screen keyboard, it stays saved
until "Disconnetti". "Chi vuole guardare?" shows every profile; one OK enters (no password, no Quick
Connect when not needed); a profile used before enters instantly. From the home, the profile avatar in the
header switches profile or disconnects.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV.**
- You may create/change: `src/lib/session.js`, `test/session.test.mjs`, `src/lib/jellyfin.js`,
  `test/jellyfin.test.mjs`, `scripts/api-smoke.mjs` (add checks only), `src/App.js`, `src/views/ServerView.js`
  (new), `src/components/Keyboard.js` (new), `src/views/ProfilesView.js`, `src/views/QuickConnectView.js`,
  `src/views/HomeView.js` (header only), `src/components/ProfileMenu.js` (new), `src/components/Tile.js`,
  `src/components/Button.js`, `src/theme.js` (new sizes/colours only), `test/ui/scenarios.json`,
  `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules". No server address, user name or token in tracked files:
  scenarios use the fixtures `{{serverHost}}` and `profile:dev`.

## Before you start
Procedure: `docs/AUTOPILOT.md` (self-review, screenshots, scenario, commit body "Requirements -> changes").
New `ui-check` steps exist for this task: `type:<text>`, `query:<k=v>`, `reload`, `{{fixture}}` (see the header
of `scripts/ui-check.mjs`). `{{serverHost}}` is the server without `http://`, from `.tmp/fixtures.json`
(written by `npm run check:api`).

## Prerequisite
Task T3 is merged into `develop` (`git log --oneline develop | grep -c "merge task/T3-home-polish"` = 1).

## Material
- `docs/ref/jellyfin-api.md`: "Facts about the home server" (`HasPassword` is unreliable: always try the empty
  password), `POST /Sessions/Logout`.
- `docs/ref/lightning.md`: "Facts for the next stages" (typed keys reach `_handleKey(e)`).
- `src/components/ExitDialog.js` and `App.$askExit` / `$exitConfirmed`: the overlay pattern to copy for `ProfileMenu`.

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `6.N` without its commit.

## Required result, per step
**6.1 Storage.** Rewrite `src/lib/session.js` (pure, `storage` injected, keep `deviceId`):
`loadServer(storage)` / `saveServer(storage, url)` (key `lupoflix.server`); `loadUsers(storage)` →
`{ [userId]: { userId, userName, token } }` and `saveUser(storage, auth)` (key `lupoflix.users`, also sets
`lupoflix.lastUser`); `forgetUser(storage, userId)`; `lastUserId(storage)`; `clearAll(storage)` (removes server,
users, lastUser, keeps the device id). Migration: an old `lupoflix.session` becomes server + one user, then is
removed. Broken JSON reads as empty. Remove `loadSession`/`saveSession`/`clearSession` and adapt `App` so that
behaviour does not change yet (server still from the config, session = the last user).
- Check: L0 tests in `test/session.test.mjs` (fake storage): round trip, two users, `forgetUser`, `clearAll`
  keeps the device id, migration, broken JSON → `npm test` `# fail 0`; then `npm run check` and `check:regress`.

**6.2 Server screen.** Boot order for the server: saved server (`loadServer`) → else the URL query `server`
when present (an empty `?server=` means "no default", for tests) → else `config.server`. No server →
`ServerView`. `Keyboard` component: keys drawn in Lightning, 5 rows: `1 2 3 4 5 6 7 8 9 0`, `q w e r t y u i o p`,
`a s d f g h j k l :`, `z x c v b n m . / -`, then a wide row `Connetti`, `Cancella`, `Svuota`. D-pad moves
(Up/Down keep the nearest x), OK presses; a typed character (`e.key.length === 1`) is added directly. It calls
`$keyboardInput(text)` and, on `Connetti`, `$keyboardSubmit(text)`. `ServerView` (Netflix look: logo on
top, title "Collega il tuo server Jellyfin", the address field as a rounded box, keyboard below, status line):
starts with `http://`, focus on `1`. Submit: `normalizeServerUrl` → `publicInfo()`; ok → `saveServer`, probe
event `server_saved` with `{ name: ServerName }`, go to the profiles; failure → status "Server non
raggiungibile: controlla l'indirizzo", stay, probe event `server_error` (not `probe.error`: it is a user
mistake, not an app error). Back → the exit dialog. Probe: `probe.view('server', { text })`,
`probe.data('text', text)` on every change, `probe.focus({ key })`.
- Check: `npx lng build > .tmp/build.log 2>&1; npm run check:api > .tmp/api.json; node scripts/ui-check.mjs --brief query:server= wait:server visible:5 shot:server "type:{{serverHost}}" key:Down key:Down key:Down key:Down key:Enter wait:profiles reload wait:profiles`
  and the error case: `query:server= wait:server type:nessuno.invalid key:Down key:Down key:Down key:Down key:Enter "until:s.events.some(e=>e.type==='server_error')" "expect:s.view==='server'"`.

**6.3 Profiles, no passwords.** `ProfilesView` in Netflix style: title "Chi vuole guardare?", square avatars
(200 px, rounded 12) with the user image through `Tile` (fades in when loaded; initial letter otherwise),
name below. Focus starts on `lastUserId`. Enter on a profile: a saved token for that user → `me()` with it,
ok → home with no login request (probe event `login` `{ user, cached: true }`); 401 → `forgetUser`, go on.
Otherwise `authenticateByName(name, '')` → `saveUser` → home (`login` `{ user, cached: false }`); 401 →
`QuickConnectView` for that user (as today). Remove the `devUser`/`devPassword` shortcut from `App`
(`devUser` stays only as the name `profile:dev` picks). Back on the profiles → exit dialog.
- Check: `... profile:dev wait:home "until:s.data.rows && s.data.rows.length>1" reload wait:profiles visible:5 shot:profiles key:Enter wait:home "expect:s.events.some(e=>e.type==='login' && e.cached===true)"`.
  Existing scenarios start with `profile:dev`: they must stay green unchanged.

**6.4 Switch profile and disconnect.** Home header: replace the user name text with the avatar (56 px, round,
image or initial) and the name; Up from the first row focuses it (`probe.focus({ area: 'header', label })`),
Down goes back. Enter opens `ProfileMenu` (overlay like `ExitDialog`, `probe.data('dialog', 'profile')`):
"Cambia profilo" → profiles screen, tokens kept; "Disconnetti" → `client.logout()` (POST `/Sessions/Logout`)
for every saved user token, errors ignored, then `clearAll` → `ServerView`; "Annulla" or Back closes.
- Check: L0 test for `logout` (method, path, token header); switch:
  `... profile:dev wait:home "until:s.data.rows && s.data.rows.length>1" key:Up "expect:s.focus.area==='header'" key:Enter "expect:s.data.dialog==='profile'" key:Enter wait:profiles visible:5`;
  disconnect: `query:server= wait:server "type:{{serverHost}}" key:Down key:Down key:Down key:Down key:Enter profile:dev wait:home key:Up key:Enter key:Down key:Enter wait:server reload wait:server`.

## How to work
As in `docs/AUTOPILOT.md`. In 6.2 and 6.4 look at the screenshots: keys aligned, focused key clearly visible,
text not cut.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre".
