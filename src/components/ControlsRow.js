import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'
import { probe } from '../lib/probe.js'
import { CONTROL_BUTTON_LABELS } from '../lib/playerLayout.js'

const BUTTON_WIDTHS = {
  restart: 170,
  next: 250,
  subtitles: 160,
  audio: 130,
}

class ControlButton extends Lightning.Component {
  static _template() {
    return {
      h: 52,
      rect: true,
      color: 0x33ffffff,
      shader: { type: Lightning.shaders.RoundedRectangle, radius: 26 },
      Label: {
        x: 0,
        y: 26,
        mount: 0.5,
        text: {
          text: '',
          fontFace: font,
          fontSize: 24,
          textColor: colors.text,
        },
      },
    }
  }

  set isFocused(val) {
    this._isFocused = !!val
    this._update()
  }

  get isFocused() {
    return !!this._isFocused
  }

  _init() {
    this._update()
  }

  _update() {
    const w = this.buttonWidth || 160
    this.patch({
      w,
      color: this.isFocused ? colors.focus : 0x33ffffff,
      Label: {
        x: w / 2,
        text: {
          text: this.label || '',
          textColor: this.isFocused ? colors.background : colors.text,
        },
      },
    })
  }
}

export default class ControlsRow extends Lightning.Component {
  static _template() {
    return {
      w: 1920,
      h: 52,
      Buttons: {},
    }
  }

  _init() {
    this._buttons = ['restart', 'subtitles', 'audio']
    this._index = 0
    this._renderButtons()
  }

  setButtons(buttonIds) {
    this._buttons = Array.isArray(buttonIds) && buttonIds.length > 0 ? buttonIds : ['restart', 'subtitles', 'audio']
    if (this._index >= this._buttons.length) {
      this._index = 0
    }
    this._renderButtons()
  }

  show() {
    this.patch({ visible: true })
    this.setSmooth('alpha', 1, { duration: 0.2 })
  }

  hide() {
    this.setSmooth('alpha', 0, { duration: 0.2 })
  }

  get currentButton() {
    return this._buttons[this._index]
  }

  _renderButtons() {
    let currentX = 0
    const gap = 16
    const container = this.tag('Buttons')
    const children = []

    for (let i = 0; i < this._buttons.length; i++) {
      const id = this._buttons[i]
      const label = CONTROL_BUTTON_LABELS[id] || id
      const w = BUTTON_WIDTHS[id] || 160
      const isFocused = this.hasFocus() && i === this._index

      children.push({
        ref: `Btn_${id}`,
        type: ControlButton,
        x: currentX,
        y: 0,
        buttonWidth: w,
        label,
        isFocused,
      })
      currentX += w + gap
    }

    container.children = children
  }

  _updateFocus() {
    const container = this.tag('Buttons')
    if (!container || !container.children) return
    const isRowFocused = this.hasFocus()
    for (let i = 0; i < container.children.length; i++) {
      container.children[i].isFocused = (isRowFocused && i === this._index)
    }
  }

  _focus() {
    this._updateFocus()
    this._emitFocus()
  }

  _unfocus() {
    this._updateFocus()
  }

  _emitFocus() {
    probe.focus({ area: 'controls', button: this.currentButton })
  }

  _handleLeft() {
    if (this._index > 0) {
      this._index--
      this._updateFocus()
      this._emitFocus()
    }
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleRight() {
    if (this._index < this._buttons.length - 1) {
      this._index++
      this._updateFocus()
      this._emitFocus()
    }
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleEnter() {
    this.fireAncestors('$controlAction', this.currentButton)
    return true
  }

  _handleUp() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$focusTimeline')
    return true
  }

  _handleDown() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$focusEpisodes')
    return true
  }
}
