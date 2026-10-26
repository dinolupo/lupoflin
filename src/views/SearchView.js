import { Lightning } from '@lightningjs/sdk'
import Keyboard from '../components/Keyboard.js'
import Tile from '../components/Tile.js'
import { formatCardLabel } from '../lib/jellyfin.js'
import { probe } from '../lib/probe.js'
import { colors, font, layout } from '../theme.js'

const COLUMNS = 4
const ROW_HEIGHT = 380
const COL_WIDTH = 240

export default class SearchView extends Lightning.Component {
  static _template() {
    return {
      rect: true,
      w: 1920,
      h: 1080,
      color: colors.background,
      SearchBox: {
        x: 40,
        y: 60,
        w: 812,
        h: 60,
        rect: true,
        color: 0xff222222,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
        Icon: {
          x: 24,
          y: 30,
          mountY: 0.5,
          text: { text: 'Cerca', fontFace: font, fontSize: 26, textColor: colors.brand },
        },
        Placeholder: {
          x: 110,
          y: 30,
          mountY: 0.5,
          text: { text: 'Cerca titoli, serie ed episodi', fontFace: font, fontSize: 24, textColor: colors.textDim },
        },
        Input: {
          x: 110,
          y: 30,
          mountY: 0.5,
          visible: false,
          text: { text: '', fontFace: font, fontSize: 26, textColor: colors.text },
        },
      },
      Keyboard: {
        x: 40,
        y: 170,
        type: Keyboard,
        mode: 'search',
        compact: true,
      },
      Results: {
        x: 860,
        y: 60,
        w: 1000,
        h: 960,
        clipping: true,
        forceZIndexContext: true,
        Empty: {
          x: 500,
          y: 320,
          mount: 0.5,
          text: { text: 'Cerca titoli, serie ed episodi', fontFace: font, fontSize: 30, textColor: colors.textDim },
        },
        NoResults: {
          x: 500,
          y: 320,
          mount: 0.5,
          visible: false,
          text: { text: '', fontFace: font, fontSize: 30, textColor: colors.textDim },
        },
        Grid: {
          x: 0,
          y: 0,
        },
      },
    }
  }

  _init() {
    this._query = ''
    this._results = []
    this._activeTiles = []
    this._focusArea = 'keyboard'
    this._resultIndex = 0
    this._searchSeq = 0
    this._debounceTimer = null

    probe.view('search', { query: '', results: 0 })
    probe.data('query', '')
    probe.data('results', 0)
  }

