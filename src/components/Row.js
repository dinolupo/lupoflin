import { Lightning } from '@lightningjs/sdk'
import Tile from './Tile.js'
import { colors, font, layout } from '../theme.js'

// Horizontal row with a title. Props: title, entries [{ key, label, imageUrl, progress }], tile { w, h }, showLabels.
// Calls on the ancestors: $rowFocus(row, entry) when focus moves, $rowSelect(row, entry) on Enter.
export default class Row extends Lightning.Component {
  static _template() {
    return {
      Title: { text: { text: '', fontFace: font, fontSize: 32, textColor: colors.text } },
      Items: { y: 56, forceZIndexContext: true },
    }
  }

  _init() {
    this._index = typeof this.initialIndex === 'number' ? this.initialIndex : 0
    const { w, h } = this.tile
    this.tag('Title').text.text = this.title || ''
    this.tag('Items').children = (this.entries || []).map((entry, i) => ({
      type: Tile,
      x: i * (w + layout.tileGap),
      w,
      h,
      label: entry.label,
      imageUrl: entry.imageUrl,
      showLabel: !!this.showLabels,
      progress: entry.progress,
      played: !!entry.played,
    }))
    if (this._index > 0) {
      const step = w + layout.tileGap
      this.tag('Items').x = -Math.max(0, this._index - 1) * step
    }
  }

  updateEntries(entries) {
    this.entries = entries || []
    const { w, h } = this.tile
    this.tag('Items').children = this.entries.map((entry, i) => ({
      type: Tile,
      x: i * (w + layout.tileGap),
      w,
      h,
      label: entry.label,
      imageUrl: entry.imageUrl,
      showLabel: !!this.showLabels,
      progress: entry.progress,
      played: !!entry.played,
    }))
    if (this._index >= this.entries.length) {
      this._index = Math.max(0, this.entries.length - 1)
    }
    const step = this.tile.w + layout.tileGap
    this.tag('Items').setSmooth('x', -Math.max(0, this._index - 1) * step, { duration: 0 })
  }

  // Height of the whole row, used by the parent to stack rows.
  get rowHeight() {
    return 56 + this.tile.h + (this.showLabels ? 50 : 0)
  }

  get index() {
    return this._index
  }

  get focusedEntry() {
    return (this.entries || [])[this._index]
  }

  _setIndex(index) {
    const count = this.tag('Items').children.length
    if (index < 0 || index >= count) return false
    this._index = index
    // Netflix style: the focused card stays near the left edge once the row starts scrolling.
    const step = this.tile.w + layout.tileGap
    this.tag('Items').setSmooth('x', -Math.max(0, index - 1) * step, { duration: 0.2 })
    this.fireAncestors('$rowFocus', this, this.focusedEntry)
    return true
  }

  _handleLeft() {
    return this._setIndex(this._index - 1)
  }

  _handleRight() {
    return this._setIndex(this._index + 1)
  }

  _handleEnter() {
    if (this.focusedEntry) this.fireAncestors('$rowSelect', this, this.focusedEntry)
  }

  _focus() {
    this.fireAncestors('$rowFocus', this, this.focusedEntry)
  }

  _getFocused() {
    return this.tag('Items').children[this._index]
  }
}
