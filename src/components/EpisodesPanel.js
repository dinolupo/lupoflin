import { Lightning, Img } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'
import { probe } from '../lib/probe.js'

const CARD_W = 280
const CARD_H = 158
const CARD_GAP = 24
const SLOT_W = CARD_W + CARD_GAP

export default class EpisodesPanel extends Lightning.Component {
  static _template() {
    return {
      w: 1760,
      h: 250,
      clipping: true,
      Cards: {
        x: 6,
        y: 4,
      },
    }
  }

  _init() {
    this._cards = []
    this._client = null
    this._index = 0
  }

  setEpisodes(cards, client) {
    this._cards = Array.isArray(cards) ? cards : []
    this._client = client
    const curIdx = this._cards.findIndex(c => c.current)
    this._index = curIdx >= 0 ? curIdx : 0
    this._renderCards()
    this._updateScroll()
  }

  focusCurrent() {
    const curIdx = this._cards.findIndex(c => c.current)
    if (curIdx >= 0) {
      this._index = curIdx
    }
    this._updateFocus()
    this._updateScroll()
    this._emitFocus()
  }

  show() {
    this.patch({ visible: true })
    this.setSmooth('alpha', 1, { duration: 0.2 })
  }

  hide() {
    this.setSmooth('alpha', 0, { duration: 0.2 })
    setTimeout(() => {
      if (!this.hasFocus() && this.attached) {
        this.patch({ visible: false })
      }
    }, 200)
  }

  _updateFocus() {
    const container = this.tag('Cards')
    if (!container || !container.children) return
    const isPanelFocused = this.hasFocus()
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i]
      const isFocused = isPanelFocused && (i === this._index)
      if (child.tag('Border')) {
        child.tag('Border').setSmooth('alpha', isFocused ? 1 : 0, { duration: 0.15 })
      }
      if (child.tag('Title')) {
        child.tag('Title').text.textColor = isFocused ? colors.text : colors.textDim
      }
    }
  }

  _updateScroll() {
    const container = this.tag('Cards')
    if (!container || this._cards.length === 0) return
    const totalW = this._cards.length * SLOT_W
    const visibleW = 1748
    if (totalW <= visibleW) {
      container.setSmooth('x', 6, { duration: 0.2 })
      return
    }
    const maxScroll = totalW - visibleW
    const desired = this._index * SLOT_W - 304
    const scroll = Math.min(maxScroll, Math.max(0, desired))
    container.setSmooth('x', 6 - scroll, { duration: 0.2 })
  }

  _emitFocus() {
    const card = this._cards[this._index]
    if (card) {
      probe.focus({ area: 'episodes', index: this._index, id: card.id })
    }
  }

  _focus() {
    this._updateFocus()
    this._updateScroll()
    this._emitFocus()
  }

  _unfocus() {
    this._updateFocus()
  }

  _renderCards() {
    const container = this.tag('Cards')
    const children = []
    const isPanelFocused = this.hasFocus()

    for (let i = 0; i < this._cards.length; i++) {
      const card = this._cards[i]
      const isFocused = isPanelFocused && (i === this._index)
      const x = i * SLOT_W

      const imageUrl = (card.imageTag && this._client)
        ? this._client.imageUrl(card.id, { tag: card.imageTag, maxWidth: 320, maxHeight: 180, type: 'Primary' })
        : null

      const cardChildren = {
        Border: {
          x: -4,
          y: -4,
          w: CARD_W + 8,
          h: CARD_H + 8,
          rect: true,
          color: colors.focus,
          shader: { type: Lightning.shaders.RoundedRectangle, radius: 10 },
          alpha: isFocused ? 1 : 0,
        },
        CardBg: {
          w: CARD_W,
          h: CARD_H,
          rect: true,
          color: colors.tile,
          clipping: true,
          shader: { type: Lightning.shaders.RoundedRectangle, radius: 6 },
          ...(imageUrl
            ? {
                Image: {
                  w: CARD_W,
                  h: CARD_H,
                  alpha: 0.001,
                  texture: Img(imageUrl).cover(CARD_W, CARD_H),
                },
              }
            : {
                Placeholder: {
                  x: CARD_W / 2,
                  y: CARD_H / 2,
                  mount: 0.5,
                  text: { text: card.label || 'EP', fontFace: font, fontSize: 32, textColor: colors.textDim },
                },
              }),
        },
      }

      if (card.current) {
        cardChildren.CardBg.NowPlaying = {
          x: 10,
          y: 10,
          w: 126,
          h: 26,
          rect: true,
          color: 0xcc141414,
          shader: { type: Lightning.shaders.RoundedRectangle, radius: 4 },
          Label: {
            x: 8,
            y: 3,
            text: { text: 'In riproduzione', fontFace: font, fontSize: 16, textColor: colors.focus },
          },
        }
      }

      if (typeof card.progress === 'number' && card.progress > 0) {
        const fillW = Math.min(CARD_W, Math.max(0, Math.round(CARD_W * card.progress)))
        cardChildren.CardBg.ProgressBar = {
          y: CARD_H - 6,
          w: CARD_W,
          h: 6,
          Track: { rect: true, w: CARD_W, h: 6, color: colors.progressTrack },
          Fill: { rect: true, w: fillW, h: 6, color: colors.brand },
        }
      }

      const titleText = card.label ? `${card.label} · ${card.title}` : card.title
      cardChildren.Title = {
        y: CARD_H + 10,
        w: CARD_W,
        text: {
          text: titleText,
          fontFace: font,
          fontSize: 20,
          textColor: isFocused ? colors.text : colors.textDim,
          wordWrapWidth: CARD_W,
          maxLines: 2,
          textOverflow: 'ellipsis',
        },
      }

      children.push({
        ref: `Episode_${card.id}`,
        x,
        y: 0,
        w: CARD_W,
        h: CARD_H + 60,
        ...cardChildren,
      })
    }

    container.children = children

    for (const child of container.children) {
      const img = child.tag('CardBg.Image')
      if (img) {
        img.on('txLoaded', () => {
          img.setSmooth('alpha', 1, { duration: 0.2 })
        })
      }
    }
  }

  _handleLeft() {
    if (this._index > 0) {
      this._index--
      this._updateFocus()
      this._updateScroll()
      this._emitFocus()
    }
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleRight() {
    if (this._index < this._cards.length - 1) {
      this._index++
      this._updateFocus()
      this._updateScroll()
      this._emitFocus()
    }
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleUp() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$focusControls')
    return true
  }

  _handleDown() {
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleEnter() {
    this.fireAncestors('$resetLayerTimer')
    const card = this._cards[this._index]
    if (card && !card.current) {
      this.fireAncestors('$playEpisode', card)
    }
    return true
  }

  _handleBack() {
    this.fireAncestors('$closeLayer')
    return true
  }
}
