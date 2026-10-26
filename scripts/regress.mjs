// Runs every scenario of test/ui/scenarios.json with ui-check (browser) after one build.
// Usage: node scripts/regress.mjs [name-filter]   Prints one line per scenario and a summary; exit 1 if any fails.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const filter = process.argv[2] || ''
const scenarios = Object.entries(JSON.parse(readFileSync('test/ui/scenarios.json', 'utf8'))).filter(
  ([name]) => !name.startsWith('_') && name.includes(filter)
)
mkdirSync('.tmp', { recursive: true })
execFileSync('node_modules/.bin/lng', ['build'], { stdio: 'ignore' })
// Scenarios with {{name}} need the ids that api-smoke writes to .tmp/fixtures.json.
if (scenarios.some(([, steps]) => steps.some(step => step.includes('{{')))) {
  spawnSync('node', ['scripts/api-smoke.mjs'], { stdio: 'ignore' })
}

let failed = 0
for (const [name, steps] of scenarios) {
  const run = spawnSync('node', ['scripts/ui-check.mjs', '--brief', ...steps, `shot:regress-${name}`], { encoding: 'utf8' })
  let result
  try {
    result = JSON.parse(run.stdout.trim().split('\n').pop())
  } catch (e) {
    result = { ok: false, failed: (run.stderr || run.stdout || 'no output').trim().split('\n')[0] }
  }
  if (!result.ok) failed++
  const why = result.ok ? '' : ` - ${result.failed || ''} ${(result.appErrors || []).join('; ')}`.trimEnd()
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${name}${why}`)
}
console.log(`${scenarios.length - failed}/${scenarios.length} scenarios ok (screenshots: .tmp/ui/regress-*.png)`)
process.exit(failed ? 1 : 0)
