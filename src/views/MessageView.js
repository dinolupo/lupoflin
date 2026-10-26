import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'

// Centered message, used for blocking errors. Props: title, message.
export default class MessageView extends Lightning.Component {
  static _template() {
    return {
      Title: { x: 960, y: 440, mountX: 0.5, text: { text: '', fontFace: font, fontSize: 48, textColor: colors.error } },
      Message: {
        x: 960,
        y: 520,
        mountX: 0.5,
        text: { text: '', fontFace: font, fontSize: 30, textColor: colors.textDim, wordWrapWidth: 1400, textAlign: 'center' },
      },
    }
  }

  _init() {
    this.tag('Title').text.text = this.title || ''
    this.tag('Message').text.text = this.message || ''
  }
}
