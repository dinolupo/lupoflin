// Saved server, users, last user and device id in localStorage. The storage object is injected for tests.
const SERVER_KEY = 'lupoflix.server'
const USERS_KEY = 'lupoflix.users'
const LAST_USER_KEY = 'lupoflix.lastUser'
const DEVICE_KEY = 'lupoflix.deviceId'
const OLD_SESSION_KEY = 'lupoflix.session'

function migrate(storage) {
  const raw = storage.getItem(OLD_SESSION_KEY)
  if (!raw) return
  storage.removeItem(OLD_SESSION_KEY)
  try {
    const s = JSON.parse(raw)
    if (s && typeof s === 'object') {
      if (s.server && !storage.getItem(SERVER_KEY)) {
        storage.setItem(SERVER_KEY, s.server)
      }
      if (s.userId && s.token) {
        const users = {}
        users[s.userId] = {
          userId: s.userId,
          userName: s.userName || '',
          token: s.token,
        }
        storage.setItem(USERS_KEY, JSON.stringify(users))
        storage.setItem(LAST_USER_KEY, s.userId)
      }
    }
  } catch (e) {
    // Broken JSON reads as empty
  }
}

export function deviceId(storage) {
  let id = storage.getItem(DEVICE_KEY)
  if (!id) {
    id = 'lupoflix-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    storage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function loadServer(storage) {
  migrate(storage)
  return storage.getItem(SERVER_KEY) || null
}

export function saveServer(storage, url) {
  storage.setItem(SERVER_KEY, url)
}

export function loadUsers(storage) {
  migrate(storage)
  try {
    const u = JSON.parse(storage.getItem(USERS_KEY) || '{}')
    return u && typeof u === 'object' && !Array.isArray(u) ? u : {}
  } catch (e) {
    return {}
  }
}

export function saveUser(storage, auth) {
  if (!auth || !auth.userId) return
  const users = loadUsers(storage)
  users[auth.userId] = {
    userId: auth.userId,
    userName: auth.userName || '',
    token: auth.token || '',
  }
  storage.setItem(USERS_KEY, JSON.stringify(users))
  storage.setItem(LAST_USER_KEY, auth.userId)
}

export function forgetUser(storage, userId) {
  const users = loadUsers(storage)
  if (users[userId]) {
    delete users[userId]
    storage.setItem(USERS_KEY, JSON.stringify(users))
  }
  if (storage.getItem(LAST_USER_KEY) === userId) {
    storage.removeItem(LAST_USER_KEY)
  }
}

export function lastUserId(storage) {
  migrate(storage)
  return storage.getItem(LAST_USER_KEY) || null
}

// Per-user caches written by the views (home rows, grid sort and filter).
const CACHE_PREFIXES = ['lupoflix:home:', 'lupoflix:grid:']

export function clearAll(storage) {
  storage.removeItem(SERVER_KEY)
  storage.removeItem(USERS_KEY)
  storage.removeItem(LAST_USER_KEY)
  storage.removeItem(OLD_SESSION_KEY)
  const cached = []
  for (let i = 0; i < (storage.length || 0); i++) {
    const k = storage.key(i)
    if (k && CACHE_PREFIXES.some(p => k.startsWith(p))) cached.push(k)
  }
  cached.forEach(k => storage.removeItem(k))
}
