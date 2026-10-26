# References: what to read, and how

Read the distilled files in this folder first. They are short and verified. Go to the raw material in `ref/`
(git-ignored, recreate with `scripts/fetch-refs.sh`) only with `grep`, never whole files.

| File | Contents | Verified against |
|---|---|---|
| `jellyfin-api.md` | Endpoints, parameters, response fields used by the app; how to query the OpenAPI spec | `ref/jellyfin-openapi.json`, server 12.3.0, 24/10/2026 |
| `lightning.md` | Component patterns used here and the traps already hit | `@lightningjs/core` 2.20.5, `@lightningjs/sdk` 5.5.7 |
| `webos.md` | Keys, app lifecycle, appinfo.json, packaging and TV commands | `ref/jellyfin-webos` (official app); TV part **not yet verified on the TV** |

## Raw material in `ref/`
| Path | Size | Use it for | Safe search |
|---|---|---|---|
| `ref/jellyfin-openapi.json` | 1.9 MB, one line | Truth for every endpoint and field | Only via the Python snippets in `jellyfin-api.md` |
| `ref/Lightning/docs/` | Markdown | Lightning core concepts (Components, HandlingInput, Transitions, RenderEngine) | `grep -rn "word" ref/Lightning/docs \| cut -c1-200 \| head -20` |
| `node_modules/@lightningjs/sdk/docs/` | Markdown | SDK plugins (Img, VideoPlayer, Storage, Router) | same |
| `ref/jellyfin-webos/frontend/` | small | webOS keys and lifecycle of the official app | `grep -rn --include=index.js "word" ref/jellyfin-webos/frontend/js \| cut -c1-200` |
| `ref/jellyfin-androidtv/` | 23 MB Kotlin | TV UX ideas only (rows, playback reporting order) | `grep -rln "word" ref/jellyfin-androidtv/app/src/main \| head` then read 40 lines |

**Never** grep without `| cut -c1-200 | head -N`: minified files (`webOSTV*.js`, `lightning.js`, `*.min.js`) are
single lines of hundreds of KB and fill the context in one call.
