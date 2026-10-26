// L1 UI check: builds nothing, serves build/ and drives headless Chromium through CDP.
// Usage: node scripts/ui-check.mjs [--brief] [--tv] [step ...]      (run `npm run build` first)
// --tv drives the app already installed on the LG TV through its remote DevTools (port 9998, Developer
// Mode on, app launched with `npm run tv launch`): the page is reloaded, then the same steps run on the TV.
// The TV keeps its saved session, so it usually starts at home: use wait:any, not profile:dev.
// --brief prints one line (ok, failed step, view, focus, errors, screenshots): use it, and the full report
// only when a run fails.
// Steps: wait:<view>  key:<Left|Right|Up|Down|Enter|Back>  profile:<name|dev>  sleep:<ms>  shot:<name>
//        (profile:dev = the devUser of static/config.local.json, which logs in without Quick Connect)
//        expect:<JS expression on the probe state s>, e.g. 'expect:s.data.rows.length>1' (checked once)
//        until:<JS expression>   same, but waits up to 20 s for it to become true
//        visible:<percent>        screenshot check: at least <percent>% of pixels differ from the background.
//                                 The probe can say "home" while nothing is drawn: this catches it.
//        type:<text>              types characters like a USB keyboard (keydown with e.key = the character)
//        query:<k=v&...>          reloads the app with that URL query, e.g. 'query:server=' (browser only)
//        reload                   reloads the page; localStorage survives (tests "still saved after restart")
//        {{name}} anywhere in a step is replaced by .tmp/fixtures.json[name], written by `npm run check:api`
//                                 (ids of real items: movieId, seriesId, h264MovieId, ...)
// Default steps: wait:any shot:start. Prints one JSON report; exit 1 if a step fails or the app reports errors.
// Each run uses a fresh browser profile: no saved session, so the app always starts from the profiles screen.
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { connect } from './lib/cdp.mjs'
import { serve } from './lib/serve.mjs'

const CHROMIUM = process.env.CHROMIUM || '/usr/bin/chromium'
const WAIT_MS = 20000
const KEYS = { Left: 37, Up: 38, Right: 39, Down: 40, Enter: 13, Back: 8 }
const OUT = '.tmp/ui'

const brief = process.argv.includes('--brief')
const onTv = process.argv.includes('--tv')
const steps = process.argv.slice(2).filter(a => a !== '--brief' && a !== '--tv')
if (!steps.length) steps.push('wait:any', 'shot:start')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// keyCode for typed characters; never one of the codes mapped in settings.json (8, 13, 27, 37-40, 461).
const charCode = ch => (/^[a-z0-9]$/i.test(ch) ? ch.toUpperCase().charCodeAt(0) : { '.': 190, ':': 186, '/': 191, '-': 189, '_': 189, ' ': 32 }[ch] || 0)

async function withFixtures(list) {
  if (!list.some(step => step.includes('{{'))) return list
  let fixtures
  try {
    fixtures = JSON.parse(await readFile('.tmp/fixtures.json', 'utf8'))
  } catch (e) {
    throw new Error('.tmp/fixtures.json missing: run npm run check:api first')
  }
  return list.map(step => step.replace(/\{\{(\w+)\}\}/g, (m, name) => {
    if (fixtures[name] === undefined || fixtures[name] === null) throw new Error(`fixture ${name} not in .tmp/fixtures.json`)
    return fixtures[name]
  }))
}

