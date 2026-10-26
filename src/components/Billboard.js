import { Img, Lightning } from '@lightningjs/sdk'
import Button from './Button.js'
import { probe } from '../lib/probe.js'
import { colors, font, layout } from '../theme.js'

// Netflix-style billboard banner at the top of the home screen.
// Props: client, item ({ id, name, overview, backdrop, logoTag }).
// Calls on ancestors: $playItem(itemId), $openItem(itemId).
export default class Billboard extends Lightning.Component {
  static _template() {
    return {
      w: 1920,
      h: 560,
      Backdrop: {
        w: 1920,
        h: 560,
        alpha: 0.001,
      },
      GradientLeft: {
        rect: true,
        w: 1200,
        h: 560,
        colorLeft: 0xf0141414,
        colorRight: 0x00141414,
      },
      GradientBottom: {
        y: 260,
        rect: true,
        w: 1920,
        h: 300,
        colorTop: 0x00141414,
        colorBottom: 0xff141414,
      },
      Content: {
        x: layout.sideMargin,
        y: 110,
        Logo: {
          w: 500,
          h: 160,
          alpha: 0.001,
        },
        Title: {
          y: 40,
          visible: false,
          text: { text: '', fontFace: font, fontSize: 44, textColor: colors.text, wordWrapWidth: 800, maxLines: 2, textOverflow: 'ellipsis' },
        },
        Overview: {
          y: 175,
          text: { text: '', fontFace: font, fontSize: 24, lineHeight: 32, textColor: colors.text, wordWrapWidth: 800, maxLines: 2, textOverflow: 'ellipsis' },
        },
        Buttons: {
          y: 260,
          PlayButton: {
            type: Button,
            w: 220,
            h: 56,
            label: 'Riproduci',
          },
          InfoButton: {
            type: Button,
            x: 240,
            w: 220,
            h: 56,
            label: 'Altre info',
          },
        },
      },
    }
  }

  get buttonIndex() {
    return this._buttonIndex || 0
  }

  set buttonIndex(idx) {
    this._buttonIndex = idx
  }

  _init() {
    this._buttonIndex = 0
    if (this.item) {
      this.populate(this.item)
    }
  }

  populate(item) {
    this.item = item
    if (!item) return
    const { client } = this
    if (item.backdrop && client) {
      const url = client.imageUrl(item.backdrop.itemId, {
        type: 'Backdrop',
        tag: item.backdrop.tag,
        maxWidth: 1920,
      })
      const bd = this.tag('Backdrop')
      bd.on('txLoaded', () => bd.setSmooth('alpha', 1, { duration: 0.3 }))
      bd.patch({ w: 1920, h: 560, texture: Img(url).cover(1920, 560) })
    }

    if (item.logoTag && client) {
      const logoUrl = client.imageUrl(item.id, {
        type: 'Logo',
        tag: item.logoTag,
        maxWidth: 500,
        maxHeight: 160,
      })
      const logo = this.tag('Content.Logo')
      logo.on('txLoaded', () => logo.setSmooth('alpha', 1, { duration: 0.2 }))
      logo.patch({ w: 500, h: 160, texture: { ...Img(logoUrl).contain(500, 160), hasAlpha: true } })
    } else {
      this.tag('Content.Title').patch({
        visible: true,
        text: { text: item.name || '' },
      })
    }

    if (item.overview) {
      this.tag('Content.Overview').text.text = item.overview
    }
  }

  _handleLeft() {
    if (this._buttonIndex > 0) {
      this._buttonIndex--
      this._refocus()
      this.emitFocus()
      return true
    }
    return false
  }

  _handleRight() {
    if (this._buttonIndex < 1) {
      this._buttonIndex++
      this._refocus()
      this.emitFocus()
      return true
    }
    return false
  }

  _handleEnter() {
    if (!this.item) return false
    if (this._buttonIndex === 0) {
      this.fireAncestors('$playItem', this.item.id)
    } else {
      this.fireAncestors('$openItem', this.item.id)
    }
    return true
  }

  _focus() {
    this.emitFocus()
  }

  emitFocus() {
    const label = this._buttonIndex === 0 ? 'Riproduci' : 'Altre info'
    probe.focus({ area: 'billboard', label })
  }

  _getFocused() {
    return this._buttonIndex === 0
      ? this.tag('Content.Buttons.PlayButton')
      : this.tag('Content.Buttons.InfoButton')
  }
}
