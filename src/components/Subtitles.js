import { Lightning } from '@lightningjs/sdk'
import { font } from '../theme.js'

export default class Subtitles extends Lightning.Component {
  static _template() {
    return {
      x: 960,
      y: 980,
      w: 1600,
      mountX: 0.5,
      mountY: 1,
      visible: false,
      alpha: 0.001,
      Text: {
        w: 1600,
        text: {
          text: '',
          fontFace: font,
          fontSize: 38,
          lineHeight: 48,
          textColor: 0xffffffff,
          textAlign: 'center',
          wordWrapWidth: 1600,
          maxLines: 2,
          shadow: true,
          shadowColor: 0xff000000,
          shadowBlur: 8,
          shadowOffsetX: 0,
          shadowOffsetY: 3,
        },
      },
    }
  }

  setOsdVisible(visible) {
    this.patch({ y: visible ? 860 : 980 })
  }

  showCue(cue) {
    if (!cue || !cue.text) {
      this.clear()
      return
    }
    const label = this.tag('Text')
    label.text.fontStyle = cue.italic ? 'italic' : 'normal'
    label.text.text = cue.text
    this.patch({ visible: true, alpha: 1 })
  }

  clear() {
    this.tag('Text').text.text = ''
    this.patch({ visible: false, alpha: 0.001 })
  }
}
