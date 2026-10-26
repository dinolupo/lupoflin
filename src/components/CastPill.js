import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'
import { probe } from '../lib/probe.js'

export default class CastPill extends Lightning.Component {
  static _template() {
    return {
      h: 40,
      w: 110,
      rect: true,
      color: 0x33ffffff,
      shader: { type: Lightning.shaders.RoundedRectangle, radius: 20 },
      Label: {
        x: 55,
        y: 20,
        mount: 0.5,
        text: {
          text: 'Cast',
          fontFace: font,
          fontSize: 22,
          textColor: colors.text,
        },
      },
    }
  }

  _init() {
    this._hasCast = false
    this._isFocused = false
  }

  setHasCast(val) {
    this._hasCast = !!val
    if (!this._hasCast) {
      this.patch({ visible: false, alpha: 0.001 })
    }
  }

  show() {
    if (!this._hasCast) return
    this.patch({ visible: true })
    this.setSmooth('alpha', 1, { duration: 0.2 })
  }

  hide() {
    this.setSmooth('alpha', 0, { duration: 0.2 })
  }

  _update() {
    this.patch({
      color: this._isFocused ? colors.focus : 0x33ffffff,
      Label: {
        text: {
          textColor: this._isFocused ? colors.background : colors.text,
        },
      },
    })
  }

  _focus() {
    this._isFocused = true
    this._update()
    this._emitFocus()
  }

  _unfocus() {
    this._isFocused = false
    this._update()
  }

  _emitFocus() {
    probe.focus({ area: 'controls', button: 'cast' })
  }

  _handleDown() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$focusTimeline')
    return true
  }

  _handleUp() {
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleLeft() {
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleRight() {
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleEnter() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$openCastPanel')
    return true
  }
}
