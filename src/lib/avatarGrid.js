// Layout and window maths for AvatarPickerView.
// Pure functions, tested by test/avatarGrid.test.mjs.

export function groupByCategory(list = []) {
  if (!Array.isArray(list) || !list.length) return []
  const map = new Map()
  for (const item of list) {
    const raw = item.category !== undefined ? item.category : item.Category
    const name = (raw && String(raw).trim()) ? String(raw).trim() : 'Altre'
    if (!map.has(name)) map.set(name, [])
    map.get(name).push(item)
  }
  const result = []
  if (map.has('Netflix')) {
    result.push({ name: 'Netflix', items: map.get('Netflix') })
  }
  const others = []
  for (const [name, items] of map.entries()) {
    if (name !== 'Netflix') {
      others.push({ name, items })
    }
  }
  others.sort((a, b) => a.name.localeCompare(b.name))
  result.push(...others)
  return result
}

export function visibleWindow({ index = 0, columns = 8, rowsVisible = 3, extraRows = 1, total = 0 } = {}) {
  if (!total || total <= 0) return { first: 0, last: -1 }
  const cols = Math.max(1, columns)
  const totalRows = Math.ceil(total / cols)
  const clampedIndex = Math.max(0, Math.min(total - 1, index))
  const focusedRow = Math.floor(clampedIndex / cols)

  const half = Math.floor((rowsVisible - 1) / 2)
  let vStart = focusedRow - half
  let vEnd = vStart + rowsVisible - 1

  if (vEnd >= totalRows) {
    vEnd = totalRows - 1
    vStart = Math.max(0, vEnd - rowsVisible + 1)
  }
  if (vStart < 0) {
    vStart = 0
    vEnd = Math.min(totalRows - 1, vStart + rowsVisible - 1)
  }

  const rFirst = Math.max(0, vStart - extraRows)
  const rLast = Math.min(totalRows - 1, vEnd + extraRows)

  const first = rFirst * cols
  const last = Math.min(total - 1, (rLast + 1) * cols - 1)

  return { first, last }
}
