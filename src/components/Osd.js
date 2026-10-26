import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'
import { formatTime, formatRemaining, formatEndTime } from '../lib/playback.js'
import Timeline from './Timeline.js'

export default class Osd extends Lightning.Component {
  static _template() {
    return {
      w: 1920,
      h: 1080,
      alpha: 0,
      BottomGradient: {
        y: 760,
        rect: true,
        w: 1920,
        h: 320,
        colorTop: 0x00000000,
        colorBottom: 0xee000000,
      },
      ProgressBar: {
        type: Timeline,
        x: 80,
        y: 880,
        w: 1760,
        h: 8,
      },
      TimeElapsed: {
        x: 80,
        y: 900,
        text: { text: '00:00', fontFace: font, fontSize: 24, textColor: colors.text },
      },
      EndTime: {
        x: 960,
        y: 900,
        mountX: 0.5,
        text: { text: '', fontFace: font, fontSize: 24, textColor: colors.textDim },
      },
      TimeRemaining: {
        x: 1840,
        y: 900,
        mountX: 1,
        text: { text: '', fontFace: font, fontSize: 24, textColor: colors.text },
      },
    }
  }

  show() {
    this.setSmooth('alpha', 1, { duration: 0.2 })
  }

  hide() {
    this.setSmooth('alpha', 0, { duration: 0.2 })
  }

  update({ currentTime, duration } = {}) {
    const cur = typeof currentTime === 'number' ? currentTime : 0
    const dur = typeof duration === 'number' && isFinite(duration) && duration > 0 ? duration : 0

    this.tag('ProgressBar').setProgress(cur, dur)

    this.tag('TimeElapsed').text.text = formatTime(cur)
    this.tag('TimeRemaining').text.text = formatRemaining(cur, dur)
    this.tag('EndTime').text.text = formatEndTime(cur, dur)
  }

  setBottomOffset(offset) {
    const y = typeof offset === 'number' ? -offset : 0
    this.tag('ProgressBar').setSmooth('y', 880 + y, { duration: 0.2 })
    this.tag('TimeElapsed').setSmooth('y', 900 + y, { duration: 0.2 })
    this.tag('EndTime').setSmooth('y', 900 + y, { duration: 0.2 })
    this.tag('TimeRemaining').setSmooth('y', 900 + y, { duration: 0.2 })
    if (y !== 0) {
      this.tag('BottomGradient').patch({ y: 460, h: 620 })
    } else {
      this.tag('BottomGradient').patch({ y: 760, h: 320 })
    }
  }
}