async function launchBrowser(profileDir) {
  const proc = spawn(CHROMIUM, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, '--no-first-run',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1080',
    '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  const port = await new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => reject(new Error('Chromium did not start')), 15000)
    proc.stderr.on('data', chunk => {
      buffer += chunk
      const match = buffer.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
  })
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = targets.find(t => t.type === 'page')
  return { proc, page: await connect(page.webSocketDebuggerUrl) }
}

// Share of pixels (sampled every 4th pixel) that differ from the app background colour 0x141414.
// Decoded inside the page with an offscreen canvas: no image library needed in Node.
async function drawnPercent(page, pngBase64) {
  const expression = `new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const c = new OffscreenCanvas(img.width, img.height)
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, img.width, img.height).data
      let drawn = 0, total = 0
      for (let i = 0; i < d.length; i += 16) {
        total++
        if (Math.abs(d[i] - 0x14) + Math.abs(d[i + 1] - 0x14) + Math.abs(d[i + 2] - 0x14) > 24) drawn++
      }
      resolve(Math.round((drawn * 1000) / total) / 10)
    }
    img.src = 'data:image/png;base64,${pngBase64}'
  })`
  return (await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
}

// DevTools endpoint of the TV registered as "tv" in ares (env TV_DEVTOOLS=host:port overrides).
function tvDevtools() {
  if (process.env.TV_DEVTOOLS) return process.env.TV_DEVTOOLS
  const list = execFileSync('node_modules/.bin/ares-setup-device', ['--list'], { encoding: 'utf8' })
  const match = list.match(/^tv\s+\S+@([\d.]+):/m)
  if (!match) throw new Error('no device "tv" in ares-setup-device --list')
  return `${match[1]}:9998`
}

async function connectTv() {
  const host = tvDevtools()
  const targets = await (await fetch(`http://${host}/json/list`)).json()
  const target = targets.find(t => t.type === 'page' && /lupofli[nx]/.test(t.url))
  if (!target) throw new Error(`app not running on the TV (${host}): npm run tv launch`)
  return { page: await connect(target.webSocketDebuggerUrl) }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const profileDir = onTv ? null : await mkdtemp(join(tmpdir(), 'lupoflix-ui-'))
  const site = onTv ? null : await serve('build')
  const { proc, page } = onTv ? await connectTv() : await launchBrowser(profileDir)
  const report = { ok: true, steps: [], consoleErrors: [], shots: [] }

  page.on(msg => {
    if (msg.method === 'Runtime.exceptionThrown') report.consoleErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text)
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') report.consoleErrors.push(msg.params.args.map(a => a.value ?? a.description).join(' '))
  })

  const state = async () => (await page.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__jlt || null)', returnByValue: true })).result.value
  const probe = async () => JSON.parse((await state()) || 'null')
  const until = async (test, label) => {
    const end = Date.now() + WAIT_MS
    while (Date.now() < end) {
      const s = await probe()
      if (s && test(s)) return s
      await sleep(200)
    }
    throw new Error(`timeout waiting for ${label}`)
  }
  const press = async name => {
    const code = KEYS[name]
    if (!code) throw new Error(`unknown key ${name}`)
    for (const type of ['rawKeyDown', 'keyUp']) {
      await page.send('Input.dispatchKeyEvent', { type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: name })
    }
    await sleep(350) // let the 0.15-0.25 s transitions finish before the next step reads the state
  }
  const typeText = async text => {
    for (const ch of text) {
      const code = charCode(ch)
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })
      await sleep(60)
    }
    await sleep(300)
  }

  try {
    await page.send('Runtime.enable')
    await page.send('Page.enable')
    if (onTv) {
      await page.send('Page.reload')
      await sleep(500) // the old page's probe is still readable for a moment after the reload starts
    } else {
      await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
      await page.send('Page.navigate', { url: site.url })
    }
    for (const step of await withFixtures(steps)) {
      const [kind, ...rest] = step.split(':')
      const arg = rest.join(':')
      const started = Date.now()
      if (kind === 'wait') await until(s => s.view && s.view !== 'splash' && (arg === 'any' || s.view === arg), `view ${arg}`)
      else if (kind === 'key') await press(arg)
      else if (kind === 'type') await typeText(arg)
      else if (kind === 'query') {
        if (onTv) throw new Error('query: is browser only')
        await page.send('Page.navigate', { url: `${site.url}?${arg}` })
        await sleep(500)
      } else if (kind === 'reload') {
        await page.send('Page.reload')
        await sleep(500) // the old page's probe is still readable for a moment after the reload starts
      }
      else if (kind === 'sleep') await sleep(Number(arg))
      else if (kind === 'profile') {
        const s = await until(x => x.view === 'profiles', 'view profiles')
        const name = arg === 'dev' ? JSON.parse(await readFile('static/config.local.json', 'utf8')).devUser : arg
        const target = s.data.profiles.findIndex(p => p.toLowerCase() === String(name).toLowerCase())
        if (target < 0) throw new Error(`profile ${name} not in ${s.data.profiles.join(', ')}`)
        // Start from the focused profile (the last one used is focused after a restart).
        const from = s.focus && typeof s.focus.index === 'number' ? s.focus.index : 0
        for (let i = from; i < target; i++) await press('Right')
        for (let i = from; i > target; i--) await press('Left')
        await press('Enter')
      } else if (kind === 'shot') {
        const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
        const file = join(OUT, `${arg}.png`)
        await writeFile(file, Buffer.from(data, 'base64'))
        report.shots.push(file)
      } else if (kind === 'visible') {
        const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
        const percent = await drawnPercent(page, data)
        if (percent < Number(arg)) throw new Error(`only ${percent}% of the screen is drawn, expected >= ${arg}%`)
        report.steps.push({ step: `${step} (measured ${percent}%)`, ms: Date.now() - started, ok: true })
        continue
      } else if (kind === 'expect' || kind === 'until') {
        // eslint-disable-next-line no-new-func
        const test = new Function('s', `try { return !!(${arg}) } catch (e) { return false }`)
        if (kind === 'until') await until(test, arg)
        else if (!test(await probe())) throw new Error(`expect failed: ${arg}`)
      } else throw new Error(`unknown step ${step}`)
      report.steps.push({ step, ms: Date.now() - started, ok: true })
    }
  } catch (e) {
    report.ok = false
    report.steps.push({ step: 'FAILED', error: e.message })
  }

  const s = await probe().catch(() => null)
  report.final = s && { view: s.view, focus: s.focus, data: s.data, lastEvents: s.events.slice(-10) }
  const appErrors = s ? s.events.filter(e => e.type === 'error') : []
  if (appErrors.length || report.consoleErrors.length) report.ok = false
  report.appErrors = appErrors
  if (brief) {
    const failed = report.steps.find(x => !x.ok)
    console.log(JSON.stringify({
      ok: report.ok,
      failed: failed ? failed.error : null,
      view: s && s.view,
      focus: s && s.focus,
      appErrors: appErrors.map(e => `${e.where}: ${e.message}`),
      consoleErrors: report.consoleErrors.slice(0, 3),
      shots: report.shots,
    }))
  } else console.log(JSON.stringify(report, null, 2))

  page.close()
  if (!onTv) {
    const exited = new Promise(resolve => proc.once('exit', resolve))
    proc.kill()
    await exited
    site.close()
  }
  // Chromium may still be flushing its profile right after exit: retry instead of failing the run.
  if (profileDir) await rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {})
  process.exit(report.ok ? 0 : 1)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
