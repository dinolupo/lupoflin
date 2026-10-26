import { Lightning } from '@lightningjs/sdk'
import { colors } from '../theme.js'
import { probe } from '../lib/probe.js'

export default class Timeline extends Lightning.Component {
  static _template() {
    return {
      w: 1760,
      h: 8,
      rect: true,
      color: colors.progressTrack,
      Fill: {
        w: 0,
        h: 8,
        rect: true,
        color: colors.brand,
      },
      Knob: {
        y: 4,
        mount: 0.5,
        w: 20,
        h: 20,
        rect: true,
        color: colors.focus,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 10 },
        visible: false,
        alpha: 0.001,
      },
    }
  }

  _init() {
    this._isFocused = false
    this._fillWidth = 0
  }

  setProgress(currentTime, duration) {
    const cur = typeof currentTime === 'number' ? currentTime : 0
    const dur = typeof duration === 'number' && isFinite(duration) && duration > 0 ? duration : 0
    const progress = dur > 0 ? Math.min(1, Math.max(0, cur / dur)) : 0
    this._fillWidth = Math.round(1760 * progress)
    this.tag('Fill').w = this._fillWidth
    this.tag('Knob').x = this._fillWidth
  }

  _updateVisuals() {
    this.patch({
      color: this._isFocused ? colors.progressTrackBright : colors.progressTrack,
      Fill: {
        color: this._isFocused ? colors.brandBright : colors.brand,
      },
      Knob: {
        x: this._fillWidth,
        visible: this._isFocused,
        alpha: this._isFocused ? 1 : 0.001,
      },
    })
  }

  _focus() {
    this._isFocused = true
    this._updateVisuals()
    probe.focus({ area: 'timeline' })
  }

  _unfocus() {
    this._isFocused = false
    this._updateVisuals()
  }

  _handleLeft() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$timelineSeek', -10)
    return true
  }

  _handleRight() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$timelineSeek', 10)
    return true
  }

  _handleRewind() {
    return this._handleLeft()
  }

  _handleFastForward() {
    return this._handleRight()
  }

  _handleEnter() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$timelinePlayPause')
    return true
  }

  _handleUp() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$timelineUp')
    return true
  }

  _handleDown() {
    this.fireAncestors('$resetLayerTimer')
    this.fireAncestors('$timelineDown')
    return true
  }
}
