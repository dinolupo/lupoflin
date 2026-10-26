import { Img, Lightning, Utils } from '@lightningjs/sdk'
import Billboard from '../components/Billboard.js'
import Row from '../components/Row.js'
import { loadHome, saveHome } from '../lib/homeCache.js'
import { formatCardLabel } from '../lib/jellyfin.js'
import { probe } from '../lib/probe.js'
import { colors, font, layout } from '../theme.js'

const HEADER_H = 140
const BILLBOARD_ROW_Y = 440
const BILLBOARD_EXPANDED_ROW_Y = 480
const LATEST_LIMIT = 20

// Netflix-like home: billboard hero banner, "Continua a guardare" (if any), the libraries row, then one "recently added" row per library.
// Props: client, session. Calls on the ancestors: $fatal(title, message), $openProfileMenu().
export default class HomeView extends Lightning.Component {
  static _template() {
    return {
      Billboard: {
        type: Billboard,
        zIndex: 1,
      },
      Rows: {
        x: layout.sideMargin,
        y: HEADER_H,
        zIndex: 2,
        boundsMargin: [0, 0, layout.poster.w + layout.tileGap, 0],
      },
      Header: {
        zIndex: 5,
        rect: true,
        w: 1920,
        h: HEADER_H - 20,
        colorTop: 0xee141414,
        colorBottom: 0x00141414,
        // 440x180 transparent PNG made from static/Lupoflix.jpeg, drawn at half size.
        Brand: { x: layout.sideMargin, y: 18, w: 220, h: 90, src: Utils.asset('images/logo-header.png') },
        Search: {
          x: 1920 - layout.sideMargin - 320,
          y: 36,
          w: 120,
          h: 48,
          Border: {
            x: -4,
            y: -4,
            w: 128,
            h: 56,
            rect: true,
            color: colors.focus,
            alpha: 0,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 28 },
          },
          Bg: {
            w: 120,
            h: 48,
            rect: true,
            color: 0x33ffffff,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 24 },
          },
          Label: {
            x: 60,
            y: 24,
            mount: 0.5,
            text: { text: 'Cerca', fontFace: font, fontSize: 26, textColor: colors.textDim },
          },
        },
        Profile: {
          x: 1920 - layout.sideMargin - 56,
          y: 32,
          Border: {
            x: -4,
            y: -4,
            w: 64,
            h: 64,
            rect: true,
            color: colors.focus,
            alpha: 0,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 32 },
          },
          Avatar: {
            w: 56,
            h: 56,
            rect: true,
            color: colors.tile,
            clipping: true,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 28 },
            Initial: {
              x: 28,
              y: 28,
              mount: 0.5,
              text: { text: '', fontFace: font, fontSize: 26, textColor: colors.textDim },
            },
            Image: { alpha: 0.001 },
          },
          Name: {
            x: -16,
            y: 28,
            mountX: 1,
            mountY: 0.5,
            text: { text: '', fontFace: font, fontSize: 28, textColor: colors.textDim },
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
    const row = this._activeRows && this._activeRows.get(this._rowIndex)
    const index = row ? row.index : ((this._rowDefs && this._rowDefs[this._rowIndex] && this._rowDefs[this._rowIndex].savedIndex) || 0)
    return {
      area: this._focusArea,
      billboardButton: this.tag('Billboard') ? this.tag('Billboard').buttonIndex : 0,
      row: this._rowIndex,
      index,
    }
  }

  _init() {
    this._rowIndex = 0
    this._rowDefs = []
    this._activeRows = new Map()
    this._focusArea = 'rows'
    this._headerIndex = 1
    this._homeReadyEmitted = false
    this._billboard = null
    this.tag('Billboard').client = this.client
    const name = (this.session && this.session.userName) || ''
    this.tag('Header.Profile.Name').text.text = name
    this.tag('Header.Profile.Avatar.Initial').text.text = name.slice(0, 1).toUpperCase()
    if (this.session && this.session.imageTag) {
      const url = this.client.userImageUrl(this.session.userId, this.session.imageTag)
      const img = this.tag('Header.Profile.Avatar.Image')
      img.on('txLoaded', () => img.setSmooth('alpha', 1, { duration: 0.2 }))
      img.patch({ w: 56, h: 56, texture: { ...Img(url).cover(56, 56), hasAlpha: true } })
    }
    probe.view('home', { user: this.session.userName, rows: [] })

    const cached = loadHome(globalThis.localStorage, this.session && this.session.userId)
    if (cached && cached.length > 0) {
      this._loadedFromCache = true
      this._applyRows(cached, true)
    }

    this._load()
  }

