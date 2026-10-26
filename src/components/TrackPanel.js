import { Lightning } from '@lightningjs/sdk'
import { colors, font } from '../theme.js'
import { probe } from '../lib/probe.js'
import { trackLabels } from '../lib/trackLabels.js'

// Prime-like audio / subtitle options: a panel at the bottom of the video with fields shown as pills.
// OK on a language pill opens the list above it; OK on an entry applies it at once and closes the list.
// Back closes the list, then the panel.

const FIELD_Y = 860
const PILL_H = 76
const ITEM_H = 72
const LIST_W = 560
const MAX_ROWS = 6
const DARK = 0xff2b2f36
const PILL = 0xff4a4f58

// A small "v" (or "^" when open) drawn with two bars: no glyph needed from the font.
function chevron(x, open, color) {
  const tilt = open ? -1 : 1
  return {
    x,
    y: PILL_H / 2,
    A: { rect: true, w: 16, h: 3, color, x: -6, mount: 0.5, rotation: tilt * Math.PI / 4 },
    B: { rect: true, w: 16, h: 3, color, x: 6, mount: 0.5, rotation: -tilt * Math.PI / 4 },
  }
}

export default class TrackPanel extends Lightning.Component {
  static _template() {
    return {
      w: 1920,
      h: 1080,
      Shade: { y: 420, w: 1920, h: 660, rect: true, colorTop: 0x00000000, colorBottom: 0xf2000000 },
      Title: { x: 120, y: 760, text: { text: '', fontFace: font, fontSize: 44, textColor: colors.text } },
      Fields: {},
      Hint: { y: FIELD_Y + 44 + PILL_H / 2, mountY: 0.5, text: { text: '', fontFace: font, fontSize: 26, textColor: colors.text } },
      List: { visible: false },
    }
  }

  _init() {
    this._mode = 'audio'
    this._field = 0
    this._listOpen = false
    this._row = 0
    this._top = 0
    this._audio = []
    this._subs = []
  }

  // mode: 'audio' | 'subtitles'. Tracks are mapped streams; selected* are Jellyfin stream indexes (subtitle null = off).
  updateTracks({ audioTracks = [], subtitleTracks = [], selectedAudio = null, selectedSubtitle = null, initialCol = 0 }) {
    this._mode = (initialCol === 1 || initialCol === 'subtitles') ? 'subtitles' : 'audio'
    this._audio = trackLabels(audioTracks, 'audio')
    this._subs = trackLabels(subtitleTracks, 'subtitle')
    this._selectedAudio = selectedAudio
    this._selectedSubtitle = selectedSubtitle
    if (selectedSubtitle !== null) this._lastSubtitle = selectedSubtitle
    this._field = 0
    this._listOpen = false
    this._render()
  }

  _fields() {
    if (this._mode === 'audio') {
      const cur = this._audio.find(t => t.index === this._selectedAudio) || this._audio[0]
      return [{ id: 'audio', title: 'Lingue audio', value: cur ? cur.label : 'Nessuna', list: this._audio, w: 460 }]
    }
    const on = this._selectedSubtitle !== null
    const fields = [{ id: 'toggle', title: 'Sottotitoli', value: on ? 'Attivati' : 'Disattivati', check: on, w: 300 }]
    if (on) {
      const cur = this._subs.find(t => t.index === this._selectedSubtitle)
      fields.push({ id: 'subtitles', title: `Lingue (${this._subs.length})`, value: cur ? cur.label : '', list: this._subs, w: 460 })
    }
    return fields
  }

  _render() {
    const fields = this._fields()
    this.tag('Title').text.text = this._mode === 'audio' ? 'Opzioni audio' : 'Sottotitoli'
    let x = 120
    this.tag('Fields').children = fields.map((f, i) => {
      const focused = i === this._field && !this._listOpen
      const open = i === this._field && this._listOpen
      const fg = focused ? colors.background : colors.text
      const el = {
        x,
        y: FIELD_Y,
        Label: { text: { text: f.title, fontFace: font, fontSize: 26, textColor: colors.textDim } },
        Pill: {
          y: 44,
          w: f.w,
          h: PILL_H,
          rect: true,
          color: focused ? colors.focus : PILL,
          shader: { type: Lightning.shaders.RoundedRectangle, radius: 12 },
          Value: {
            x: 32,
            y: PILL_H / 2,
            mountY: 0.5,
            text: { text: f.value, fontFace: font, fontSize: 30, textColor: fg, wordWrapWidth: f.w - 100, maxLines: 1, textOverflow: 'ellipsis' },
          },
          Mark: f.list ? chevron(f.w - 40, open, fg) : {
            x: f.w - 40, y: PILL_H / 2, mount: 0.5,
            text: { text: f.check ? '✓' : '', fontFace: font, fontSize: 32, textColor: fg },
          },
        },
      }
      x += f.w + 40
      return el
    })
    const hint = this.tag('Hint')
    const off = this._mode === 'subtitles' && this._selectedSubtitle === null
    hint.x = x
    hint.text.text = !off ? '' : (this._subs.length ? 'Premi OK sul telecomando per attivarli e scegliere la lingua.' : 'Nessun sottotitolo disponibile.')
    this._renderList(fields)
    this._emitFocus(fields)
  }

