// Minimal Chrome DevTools Protocol client on Node's built-in WebSocket (Node >= 22). No dependencies.
export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error(`CDP connection failed: ${wsUrl}`))
  })
  let nextId = 0
  const pending = new Map()
  const listeners = []
  ws.onmessage = event => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`))
      else resolve(msg.result)
    } else if (msg.method) {
      for (const fn of listeners) fn(msg)
    }
  }
  return {
    send(method, params = {}) {
      const id = ++nextId
      ws.send(JSON.stringify({ id, method, params }))
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    },
    on(fn) {
      listeners.push(fn)
    },
    close() {
      ws.close()
    },
  }
}
