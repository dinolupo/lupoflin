import { Img, Lightning } from '@lightningjs/sdk'
import Button from '../components/Button.js'
import Row from '../components/Row.js'
import { probe } from '../lib/probe.js'
import { formatTime, layoutButtonPositions, ticksToSeconds } from '../lib/playback.js'
import { colors, font, layout } from '../theme.js'

const BODY_ORIGIN_Y = 240
const TARGET_ROW_TOP = 340
const SEASONS_Y = 260
const EPISODES_Y = 736
const SIMILAR_FILM_Y = 260
const SIMILAR_SERIES_Y = 1140

// Netflix-style details page for titles (films and series).
// Props: client, session, itemId.
// Calls on the ancestors: $back().
export default class DetailsView extends Lightning.Component {
  static _template() {
    return {
      Backdrop: {
        w: 1920,
        h: 1080,
        alpha: 0.001,
      },
      Gradient: {
        rect: true,
        w: 1200,
        h: 1080,
        colorLeft: 0xf0141414,
        colorRight: 0x00141414,
      },
      Title: {
        x: layout.sideMargin,
        y: 80,
        text: { text: '', fontFace: font, fontSize: 64, textColor: colors.text, wordWrapWidth: 1000, maxLines: 2, textOverflow: 'ellipsis' },
      },
      TitleLogo: {
        x: layout.sideMargin,
        y: 40,
        w: 640,
        h: 140,
        alpha: 0.001,
        visible: false,
      },
      Meta: {
        x: layout.sideMargin,
        y: 190,
        text: { text: '', fontFace: font, fontSize: 28, textColor: colors.textDim },
      },
      Body: {
        x: layout.sideMargin,
        y: BODY_ORIGIN_Y,
        Overview: {
          y: 0,
          text: { text: '', fontFace: font, fontSize: 30, textColor: colors.text, wordWrapWidth: 900, maxLines: 4, textOverflow: 'ellipsis' },
        },
        PlayButton: {
          type: Button,
          y: 160,
          label: 'Riproduci',
        },
      },
      Status: { x: 960, y: 540, mountX: 0.5, text: { text: 'Caricamento…', fontFace: font, fontSize: 32, textColor: colors.textDim } },
    }
  }

  set navState(value) {
    this._restoreState = value
  }

  get navState() {
    const seasonsRow = this.tag('Body.Seasons')
    const episodesRow = this.tag('Body.Episodes')
    return {
      section: this._section,
      seasonIndex: seasonsRow ? seasonsRow.index : 0,
      selectedSeasonEntry: this._selectedSeasonEntry,
      episodes: this._episodes,
      episodeIndex: episodesRow ? episodesRow.index : 0,
    }
  }

  _init() {
    this._section = 0
    this._buttonIndex = 0
    this._seasons = []
    this._episodes = []
    this._similar = []
    this._selectedSeasonEntry = null
    this._load()
  }

  async _load() {
    const { client, session, itemId } = this
    try {
      const details = await client.item(session.userId, itemId)
      if (!this.attached) return
      this._details = details
      probe.view('details', { id: details.id, name: details.name, type: details.type })
      this._populate(details)
      this.tag('Status').visible = false
      const btns = this._getButtons()
      const initialBtn = btns[this._buttonIndex] || btns[0]
      probe.focus({ section: 'button', index: this._buttonIndex, label: initialBtn.label })

      if (details.type === 'Series') {
        await this._loadSeasons()
      }

      await this._loadSimilar()

      if (this._restoreState) {
        const restore = this._restoreState
        this._restoreState = null
        if (restore.selectedSeasonEntry) {
          this._selectedSeasonEntry = restore.selectedSeasonEntry
        }
        if (typeof restore.seasonIndex === 'number' && this.tag('Body.Seasons')) {
          this.tag('Body.Seasons')._setIndex(restore.seasonIndex)
        }
        if (restore.episodes && restore.episodes.length) {
          this._episodes = restore.episodes
          this._populateEpisodes(restore.episodes)
          probe.data('episodes', restore.episodes.length)
          if (typeof restore.episodeIndex === 'number' && this.tag('Body.Episodes')) {
            this.tag('Body.Episodes')._setIndex(restore.episodeIndex)
          }
        }
        if (typeof restore.section === 'number') {
          this._setSection(restore.section)
        }
      }

      this._refocus()
      this._focus()
    } catch (e) {
      probe.error('details', e)
      this.fireAncestors('$fatal', 'Impossibile caricare i dettagli', e.message)
    }
  }

