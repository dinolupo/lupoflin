import { Img, Lightning } from '@lightningjs/sdk'
import { probe } from '../lib/probe.js'
import { colors, font } from '../theme.js'

// One focusable card: image (or placeholder with the name) and an optional label below.
// Props: w, h, label, imageUrl, showLabel, round (profile avatars), progress (0-1: watched bar, optional).
export default class Tile extends Lightning.Component {
  static _template() {
    return {
      Border: { rect: true, color: colors.focus, alpha: 0 },
      Card: {
        rect: true,
        color: colors.tile,
        clipping: true,
        Initial: { mount: 0.5, text: { text: '', fontFace: font, fontSize: 40, textColor: colors.textDim } },
        // Not 0: Lightning does not load textures of invisible elements, so txLoaded would never fire.
        Image: { alpha: 0.001 },
      },
      Label: {
        alpha: 0,
        text: { text: '', fontFace: font, fontSize: 26, textColor: colors.textDim, maxLines: 1, textOverflow: 'ellipsis' },
      },
    }
  }

  _init() {
    probe.count('tiles', 1)
    const { w, h } = this
    const radius = typeof this.radius === 'number' ? this.radius : (this.round ? w / 2 : 6)
    const isCentered = this.round || this.centerLabel
    this.patch({
      Border: { x: -5, y: -5, w: w + 10, h: h + 10, shader: { type: Lightning.shaders.RoundedRectangle, radius: radius + 5 } },
      Card: {
        w,
        h,
        shader: { type: Lightning.shaders.RoundedRectangle, radius },
        Initial: { x: w / 2, y: h / 2, text: { text: this.label ? this.label.slice(0, 1).toUpperCase() : '' } },
      },
      // Profile names are centered under the avatar, titles are left aligned like Netflix.
      Label: {
        x: isCentered ? w / 2 : 0,
        mountX: isCentered ? 0.5 : 0,
        y: h + 12,
        alpha: this.showLabel ? 1 : 0,
        text: { text: this.label || '', wordWrapWidth: w },
      },
    })
    const image = this.tag('Image')
    image.on('txLoaded', () => {
      probe.count('images', 1)
      image.setSmooth('alpha', 1, { duration: 0.2 })
    })
    if (this.imageUrl) {
      this._currentUrl = this.imageUrl
      const tex = Img(this.imageUrl).cover(w, h)
      image.patch({ w, h, texture: (this.hasAlpha || this.round) ? { ...tex, hasAlpha: true } : tex })
    }
    if (typeof this.progress === 'number' && this.progress >= 0) {
      const fillW = Math.min(w, Math.max(0, w * this.progress))
      this.tag('Card').patch({
        ProgressBar: {
          y: h - 6,
          Track: { rect: true, w, h: 6, color: colors.progressTrack },
          Fill: { rect: true, w: fillW, h: 6, color: colors.brand },
        },
      })
    }
    if (this.played) {
      this.tag('Card').patch({
        WatchedBadge: {
          x: w - 30,
          y: 6,
          w: 24,
          h: 24,
          rect: true,
          color: 0xcc141414,
          shader: { type: Lightning.shaders.RoundedRectangle, radius: 12 },
          Check: {
            x: 12,
            y: 12,
            mount: 0.5,
            text: { text: '✓', fontFace: font, fontSize: 16, textColor: colors.focus },
          },
        },
      })
    }
  }

  _detach() {
    probe.count('tiles', -1)
  }

  updateAvatar(item, x, y) {
    this.item = item
    this.label = item.name
    this.patch({ x, y })
    if (this._currentUrl !== item.url) {
      this._currentUrl = item.url
      this.imageUrl = item.url
      this.tag('Card.Initial').text.text = (item.name || '?').slice(0, 1).toUpperCase()
      const image = this.tag('Image')
      const tex = Img(item.url).cover(this.w, this.h)
      image.patch({ alpha: 0.001, texture: (this.hasAlpha || this.round) ? { ...tex, hasAlpha: true } : tex })
    }
  }

  _focus() {
    this.patch({ zIndex: 2 })
    this.setSmooth('scale', 1.08, { duration: 0.15 })
    this.tag('Border').setSmooth('alpha', 1, { duration: 0.15 })
    this.tag('Label').text.textColor = colors.text
  }

  _unfocus() {
    this.patch({ zIndex: 0 })
    this.setSmooth('scale', 1, { duration: 0.15 })
    this.tag('Border').setSmooth('alpha', 0, { duration: 0.15 })
    this.tag('Label').text.textColor = colors.textDim
  }
}
