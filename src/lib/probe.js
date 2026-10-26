// Test probe: the UI is drawn on WebGL, so tests cannot read the DOM. The app publishes its state here and
// scripts/ui-check.mjs reads it through Chrome DevTools. Keep it small: plain data only.
const MAX_EVENTS = 200
const SEND_EVERY_MS = 1000

// Optional: events are also POSTed to scripts/telemetry-server.mjs, so a run on the TV can be read on the PC.
let telemetry = null

function target() {
  if (typeof window === 'undefined') return null
  if (!window.__jlt) window.__jlt = { ready: false, view: null, focus: null, data: { counters: {} }, events: [] }
  return window.__jlt
}

function push(type, detail) {
  const t = target()
  if (!t) return
  const event = { t: Date.now(), type, ...detail }
  t.events.push(event)
  if (t.events.length > MAX_EVENTS) t.events.shift()
  if (telemetry) telemetry.queue.push(event)
}

function flush() {
  if (!telemetry.queue.length) return
  const body = JSON.stringify(telemetry.queue.splice(0))
  // text/plain + no-cors: no preflight, works from the file:// origin of a webOS app. Failures are ignored.
  fetch(telemetry.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body }).catch(() => {})
}

export const probe = {
  telemetry(url) {
    if (!url || telemetry) return
    telemetry = { url, queue: [] }
    setInterval(flush, SEND_EVERY_MS)
    push('telemetry', { userAgent: navigator.userAgent, screen: `${screen.width}x${screen.height}`, inner: `${innerWidth}x${innerHeight}` })
  },
  ready() {
    const t = target()
    if (t) t.ready = true
    push('ready')
  },
  view(name, data = {}) {
    const t = target()
    if (!t) return
    const counters = (t.data && t.data.counters) ? { ...t.data.counters } : {}
    t.view = name
    t.focus = null
    t.data = { ...data, counters: { ...counters, ...(data.counters || {}) } }
    push('view', { name })
  },
  count(name, delta = 1) {
    const t = target()
    if (!t) return
    if (!t.data) t.data = {}
    if (!t.data.counters) t.data.counters = {}
    t.data.counters[name] = (t.data.counters[name] || 0) + delta
  },
  focus(detail) {
    const t = target()
    if (t) t.focus = detail
  },
  data(key, value) {
    const t = target()
    if (t) t.data[key] = value
  },
  event(type, detail = {}) {
    push(type, detail)
  },
  // Pass the Error itself when there is one: the first stack lines make failures diagnosable from the report.
  error(where, error) {
    const message = error && error.message ? error.message : String(error)
    const stack = error && error.stack ? error.stack.split('\n').slice(1, 4).map(l => l.trim()) : undefined
    push('error', { where, message, stack })
  },
}
