import { Lightning, Utils } from '@lightningjs/sdk'
import Tile from '../components/Tile.js'
import { needsNextPage } from '../lib/paging.js'
import { probe } from '../lib/probe.js'
import { colors, font, layout } from '../theme.js'

const HEADER_H = 170
const PAGE_LIMIT = 60

const SORTS = [
  { key: 'SortName', label: 'Ordina: A-Z', sortBy: 'SortName', sortOrder: 'Ascending' },
  { key: 'DateCreated', label: 'Ordina: Aggiunti di recente', sortBy: 'DateCreated', sortOrder: 'Descending' },
  { key: 'ProductionYear', label: 'Ordina: Anno', sortBy: 'ProductionYear', sortOrder: 'Descending' },
  { key: 'CommunityRating', label: 'Ordina: Voto', sortBy: 'CommunityRating', sortOrder: 'Descending' },
]

const FILTERS = [
  { key: 'all', label: 'Filtro: Tutti', filters: undefined },
  { key: 'IsUnplayed', label: 'Filtro: Non visti', filters: 'IsUnplayed' },
  { key: 'IsFavorite', label: 'Filtro: Preferiti', filters: 'IsFavorite' },
]

function loadLibraryPrefs(storage, userId, libraryId) {
  try {
    const raw = storage.getItem(`lupoflix:grid:${userId}:${libraryId}`)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function saveLibraryPrefs(storage, userId, libraryId, prefs) {
  try {
    storage.setItem(`lupoflix:grid:${userId}:${libraryId}`, JSON.stringify(prefs))
  } catch (e) {}
}

// Full-screen grid of titles in a library.
// Props: client, session, view { id, name, collectionType }
export default class GridView extends Lightning.Component {
  static _template() {
    return {
      Tiles: { x: layout.sideMargin, y: HEADER_H, forceZIndexContext: true },
      Header: {
        rect: true,
        w: 1920,
        h: 140,
        color: colors.background,
        zIndex: 5,
        Brand: { x: layout.sideMargin, y: 18, w: 220, h: 90, src: Utils.asset('images/logo-header.png') },
        Title: { x: layout.sideMargin + 240, y: 38, text: { text: '', fontFace: font, fontSize: 36, textColor: colors.text } },
        User: { x: 1920 - layout.sideMargin, y: 44, mountX: 1, text: { text: '', fontFace: font, fontSize: 28, textColor: colors.textDim } },
        Bar: {
          x: layout.sideMargin + 240,
          y: 90,
          Sort: {
            w: 320,
            h: 38,
            rect: true,
            color: 0x33ffffff,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 19 },
            Border: {
              x: -3,
              y: -3,
              w: 326,
              h: 44,
              rect: true,
              color: colors.focus,
              alpha: 0,
              shader: { type: Lightning.shaders.RoundedRectangle, radius: 22 },
            },
            Label: {
              x: 160,
              y: 19,
              mount: 0.5,
              text: { text: 'Ordina: A-Z', fontFace: font, fontSize: 22, textColor: colors.textDim },
            },
          },
          Filter: {
            x: 340,
            w: 220,
            h: 38,
            rect: true,
            color: 0x33ffffff,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 19 },
            Border: {
              x: -3,
              y: -3,
              w: 226,
              h: 44,
              rect: true,
              color: colors.focus,
              alpha: 0,
              shader: { type: Lightning.shaders.RoundedRectangle, radius: 22 },
            },
            Label: {
              x: 110,
              y: 19,
              mount: 0.5,
              text: { text: 'Filtro: Tutti', fontFace: font, fontSize: 22, textColor: colors.textDim },
            },
          },
        },
      },
      Status: { x: 960, y: 540, mountX: 0.5, text: { text: 'Caricamento…', fontFace: font, fontSize: 32, textColor: colors.textDim } },
    }
  }

  set navState(value) {
    this._restoreState = value
  }

  get navState() {
    return {
      index: this._index,
      loaded: this._items.length,
    }
  }

  _init() {
    this._index = 0
    this._items = []
    this._activeTiles = new Map()
    this._total = 0
    this._loadingMore = false
    this._targetY = HEADER_H
    this._focusArea = 'grid'
    this._barIndex = 0

    const prefs = loadLibraryPrefs(globalThis.localStorage, this.session && this.session.userId, this.view && this.view.id)
    this._sortIndex = (prefs && typeof prefs.sortIndex === 'number' && prefs.sortIndex >= 0 && prefs.sortIndex < SORTS.length) ? prefs.sortIndex : 0
    this._filterIndex = (prefs && typeof prefs.filterIndex === 'number' && prefs.filterIndex >= 0 && prefs.filterIndex < FILTERS.length) ? prefs.filterIndex : 0

    const name = (this.view && this.view.name) || ''
    this.tag('Header.Title').text.text = name
    this.tag('Header.User').text.text = (this.session && this.session.userName) || ''

    this._updateBarLabels()
    probe.view('grid', { library: name, total: 0, loaded: 0 })
    probe.data('sort', SORTS[this._sortIndex].key)
    probe.data('filter', FILTERS[this._filterIndex].key)
    this._load()
  }

  _updateBarLabels() {
    this.tag('Header.Bar.Sort.Label').text.text = SORTS[this._sortIndex].label
    this.tag('Header.Bar.Filter.Label').text.text = FILTERS[this._filterIndex].label
  }

  _updateBarFocus() {
    const isBar = this._focusArea === 'bar'
    const isSort = isBar && this._barIndex === 0
    const isFilter = isBar && this._barIndex === 1

    this.tag('Header.Bar.Sort.Border').setSmooth('alpha', isSort ? 1 : 0, { duration: 0.15 })
    this.tag('Header.Bar.Sort.Label').text.textColor = isSort ? colors.background : colors.textDim

    this.tag('Header.Bar.Filter.Border').setSmooth('alpha', isFilter ? 1 : 0, { duration: 0.15 })
    this.tag('Header.Bar.Filter.Label').text.textColor = isFilter ? colors.background : colors.textDim

    if (isBar) {
      const tag = isSort ? this.tag('Header.Bar.Sort') : this.tag('Header.Bar.Filter')
      probe.focus({
        area: 'bar',
        control: isSort ? 'sort' : 'filter',
        label: isSort ? SORTS[this._sortIndex].label : FILTERS[this._filterIndex].label,
        textColor: tag.tag('Label').text.textColor,
        fillColor: tag.tag('Border').color,
      })
    }
  }

  async _reload() {
    this._index = 0
    this._items = []
    this._activeTiles.clear()
    this.tag('Tiles').children = []
    this.tag('Tiles').setSmooth('y', HEADER_H, { duration: 0.15 })
    this._targetY = HEADER_H
    this.tag('Status').visible = true
    await this._load()
  }

  async _load() {
    const { client, session, view } = this
    const restore = this._restoreState
    const limit = restore && restore.loaded ? Math.max(PAGE_LIMIT, restore.loaded) : PAGE_LIMIT
    const sort = SORTS[this._sortIndex]
    const filter = FILTERS[this._filterIndex]

    probe.data('sort', sort.key)
    probe.data('filter', filter.key)

    try {
      const res = await client.items(session.userId, view, {
        startIndex: 0,
        limit,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
        filters: filter.filters,
      })
      if (!this.attached) return
      this._total = res.total
      probe.data('total', this._total)
      this._items = res.items || []
      probe.data('loaded', this._items.length)
      if (restore) {
        this._restoreState = null
        this._index = Math.min(restore.index || 0, Math.max(0, this._items.length - 1))
        this._scroll()
      }
      this.tag('Status').visible = false
      this._updateVirtualTiles()
      if (this._focusArea === 'grid') {
        this._publishFocus()
      }
      this._refocus()
      this._maybeLoadMore()
    } catch (e) {
      probe.error('grid', e)
      this.fireAncestors('$fatal', 'Impossibile caricare la libreria', e.message)
    }
  }

  _populate(items) {
    this._items = items || []
    this.tag('Status').visible = false
    this._updateVirtualTiles()
    this._refocus()
  }

  _appendItems(newItems) {
    if (!newItems || !newItems.length) return
    this._items = this._items.concat(newItems)
    this._updateVirtualTiles()
  }

  _updateVirtualTiles() {
    if (!this._items || !this._items.length) {
      this._activeTiles.clear()
      this.tag('Tiles').children = []
      return
    }
    const { poster, tileGap, grid } = layout
    const cols = grid.columns
    const rowHeight = grid.rowHeight
    const lastRow = Math.max(0, Math.floor((this._items.length - 1) / cols))

    const targetY = this._targetY !== undefined ? this._targetY : HEADER_H
    const rTop = Math.max(0, Math.floor((HEADER_H - targetY) / rowHeight))
    const rBottom = Math.floor((1080 - targetY) / rowHeight)
    const rFocus = Math.floor(this._index / cols)

    // Keep visible rows ± 2, always covering the focus row
    const rMin = Math.max(0, Math.min(rTop - 2, rFocus - 2))
    const rMax = Math.min(lastRow, Math.max(rBottom + 2, rFocus + 2))

    const iMin = rMin * cols
    const iMax = Math.min(this._items.length - 1, (rMax + 1) * cols - 1)

    for (const [idx] of this._activeTiles.entries()) {
      if (idx < iMin || idx > iMax) {
        this._activeTiles.delete(idx)
      }
    }

    for (let i = iMin; i <= iMax; i++) {
      if (!this._activeTiles.has(i)) {
        const item = this._items[i]
        const col = i % cols
        const row = Math.floor(i / cols)
        const tileComp = this.stage.c({
          type: Tile,
          x: col * (poster.w + tileGap),
          y: row * rowHeight,
          w: poster.w,
          h: poster.h,
          label: item.name,
          imageUrl: item.imageTag ? this.client.imageUrl(item.id, { tag: item.imageTag, maxHeight: poster.h }) : null,
          showLabel: true,
          played: item.played,
        })
        this._activeTiles.set(i, tileComp)
      }
    }

    const sortedIndices = Array.from(this._activeTiles.keys()).sort((a, b) => a - b)
    this.tag('Tiles').children = sortedIndices.map(i => this._activeTiles.get(i))
  }

  async _maybeLoadMore() {
    if (this._loadingMore) return
    if (!needsNextPage({
      focusIndex: this._index,
      loaded: this._items.length,
      total: this._total,
      columns: layout.grid.columns,
      marginRows: 2,
    })) {
      return
    }
    this._loadingMore = true
    try {
      const { client, session, view } = this
      const startIndex = this._items.length
      const sort = SORTS[this._sortIndex]
      const filter = FILTERS[this._filterIndex]
      const res = await client.items(session.userId, view, {
        startIndex,
        limit: PAGE_LIMIT,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
        filters: filter.filters,
      })
      if (!this.attached) return
      this._total = res.total
      probe.data('total', this._total)
      this._appendItems(res.items)
      probe.data('loaded', this._items.length)
    } catch (e) {
      probe.error('grid_page', e)
    } finally {
      this._loadingMore = false
    }
  }

  _publishFocus() {
    const item = this._items[this._index]
    probe.focus({ index: this._index, label: item ? item.name : null })
  }

  _scroll() {
    const row = Math.floor(this._index / layout.grid.columns)
    const rowHeight = layout.grid.rowHeight
    const rowTop = row * rowHeight
    const rowBottom = rowTop + rowHeight

    let currentY = this._targetY !== undefined ? this._targetY : HEADER_H
    if (currentY + rowBottom > 1080) {
      currentY = 1080 - rowBottom
    }
    if (currentY + rowTop < HEADER_H) {
      currentY = HEADER_H - rowTop
    }
    this._targetY = currentY
    this.tag('Tiles').setSmooth('y', currentY, { duration: 0.2 })
  }

  _setIndex(index) {
    if (index < 0 || index >= this._items.length) return false
    this._index = index
    this._scroll()
    this._updateVirtualTiles()
    this._publishFocus()
    this._refocus()
    this._maybeLoadMore()
    return true
  }

  _handleLeft() {
    if (this._focusArea === 'bar') {
      if (this._barIndex > 0) {
        this._barIndex--
        this._updateBarFocus()
      }
      return true
    }
    if (this._index % layout.grid.columns === 0) return true
    return this._setIndex(this._index - 1)
  }

  _handleRight() {
    if (this._focusArea === 'bar') {
      if (this._barIndex < 1) {
        this._barIndex++
        this._updateBarFocus()
      }
      return true
    }
    const cols = layout.grid.columns
    if (this._index % cols === cols - 1 || this._index + 1 >= this._items.length) {
      return true
    }
    return this._setIndex(this._index + 1)
  }

  _handleUp() {
    if (this._focusArea === 'bar') return true
    const cols = layout.grid.columns
    if (this._index - cols < 0) {
      this._focusArea = 'bar'
      this._barIndex = 0
      this._updateBarFocus()
      this._refocus()
      return true
    }
    return this._setIndex(this._index - cols)
  }

  _handleDown() {
    if (this._focusArea === 'bar') {
      this._focusArea = 'grid'
      this._updateBarFocus()
      this._refocus()
      this._publishFocus()
      return true
    }
    const cols = layout.grid.columns
    let next = this._index + cols
    if (next >= this._items.length) {
      const curRow = Math.floor(this._index / cols)
      const lastRow = Math.floor((this._items.length - 1) / cols)
      if (curRow < lastRow) {
        next = this._items.length - 1
      } else {
        this._maybeLoadMore()
        return true
      }
    }
    return this._setIndex(next)
  }

  _handleEnter() {
    if (this._focusArea === 'bar') {
      if (this._barIndex === 0) {
        this._sortIndex = (this._sortIndex + 1) % SORTS.length
      } else {
        this._filterIndex = (this._filterIndex + 1) % FILTERS.length
      }
      this._updateBarLabels()
      saveLibraryPrefs(globalThis.localStorage, this.session && this.session.userId, this.view && this.view.id, {
        sortIndex: this._sortIndex,
        filterIndex: this._filterIndex,
      })
      this._updateBarFocus()
      this._reload()
      return true
    }
    const item = this._items[this._index]
    if (item) {
      this.fireAncestors('$openItem', item.id)
    }
  }

  _handleBack() {
    this.fireAncestors('$back')
    return true
  }

  _focus() {
    if (this._focusArea === 'grid') {
      this._publishFocus()
    } else {
      this._updateBarFocus()
    }
  }

  _getFocused() {
    if (this._focusArea === 'bar') {
      return undefined
    }
    return this._activeTiles && this._activeTiles.get(this._index)
  }
}