  _populate(details) {
    if (details.backdrop) {
      const url = this.client.imageUrl(details.backdrop.itemId, {
        type: 'Backdrop',
        tag: details.backdrop.tag,
        maxWidth: 1920,
      })
      const bd = this.tag('Backdrop')
      bd.on('txLoaded', () => bd.setSmooth('alpha', 1, { duration: 0.3 }))
      bd.patch({ w: 1920, h: 1080, texture: Img(url).cover(1920, 1080) })
    }

    if (details.logo) {
      const logoUrl = this.client.imageUrl(details.logo.itemId, {
        type: 'Logo',
        tag: details.logo.tag,
        maxWidth: 640,
        maxHeight: 200,
      })
      const logoComp = this.tag('TitleLogo')
      logoComp.on('txLoaded', () => logoComp.setSmooth('alpha', 1, { duration: 0.2 }))
      logoComp.patch({ w: 640, h: 140, texture: { ...Img(logoUrl).contain(640, 140), hasAlpha: true }, visible: true })
      this.tag('Title').visible = false
    } else {
      this.tag('TitleLogo').visible = false
      this.tag('Title').text.text = details.name || ''
      this.tag('Title').visible = true
    }

    const metaParts = []
    if (details.year) metaParts.push(String(details.year))
    if (details.minutes) metaParts.push(`${details.minutes} min`)
    if (details.rating) metaParts.push(details.rating)
    this.tag('Meta').text.text = metaParts.join(' · ')

    this.tag('Body.Overview').text.text = details.overview || ''

    const resumeTicks = details.playbackPositionTicks || 0
    this._isFavorite = !!details.isFavorite
    this._isPlayed = !!details.isPlayed
    const favLabel = this._isFavorite ? '✓ Nella mia lista' : '+ La mia lista'
    const playedLabel = this._isPlayed ? 'Visto' : 'Segna come visto'

    if (resumeTicks > 0) {
      this._hasResume = true
      this._resumeTicks = resumeTicks
      this._buttonIndex = 0
      const resumeTimeStr = formatTime(ticksToSeconds(resumeTicks))
      const resumeLabel = `Riprendi da ${resumeTimeStr}`
      this._resumeLabel = resumeLabel
      this.tag('Body.PlayButton').visible = false
      this.tag('Body').patch({
        ResumeButton: {
          type: Button,
          label: resumeLabel,
          visible: true,
        },
        RestartButton: {
          type: Button,
          label: "Dall'inizio",
          visible: true,
        },
        FavoriteButton: {
          type: Button,
          label: favLabel,
          visible: true,
        },
        PlayedButton: {
          type: Button,
          label: playedLabel,
          visible: true,
        },
      })
    } else {
      this._hasResume = false
      this._buttonIndex = 0
      this.tag('Body.PlayButton').visible = true
      if (this.tag('Body.ResumeButton')) this.tag('Body.ResumeButton').visible = false
      if (this.tag('Body.RestartButton')) this.tag('Body.RestartButton').visible = false
      this.tag('Body').patch({
        FavoriteButton: {
          type: Button,
          label: favLabel,
          visible: true,
        },
        PlayedButton: {
          type: Button,
          label: playedLabel,
          visible: true,
        },
      })
    }
    this._layoutButtons()
  }

