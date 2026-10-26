import { Lightning } from '@lightningjs/sdk'
import { brand, colors, font } from '../theme.js'

const BUTTONS = ['Esci', 'Annulla']
const BUTTON = { w: 260, h: 72 }

// "Vuoi uscire da LupoFlin?" over a dimmed screen. Left/Right choose, Enter confirms, Back cancels.
// Calls on the ancestors: $exitConfirmed(), $exitCancelled().
export default class ExitDialog extends Lightning.Component {
  static _template() {
    return {
      zIndex: 10,
      Dim: { rect: true, w: 1920, h: 1080, color: 0xcc000000 },
      Box: {
        x: 960,
        y: 540,
        mount: 0.5,
        w: 760,
        h: 300,
        rect: true,
        color: colors.tile,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 12 },
        Title: { x: 380, y: 60, mountX: 0.5, text: { text: `Vuoi uscire da ${brand.name}?`, fontFace: font, fontSize: 40, textColor: colors.text } },
        Buttons: { x: 380, y: 170, mountX: 0.5, w: BUTTON.w * 2 + 40 },
      },
    }
  }

  _init() {
    this._index = 0
    this.tag('Buttons').children = BUTTONS.map((label, i) => ({
      x: i * (BUTTON.w + 40),
      w: BUTTON.w,
      h: BUTTON.h,
      rect: true,
      shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
      Label: { x: BUTTON.w / 2, y: BUTTON.h / 2 + 2, mount: 0.5, text: { text: label, fontFace: font, fontSize: 32 } },
    }))
    this._paint()
  }

  get button() {
    return BUTTONS[this._index]
  }

  // Focused button: white with dark text (Netflix style); the other one: dark with grey text.
  _paint() {
    this.tag('Buttons').children.forEach((button, i) => {
      const focused = i === this._index
      button.color = focused ? colors.focus : 0xff444444
      button.tag('Label').text.textColor = focused ? colors.background : colors.textDim
    })
    this.fireAncestors('$exitFocus', this.button)
  }

  _handleLeft() {
    this._index = 0
    this._paint()
  }

  _handleRight() {
    this._index = 1
    this._paint()
  }

  _handleEnter() {
    if (this._index === 0) this.fireAncestors('$exitConfirmed')
    else this.fireAncestors('$exitCancelled')
  }

  _handleBack() {
    this.fireAncestors('$exitCancelled')
  }
}
