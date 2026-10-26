import { Lightning, Img } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'
import { probe } from '../lib/probe.js'
import { castCard, formatBirthDate } from '../lib/playerLayout.js'

export default class CastPanel extends Lightning.Component {
  static _template() {
    return {
      w: 580,
      h: 1080,
      rect: true,
      color: 0xff141414,
      Header: {
        x: 40,
        y: 40,
        Title: {
          text: { text: 'Cast', fontFace: font, fontSize: 34, textColor: colors.text },
        },
      },
      List: {
        x: 40,
        y: 100,
        w: 500,
        h: 940,
        clipping: true,
        Content: {
          y: 0,
        },
      },
    }
  }

  _init() {
    this._actors = []
    this._index = 0
    this._cache = new Map()
    this._client = null
    this._userId = null
    this._currentItemId = null
    this._isOpen = false
  }

  open({ actors = [], client, userId, currentItemId }) {
    this._isOpen = true
    this._actors = actors
    this._client = client
    this._userId = userId
    this._currentItemId = currentItemId
    this._index = 0
    this.tag('Content').y = 0
    this.patch({ visible: true })
    this.setSmooth('alpha', 1, { duration: 0.2 })
    this._renderItems()
    this._loadDetails(0)
    this._emitFocus()
  }

  close() {
    this._isOpen = false
    this.setSmooth('alpha', 0, { duration: 0.2 })
    setTimeout(() => {
      if (!this._isOpen && this.attached) {
        this.patch({ visible: false })
      }
    }, 200)
  }

  _emitFocus() {
    const actor = this._actors[this._index]
    if (actor) {
      probe.focus({ area: 'cast', index: this._index, name: actor.name })
    }
  }

  async _loadDetails(index) {
    const actor = this._actors[index]
    if (!actor || !this._client || this._cache.has(actor.id)) return

    try {
      const [personData, itemsData] = await Promise.all([
        this._client.person(this._userId, actor.name).catch(() => null),
        this._client.itemsOfPerson(this._userId, actor.id, { exclude: this._currentItemId }).catch(() => []),
      ])
      const details = {
        birthDate: personData ? personData.birthDate : null,
        birthPlace: personData ? personData.birthPlace : null,
        biography: personData ? personData.biography : null,
        titles: (itemsData || []).map(i => i.name || i.title || '').filter(Boolean).slice(0, 4),
      }
      this._cache.set(actor.id, details)
      if (this.attached && this._index === index) {
        this._renderItems()
      }
    } catch (e) {}
  }

