import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'

// Focusable button with label. Props: label, w, h
export default class Button extends Lightning.Component {
  static _template() {
    return {
      rect: true,
      w: 240,
      h: 64,
      color: 0xff444444,
      shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
      Label: {
        x: 120,
        y: 34,
        mount: 0.5,
        text: { text: '', fontFace: font, fontSize: 32, textColor: colors.textDim },
      },
    }
  }

  _init() {
    const w = this.w || 240
    const h = this.h || 64
    this.patch({
      w,
      h,
      Label: {
        x: w / 2,
        y: h / 2 + 2,
        mount: 0.5,
        text: { text: this.label || '' },
      },
    })
  }

  _focus() {
    this.patch({ color: colors.focus })
    this.tag('Label').text.textColor = colors.background
  }

  setLabel(text) {
    this.label = text
    if (this.tag('Label')) {
      this.tag('Label').text.text = text
    }
  }

  _unfocus() {
    this.patch({ color: 0xff444444 })
    this.tag('Label').text.textColor = colors.textDim
  }
}
