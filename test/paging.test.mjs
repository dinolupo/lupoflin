// L0 unit tests for src/lib/paging.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { needsNextPage } from '../src/lib/paging.js'

test('needsNextPage: empty library returns false', () => {
  assert.equal(needsNextPage({ focusIndex: 0, loaded: 0, total: 0, columns: 7, marginRows: 2 }), false)
})

test('needsNextPage: total already loaded returns false', () => {
  assert.equal(needsNextPage({ focusIndex: 55, loaded: 60, total: 60, columns: 7, marginRows: 2 }), false)
  assert.equal(needsNextPage({ focusIndex: 20, loaded: 25, total: 25, columns: 7, marginRows: 2 }), false)
})

test('needsNextPage: exactly one page loaded with more total items', () => {
  // 60 items loaded out of 150. Columns: 7. Last row is 8 (indexes 56-59).
  // marginRows = 2: triggers when focusedRow is >= 6 (index >= 42).
  assert.equal(needsNextPage({ focusIndex: 0, loaded: 60, total: 150, columns: 7, marginRows: 2 }), false)
  assert.equal(needsNextPage({ focusIndex: 35, loaded: 60, total: 150, columns: 7, marginRows: 2 }), false) // row 5 (8 - 5 = 3 > 2)
  assert.equal(needsNextPage({ focusIndex: 42, loaded: 60, total: 150, columns: 7, marginRows: 2 }), true)  // row 6 (8 - 6 = 2 <= 2)
  assert.equal(needsNextPage({ focusIndex: 56, loaded: 60, total: 150, columns: 7, marginRows: 2 }), true)  // row 8 (8 - 8 = 0 <= 2)
})

test('needsNextPage: last page partially filled', () => {
  // 95 items loaded out of 100. Columns: 7. Last row is 13 (Math.floor(94 / 7) = 13).
  // marginRows = 2: triggers for rows >= 11 (index >= 77).
  assert.equal(needsNextPage({ focusIndex: 70, loaded: 95, total: 100, columns: 7, marginRows: 2 }), false) // row 10 (13 - 10 = 3 > 2)
  assert.equal(needsNextPage({ focusIndex: 77, loaded: 95, total: 100, columns: 7, marginRows: 2 }), true)  // row 11 (13 - 11 = 2 <= 2)
  assert.equal(needsNextPage({ focusIndex: 94, loaded: 95, total: 100, columns: 7, marginRows: 2 }), true)  // row 13
})

test('needsNextPage: handles invalid or edge arguments safely', () => {
  assert.equal(needsNextPage(), false)
  assert.equal(needsNextPage({ columns: 0 }), false)
  assert.equal(needsNextPage({ loaded: -1 }), false)
  assert.equal(needsNextPage({ total: -5 }), false)
})