  async _load() {
    const { client, session } = this
    try {
      const views = await client.views(session.userId)
      const genreViews = views.filter(v => v.collectionType === 'movies' || v.collectionType === 'tvshows')
      const [resume, nextUp, favorites, latest, genresPerView] = await Promise.all([
        client.resume(session.userId).catch(() => []),
        client.nextUp(session.userId).catch(() => []),
        client.favorites(session.userId).catch(() => []),
        Promise.all(views.map(view => client.latest(session.userId, view.id, LATEST_LIMIT).catch(() => []))),
        Promise.all(genreViews.map(view => client.genres(session.userId, view.id).catch(() => []))),
      ])
      if (!this.attached) return

      const candidates = []
      views.forEach((view, i) => {
        if (view.collectionType === 'movies' || view.collectionType === 'tvshows') {
          const items = latest[i] || []
          for (const item of items) {
            if (item.backdrop && item.logoTag) {
              candidates.push(item)
            }
          }
        }
      })
      const picked = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : null

      if (picked) {
        this._billboard = picked
        this.tag('Billboard').populate(picked)
        probe.data('billboard', { id: picked.id, name: picked.name })
        if (this._rowIndex === 0 && this._focusArea === 'rows') {
          this.tag('Rows').setSmooth('y', BILLBOARD_ROW_Y, { duration: 0.25 })
        }
      }

      this._populate(views, latest, resume, nextUp, favorites, genreViews, genresPerView)
    } catch (e) {
      probe.error('home', e)
      this.fireAncestors('$fatal', 'Impossibile caricare le librerie', e.message)
    }
  }

  _populate(views, latest, resume, nextUp = [], favorites = [], genreViews = [], genresPerView = []) {
    const { client } = this
    const wide = layout.wide
    const poster = layout.poster
    const rows = []
    if (resume && resume.length > 0) {
      rows.push({
        title: 'Continua a guardare',
        tile: wide,
        showLabels: true,
        loaded: true,
        entries: resume.map(item => ({
          kind: 'item',
          id: item.id,
          label: formatCardLabel(item),
          progress: item.progress,
          played: item.played,
          imageUrl: item.imageTag
            ? client.imageUrl(item.id, { tag: item.imageTag, maxWidth: wide.w })
            : (item.type === 'Episode' && item.seriesBackdrop
                ? client.imageUrl(item.seriesBackdrop.itemId, { type: 'Backdrop', tag: item.seriesBackdrop.tag, maxWidth: wide.w })
                : null),
        })),
      })
    }
    if (nextUp && nextUp.length > 0) {
      rows.push({
        title: 'Prossimi episodi',
        tile: wide,
        showLabels: true,
        loaded: true,
        entries: nextUp.map(item => ({
          kind: 'item',
          id: item.id,
          label: formatCardLabel(item),
          played: item.played,
          imageUrl: item.imageTag
            ? client.imageUrl(item.id, { tag: item.imageTag, maxWidth: wide.w })
            : (item.type === 'Episode' && item.seriesBackdrop
                ? client.imageUrl(item.seriesBackdrop.itemId, { type: 'Backdrop', tag: item.seriesBackdrop.tag, maxWidth: wide.w })
                : null),
        })),
      })
    }
    if (favorites && favorites.length > 0) {
      rows.push({
        title: 'La mia lista',
        tile: poster,
        loaded: true,
        entries: favorites.map(item => ({
          kind: 'item',
          id: item.id,
          label: item.name,
          played: item.played,
          imageUrl: item.imageTag ? client.imageUrl(item.id, { tag: item.imageTag, maxHeight: poster.h }) : null,
        })),
      })
    }
    rows.push({
      title: 'Le tue librerie',
      tile: wide,
      showLabels: true,
      loaded: true,
      entries: views.map(v => ({
        kind: 'library',
        id: v.id,
        label: v.name,
        collectionType: v.collectionType,
        imageUrl: v.imageTag ? client.imageUrl(v.id, { tag: v.imageTag, maxWidth: wide.w }) : null,
      })),
    })
    views.forEach((view, i) => {
      if (!latest[i] || !latest[i].length) return
      rows.push({
        title: `Aggiunti di recente: ${view.name}`,
        tile: poster,
        loaded: true,
        entries: latest[i].map(item => ({
          kind: 'item',
          id: item.id,
          label: item.name,
          played: item.played,
          imageUrl: item.imageTag ? client.imageUrl(item.id, { tag: item.imageTag, maxHeight: poster.h }) : null,
        })),
      })
    })

    genreViews.forEach((view, vi) => {
      const genres = genresPerView[vi] || []
      genres.forEach(genre => {
        rows.push({
          title: `${genre.name} · ${view.name}`,
          tile: poster,
          isGenre: true,
          genreId: genre.id,
          libraryView: view,
          loaded: false,
          loading: false,
          entries: Array.from({ length: 6 }, () => ({
            kind: 'placeholder',
            id: null,
            label: '',
            imageUrl: null,
          })),
        })
      })
    })

    if (this._loadedFromCache) {
      this._refreshFromLive(rows)
    } else {
      this._applyRows(rows, false)
    }
    saveHome(globalThis.localStorage, this.session && this.session.userId, this._rowDefs)
  }

