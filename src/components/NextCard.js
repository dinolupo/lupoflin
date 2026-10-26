import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'
import { probe } from '../lib/probe.js'

export default class NextCard extends Lightning.Component {
  static _template() {
    return {
      w: 480,
      h: 160,
      rect: true,
      color: 0xee1f1f1f,
      shader: { type: Lightning.shaders.RoundedRectangle, radius: 10 },
      visible: false,
      alpha: 0.001,
      Thumb: {
        x: 16,
        y: 16,
        w: 180,
        h: 128,
        rect: true,
        color: 0xff333333,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 6 },
      },
      Header: {
        x: 212,
        y: 20,
        text: { text: 'Episodio successivo', fontFace: font, fontSize: 20, textColor: colors.textDim },
      },
      Title: {
        x: 212,
        y: 48,
        w: 250,
        text: { text: '', fontFace: font, fontSize: 24, textColor: colors.text, maxLines: 1, textOverflow: 'ellipsis' },
      },
      Countdown: {
        x: 212,
        y: 86,
        text: { text: '', fontFace: font, fontSize: 20, textColor: colors.focus },
      },
      PlayBtn: {
        x: 212,
        y: 112,
        w: 120,
        h: 34,
        rect: true,
        color: colors.brand,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 4 },
        Label: {
          x: 60,
          y: 17,
          mount: 0.5,
          text: { text: 'Riproduci', fontFace: font, fontSize: 18, textColor: 0xffffffff },
        },
      },
    }
  }

  _init() {
    this._countdown = 10
    this._timer = null
    this._autoPlay = true
    this._episode = null
  }

  _detach() {
    clearInterval(this._timer)
  }

  show(episode, { autoPlay = true, client = null } = {}) {
    this._episode = episode
    this._autoPlay = autoPlay
    this._countdown = 10

    const titleText = episode.name || `Episodio ${episode.episodeNumber || ''}`
    this.tag('Title').text.text = titleText

    if (episode.imageTag && client) {
      const url = client.imageUrl(episode.id, { tag: episode.imageTag, maxWidth: 360, maxHeight: 256 })
      this.tag('Thumb').patch({
        texture: Lightning.StageUtils.isWebGl ? { type: Lightning.textures.ImageTexture, src: url } : undefined,
      })
    }

    this._updateCountdownText()
    this.patch({ visible: true, alpha: 1 })
    probe.data('nextCard', true)

    clearInterval(this._timer)
    if (this._autoPlay) {
      this._timer = setInterval(() => {
        this._countdown--
        this._updateCountdownText()
        if (this._countdown <= 0) {
          clearInterval(this._timer)
          this._triggerPlay()
        }
      }, 1000)
    }
  }

  _updateCountdownText() {
    if (this._autoPlay && this._countdown > 0) {
      this.tag('Countdown').text.text = `Inizio tra ${this._countdown}s`
    } else {
      this.tag('Countdown').text.text = ''
    }
  }

  hide() {
    clearInterval(this._timer)
    this.patch({ visible: false, alpha: 0.001 })
    probe.data('nextCard', false)
  }

  _triggerPlay() {
    this.hide()
    this.fireAncestors('$playNextEpisode', this._episode)
  }

  _handleEnter() {
    this._triggerPlay()
    return true
  }

  _handleBack() {
    this.hide()
    return true
  }
}
