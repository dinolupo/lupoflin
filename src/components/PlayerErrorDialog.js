import { Lightning } from '@lightningjs/sdk'
import Button from './Button.js'
import { colors, font } from '../theme.js'

export default class PlayerErrorDialog extends Lightning.Component {
  static _template() {
    return {
      Dim: { rect: true, w: 1920, h: 1080, color: 0xee141414 },
      Box: {
        x: 960,
        y: 540,
        mount: 0.5,
        w: 640,
        h: 260,
        rect: true,
        color: colors.tile,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 12 },
        Title: {
          x: 320,
          y: 70,
          mount: 0.5,
          text: { text: 'Impossibile riprodurre il titolo', fontFace: font, fontSize: 32, textColor: colors.text },
        },
        Button: {
          type: Button,
          x: 320,
          y: 170,
          mount: 0.5,
          w: 220,
          h: 60,
          label: 'Indietro',
        },
      },
    }
  }

  _getFocused() {
    return this.tag('Box.Button')
  }
}