  _renderList(fields) {
    const list = this.tag('List')
    const f = fields[this._field]
    if (!this._listOpen || !f || !f.list) {
      list.patch({ visible: false })
      return
    }
    const rows = Math.min(MAX_ROWS, f.list.length)
    if (this._row < this._top) this._top = this._row
    if (this._row >= this._top + rows) this._top = this._row - rows + 1
    const h = 90 + rows * ITEM_H + 16
    const selected = this._mode === 'audio' ? this._selectedAudio : this._selectedSubtitle
    let fx = 120
    for (let i = 0; i < this._field; i++) fx += fields[i].w + 40
    list.patch({ visible: true, x: fx - 24, y: FIELD_Y - 16 - h })
    list.children = [
      { w: LIST_W, h, rect: true, color: DARK, shader: { type: Lightning.shaders.RoundedRectangle, radius: 16 } },
      { x: 40, y: 28, text: { text: f.title.replace(/ \(\d+\)$/, ''), fontFace: font, fontSize: 30, textColor: colors.text } },
      ...f.list.slice(this._top, this._top + rows).map((t, k) => {
        const i = this._top + k
        const focused = i === this._row
        const fg = focused ? colors.background : colors.text
        return {
          x: 16,
          y: 90 + k * ITEM_H,
          w: LIST_W - 32,
          h: ITEM_H - 8,
          rect: true,
          color: focused ? colors.focus : 0x00000000,
          shader: { type: Lightning.shaders.RoundedRectangle, radius: 10 },
          Name: { x: 24, y: (ITEM_H - 8) / 2, mountY: 0.5, text: { text: t.label, fontFace: font, fontSize: 30, textColor: fg, wordWrapWidth: LIST_W - 130, maxLines: 1, textOverflow: 'ellipsis' } },
          Check: { x: LIST_W - 70, y: (ITEM_H - 8) / 2, mount: 0.5, text: { text: t.index === selected ? '✓' : '', fontFace: font, fontSize: 32, textColor: fg } },
        }
      }),
    ]
  }

  _handleLeft() {
    if (!this._listOpen && this._field > 0) { this._field--; this._render() }
    return true
  }

  _handleRight() {
    if (!this._listOpen && this._field < this._fields().length - 1) { this._field++; this._render() }
    return true
  }

  _handleUp() {
    if (this._listOpen && this._row > 0) { this._row--; this._render() }
    return true
  }

  _handleDown() {
    const f = this._fields()[this._field]
    if (this._listOpen && f && this._row < f.list.length - 1) { this._row++; this._render() }
    return true
  }

  _handleEnter() {
    const f = this._fields()[this._field]
    if (!f) return true
    if (this._listOpen) {
      const t = f.list[this._row]
      this._listOpen = false
      if (t && this._mode === 'audio') {
        this._selectedAudio = t.index
        this.fireAncestors('$selectAudio', t.index)
      } else if (t) {
        this._selectedSubtitle = this._lastSubtitle = t.index
        this.fireAncestors('$selectSubtitle', t.index)
      }
    } else if (f.id === 'toggle') {
      if (this._selectedSubtitle !== null) {
        this._selectedSubtitle = null
      } else if (this._subs.length) {
        const keep = this._subs.find(t => t.index === this._lastSubtitle)
        this._selectedSubtitle = this._lastSubtitle = (keep || this._subs[0]).index
      }
      this.fireAncestors('$selectSubtitle', this._selectedSubtitle)
    } else if (f.list && f.list.length) {
      const sel = f.list.findIndex(t => t.index === (this._mode === 'audio' ? this._selectedAudio : this._selectedSubtitle))
      this._row = Math.max(0, sel)
      this._top = 0
      this._listOpen = true
    }
    this._render()
    return true
  }

  _handleBack() {
    if (this._listOpen) {
      this._listOpen = false
      this._render()
    } else {
      this.fireAncestors('$closeTrackMenu')
    }
    return true
  }

  _emitFocus(fields) {
    const f = fields[this._field]
    if (!f) return
    probe.focus({
      area: 'tracks',
      col: f.id,
      list: this._listOpen,
      index: this._listOpen ? this._row : this._field,
      label: this._listOpen ? f.list[this._row].label : f.value,
    })
  }
}
