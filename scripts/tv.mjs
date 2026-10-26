// TV commands around @webos-tools/cli. Device name: env TV_DEVICE or "tv".
// Usage: node scripts/tv.mjs [--private] info | install <ipk> | launch | close | running | startup [runs]
// --private: the app id of the private build (brand.local/brand.json) instead of the public one.
// startup: cold-starts the app <runs> times (default 3) and prints, per run, the time from the launch command
// to the home being drawn, plus the app's own timings (ms since its page started loading).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { connect } from './lib/cdp.mjs'

const device = process.env.TV_DEVICE || 'tv'
const argv = process.argv.slice(2)
const appId = JSON.parse(readFileSync(argv.includes('--private') ? 'brand.local/brand.json' : 'appinfo.json', 'utf8'))[argv.includes('--private') ? 'appId' : 'id']
const [cmd, arg] = argv.filter(a => a !== '--private')
const ares = (name, ...params) =>
  execFileSync(`node_modules/.bin/${name}`, ['-d', device, ...params], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const commands = {
  info: () => ares('ares-device', '-i'),
  install: () => ares('ares-install', arg),
  launch: () => ares('ares-launch', appId),
  close: () => ares('ares-launch', '--close', appId),
  running: () => ares('ares-launch', '--running'),
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function devtoolsHost() {
  const list = execFileSync('node_modules/.bin/ares-setup-device', ['--list'], { encoding: 'utf8' })
  return `${list.match(new RegExp(`^${device}\\s+\\S+@([\\d.]+):`, 'm'))[1]}:9998`
}

async function startupRun(host) {
  try {
    ares('ares-launch', '--close', appId)
  } catch (e) {
    // not running: fine
  }
  await sleep(2000)
  const t0 = Date.now()
  ares('ares-launch', appId)
  const launchedMs = Date.now() - t0
  let page = null
  while (Date.now() - t0 < 30000) {
    try {
      const target = (await (await fetch(`http://${host}/json/list`)).json()).find(t => t.url.includes(appId))
      if (target) {
        page = await connect(target.webSocketDebuggerUrl)
        const value = (await page.send('Runtime.evaluate', {
          expression: 'JSON.stringify(window.__jlt ? __jlt.events.filter(e => e.ms !== undefined || e.type === "view") : null)',
          returnByValue: true,
        })).result.value
        const events = JSON.parse(value || 'null') || []
        const home = events.find(e => e.type === 'home_ready')
        const boot = events.find(e => e.type === 'boot_done')
        const firstView = events.find(e => e.type === 'view' && e.name !== 'splash')
        if (home || (firstView && firstView.name !== 'home')) {
          page.close()
          return {
            totalMs: Date.now() - t0,
            launchCommandMs: launchedMs,
            appBootMs: boot && boot.ms,
            appHomeReadyMs: home && home.ms,
            firstScreen: firstView && firstView.name,
          }
        }
        page.close()
      }
    } catch (e) {
      // page not ready yet
    }
    await sleep(100)
  }
  return { error: 'home not reached in 30 s' }
}

commands.startup = async () => {
  const host = devtoolsHost()
  const runs = Number(arg || 3)
  const results = []
  for (let i = 0; i < runs; i++) results.push(await startupRun(host))
  return JSON.stringify(results)
}

if (!commands[cmd]) {
  console.error('usage: node scripts/tv.mjs info | install <ipk> | launch | close | running | startup [runs]')
  process.exit(2)
}
try {
  console.log(await commands[cmd]())
} catch (e) {
  console.error((e.stderr || e.message).toString().trim().split('\n').slice(0, 5).join('\n'))
  process.exit(1)
}
