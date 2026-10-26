import { Img, Lightning } from '@lightningjs/sdk'
import { probe } from '../lib/probe.js'
import { colors, font } from '../theme.js'

export default class ConfirmDialog extends Lightning.Component {
  static _template() {
    return {
      Dim: { rect: true, w: 1920, h: 1080, color: 0xcc000000 },
      Box: {
        x: 960,
        y: 540,
        mount: 0.5,
        w: 640,
        h: 460,
        rect: true,
        color: colors.tile,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 16 },
        Title: {
          x: 320,
          y: 40,
          mountX: 0.5,
          text: { text: 'Usare questa icona?', fontFace: font, fontSize: 36, textColor: colors.text },
        },
        Comparison: {
          x: 320,
          y: 120,
          mountX: 0.5,
          Old: {
            x: -90,
            y: 0,
            mountX: 0.5,
            w: 120,
            h: 120,
            rect: true,
            color: 0xff333333,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 60 },
            clipping: true,
            Initial: {
              x: 60,
              y: 60,
              mount: 0.5,
              text: { text: '', fontFace: font, fontSize: 44, textColor: colors.textDim },
            },
            Image: { alpha: 0.001 },
          },
          Arrow: {
            x: 0,
            y: 60,
            mount: 0.5,
            text: { text: '→', fontFace: font, fontSize: 36, textColor: colors.textDim },
          },
          New: {
            x: 90,
            y: 0,
            mountX: 0.5,
            w: 120,
            h: 120,
            rect: true,
            color: 0xff333333,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 60 },
            clipping: true,
            Image: { alpha: 0.001 },
          },
        },
        Error: {
          x: 320,
          y: 280,
          mountX: 0.5,
          text: { text: '', fontFace: font, fontSize: 24, textColor: 0xffff4444 },
        },
        Buttons: {
          x: 320,
          y: 330,
          mountX: 0.5,
          Si: {
            x: -80,
            y: 0,
            mountX: 0.5,
            w: 140,
            h: 56,
            rect: true,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
            Label: {
              x: 70,
              y: 28,
              mount: 0.5,
              text: { text: 'Sì', fontFace: font, fontSize: 26 },
            },
          },
          No: {
            x: 80,
            y: 0,
            mountX: 0.5,
            w: 140,
            h: 56,
            rect: true,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
            Label: {
              x: 70,
              y: 28,
              mount: 0.5,
              text: { text: 'No', fontFace: font, fontSize: 26 },
            },
          },
        },
      },
    }
  }

  _init() {
    this._buttonIndex = 1
    const oldAvatar = this.tag('Comparison.Old')
    if (this.oldImageUrl) {
      const img = oldAvatar.tag('Image')
      img.on('txLoaded', () => img.setSmooth('alpha', 1, { duration: 0.2 }))
      img.patch({ w: 120, h: 120, texture: { ...Img(this.oldImageUrl).cover(120, 120), hasAlpha: true } })
    } else {
      oldAvatar.tag('Initial').text.text = (this.userName || '?').slice(0, 1).toUpperCase()
    }

    if (this.newImageUrl) {
      const img = this.tag('Comparison.New.Image')
      img.on('txLoaded', () => img.setSmooth('alpha', 1, { duration: 0.2 }))
      img.patch({ w: 120, h: 120, texture: { ...Img(this.newImageUrl).cover(120, 120), hasAlpha: true } })
    }

    this._paint()
  }

  get buttonLabel() {
    return this._buttonIndex === 0 ? 'Sì' : 'No'
  }

  setError(msg) {
    this.tag('Error').text.text = msg || ''
  }

  _paint() {
    const isSi = this._buttonIndex === 0
    const si = this.tag('Buttons.Si')
    const no = this.tag('Buttons.No')

    si.color = isSi ? colors.focus : 0xff444444
    si.tag('Label').text.textColor = isSi ? colors.background : colors.textDim

    no.color = !isSi ? colors.focus : 0xff444444
    no.tag('Label').text.textColor = !isSi ? colors.background : colors.textDim

    probe.data('dialog', 'avatar-confirm')
    probe.focus({ dialog: 'avatar-confirm', label: this.buttonLabel })
  }

  _handleLeft() {
    if (this._buttonIndex > 0) {
      this._buttonIndex = 0
      this._paint()
    }
    return true
  }

  _handleRight() {
    if (this._buttonIndex < 1) {
      this._buttonIndex = 1
      this._paint()
    }
    return true
  }

  _handleEnter() {
    if (this._buttonIndex === 0) {
      this.fireAncestors('$avatarConfirmed')
    } else {
      this.fireAncestors('$closeAvatarConfirm')
    }
    return true
  }

  _handleBack() {
    this.fireAncestors('$closeAvatarConfirm')
    return true
  }
}
