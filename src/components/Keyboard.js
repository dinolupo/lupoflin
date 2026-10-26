import { Lightning } from '@lightningjs/sdk'
import { probe } from '../lib/probe.js'
import { colors, font } from '../theme.js'

const BASE_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ':'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '/', '-'],
]

export default class Keyboard extends Lightning.Component {
  static _template() {
    return {
      w: 908,
      h: 500,
      Keys: {},
    }
  }

  _init() {
    this._value = this.initialText || ''
    this._row = 0
    this._col = 0
    this._keys = []
    const lastRow = this.mode === 'search' ? ['Spazio', 'Cancella', 'Svuota'] : ['Connetti', 'Cancella', 'Svuota']
    this._rows = [...BASE_ROWS, lastRow]
    this._createKeys()
  }

  setValue(val) {
    this._value = String(val || '')
  }

  _createKeys() {
    const keyPatch = {}
    const isCompact = !!this.compact
    const charW = isCompact ? 74 : 80
    const charH = isCompact ? 92 : 64
    const gapX = isCompact ? 8 : 12
    const gapY = isCompact ? 10 : 12
    const totalW = 10 * charW + 9 * gapX
    const actionGap = isCompact ? 12 : 16
    const actionW = Math.floor((totalW - 2 * actionGap) / 3)

    for (let r = 0; r < this._rows.length; r++) {
      this._keys[r] = []
      for (let c = 0; c < this._rows[r].length; c++) {
        const key = this._rows[r][c]
        const w = r === 4 ? actionW : charW
        const x = r === 4 ? c * (actionW + actionGap) : c * (charW + gapX)
        const y = r * (charH + gapY)
        const h = charH
        this._keys[r][c] = { cx: x + w / 2, key }
        keyPatch[`Key_${r}_${c}`] = {
          rect: true,
          x,
          y,
          w,
          h,
          color: 0xff333333,
          shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
          Label: {
            x: w / 2,
            y: h / 2 + 2,
            mount: 0.5,
            text: {
              text: key,
              fontFace: font,
              fontSize: r === 4 ? (isCompact ? 30 : 26) : (isCompact ? 36 : 28),
              textColor: colors.text,
            },
          },
        }
      }
    }
    this.tag('Keys').patch(keyPatch)
  }

  _nearestCol(targetRow, fromCx) {
    const keys = this._keys[targetRow]
    let bestCol = 0
    let bestDist = Infinity
    for (let c = 0; c < keys.length; c++) {
      const dist = Math.abs(keys[c].cx - fromCx)
      if (dist < bestDist) {
        bestDist = dist
        bestCol = c
      }
    }
    return bestCol
  }

  _focus() {
    this._updateFocus()
  }

  _unfocus() {
    const cur = this.tag('Keys').tag(`Key_${this._row}_${this._col}`)
    if (cur) {
      cur.patch({ color: 0xff333333 })
      cur.tag('Label').text.textColor = colors.text
    }
  }

  _updateFocus() {
    if (this._prevRow !== undefined && this._prevCol !== undefined) {
      const prev = this.tag('Keys').tag(`Key_${this._prevRow}_${this._prevCol}`)
      if (prev) {
        prev.patch({ color: 0xff333333 })
        prev.tag('Label').text.textColor = colors.text
      }
    }
    const cur = this.tag('Keys').tag(`Key_${this._row}_${this._col}`)
    if (cur) {
      cur.patch({ color: colors.focus })
      cur.tag('Label').text.textColor = colors.background
    }
    this._prevRow = this._row
    this._prevCol = this._col
    const key = this._rows[this._row][this._col]
    probe.focus({ key })
  }

  _handleLeft() {
    if (this._col > 0) {
      this._col--
      this._updateFocus()
      return true
    }
    return true
  }

  _handleRight() {
    if (this._col < this._rows[this._row].length - 1) {
      this._col++
      this._updateFocus()
      return true
    }
    // Last key of the row: the parent decides (the search screen goes to the results)
    return false
  }

  _handleUp() {
    if (this._row > 0) {
      const curCx = this._keys[this._row][this._col].cx
      this._row--
      this._col = this._nearestCol(this._row, curCx)
      this._updateFocus()
    }
    return true
  }

  _handleDown() {
    if (this._row < this._rows.length - 1) {
      const curCx = this._keys[this._row][this._col].cx
      this._row++
      this._col = this._nearestCol(this._row, curCx)
      this._updateFocus()
    }
    return true
  }

  _handleEnter() {
    const key = this._rows[this._row][this._col]
    if (key === 'Connetti') {
      this.fireAncestors('$keyboardSubmit', this._value)
    } else if (key === 'Spazio') {
      this._value += ' '
      this.fireAncestors('$keyboardInput', this._value)
    } else if (key === 'Cancella') {
      if (this._value.length > 0) {
        this._value = this._value.slice(0, -1)
        this.fireAncestors('$keyboardInput', this._value)
      }
    } else if (key === 'Svuota') {
      this._value = ''
      this.fireAncestors('$keyboardInput', this._value)
    } else {
      this._value += key
      this.fireAncestors('$keyboardInput', this._value)
    }
    return true
  }

  _handleKey(e) {
    if (e && e.key === 'Backspace') {
      if (this._value.length > 0) {
        this._value = this._value.slice(0, -1)
        this.fireAncestors('$keyboardInput', this._value)
      }
      return true
    }
    if (e && e.key && e.key.length === 1) {
      this._value += e.key
      this.fireAncestors('$keyboardInput', this._value)
      return true
    }
    return false
  }

  _handleBack() {
    return false
  }
}

