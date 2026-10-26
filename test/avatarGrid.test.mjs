// L0 unit tests for src/lib/avatarGrid.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { groupByCategory, visibleWindow } from '../src/lib/avatarGrid.js'

test('groupByCategory: empty list returns empty array', () => {
  assert.deepEqual(groupByCategory([]), [])
  assert.deepEqual(groupByCategory(null), [])
  assert.deepEqual(groupByCategory(undefined), [])
})

test('groupByCategory: groups items and orders Netflix first then alphabetically', () => {
  const items = [
    { id: '1', name: 'Prime 1', category: 'Prime Video' },
    { id: '2', name: 'Netflix 1', category: 'Netflix' },
    { id: '3', name: 'Disney 1', category: 'Disney Plus' },
    { id: '4', name: 'Netflix 2', category: 'Netflix' },
    { id: '5', name: 'Paramount 1', category: 'Paramount Plus' },
  ]
  const groups = groupByCategory(items)
  assert.equal(groups.length, 4)
  assert.equal(groups[0].name, 'Netflix')
  assert.equal(groups[0].items.length, 2)
  assert.equal(groups[1].name, 'Disney Plus')
  assert.equal(groups[2].name, 'Paramount Plus')
  assert.equal(groups[3].name, 'Prime Video')
})

test('groupByCategory: maps empty, null or missing category to Altre', () => {
  const items = [
    { id: '1', name: 'Item 1', category: '' },
    { id: '2', name: 'Item 2', category: null },
    { id: '3', name: 'Item 3' },
    { id: '4', name: 'Netflix 1', category: 'Netflix' },
  ]
  const groups = groupByCategory(items)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].name, 'Netflix')
  assert.equal(groups[1].name, 'Altre')
  assert.equal(groups[1].items.length, 3)
})

test('visibleWindow: window at the start', () => {
  // 100 items, 8 columns (13 rows: 0..12).
  // rowsVisible = 3, extraRows = 1.
  // Start: index = 0 (row 0). Visible rows: 0, 1, 2.
  // Plus extra row below: row 3. Rows that exist: 0..3 (indices 0..31).
  const win = visibleWindow({ index: 0, columns: 8, rowsVisible: 3, extraRows: 1, total: 100 })
  assert.deepEqual(win, { first: 0, last: 31 })
})

test('visibleWindow: window in the middle', () => {
  // 100 items, 8 columns (13 rows: 0..12).
  // Middle: index = 48 (row 6). Visible rows centered: 5, 6, 7.
  // Plus extra row above (row 4) and below (row 8). Rows that exist: 4..8 (indices 32..71).
  const win = visibleWindow({ index: 48, columns: 8, rowsVisible: 3, extraRows: 1, total: 100 })
  assert.deepEqual(win, { first: 32, last: 71 })
})

test('visibleWindow: window at the end', () => {
  // 100 items, 8 columns (13 rows: 0..12).
  // End: index = 96 (row 12, the last row). Visible rows: 10, 11, 12.
  // Plus extra row above: row 9. Rows that exist: 9..12 (indices 72..99).
  const win = visibleWindow({ index: 96, columns: 8, rowsVisible: 3, extraRows: 1, total: 100 })
  assert.deepEqual(win, { first: 72, last: 99 })
})

test('visibleWindow: fewer items than a screen', () => {
  // 12 items, 8 columns (2 rows: 0, 1). Total items < 3 visible rows.
  // All rows 0..1 exist (indices 0..11).
  const win = visibleWindow({ index: 0, columns: 8, rowsVisible: 3, extraRows: 1, total: 12 })
  assert.deepEqual(win, { first: 0, last: 11 })
})

test('visibleWindow: total 0 items returns first 0, last -1', () => {
  const win = visibleWindow({ index: 0, columns: 8, rowsVisible: 3, extraRows: 1, total: 0 })
  assert.deepEqual(win, { first: 0, last: -1 })
})
