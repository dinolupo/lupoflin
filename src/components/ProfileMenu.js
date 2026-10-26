import { Lightning } from '@lightningjs/sdk'
import { probe } from '../lib/probe.js'
import { colors, font } from '../theme.js'

const BUTTONS = ['Cambia profilo', 'Cambia icona', 'Disconnetti', 'Annulla']
const BUTTON = { w: 360, h: 64 }

// Profile options menu over a dimmed screen. Up/Down choose, Enter confirms, Back cancels.
// Calls on the ancestors: $switchProfile(), $openAvatarPicker(), $disconnect(), $closeProfileMenu().
export default class ProfileMenu extends Lightning.Component {
  static _template() {
    return {
      zIndex: 10,
      Dim: { rect: true, w: 1920, h: 1080, color: colors.background },
      Box: {
        x: 960,
        y: 540,
        mount: 0.5,
        w: 480,
        h: 460,
        rect: true,
        color: colors.tile,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 12 },
        Title: {
          x: 240,
          y: 45,
          mountX: 0.5,
          text: { text: 'Profilo', fontFace: font, fontSize: 36, textColor: colors.text },
        },
        Buttons: { x: 240, y: 110, mountX: 0.5, w: BUTTON.w },
      },
    }
  }

  _init() {
    this._index = 0
    if (this.userName) {
      this.tag('Box.Title').text.text = this.userName
    }
    this._buttons = this.hasAvatarPicker === false
      ? ['Cambia profilo', 'Disconnetti', 'Annulla']
      : ['Cambia profilo', 'Cambia icona', 'Disconnetti', 'Annulla']
    if (this.hasAvatarPicker === false) {
      this.tag('Box').patch({ h: 380 })
    }
    this.tag('Buttons').children = this._buttons.map((label, i) => ({
      y: i * (BUTTON.h + 16),
      w: BUTTON.w,
      h: BUTTON.h,
      rect: true,
      shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
      Label: {
        x: BUTTON.w / 2,
        y: BUTTON.h / 2 + 2,
        mount: 0.5,
        text: { text: label, fontFace: font, fontSize: 28 },
      },
    }))
    this._paint()
  }

  get button() {
    return (this._buttons || BUTTONS)[this._index]
  }

  _paint() {
    this.tag('Buttons').children.forEach((button, i) => {
      const focused = i === this._index
      button.color = focused ? colors.focus : 0xff444444
      button.tag('Label').text.textColor = focused ? colors.background : colors.textDim
    })
    probe.focus({ dialog: 'profile', label: this.button })
  }

  _handleUp() {
    if (this._index > 0) {
      this._index--
      this._paint()
    }
    return true
  }

  _handleDown() {
    const list = this._buttons || BUTTONS
    if (this._index < list.length - 1) {
      this._index++
      this._paint()
    }
    return true
  }

  _handleLeft() {
    return true
  }

  _handleRight() {
    return true
  }

  _handleEnter() {
    const action = this.button
    if (action === 'Cambia profilo') {
      this.fireAncestors('$switchProfile')
    } else if (action === 'Cambia icona') {
      this.fireAncestors('$openAvatarPicker')
    } else if (action === 'Disconnetti') {
      this.fireAncestors('$disconnect')
    } else {
      this.fireAncestors('$closeProfileMenu')
    }
    return true
  }

  _handleBack() {
    this.fireAncestors('$closeProfileMenu')
    return true
  }
}
