// Pure paging calculation helper for grid views.
// Determines whether the next page should be loaded based on current focus and loaded item count.
export function needsNextPage({ focusIndex = 0, loaded = 0, total = 0, columns = 7, marginRows = 2 } = {}) {
  if (total <= 0 || loaded >= total || loaded <= 0 || columns <= 0) return false
  const focusedRow = Math.floor(Math.max(0, focusIndex) / columns)
  const lastLoadedRow = Math.floor((loaded - 1) / columns)
  return (lastLoadedRow - focusedRow) <= marginRows
}