  _applyRows(rows, fromCache) {
    let currentY = 0
    rows.forEach(row => {
      row.y = currentY
      const rowH = 56 + row.tile.h + (row.showLabels ? 50 : 0)
      currentY += rowH + layout.rowGap
    })
    this._rowDefs = rows
    this.tag('Status').visible = false
    this._updateProbeRows()
    if (!this._homeReadyEmitted) {
      this._homeReadyEmitted = true
      // Milliseconds since the page started loading: the startup time measured by `npm run tv startup`.
      probe.event('home_ready', { ms: Math.round(performance.now()), fromCache })
    }
    if (this._restoreState) {
      const { area = 'rows', billboardButton = 0, row = 0, index = 0 } = this._restoreState
      this._restoreState = null
      this._focusArea = area
      if (this.tag('Billboard')) {
        this.tag('Billboard').buttonIndex = billboardButton
      }
      if (this._rowDefs[row]) {
        this._rowIndex = row
        this._rowDefs[row].savedIndex = index
      }
    }
    if (this._rowDefs[this._rowIndex]) {
      let targetY = HEADER_H - this._rowDefs[this._rowIndex].y
      if (this._rowIndex === 0 && this._billboard) {
        targetY = this._focusArea === 'billboard' ? BILLBOARD_EXPANDED_ROW_Y : BILLBOARD_ROW_Y
      }
      this.tag('Rows').setSmooth('y', targetY, { duration: 0 })
    }
    this._updateVirtualRows()
    this._checkDemandLoading()
    this._refocus()
  }

  _refreshFromLive(newRows) {
    newRows.forEach((nr, i) => {
      const old = this._rowDefs[i]
      if (old) {
        if (typeof old.savedIndex === 'number') nr.savedIndex = old.savedIndex
        if (old.loaded && !nr.loaded && old.entries && old.entries.length) {
          nr.loaded = true
          nr.entries = old.entries
        }
      }
    })
    let currentY = 0
    newRows.forEach(row => {
      row.y = currentY
      const rowH = 56 + row.tile.h + (row.showLabels ? 50 : 0)
      currentY += rowH + layout.rowGap
    })
    this._rowDefs = newRows
    this._updateProbeRows()
    for (const [idx, comp] of this._activeRows.entries()) {
      if (idx < newRows.length && comp && comp.updateEntries) {
        comp.updateEntries(newRows[idx].entries)
      }
    }
    this._checkDemandLoading()
  }

  get _rows() {
    return this._activeRows ? Array.from(this._activeRows.values()) : []
  }

  _updateVirtualRows() {
    if (!this._rowDefs || !this._rowDefs.length) return
    const focusRow = this._rowIndex
    const minRow = Math.max(0, focusRow - 1)
    const maxRow = Math.min(this._rowDefs.length - 1, focusRow + 2)

    for (const [idx, comp] of this._activeRows.entries()) {
      if (idx < minRow || idx > maxRow) {
        this._rowDefs[idx].savedIndex = comp.index
        this._activeRows.delete(idx)
      }
    }

    for (let i = minRow; i <= maxRow; i++) {
      if (!this._activeRows.has(i)) {
        const def = this._rowDefs[i]
        const comp = this.stage.c({
          type: Row,
          y: def.y,
          title: def.title,
          tile: def.tile,
          showLabels: !!def.showLabels,
          entries: def.entries,
          initialIndex: typeof def.savedIndex === 'number' ? def.savedIndex : 0,
        })
        this._activeRows.set(i, comp)
      }
    }

    const sorted = Array.from(this._activeRows.keys()).sort((a, b) => a - b)
    this.tag('Rows').children = sorted.map(i => this._activeRows.get(i))
  }

