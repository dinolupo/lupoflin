// Collects probe events POSTed by the app (config "telemetry": "http://<pc-ip>:8765").
// Writes every event to .tmp/telemetry/<start time>.jsonl and prints a short line for the important ones.
// Usage: node scripts/telemetry-server.mjs [port]      Stop with Ctrl+C.
import { createServer } from 'node:http'
import { appendFileSync, mkdirSync } from 'node:fs'

const port = Number(process.argv[2] || 8765)
mkdirSync('.tmp/telemetry', { recursive: true })
const file = `.tmp/telemetry/${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') {
    res.writeHead(204)
    res.end()
    return
  }
  let body = ''
  req.on('data', chunk => (body += chunk))
  req.on('end', () => {
    res.writeHead(204)
    res.end()
    let events
    try {
      events = JSON.parse(body)
    } catch (e) {
      return
    }
    for (const e of events) {
      appendFileSync(file, JSON.stringify({ from: req.socket.remoteAddress, ...e }) + '\n')
      const time = new Date(e.t).toLocaleTimeString('it-IT')
      if (e.type === 'perf') console.log(`${time} perf ${e.fps} fps, worst ${e.worstMs} ms`)
      else if (e.type !== 'select') console.log(`${time} ${e.type} ${JSON.stringify({ ...e, t: undefined, type: undefined })}`)
      else console.log(`${time} select ${e.label}`)
    }
  })
})
server.listen(port, '0.0.0.0', () => console.log(`telemetry on :${port} -> ${file}`))
