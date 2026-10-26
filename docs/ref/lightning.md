# Lightning in this project

Versions: `@lightningjs/core` 2.20.5, `@lightningjs/sdk` 5.5.7, `@lightningjs/cli` 2.14.2 (`lng`).
Everything is drawn on one WebGL canvas: **no HTML for UI**. Tests cannot inspect the DOM, they read the
probe (`src/lib/probe.js`) through `scripts/ui-check.mjs`.

## Patterns used here (copy them, do not invent new ones)
| Need | How it is done | Example |
|---|---|---|
| A screen | Class extending `Lightning.Component`, shown by `App._show(Type, props, name)` | `src/views/ProfilesView.js` |
| Props | Plain properties patched at creation: `{ type: Tile, w, h, label, imageUrl }`, read in `_init()` | `src/components/Tile.js` |
| Template | `static _template()` returns refs in PascalCase (`Title`, `Items`) | any view |
| Find a child | `this.tag('Items')`, children list `this.tag('Items').children` | `Row.js` |
| Focus | `_getFocused()` returns the focused child; `_focus()` / `_unfocus()` react; after changing the index call `this._refocus()` (or let a key handler return) | `HomeView._setRow` |
| Keys | `_handleLeft/Right/Up/Down/Enter/Back()`. Return `false` = not handled, the key bubbles to the parent | `Row._handleLeft` |
| Child to ancestor call | `this.fireAncestors('$name', ...args)`; the ancestor defines `$name(...)` | `$rowSelect`, `$loggedIn` |
| Animation | `element.setSmooth('x', value, { duration: 0.2 })`; keep durations 0.15-0.25 s | `Row._setIndex` |
| Text | `text: { text, fontFace: font, fontSize, textColor, wordWrapWidth, maxLines, textOverflow: 'ellipsis' }`, `font` from `src/theme.js` | `Tile` |
| Remote image | `texture: Img(url).cover(w, h)` with `Img` from the SDK; ask the server for the drawn size (`maxWidth`/`maxHeight`) | `Tile._init` |
| Local image | `src: Utils.asset('images/x.jpg')` (path relative to `static/`) | `SplashView` |
| Rounded corners | `shader: { type: Lightning.shaders.RoundedRectangle, radius }` | `Tile` |
| Colours, sizes | Only from `src/theme.js` (ARGB numbers `0xffRRGGBB`) | - |
| Timers | `setTimeout` stored on `this`, cleared in `_detach()`; check `this.attached` in callbacks | `QuickConnectView` |

## Traps already hit (each one cost a debugging round)
1. **Reserved method names.** Never name your own method like a lifecycle hook. Component reserves:
   `_construct _build _setup _init _attach _detach _firstActive _active _inactive _firstEnable _enable _disable
   _focus _unfocus _focusChange _getFocused _setFocusSettings _handleFocusSettings _refocus _signal
   _onSetup _onAttach _onDetach _onEnabled _onDisabled _onActive _onInactive _onResize`, and Element uses
   `_update*`, `_set*Flag`, `_getRender*`, `_enableTexture*`. A method called `_build` was run by the
   constructor and crashed the home (24/10/2026). Use names like `_populate`, `_load`, `_move`.
   Check: `grep -c "    _myName(" node_modules/@lightningjs/core/dist/lightning.esm.js` must print 0.
2. **alpha 0 means "do not load".** Lightning skips textures of invisible elements, so an image that starts
   at `alpha: 0` and waits for `txLoaded` to fade in never loads. Start at `alpha: 0.001`.
3. **zIndex escapes its parent.** A child with `zIndex` set is drawn in the z-context of the nearest ancestor
   with `forceZIndexContext: true` (or the root). Without it the focused card was the only thing visible.
   Containers of scaled/raised cards need `forceZIndexContext: true`.
4. **Back closes the app.** If no component handles Back, the SDK Application calls `closeApp()` and
   destroys everything. Root screens must define `_handleBack()`; `App._handleBack()` swallows it.
5. **`textAlign` does nothing without a width.** To centre a label use `x: w / 2, mountX: 0.5`.
6. **No zIndex at the root.** `forceZIndexContext` + `zIndex` on `App` hid every view (screen empty, probe
   still "home", all checks green). Keep overlays on top by child order: `App` has `Background`, `Views`, `Perf`.
   Any visual change is checked with the `visible:` step of `ui-check`, never with the probe alone.