  _measureButtonText(text) {
    try {
      const canvas = this.stage && this.stage.getDrawingCanvas ? this.stage.getDrawingCanvas() : (typeof document !== 'undefined' && document.createElement('canvas'))
      if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d')
        ctx.font = '32px Regular'
        const m = ctx.measureText(text)
        if (m && typeof m.width === 'number' && m.width > 0) {
          return m.width
        }
      }
    } catch (e) {}
    return (text || '').length * 18
  }

  _layoutButtons() {
    const buttons = this._getButtons()
    const layoutItems = layoutButtonPositions(buttons.map(b => b.label), l => this._measureButtonText(l))
    layoutItems.forEach((item, i) => {
      const b = buttons[i]
      const comp = this.tag(b.tag)
      if (comp) {
        comp.patch({
          x: item.x,
          y: 160,
          w: item.w,
          visible: true,
          Label: {
            x: item.w / 2,
            y: 34,
            mount: 0.5,
            text: { text: item.label },
          },
        })
      }
    })
    probe.data('buttons', layoutItems)
  }

  _getButtons() {
    const favLabel = this._isFavorite ? '✓ Nella mia lista' : '+ La mia lista'
    const playedLabel = this._isPlayed ? 'Visto' : 'Segna come visto'
    if (this._hasResume) {
      return [
        { tag: 'Body.ResumeButton', label: this._resumeLabel, action: 'resume' },
        { tag: 'Body.RestartButton', label: "Dall'inizio", action: 'restart' },
        { tag: 'Body.FavoriteButton', label: favLabel, action: 'favorite' },
        { tag: 'Body.PlayedButton', label: playedLabel, action: 'played' },
      ]
    }
    return [
      { tag: 'Body.PlayButton', label: 'Riproduci', action: 'play' },
      { tag: 'Body.FavoriteButton', label: favLabel, action: 'favorite' },
      { tag: 'Body.PlayedButton', label: playedLabel, action: 'played' },
    ]
  }

  async _loadSeasons() {
    const { client, session } = this
    try {
      const seasons = await client.seasons(session.userId, this._details.id)
      if (!this.attached) return
      this._seasons = seasons
      this._populateSeasons(seasons)
      probe.data('seasons', seasons.length)
    } catch (e) {
      probe.error('seasons', e)
    }
  }

  _populateSeasons(seasons) {
    if (!seasons || !seasons.length) return
    const { client } = this
    const poster = layout.poster
    this.tag('Body').patch({
      Seasons: {
        type: Row,
        y: SEASONS_Y,
        title: 'Stagioni',
        tile: poster,
        showLabels: true,
        entries: seasons.map(s => ({
          id: s.id,
          label: s.name,
          imageUrl: s.imageTag ? client.imageUrl(s.id, { tag: s.imageTag, maxHeight: poster.h }) : null,
        })),
      },
    })
  }

  _populateEpisodes(episodes) {
    if (!episodes || !episodes.length) return
    const { client } = this
    const wide = layout.wide
    this.tag('Body').patch({
      Episodes: {
        type: Row,
        y: EPISODES_Y,
        title: 'Episodi',
        tile: wide,
        showLabels: true,
        entries: episodes.map(ep => ({
          id: ep.id,
          label: ep.index ? `${ep.index}. ${ep.name}` : ep.name,
          imageUrl: ep.imageTag ? client.imageUrl(ep.id, { tag: ep.imageTag, maxWidth: wide.w }) : null,
        })),
      },
    })
  }

  async _loadSimilar() {
    const { client, session } = this
    try {
      const items = await client.similar(this._details.id, session.userId, 12)
      if (!this.attached) return
      this._similar = items
      probe.data('similar', items.length)
      if (items.length > 0) {
        this._populateSimilar(items)
      }
    } catch (e) {
      probe.error('similar', e)
      probe.data('similar', 0)
    }
  }

  _populateSimilar(items) {
    if (!items || !items.length) return
    const { client } = this
    const poster = layout.poster
    const isSeries = this._details && this._details.type === 'Series'
    const y = isSeries ? SIMILAR_SERIES_Y : SIMILAR_FILM_Y
    this.tag('Body').patch({
      Similar: {
        type: Row,
        y,
        title: 'Altri titoli simili',
        tile: poster,
        showLabels: false,
        entries: items.map(item => ({
          id: item.id,
          label: item.name,
          played: item.played,
          imageUrl: item.imageTag ? client.imageUrl(item.id, { tag: item.imageTag, maxHeight: poster.h }) : null,
        })),
      },
    })
  }

  _getMaxSection() {
    if (this._details && this._details.type === 'Series') {
      if (this._similar && this._similar.length && this._episodes && this._episodes.length) return 3
      if (this._episodes && this._episodes.length) return 2
      if (this._seasons && this._seasons.length) return 1
      return 0
    }
    return (this._similar && this._similar.length) ? 1 : 0
  }

  _setSection(index) {
    if (index === this._section) return
    if (index < 0) return
    if (index > this._getMaxSection()) return

    this._section = index
    if (index === 0) {
      this.tag('Body.Overview').alpha = 1
      this._setButtonsAlpha(1)
      const seasons = this.tag('Body.Seasons')
      if (seasons) seasons.alpha = 1
      const episodes = this.tag('Body.Episodes')
      if (episodes) episodes.alpha = 1
      this.tag('Body').setSmooth('y', BODY_ORIGIN_Y, { duration: 0.25 })
      const btns = this._getButtons()
      const btn = btns[this._buttonIndex] || btns[0]
      probe.focus({ section: 'button', index: this._buttonIndex || 0, label: btn.label })
    } else if (this._details && this._details.type === 'Series') {
      this._setButtonsAlpha(0)
      if (index === 1) {
        this.tag('Body.Overview').alpha = 0
        const seasons = this.tag('Body.Seasons')
        if (seasons) seasons.alpha = 1
        const episodes = this.tag('Body.Episodes')
        if (episodes) episodes.alpha = 1
        const targetY = TARGET_ROW_TOP - SEASONS_Y
        this.tag('Body').setSmooth('y', targetY, { duration: 0.25 })
        const row = this.tag('Body.Seasons')
        const top = TARGET_ROW_TOP
        const bottom = top + (row ? row.rowHeight : 436)
        probe.data('focusRect', { top, bottom })
        const focused = row && row.focusedEntry
        probe.focus({ section: 'seasons', index: row ? row.index : 0, label: focused ? focused.label : '' })
      } else if (index === 2) {
        this.tag('Body.Overview').alpha = 0
        const seasons = this.tag('Body.Seasons')
        if (seasons) seasons.alpha = 0
        const episodes = this.tag('Body.Episodes')
        if (episodes) episodes.alpha = 1
        const targetY = TARGET_ROW_TOP - EPISODES_Y
        this.tag('Body').setSmooth('y', targetY, { duration: 0.25 })
        const row = this.tag('Body.Episodes')
        const top = TARGET_ROW_TOP
        const bottom = top + (row ? row.rowHeight : 331)
        probe.data('focusRect', { top, bottom })
        const focused = row && row.focusedEntry
        probe.focus({ section: 'episodes', index: row ? row.index : 0, label: focused ? focused.label : '' })
      } else if (index === 3) {
        this.tag('Body.Overview').alpha = 0
        const seasons = this.tag('Body.Seasons')
        if (seasons) seasons.alpha = 0
        const episodes = this.tag('Body.Episodes')
        if (episodes) episodes.alpha = 0
        const targetY = TARGET_ROW_TOP - SIMILAR_SERIES_Y
        this.tag('Body').setSmooth('y', targetY, { duration: 0.25 })
        const row = this.tag('Body.Similar')
        const top = TARGET_ROW_TOP
        const bottom = top + (row ? row.rowHeight : 436)
        probe.data('focusRect', { top, bottom })
        const focused = row && row.focusedEntry
        probe.focus({ section: 'similar', index: row ? row.index : 0, label: focused ? focused.label : '' })
      }
    } else {
      this._setButtonsAlpha(0)
      if (index === 1) {
        this.tag('Body.Overview').alpha = 0
        const targetY = TARGET_ROW_TOP - SIMILAR_FILM_Y
        this.tag('Body').setSmooth('y', targetY, { duration: 0.25 })
        const row = this.tag('Body.Similar')
        const top = TARGET_ROW_TOP
        const bottom = top + (row ? row.rowHeight : 436)
        probe.data('focusRect', { top, bottom })
        const focused = row && row.focusedEntry
        probe.focus({ section: 'similar', index: row ? row.index : 0, label: focused ? focused.label : '' })
      }
    }
    this._refocus()
  }

  _setButtonsAlpha(alpha) {
    const btns = this._getButtons()
    for (const b of btns) {
      const el = this.tag(b.tag)
      if (el) el.alpha = alpha
    }
  }

  _handleDown() {
    if (this._section < this._getMaxSection()) {
      this._setSection(this._section + 1)
    }
  }

  _handleUp() {
    if (this._section > 0) {
      this._setSection(this._section - 1)
    }
  }

  async _handleEnter() {
    if (this._section === 0 && this._details) {
      const btns = this._getButtons()
      const btn = btns[this._buttonIndex] || btns[0]
      if (btn.action === 'play' || btn.action === 'resume' || btn.action === 'restart') {
        const startTicks = (btn.action === 'resume') ? this._resumeTicks : 0
        probe.event('play_requested', { id: this._details.id, startTicks })
        this.fireAncestors('$playItem', this._details.id, startTicks)
        return
      }
      if (btn.action === 'favorite') {
        const nextValue = !this._isFavorite
        try {
          await this.client.setFavorite(this.session.userId, this._details.id, nextValue)
          this._isFavorite = nextValue
          const newLabel = nextValue ? '✓ Nella mia lista' : '+ La mia lista'
          this._layoutButtons()
          probe.event('favorite', { id: this._details.id, value: nextValue })
          probe.focus({ section: 'button', index: this._buttonIndex, label: newLabel })
        } catch (e) {
          probe.error('favorite', e)
        }
        return
      }
      if (btn.action === 'played') {
        const nextValue = !this._isPlayed
        try {
          await this.client.setPlayed(this.session.userId, this._details.id, nextValue)
          this._isPlayed = nextValue
          const newLabel = nextValue ? 'Visto' : 'Segna come visto'
          this._layoutButtons()
          probe.event('played', { id: this._details.id, value: nextValue })
          probe.focus({ section: 'button', index: this._buttonIndex, label: newLabel })
        } catch (e) {
          probe.error('played', e)
        }
        return
      }
    }
  }

  _handleLeft() {
    if (this._section === 0 && this._buttonIndex > 0) {
      this._buttonIndex--
      this._refocus()
      this._focus()
      return true
    }
  }

  _handleRight() {
    if (this._section === 0) {
      const btns = this._getButtons()
      if (this._buttonIndex < btns.length - 1) {
        this._buttonIndex++
        this._refocus()
        this._focus()
        return true
      }
    }
  }

  async $rowSelect(row, entry) {
    if (row === this.tag('Body.Seasons')) {
      this._selectedSeasonEntry = entry
      try {
        const episodes = await this.client.episodes(this.session.userId, this._details.id, entry.id)
        if (!this.attached) return
        this._episodes = episodes
        this._populateEpisodes(episodes)
        probe.data('episodes', episodes.length)
      } catch (e) {
        probe.error('episodes', e)
      }
      return
    }
    if (row === this.tag('Body.Episodes')) {
      this.fireAncestors('$openItem', entry.id)
      return
    }
    if (row === this.tag('Body.Similar')) {
      this.fireAncestors('$openItem', entry.id)
      return
    }
  }

  $rowFocus(row, entry) {
    if (entry && row === this.tag('Body.Seasons')) {
      const top = TARGET_ROW_TOP
      const bottom = top + row.rowHeight
      probe.data('focusRect', { top, bottom })
      probe.focus({ section: 'seasons', index: row.index, label: entry.label })
    } else if (entry && row === this.tag('Body.Episodes')) {
      const top = TARGET_ROW_TOP
      const bottom = top + row.rowHeight
      probe.data('focusRect', { top, bottom })
      probe.focus({ section: 'episodes', index: row.index, label: entry.label })
    } else if (entry && row === this.tag('Body.Similar')) {
      const top = TARGET_ROW_TOP
      const bottom = top + row.rowHeight
      probe.data('focusRect', { top, bottom })
      probe.focus({ section: 'similar', index: row.index, label: entry.label })
    }
  }

  _handleBack() {
    this.fireAncestors('$back')
    return true
  }

  _focus() {
    if (this._section === 0) {
      const btns = this._getButtons()
      const btn = btns[this._buttonIndex] || btns[0]
      probe.focus({ section: 'button', index: this._buttonIndex || 0, label: btn.label })
    } else if (this._details && this._details.type === 'Series') {
      if (this._section === 1) {
        const row = this.tag('Body.Seasons')
        const focused = row && row.focusedEntry
        probe.focus({ section: 'seasons', index: row ? row.index : 0, label: focused ? focused.label : '' })
      } else if (this._section === 2) {
        const row = this.tag('Body.Episodes')
        const focused = row && row.focusedEntry
        probe.focus({ section: 'episodes', index: row ? row.index : 0, label: focused ? focused.label : '' })
      } else if (this._section === 3) {
        const row = this.tag('Body.Similar')
        const focused = row && row.focusedEntry
        probe.focus({ section: 'similar', index: row ? row.index : 0, label: focused ? focused.label : '' })
      }
    } else {
      if (this._section === 1) {
        const row = this.tag('Body.Similar')
        const focused = row && row.focusedEntry
        probe.focus({ section: 'similar', index: row ? row.index : 0, label: focused ? focused.label : '' })
      }
    }
  }

  _getFocused() {
    if (this._details && this._details.type === 'Series') {
      if (this._section === 1) return this.tag('Body.Seasons')
      if (this._section === 2) return this.tag('Body.Episodes')
      if (this._section === 3) return this.tag('Body.Similar')
    } else {
      if (this._section === 1) return this.tag('Body.Similar')
    }
    const btns = this._getButtons()
    const btn = btns[this._buttonIndex] || btns[0]
    return this.tag(btn.tag)
  }
}
