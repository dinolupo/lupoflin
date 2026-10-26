// L0 tests for src/lib/session.js with an in-memory storage.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearAll,
  deviceId,
  forgetUser,
  lastUserId,
  loadServer,
  loadUsers,
  saveServer,
  saveUser,
} from '../src/lib/session.js'

function memoryStorage() {
  const m = new Map()
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  }
}

test('deviceId is created once and then reused', () => {
  const s = memoryStorage()
  const first = deviceId(s)
  assert.match(first, /^lupoflix-/)
  assert.equal(deviceId(s), first)
})

test('server round trip', () => {
  const s = memoryStorage()
  assert.equal(loadServer(s), null)
  saveServer(s, 'http://jellyfin.test:8096')
  assert.equal(loadServer(s), 'http://jellyfin.test:8096')
})

test('two users round trip and lastUserId', () => {
  const s = memoryStorage()
  assert.deepEqual(loadUsers(s), {})
  assert.equal(lastUserId(s), null)

  const u1 = { userId: 'u1', userName: 'Alice', token: 'tok1' }
  const u2 = { userId: 'u2', userName: 'Bob', token: 'tok2' }

  saveUser(s, u1)
  assert.deepEqual(loadUsers(s), { u1 })
  assert.equal(lastUserId(s), 'u1')

  saveUser(s, u2)
  assert.deepEqual(loadUsers(s), { u1, u2 })
  assert.equal(lastUserId(s), 'u2')
})

test('forgetUser removes specified user and clears lastUser if matching', () => {
  const s = memoryStorage()
  const u1 = { userId: 'u1', userName: 'Alice', token: 'tok1' }
  const u2 = { userId: 'u2', userName: 'Bob', token: 'tok2' }
  saveUser(s, u1)
  saveUser(s, u2)

  forgetUser(s, 'u1')
  assert.deepEqual(loadUsers(s), { u2 })
  assert.equal(lastUserId(s), 'u2')

  forgetUser(s, 'u2')
  assert.deepEqual(loadUsers(s), {})
  assert.equal(lastUserId(s), null)
})

test('clearAll removes server, users, lastUser, caches and keeps deviceId', () => {
  const s = memoryStorage()
  const id = deviceId(s)
  saveServer(s, 'http://jellyfin.test')
  saveUser(s, { userId: 'u1', userName: 'Alice', token: 'tok1' })
  s.setItem('lupoflix:home:u1', '{}')
  s.setItem('lupoflix:grid:u1:lib1', '{}')

  clearAll(s)
  assert.equal(s.getItem('lupoflix:home:u1'), null)
  assert.equal(s.getItem('lupoflix:grid:u1:lib1'), null)
  assert.equal(loadServer(s), null)
  assert.deepEqual(loadUsers(s), {})
  assert.equal(lastUserId(s), null)
  assert.equal(deviceId(s), id)
})

test('migration: an old lupoflix.session becomes server + one user, then is removed', () => {
  const s = memoryStorage()
  s.setItem(
    'lupoflix.session',
    JSON.stringify({
      server: 'http://jellyfin.migrated:8096',
      userId: 'u-old',
      userName: 'OldUser',
      token: 'tok-old',
    })
  )

  assert.equal(loadServer(s), 'http://jellyfin.migrated:8096')
  assert.deepEqual(loadUsers(s), {
    'u-old': { userId: 'u-old', userName: 'OldUser', token: 'tok-old' },
  })
  assert.equal(lastUserId(s), 'u-old')
  assert.equal(s.getItem('lupoflix.session'), null)
})

test('broken JSON reads as empty without throwing', () => {
  const s = memoryStorage()
  s.setItem('lupoflix.users', '{broken-json')
  assert.deepEqual(loadUsers(s), {})

  s.setItem('lupoflix.session', '{broken-session')
  assert.equal(loadServer(s), null)
  assert.deepEqual(loadUsers(s), {})
  assert.equal(lastUserId(s), null)
  assert.equal(s.getItem('lupoflix.session'), null)
})