  _detach() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = null
    }
  }

  $keyboardInput(val) {
    this._query = val || ''
    const hasQuery = this._query.length > 0
    this.tag('SearchBox.Input').text.text = this._query
    this.tag('SearchBox.Input').visible = hasQuery
    this.tag('SearchBox.Placeholder').visible = !hasQuery
    probe.data('query', this._query)

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = null
    }

    const trimmed = this._query.trim()
    if (!trimmed) {
      this._searchSeq++
      this._results = []
      this._activeTiles = []
      this.tag('Results.Grid').children = []
      this.tag('Results.Empty').visible = true
      this.tag('Results.NoResults').visible = false
      probe.data('results', 0)
      if (this._focusArea === 'results') {
        this._focusArea = 'keyboard'
        this._refocus()
      }
      return
    }

    const seq = ++this._searchSeq
    this._debounceTimer = setTimeout(async () => {
      try {
        const items = await this.client.search(this.session.userId, trimmed, 40)
        if (seq !== this._searchSeq || !this.attached) return
        this._results = items || []
        probe.data('results', this._results.length)
        this._populateResults()
      } catch (e) {
        if (seq !== this._searchSeq || !this.attached) return
        this._results = []
        probe.data('results', 0)
        this._populateResults()
      }
    }, 300)
  }

  _populateResults() {
    const hasResults = this._results.length > 0
    this.tag('Results.Empty').visible = false
    this.tag('Results.NoResults').visible = !hasResults
    if (!hasResults) {
      this.tag('Results.NoResults').text.text = `Nessun risultato per «${this._query}»`
      this._activeTiles = []
      this.tag('Results.Grid').children = []
      if (this._focusArea === 'results') {
        this._focusArea = 'keyboard'
        this._refocus()
      }
      return
    }

    const { poster } = layout
    this._activeTiles = this._results.map((item, i) => {
      const col = i % COLUMNS
      const row = Math.floor(i / COLUMNS)
      return this.stage.c({
        type: Tile,
        x: col * COL_WIDTH,
        y: row * ROW_HEIGHT,
        w: poster.w,
        h: poster.h,
        label: formatCardLabel(item),
        imageUrl: item.imageTag ? this.client.imageUrl(item.id, { tag: item.imageTag, maxHeight: poster.h }) : null,
        showLabel: true,
        played: item.played,
      })
    })

    this.tag('Results.Grid').children = this._activeTiles
    this._resultIndex = Math.min(this._resultIndex, Math.max(0, this._results.length - 1))
    this._scrollResults()
    if (this._focusArea === 'results') {
      this._publishResultFocus()
      this._refocus()
    }
  }

  _scrollResults() {
    const row = Math.floor(this._resultIndex / COLUMNS)
    const targetY = row > 1 ? -(row - 1) * ROW_HEIGHT : 0
    this.tag('Results.Grid').setSmooth('y', targetY, { duration: 0.2 })
  }

  _publishResultFocus() {
    const item = this._results[this._resultIndex]
    if (item) {
      probe.focus({ area: 'results', index: this._resultIndex, id: item.id, label: item.name })
    }
  }

  _getFocused() {
    if (this._focusArea === 'results' && this._activeTiles[this._resultIndex]) {
      return this._activeTiles[this._resultIndex]
    }
    return this.tag('Keyboard')
  }

  _handleRight() {
    if (this._focusArea === 'keyboard') {
      if (this._results.length > 0) {
        this._focusArea = 'results'
        this._resultIndex = 0
        this._scrollResults()
        this._publishResultFocus()
        this._refocus()
        return true
      }
      return true
    }
    if (this._focusArea === 'results') {
      if (this._resultIndex < this._results.length - 1) {
        this._resultIndex++
        this._scrollResults()
        this._publishResultFocus()
        this._refocus()
      }
      return true
    }
    return false
  }

  _handleLeft() {
    if (this._focusArea === 'results') {
      if (this._resultIndex % COLUMNS === 0) {
        this._focusArea = 'keyboard'
        this._refocus()
        return true
      }
      this._resultIndex--
      this._scrollResults()
      this._publishResultFocus()
      this._refocus()
      return true
    }
    return false
  }

  _handleUp() {
    if (this._focusArea === 'results') {
      if (this._resultIndex >= COLUMNS) {
        this._resultIndex -= COLUMNS
        this._scrollResults()
        this._publishResultFocus()
        this._refocus()
      }
      return true
    }
    return false
  }

  _handleDown() {
    if (this._focusArea === 'results') {
      if (this._resultIndex + COLUMNS < this._results.length) {
        this._resultIndex += COLUMNS
        this._scrollResults()
        this._publishResultFocus()
        this._refocus()
      } else if (Math.floor(this._resultIndex / COLUMNS) < Math.floor((this._results.length - 1) / COLUMNS)) {
        this._resultIndex = this._results.length - 1
        this._scrollResults()
        this._publishResultFocus()
        this._refocus()
      }
      return true
    }
    return false
  }

  _handleEnter() {
    if (this._focusArea === 'results') {
      const item = this._results[this._resultIndex]
      if (item && item.id) {
        this.fireAncestors('$openItem', item.id)
      }
      return true
    }
    return false
  }

  _handleBack() {
    if (this._focusArea === 'results') {
      this._focusArea = 'keyboard'
      this._refocus()
      return true
    }
    this.fireAncestors('$back')
    return true
  }
}