  _renderItems() {
    const container = this.tag('Content')
    const children = []
    let currentY = 0

    for (let i = 0; i < this._actors.length; i++) {
      const actor = this._actors[i]
      const isFocused = (i === this._index)
      const cached = this._cache.get(actor.id) || null
      const card = castCard(actor, cached)

      const photoUrl = actor.imageTag && this._client
        ? this._client.imageUrl(actor.id, { tag: actor.imageTag, maxWidth: 128, maxHeight: 128 })
        : null

      if (isFocused) {
        const cardChildren = {
          Bg: {
            w: 500,
            rect: true,
            color: 0x2bffffff,
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 12 },
          },
          Photo: {
            x: 16,
            y: 16,
            w: 64,
            h: 64,
            ...(photoUrl ? { color: 0xffffffff } : { rect: true, color: 0x33ffffff }),
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 32 },
            ...(photoUrl
              ? { texture: { ...Img(photoUrl).cover(64, 64), hasAlpha: true } }
              : {
                  Initial: {
                    x: 32,
                    y: 32,
                    mount: 0.5,
                    text: { text: (actor.name || '?')[0], fontFace: font, fontSize: 28, textColor: colors.text },
                  },
                }),
          },
          Name: {
            x: 96,
            y: 16,
            text: { text: card.name, fontFace: font, fontSize: 24, textColor: colors.focus },
          },
        }

        let contentY = 48
        if (card.role) {
          cardChildren.Role = {
            x: 96,
            y: contentY,
            text: { text: `Interpreta: ${card.role}`, fontFace: font, fontSize: 20, textColor: colors.text, wordWrapWidth: 388 },
          }
          contentY += 36
        }

        if (card.hasDetails) {
          contentY = Math.max(contentY, 96)
          if (card.birthDate || card.birthPlace) {
            const birth = [formatBirthDate(card.birthDate), card.birthPlace].filter(Boolean).join(' · ')
            cardChildren.Birth = {
              x: 16,
              y: contentY,
              text: { text: birth, fontFace: font, fontSize: 18, textColor: colors.textDim, wordWrapWidth: 468 },
            }
            contentY += 28
          }

          if (card.biography) {
            cardChildren.Bio = {
              x: 16,
              y: contentY,
              text: { text: card.biography, fontFace: font, fontSize: 18, textColor: colors.textDim, wordWrapWidth: 468, maxLines: 4, textOverflow: 'ellipsis' },
            }
            contentY += 80
          }

          if (card.titles && card.titles.length > 0) {
            cardChildren.VistoInLabel = {
              x: 16,
              y: contentY,
              text: { text: 'Visto in', fontFace: font, fontSize: 18, textColor: colors.textDim },
            }
            contentY += 24
            cardChildren.VistoIn = {
              x: 16,
              y: contentY,
              text: { text: card.titles.join(', '), fontFace: font, fontSize: 18, textColor: colors.text, wordWrapWidth: 468, maxLines: 2 },
            }
            contentY += 40
          }
        } else {
          contentY = Math.max(contentY + 16, 96)
        }

        const cardH = contentY + 12
        cardChildren.Bg.h = cardH

        children.push({
          ref: `Card_${actor.id}`,
          y: currentY,
          w: 500,
          h: cardH,
          ...cardChildren,
        })
        currentY += cardH + 12
      } else {
        const rowChildren = {
          Photo: {
            x: 8,
            y: 6,
            w: 64,
            h: 64,
            ...(photoUrl ? { color: 0xffffffff } : { rect: true, color: 0x22ffffff }),
            shader: { type: Lightning.shaders.RoundedRectangle, radius: 32 },
            ...(photoUrl
              ? { texture: { ...Img(photoUrl).cover(64, 64), hasAlpha: true } }
              : {
                  Initial: {
                    x: 32,
                    y: 32,
                    mount: 0.5,
                    text: { text: (actor.name || '?')[0], fontFace: font, fontSize: 26, textColor: colors.textDim },
                  },
                }),
          },
          Name: {
            x: 88,
            y: actor.roleLine ? 14 : 24,
            text: { text: actor.name, fontFace: font, fontSize: 22, textColor: colors.text },
          },
        }

        if (actor.roleLine) {
          rowChildren.RoleLine = {
            x: 88,
            y: 42,
            text: { text: actor.roleLine, fontFace: font, fontSize: 18, textColor: colors.textDim, wordWrapWidth: 396, maxLines: 1 },
          }
        }

        children.push({
          ref: `Row_${actor.id}`,
          y: currentY,
          w: 500,
          h: 76,
          ...rowChildren,
        })
        currentY += 76 + 8
      }
    }

    container.children = children

    if (this._actors.length > 0 && container.children[this._index]) {
      const focusedChild = container.children[this._index]
      const focusedY = focusedChild.y || 0
      const listH = 940
      const maxScroll = Math.max(0, currentY - listH)
      const targetY = Math.min(0, Math.max(-maxScroll, 200 - focusedY))
      container.setSmooth('y', targetY, { duration: 0.2 })
    }
  }

  _handleUp() {
    if (this._index > 0) {
      this._index--
      this._renderItems()
      this._loadDetails(this._index)
      this._emitFocus()
    }
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleDown() {
    if (this._index < this._actors.length - 1) {
      this._index++
      this._renderItems()
      this._loadDetails(this._index)
      this._emitFocus()
    }
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleLeft() {
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleRight() {
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleEnter() {
    this.fireAncestors('$resetLayerTimer')
    return true
  }

  _handleBack() {
    this.fireAncestors('$closeCastPanel')
    return true
  }
}