  _updateProbeRows() {
    if (!this._rowDefs) return
    probe.data('rows', this._rowDefs.map(r => ({
      title: r.title,
      count: r.entries ? r.entries.length : 0,
      loaded: r.loaded !== false,
    })))
  }

  _checkDemandLoading() {
    if (!this._rowDefs || !this._rowDefs.length) return
    const focusRow = this._rowIndex
    const minRow = Math.max(0, focusRow - 2)
    const maxRow = Math.min(this._rowDefs.length - 1, focusRow + 2)
    for (let i = minRow; i <= maxRow; i++) {
      const rowDef = this._rowDefs[i]
      if (rowDef && rowDef.isGenre && !rowDef.loaded && !rowDef.loading) {
        this._loadGenreRow(i, rowDef)
      }
    }
  }

  async _loadGenreRow(index, rowDef) {
    rowDef.loading = true
    try {
      const res = await this.client.items(this.session.userId, rowDef.libraryView, {
        genreId: rowDef.genreId,
        sortBy: 'Random',
        limit: 20,
      })
      if (!this.attached) return
      const poster = layout.poster
      const entries = (res.items || []).map(item => ({
        kind: 'item',
        id: item.id,
        label: item.name,
        played: item.played,
        imageUrl: item.imageTag ? this.client.imageUrl(item.id, { tag: item.imageTag, maxHeight: poster.h }) : null,
      }))
      rowDef.loaded = true
      rowDef.loading = false
      rowDef.entries = entries
      const rowEl = this._activeRows.get(index)
      if (rowEl && rowEl.updateEntries) {
        rowEl.updateEntries(entries)
      }
      this._updateProbeRows()
      saveHome(globalThis.localStorage, this.session && this.session.userId, this._rowDefs)
      if (this._rowIndex === index && this._focusArea === 'rows') {
        this._refocus()
        if (rowEl) {
          probe.focus({ row: this._rowIndex, index: rowEl.index, title: rowEl.title, label: rowEl.focusedEntry ? rowEl.focusedEntry.label : null })
        }
      }
    } catch (e) {
      rowDef.loading = false
    }
  }

  _updateHeaderFocus() {
    const isHeader = this._focusArea === 'header'
    const isSearch = isHeader && this._headerIndex === 0
    const isProfile = isHeader && this._headerIndex === 1

    this.tag('Header.Search.Border').setSmooth('alpha', isSearch ? 1 : 0, { duration: 0.15 })
    this.tag('Header.Search.Label').text.textColor = isSearch ? colors.background : colors.textDim

    this.tag('Header.Profile.Border').setSmooth('alpha', isProfile ? 1 : 0, { duration: 0.15 })
    this.tag('Header.Profile.Name').text.textColor = isProfile ? colors.text : colors.textDim

    if (isHeader) {
      if (isSearch) {
        probe.focus({
          area: 'header',
          label: 'Cerca',
          textColor: this.tag('Header.Search.Label').text.textColor,
          fillColor: this.tag('Header.Search.Border').color,
        })
      } else {
        probe.focus({ area: 'header', label: (this.session && this.session.userName) || '' })
      }
    }
  }

  _emitCurrentRowFocus() {
    const row = this._activeRows && this._activeRows.get(this._rowIndex)
    if (row) {
      probe.focus({
        row: this._rowIndex,
        index: row.index,
        title: row.title,
        label: row.focusedEntry ? row.focusedEntry.label : (row.entry ? row.entry.label : null),
      })
    }
  }

