# LG webOS facts

Status: verified on Dino's TV on 24/10/2026 unless marked otherwise.

## The TV
LG **55QNED85T6C** (2024), sdkVersion 10.3.2, firmware 33.31.75, registered in ares as `tv`
(`npm run tv info`). Web engine: **Chrome 120** (`WebAppManager` user agent) → ES6 build.
Remote DevTools: `http://<tv-ip>:9998/json/list` while Developer Mode is on. `ui-check --tv` uses it to read
the probe, send keys (`Input.dispatchKeyEvent` works) and take screenshots (`Page.captureScreenshot` works).

## Display
- The web app UI plane is 1920x1080 also on 4K panels; the TV scales it. Video plays on a separate plane and
  can be 4K. So the Lightning stage stays 1920x1080 and images larger than 1920 px only waste GPU memory.
  Verified: the 4K TV reports `screen` 1920x1080 and `innerWidth`x`innerHeight` 1920x1080 (telemetry).
- The app runs from `file:///media/developer/apps/usr/palm/applications/<id>/`: local files are read with
  XHR (status 0), not `fetch`.

## Keys (keydown `keyCode`)
| Key | Code | Mapped in `settings.json` |
|---|---|---|
| Arrows | 37-40 | Left, Up, Right, Down |
| OK | 13 | Enter |
| Back | 461 | Back |
| Play / Pause / Stop / Rewind / FastForward | 415 / 19 / 413 / 412 / 417 | Play, Pause, Stop, Rewind, FastForward |
| Red / Green / Yellow / Blue | 403 / 404 / 405 / 406 | not yet |

The official app handles 461 in `frontend/js/index.js` and calls `webOS.platformBack()` (→
`window.PalmSystem.platformBack()`) to leave the app from the root screen: that only sends it to the background.
LupoFlin exits with `window.close()` after its "Vuoi uscire?" dialog (`src/components/ExitDialog.js`).
Verified on the TV 24/10/2026: `npm run tv running` lists the app before, not after "Esci".

## Launcher icon
`appinfo.json` → `icon` = `static/icon.png` (80x80) and `largeIcon` = `static/largeIcon.png` (130x130): the red
flame "L" on black, since 24/10/2026 23:00. The launcher may keep the icon of an earlier install of the same
version: bump `version` when the icon changes, and if it still shows the old one, remove the app
(`ares-install -d tv --remove com.dinuxnode.lupoflin`) and install again. To verify: Dino looks at the
launcher (no API exposes it).

## appinfo.json (official app, for reference)
`id`, `version`, `vendor`, `type: "web"`, `main: "index.html"`, `title`, `icon` (80x80), `largeIcon` (130x130),
`bgColor`, `splashBackground`, `disableBackHistoryAPI: true`. Ours: `appinfo.json` in the repo root.

**`requiredACG` is mandatory** (LG notice, 24/10/2026): ACG (Access Control Group) is active since webOS TV 26;
from September 2026 the CLI warns when the field is missing, from March 2027 `ares-package` refuses to package
and the Seller Lounge refuses submissions. Apps that call no Luna API declare `"requiredACG": []` (ours, today).
A step that adds a Luna service call (`luna://...`, `webOS.service.request`) must add its ACG group to this
array in the same commit: look it up in LG's ACG Developer Guide, do not guess the name.

## Tools (`@webos-tools/cli`, in devDependencies)
```bash
npx ares-setup-device --list                 # registered devices
npx ares-setup-device                         # add the TV: name tv, port 9922, user prisoner
npx ares-novacom --device tv --getkey         # passphrase shown in the Developer Mode app
npx ares-device -i -d tv                      # webOS version: first TV check
npx ares-package <dir> -o <outdir>            # build the .ipk
npx ares-install -d tv <file.ipk>
npx ares-launch -d tv <app id>
npx ares-inspect -d tv --app <app id> --open  # remote DevTools
```
The Developer Mode session on the TV expires: extend it in the Developer Mode app before working.
