// Builds the webOS .ipk into .tmp/ipk/.
// Usage: node scripts/package.mjs [--private] [--es5] [--telemetry http://<pc-ip>:8765] [--perf]
// Public build (default): LupoFlin brand, no server in the config, so every user types their own.
// --private: the git-ignored brand.local/ overlay (brand.json + static/ files over dist/static) and "server"
// from static/config.local.json. Never devUser/devPassword in any build.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const variant = args.includes('--es5') ? 'es5' : 'es6'
const telemetryAt = args.indexOf('--telemetry')
const isPrivate = args.includes('--private')
const dist = join('dist', variant)
const out = '.tmp/ipk'
const bin = name => join('node_modules', '.bin', name)

rmSync(dist, { recursive: true, force: true })
execFileSync(bin('lng'), ['dist', `--${variant}`], { stdio: ['ignore', 'ignore', 'inherit'] })

const appinfo = JSON.parse(readFileSync('appinfo.json', 'utf8'))
// The full-size logo is a source image, not an app asset.
rmSync(join(dist, 'static', 'Lupoflin.jpeg'), { force: true })
const config = {}
if (isPrivate) {
  if (!existsSync('brand.local/brand.json')) throw new Error('--private needs brand.local/brand.json')
  const brand = JSON.parse(readFileSync('brand.local/brand.json', 'utf8'))
  cpSync('brand.local/static', join(dist, 'static'), { recursive: true })
  appinfo.id = brand.appId
  appinfo.title = brand.name
  config.server = JSON.parse(readFileSync('static/config.local.json', 'utf8')).server
  config.brand = { name: brand.name, color: brand.color, colorBright: brand.colorBright }
}
writeFileSync(join(dist, 'appinfo.json'), JSON.stringify(appinfo, null, 2))
if (telemetryAt >= 0) config.telemetry = args[telemetryAt + 1]
if (args.includes('--perf')) config.showPerf = true
writeFileSync(join(dist, 'static', 'config.local.json'), JSON.stringify(config, null, 2))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
// Keep ares-package warnings (e.g. the missing requiredACG notice): they are reported, not swallowed.
const aresOutput = execFileSync(bin('ares-package'), [dist, '-o', out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const warnings = aresOutput.split('\n').filter(line => /warn|error|deprecat/i.test(line))
const ipk = readdirSync(out).find(f => f.endsWith('.ipk'))
const packaged = readFileSync(join(dist, 'static', 'config.local.json'), 'utf8')
console.log(JSON.stringify({
  ipk: join(out, ipk),
  kb: Math.round(statSync(join(out, ipk)).size / 1024),
  variant,
  appId: appinfo.id,
  config: JSON.parse(packaged),
  devFieldsInPackage: /devUser|devPassword/.test(packaged),
  warnings,
}))