7. **Settings keys.** Key codes are mapped in `settings.json` → `appSettings.keys`; Escape and Backspace are
   mapped to Back for the browser, 461 is the webOS remote Back.
8. **Transparent images need `hasAlpha: true`.** With `useImageWorker: false` (our setting) Lightning uploads an
   image with alpha only if its URL contains `.png` (`loadSrcTexture`, `lightning.esm.js` ~11827). Jellyfin URLs
   never do, so logos were drawn on a black box. Use `texture: { ...Img(url).contain(w, h), hasAlpha: true }`
   for logos or any image with transparency (25/10/2026).
9. **Headless Chromium shows a white page behind the video** (clear colour transparent during playback);
   on the TV it is black. Letterbox bars in `shot:player` screenshots are not a defect: do not draw bars (checked on
   the TV, 25/10/2026).
10. **User and avatar pictures need `hasAlpha: true`.** User pictures and GetAvatar icons are PNGs with transparent
    corners whose hidden colour can be green (71, 112, 76) or black. With `useImageWorker: false`, Lightning treats
    URLs without `.png` as opaque, rendering coloured borders around rounded avatar squares and circles. Use
    `texture: { ...Img(url).cover(w, h), hasAlpha: true }` (25/10/2026).

## Facts for the next stages (read in the source, 25/10/2026)
- **Textures already load lazily.** An element loads its texture only when it is *active*: visible, alpha > 0
  and within the screen plus a 100 px margin (`withinBoundsMargin`, `lightning.esm.js` ~3703-3790 and
  `_isActive` ~7201). A row that scrolls into view starts loading only 100 px before it appears. To prefetch,
  set `boundsMargin: [left, top, right, bottom]` on a container (applies to all its descendants), e.g.
  one card width to the right. What does **not** come for free: elements cost memory and CPU even when
  off-screen, so long lists must create only the elements near the focus (virtualisation).
- **Any key that is not in `settings.json`** reaches `_captureKey(e)` / `_handleKey(e)` (`lightning.esm.js`
  ~14635) with the browser `KeyboardEvent`: `e.key` is the character (`'a'`, `'1'`, `'.'`). Use it for
  typing; return `false` when not handled. `ui-check` step `type:<text>` sends such keys.
- **Clear colour**: `this.stage.setClearColor([r, g, b, a])` (0-1 floats, `lightning.esm.js` ~14250). The
  settings start it at `0xff141414` (opaque).
- **VideoPlayer** is `import { VideoPlayer } from '@lightningjs/sdk'`, code in `@metrological/sdk`:
  docs `node_modules/@metrological/sdk/docs/plugins/videoplayer.md` (methods ~line 23, events ~432), source
  `node_modules/@metrological/sdk/src/VideoPlayer/index.js`. `VideoPlayer.consumer(this)` makes the component
  receive `$videoPlayer<Event>` calls (`$videoPlayerPlaying`, `$videoPlayerTimeUpdate`, `$videoPlayerEnded`,
  `$videoPlayerError`, ...). It creates one `<video id="video-player">` appended to `body` with
  `style.zIndex = '1'` (index.js ~117-140): **above** the WebGL canvas, so nothing Lightning draws is visible
  over it until the video goes **behind** the canvas and the canvas is transparent where the video shows.
  Not verified yet: the step that builds the player proves its way with a screenshot.

## Build and run
- `npx lng build` → `build/` (ES6, used by `ui-check`). `lng dist` is for packaging (later stage).
- No environment variables reach the bundle: runtime config is `static/config.local.json`, read with
  XHR (`file://` on the TV) in `App._loadConfig`.
- `npm run dev` (`lng dev`) never exits: do not run it in the foreground.

## Where to look things up
`ref/Lightning/docs/Components/`, `ref/Lightning/docs/HandlingInput/`, `ref/Lightning/docs/Transitions/`,
`ref/Lightning/docs/RenderEngine/` and `node_modules/@lightningjs/sdk/docs/plugins/*.md`.
Search first, then read only the matching section (see `docs/ref/README.md`).
