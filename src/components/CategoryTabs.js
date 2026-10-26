import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'

export default class CategoryTabs extends Lightning.Component {
  static _template() {
    return {
      Tabs: {},
    }
  }

  _init() {
    this._index = 0
    this._categories = this.categories || []
    this._rebuild()
  }

  set categories(cats) {
    this._categories = cats || []
    this._index = 0
    if (this.tag('Tabs')) this._rebuild()
  }

  get categories() {
    return this._categories
  }

  get index() {
    return this._index
  }

  set index(val) {
    this._index = val
    this._paint()
  }

  get currentCategory() {
    return this._categories[this._index] || null
  }

  _rebuild() {
    let curX = 0
    const children = this._categories.map((cat, i) => {
      const label = `${cat.name} · ${cat.items ? cat.items.length : 0}`
      const tabW = Math.max(160, label.length * 15 + 44)
      const x = curX
      curX += tabW + 20
      return {
        ref: `Tab_${i}`,
        x,
        y: 0,
        w: tabW,
        h: 52,
        rect: true,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 26 },
        Label: {
          x: tabW / 2,
          y: 26,
          mount: 0.5,
          text: { text: label, fontFace: font, fontSize: 24 },
        },
      }
    })
    this.tag('Tabs').children = children
    this._paint()
  }

  _paint() {
    const tabs = this.tag('Tabs').children
    tabs.forEach((tab, i) => {
      const isFocused = this.hasFocus() && i === this._index
      const isSelected = i === this._index
      if (isFocused) {
        tab.color = colors.focus
        tab.tag('Label').text.textColor = colors.background
      } else if (isSelected) {
        tab.color = 0x55ffffff
        tab.tag('Label').text.textColor = colors.text
      } else {
        tab.color = 0x22ffffff
        tab.tag('Label').text.textColor = colors.textDim
      }
    })
  }

  _focus() {
    this._paint()
  }

  _unfocus() {
    this._paint()
  }

  _handleLeft() {
    if (this._index > 0) {
      this._index--
      this._paint()
      this.fireAncestors('$tabChanged', this.currentCategory, this._index)
      return true
    }
    return true
  }

  _handleRight() {
    if (this._index < this._categories.length - 1) {
      this._index++
      this._paint()
      this.fireAncestors('$tabChanged', this.currentCategory, this._index)
      return true
    }
    return true
  }
}
