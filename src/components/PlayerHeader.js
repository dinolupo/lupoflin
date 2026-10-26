import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'

export default class PlayerHeader extends Lightning.Component {
  static _template() {
    return {
      w: 1920,
      h: 240,
      alpha: 0,
      TopGradient: {
        rect: true,
        w: 1920,
        h: 260,
        colorTop: 0xee000000,
        colorBottom: 0x00000000,
      },
      Title: {
        x: 80,
        y: 60,
        text: {
          text: '',
          fontFace: font,
          fontSize: 44,
          textColor: colors.text,
          wordWrapWidth: 1760,
          maxLines: 1,
          textOverflow: 'ellipsis',
        },
      },
      Subtitle: {
        x: 80,
        y: 116,
        visible: false,
        text: {
          text: '',
          fontFace: font,
          fontSize: 26,
          textColor: 0xddffffff,
          wordWrapWidth: 1760,
          maxLines: 1,
          textOverflow: 'ellipsis',
        },
      },
    }
  }

  show() {
    this.setSmooth('alpha', 1, { duration: 0.2 })
  }

  hide() {
    this.setSmooth('alpha', 0, { duration: 0.2 })
  }

  update({ title, subtitle } = {}) {
    this.tag('Title').text.text = title || ''
    if (subtitle) {
      this.tag('Subtitle').text.text = subtitle
      this.tag('Subtitle').visible = true
    } else {
      this.tag('Subtitle').text.text = ''
      this.tag('Subtitle').visible = false
    }
  }
}
