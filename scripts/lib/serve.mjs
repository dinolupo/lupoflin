// Static file server for build/ on a free local port. Returns { url, close }.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf', '.map': 'application/json',
}

export async function serve(root) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
    try {
      const file = join(root, path.endsWith('/') ? path + 'index.html' : path)
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' })
      res.end(body)
    } catch (e) {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }
}