  _setRow(index) {
    if (index < 0 || index >= this._rowDefs.length) return
    const prevComp = this._activeRows && this._activeRows.get(this._rowIndex)
    if (prevComp) {
      this._rowDefs[this._rowIndex].savedIndex = prevComp.index
    }
    this._rowIndex = index
    if (index === 0 && this._billboard) {
      this.tag('Rows').setSmooth('y', BILLBOARD_ROW_Y, { duration: 0.25 })
      this.tag('Billboard').setSmooth('alpha', 1, { duration: 0.25 })
      this.tag('Header').patch({ color: 0, colorTop: 0xee141414, colorBottom: 0x00141414 })
    } else {
      this.tag('Rows').setSmooth('y', HEADER_H - this._rowDefs[index].y, { duration: 0.25 })
      if (this._billboard) {
        this.tag('Billboard').setSmooth('alpha', 0, { duration: 0.25 })
      }
      this.tag('Header').patch({ color: colors.background })
    }
    this._updateVirtualRows()
    this._checkDemandLoading()
    this._refocus()
  }

  _handleLeft() {
    if (this._focusArea === 'header') {
      if (this._headerIndex > 0) {
        this._headerIndex--
        this._updateHeaderFocus()
      }
      return true
    }
    return false
  }

  _handleRight() {
    if (this._focusArea === 'header') {
      if (this._headerIndex < 1) {
        this._headerIndex++
        this._updateHeaderFocus()
      }
      return true
    }
    return false
  }

  _handleUp() {
    if (this._focusArea === 'header') return true
    if (this._focusArea === 'billboard') {
      this._focusArea = 'header'
      this._headerIndex = 1
      this._updateHeaderFocus()
      this._refocus()
      return true
    }
    // _focusArea === 'rows'
    if (this._rowIndex === 0) {
      if (this._billboard) {
        this._focusArea = 'billboard'
        this.tag('Rows').setSmooth('y', BILLBOARD_EXPANDED_ROW_Y, { duration: 0.25 })
        this._refocus()
        this.tag('Billboard').emitFocus()
      } else {
        this._focusArea = 'header'
        this._headerIndex = 1
        this._updateHeaderFocus()
        this._refocus()
      }
      return true
    }
    this._setRow(this._rowIndex - 1)
    return true
  }

  _handleDown() {
    if (this._focusArea === 'header') {
      if (this._billboard) {
        this._focusArea = 'billboard'
        this._updateHeaderFocus()
        this._refocus()
        this.tag('Billboard').emitFocus()
      } else {
        this._focusArea = 'rows'
        this._updateHeaderFocus()
        this._refocus()
        this._emitCurrentRowFocus()
      }
      return true
    }
    if (this._focusArea === 'billboard') {
      this._focusArea = 'rows'
      this._rowIndex = 0
      this.tag('Rows').setSmooth('y', BILLBOARD_ROW_Y, { duration: 0.25 })
      this._refocus()
      this._emitCurrentRowFocus()
      return true
    }
    // _focusArea === 'rows'
    if (this._rowIndex < this._rowDefs.length - 1) {
      this._setRow(this._rowIndex + 1)
    }
    return true
  }

  _handleEnter() {
    if (this._focusArea === 'header') {
      if (this._headerIndex === 0) {
        this.fireAncestors('$openSearch')
      } else {
        this.fireAncestors('$openProfileMenu')
      }
      return true
    }
    return false
  }

  $rowFocus(row, entry) {
    if (this._rowDefs && this._rowDefs[this._rowIndex]) {
      this._rowDefs[this._rowIndex].savedIndex = row.index
    }
    if (this._focusArea === 'rows') {
      probe.focus({ row: this._rowIndex, index: row.index, title: row.title, label: entry ? entry.label : null })
    }
  }

  $rowSelect(row, entry) {
    if (!entry || entry.kind === 'placeholder' || !entry.id) return
    if (entry.kind === 'library') {
      this.fireAncestors('$openLibrary', { id: entry.id, name: entry.label, collectionType: entry.collectionType })
      return
    }
    probe.event('select', { kind: entry.kind, id: entry.id, label: entry.label })
    this.fireAncestors('$openItem', entry.id)
  }

  _focus() {
    if (this._focusArea === 'header') {
      this._updateHeaderFocus()
    } else if (this._focusArea === 'billboard') {
      if (this.tag('Billboard')) this.tag('Billboard').emitFocus()
    } else {
      this._emitCurrentRowFocus()
    }
  }

  _getFocused() {
    if (this._focusArea === 'header') {
      return undefined
    }
    if (this._focusArea === 'billboard') {
      return this.tag('Billboard')
    }
    return this._activeRows && this._activeRows.get(this._rowIndex)
  }
}
