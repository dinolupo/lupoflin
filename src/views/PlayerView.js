import { Lightning, VideoPlayer } from '@lightningjs/sdk'
import Button from '../components/Button.js'
import CastPanel from '../components/CastPanel.js'
import CastPill from '../components/CastPill.js'
import ControlsRow from '../components/ControlsRow.js'
import EpisodesPanel from '../components/EpisodesPanel.js'
import NextCard from '../components/NextCard.js'
import Osd from '../components/Osd.js'
import PlayerErrorDialog from '../components/PlayerErrorDialog.js'
import PlayerHeader from '../components/PlayerHeader.js'
import StillWatchingDialog from '../components/StillWatchingDialog.js'
import Subtitles from '../components/Subtitles.js'
import TrackPanel from '../components/TrackPanel.js'
import { deviceProfile } from '../lib/deviceProfile.js'
import {
  findActiveSegment,
  findNextEpisode,
  isPlaybackErrorIgnored,
  isTextSubtitle,
  mapSegment,
  nextAction,
  playerErrorMessage,
  segmentLabel,
  selectDefaultTracks,
} from '../lib/playback.js'
import {
  applyVideoLayerZIndex,
  castOrder,
  controlButtons,
  episodeCards,
  playerTitleLines,
  sendProgressReport,
  sendStartReport,
  sendStopReport,
  needsAudioRequest,
} from '../lib/playerLayout.js'
import { probe } from '../lib/probe.js'
import { findActiveCue, parseVtt } from '../lib/vtt.js'
import { audioTrackPosition } from '../lib/trackLabels.js'

export default class PlayerView extends Lightning.Component {
  static _template() {
    return {
      Subtitles: { type: Subtitles },
      NextCard: { type: NextCard, x: 1840, y: 980, mountX: 1, mountY: 1, visible: false, alpha: 0.001 },
      SkipButton: { type: Button, x: 1840, y: 980, mountX: 1, mountY: 1, w: 240, h: 60, label: 'Salta intro', visible: false, alpha: 0.001 },
      Header: { type: PlayerHeader },
      Osd: { type: Osd },
      CastPill: { type: CastPill, x: 80, y: 820, visible: false, alpha: 0.001 },
      ControlsRow: { type: ControlsRow, x: 80, y: 950, visible: false, alpha: 0.001 },
      EpisodesPanel: { type: EpisodesPanel, x: 80, y: 780, visible: false, alpha: 0.001 },
      CastPanel: { type: CastPanel, visible: false, alpha: 0.001, zIndex: 10 },
      TrackMenu: { type: TrackPanel, visible: false, alpha: 0.001 },
      StillWatching: { type: StillWatchingDialog, visible: false, alpha: 0.001 },
      ErrorDialog: { type: PlayerErrorDialog, visible: false, zIndex: 20 },
    }
  }

  _init() {
    VideoPlayer.consumer(this)
    this._hasError = false
    this._isPaused = false
    this._osdVisible = false
    this._layerOpen = false
    this._titleLines = { title: '', subtitle: null }
    this._title = ''
    this._duration = 0
    this._startReported = false
    this._stoppedReported = false
    this._lastProgressSec = 0
    this._audioIndex = null
    this._subtitleIndex = null
    this._trackMenuOpen = false
    this._cues = []
    this._activeCueText = null
    this._episodesWithoutKeys = typeof this.episodesWithoutKeys === 'number' ? this.episodesWithoutKeys : 0
    this._keyWasPressed = false
    this._nextEpisode = null
    this._hasNext = false
    this._nextCardShown = false
    this._stillWatchingOpen = false
    this._enableNextEpisodeAutoPlay = true
    this._segments = []
    this._activeSegment = null
    this._hasCast = false
    this._actors = []
    this._castPanelOpen = false
    this._focusArea = 'controls'
    this._isEpisode = false
    this._seasonEpisodes = []
    this._seasonEpisodesCount = 0
  }

  _active() {
    probe.view('player', { id: this.itemId })
    probe.focus({ area: 'player', id: this.itemId })
    probe.data('dialog', null)
    probe.data('subtitle', null)
    probe.data('nextCard', false)
    probe.data('segments', 0)
    probe.data('titleLines', null)
    probe.data('layer', 'closed')
    probe.data('paused', false)
    probe.data('cast', 0)
    probe.data('episodes', 0)
    this._setupLayers()
    if (!this._started) {
      this._started = true
      this._startPlayback()
    }
  }

  _getFocused() {
    if (this._hasError) return this.tag('ErrorDialog')
    if (this._stillWatchingOpen) return this.tag('StillWatching')
    if (this._trackMenuOpen) return this.tag('TrackMenu')
    if (this._castPanelOpen) return this.tag('CastPanel')
    if (this._activeSegment) return this.tag('SkipButton')
    if (this._nextCardShown) return this.tag('NextCard')
    if (this._layerOpen) {
      if (this._focusArea === 'cast_pill') return this.tag('CastPill')
      if (this._focusArea === 'timeline') return this.tag('Osd').tag('ProgressBar')
      if (this._focusArea === 'episodes') return this.tag('EpisodesPanel')
      return this.tag('ControlsRow')
    }
    return this.tag('Osd')
  }

  _inactive() {
    clearTimeout(this._osdTimer)
    clearTimeout(this._layerTimer)
    this._restoreLayers()
    this._sendStopped(false)
  }

  _detach() {
    this._inactive()
  }

  async _startPlayback() {
    try {
      const target = (typeof window !== 'undefined' && window.PalmSystem) ? 'webos' : 'browser'
      const profile = deviceProfile(target)
      const startTicks = typeof this.startTicks === 'number' ? this.startTicks : 0

      // Fetch item details for header, OSD and next episode lookup
      this.client.item(this.session.userId, this.itemId).then(async details => {
        if (!this.attached) return
        this._titleLines = playerTitleLines(details)
        probe.data('titleLines', this._titleLines)
        this.tag('Header').update(this._titleLines)
        this._actors = castOrder(details.people)
        this._hasCast = this._actors.length > 0
        this.tag('CastPill').setHasCast(this._hasCast)
        this.tag('ControlsRow').setButtons(controlButtons({ hasNext: this._hasNext }))
        this._duration = details.minutes ? details.minutes * 60 : 0
        this._updateOsd()
        this._showOsd()

        this._isEpisode = details.type === 'Episode'
        if (this._isEpisode) {
          this.tag('ControlsRow').y = 710
          this.tag('CastPill').y = 570
        }
        if (this._isEpisode && details.seriesId) {
          try {
            const [allEpisodes, seasonEpisodes] = await Promise.all([
              this.client.episodes(this.session.userId, details.seriesId),
              details.seasonId ? this.client.episodes(this.session.userId, details.seriesId, details.seasonId) : null,
            ])
            if (!this.attached) return
            const nextEp = findNextEpisode(allEpisodes, this.itemId)
            if (nextEp) {
              this._nextEpisode = nextEp
              this._hasNext = true
              this.tag('ControlsRow').setButtons(controlButtons({ hasNext: true }))
            }
            const eps = (seasonEpisodes && seasonEpisodes.length)
              ? seasonEpisodes
              : allEpisodes.filter(e => e.seasonNumber === details.seasonNumber)
            this._seasonEpisodes = eps
            this._seasonEpisodesCount = eps.length
            probe.data('episodes', eps.length)
            this.tag('EpisodesPanel').setEpisodes(episodeCards(eps, this.itemId), this.client)
          } catch (e) {
            probe.data('episodes', 0)
          }
        }
      }).catch(() => {})

      let [me, info] = await Promise.all([
        this.client.me().catch(() => ({})),
        this.client.playbackInfo(this.session.userId, this.itemId, {
          profile,
          startTicks,
          audioIndex: typeof this._audioIndex === 'number' ? this._audioIndex : undefined,
        }),
      ])
      if (!this.attached) return
      this._playSessionId = info.playSessionId
      this._source = info.source

      if (me && me.Configuration && me.Configuration.EnableNextEpisodeAutoPlay !== undefined) {
        this._enableNextEpisodeAutoPlay = me.Configuration.EnableNextEpisodeAutoPlay !== false
      }

      if (this._audioIndex === null && this._subtitleIndex === null && info.source) {
        const defTracks = selectDefaultTracks({
          streams: info.source.streams || [],
          defaultAudioIndex: info.source.defaultAudioStreamIndex,
          defaultSubtitleIndex: info.source.defaultSubtitleStreamIndex,
          userConfig: (me && me.Configuration) || {},
        })
        this._audioIndex = defTracks.audio
        this._subtitleIndex = defTracks.subtitle
        probe.data('tracks', { audio: this._audioIndex, subtitle: this._subtitleIndex })
      }
      // The first request does not say which track the user wants: when it differs from the file's default, ask again.
      if (needsAudioRequest(info.source, this._audioIndex) && info.source.directPlay && canSwitchInFile()) {
        this._pendingAudio = this._audioIndex // switched on loadedmetadata, when the element lists its tracks
      } else if (needsAudioRequest(info.source, this._audioIndex)) {
        info = await this.client.playbackInfo(this.session.userId, this.itemId, {
          profile,
          startTicks,
          audioIndex: this._audioIndex,
          mediaSourceId: info.source.id,
          directPlay: false,
        })
        if (!this.attached) return
        this._playSessionId = info.playSessionId
        this._source = info.source
      }
      this._loadSubtitles()

      this.client.segments(this.itemId).then(items => {
        if (!this.attached) return
        this._segments = (items || []).map(mapSegment).filter(Boolean)
        probe.data('segments', this._segments.length)
        this._updateSegments(VideoPlayer.currentTime || 0)
      }).catch(() => {
        this._segments = []
        probe.data('segments', 0)
      })

      const streamUrl = this.client.streamUrl(this.itemId, info.source, info.playSessionId)
      this._setupLayers()
      VideoPlayer.open(streamUrl)
    } catch (e) {
      probe.error('player', e)
      this._showPlayerError(playerErrorMessage(e))
    }
  }

  _showPlayerError(message) {
    if (this._hasError) return
    this._hasError = true
    this._restoreLayers()
    probe.event('player_error', { message: message || 'Impossibile riprodurre il titolo' })
    this.tag('ErrorDialog').visible = true
    this._refocus()
  }

  _setupLayers() {
    this.fireAncestors('$setVideoLayer', true)
    const videoEl = VideoPlayer._videoEl || (typeof document !== 'undefined' && document.getElementById('video-player'))
    this._origVideoZIndex = applyVideoLayerZIndex(videoEl, true, this._origVideoZIndex)
  }

  _restoreLayers() {
    this.fireAncestors('$setVideoLayer', false)
    const videoEl = VideoPlayer._videoEl || (typeof document !== 'undefined' && document.getElementById('video-player'))
    applyVideoLayerZIndex(videoEl, false, this._origVideoZIndex)
  }

  _showOsd() {
    this.tag('Header').show()
    this.tag('Osd').show()
    this.tag('Subtitles').setOsdVisible(true)
    this._osdVisible = true
    probe.data('osd', true)
    this._updateOsd()
    clearTimeout(this._osdTimer)
    this._osdTimer = setTimeout(() => this._hideOsd(), 4000)
  }

  _hideOsd() {
    this.tag('Header').hide()
    this.tag('Osd').hide()
    this.tag('Subtitles').setOsdVisible(false)
    this._osdVisible = false
    probe.data('osd', false)
  }

  _updateOsd(currentTime) {
    const time = typeof currentTime === 'number' ? currentTime : (VideoPlayer.currentTime || 0)
    const dur = VideoPlayer.duration && isFinite(VideoPlayer.duration) ? VideoPlayer.duration : this._duration
    this.tag('Osd').update({
      currentTime: time,
      duration: dur,
    })
  }

  _handleBack() {
    this._keyWasPressed = true
    if (this._hasError) { this._close(); return true }
    if (this._stillWatchingOpen) { this.$stillWatchingExit(); return true }
    if (this._trackMenuOpen) { this._closeTrackMenu(); return true }
    if (this._castPanelOpen) { this.$closeCastPanel(); return true }
    if (this._nextCardShown) { this.tag('NextCard').hide(); this._nextCardShown = false; this._refocus(); return true }
    if (this._layerOpen) { this._closeLayer(); return true }
    this._close()
    return true
  }

  // Stops this playback (timers, video, stop report) without leaving the screen.
  _stopPlayback() {
    clearTimeout(this._osdTimer)
    clearTimeout(this._layerTimer)
    // The position must be read before close(): afterwards the video reports 0 and the resume point is lost.
    const time = VideoPlayer.currentTime
    VideoPlayer.close()
    this._restoreLayers()
    sendStopReport(this.client, this, time, false)
  }

  _close() {
    this._stopPlayback()
    this.fireAncestors('$back')
  }

  _openTrackMenu(initialCol = 0) {
    if (this._trackMenuOpen) return
    this._trackMenuOpen = true
    this._hideOsd()
    const streams = (this._source && this._source.streams) || []
    this.tag('TrackMenu').updateTracks({
      audioTracks: streams.filter(s => s.type === 'Audio'),
      subtitleTracks: streams.filter(isTextSubtitle),
      selectedAudio: this._audioIndex,
      selectedSubtitle: this._subtitleIndex,
      initialCol,
    })
    this.tag('TrackMenu').patch({ visible: true, alpha: 1 })
    probe.data('dialog', 'tracks')
    this._refocus()
  }

  _closeTrackMenu() {
    if (!this._trackMenuOpen) return
    this._trackMenuOpen = false
    this.tag('TrackMenu').patch({ visible: false, alpha: 0.001 })
    probe.data('dialog', null)
    probe.focus({ area: 'player', id: this.itemId })
    this._refocus()
    this._showOsd()
  }

  $closeTrackMenu() { this._closeTrackMenu() }

  $selectSubtitle(subtitleIndex) {
    this._subtitleIndex = subtitleIndex
    probe.data('tracks', { audio: this._audioIndex, subtitle: this._subtitleIndex })
    this._loadSubtitles()
  }

  async _loadSubtitles() {
    if (this._subtitleIndex === null) {
      this._cues = []
      this._activeCueText = null
      this.tag('Subtitles').clear()
      probe.data('subtitle', null)
      return
    }
    const mediaSourceId = this._source ? this._source.id : this.itemId
    try {
      const vttText = await this.client.subtitles(this.itemId, mediaSourceId, this._subtitleIndex, 'vtt')
      if (!this.attached) return
      this._cues = parseVtt(vttText)
      this._updateSubtitles(VideoPlayer.currentTime || 0)
    } catch (e) {
      this._cues = []
      this._activeCueText = null
      this.tag('Subtitles').clear()
      probe.data('subtitle', null)
    }
  }

  _updateSubtitles(currentTime) {
    if (!this._cues || this._cues.length === 0) {
      if (this._activeCueText !== null) {
        this._activeCueText = null
        this.tag('Subtitles').clear()
        probe.data('subtitle', null)
      }
      return
    }
    const cue = findActiveCue(this._cues, currentTime)
    const text = cue ? cue.text : null
    if (text !== this._activeCueText) {
      this._activeCueText = text
      probe.data('subtitle', text)
      this.tag('Subtitles').showCue(cue)
    }
  }

  async $selectAudio(audioIndex) {
    if (this._audioIndex === audioIndex) return
    this._audioIndex = audioIndex
    probe.data('tracks', { audio: this._audioIndex, subtitle: this._subtitleIndex })
    if (this._switchAudioInFile(audioIndex)) return
    await this._reopenWithAudio()
  }

  // Direct play: the <video> element itself switches between the file's audio tracks, at once and without reloading
  // (what the Jellyfin web client does on webOS). False when the element cannot do it.
  _switchAudioInFile(audioIndex) {
    const tracks = this._source && this._source.directPlay ? nativeAudioTracks() : null
    const pos = tracks ? audioTrackPosition(this._source.streams, audioIndex, tracks.length) : -1
    probe.data('audioSwitch', { method: pos >= 0 ? 'file' : 'server', native: tracks ? tracks.length : 0 })
    if (pos < 0) return false
    for (let i = 0; i < tracks.length; i++) tracks[i].enabled = i === pos
    this._sendProgress(VideoPlayer.currentTime || 0, this._isPaused)
    return true
  }

  // Otherwise the server sends a new stream with the chosen track, from the same position.
  async _reopenWithAudio() {
    const currentSec = VideoPlayer.currentTime || 0
    const startTicks = secondsToTicks(currentSec)
    try {
      const target = (typeof window !== 'undefined' && window.PalmSystem) ? 'webos' : 'browser'
      const profile = deviceProfile(target)
      const info = await this.client.playbackInfo(this.session.userId, this.itemId, {
        profile,
        startTicks,
        audioIndex: this._audioIndex,
        mediaSourceId: this._source ? this._source.id : undefined,
        directPlay: false,
      })
      if (!this.attached) return
      this._source = info.source
      this._playSessionId = info.playSessionId
      const streamUrl = this.client.streamUrl(this.itemId, info.source, info.playSessionId)
      this._setupLayers()
      this._seekOnCanPlay = currentSec
      VideoPlayer.open(streamUrl)
    } catch (e) {
      probe.error('player', e)
    }
  }

  _checkNextAction(time) {
    if (!this._hasNext || this._stillWatchingOpen) return
    const dur = (VideoPlayer.duration && isFinite(VideoPlayer.duration)) ? VideoPlayer.duration : this._duration
    const action = nextAction({ time, duration: dur, outroStart: this._outroStart, hasNext: this._hasNext, episodesWithoutKeys: this._episodesWithoutKeys })
    if (action === 'askStillWatching') this._showStillWatching()
    else if (action === 'showNext' && !this._nextCardShown) this._showNextCard()
  }

  _showNextCard() {
    if (this._nextCardShown || !this._nextEpisode) return
    this._nextCardShown = true
    this.tag('NextCard').show(this._nextEpisode, {
      autoPlay: this._enableNextEpisodeAutoPlay,
      client: this.client,
    })
    this._refocus()
  }

  _showStillWatching() {
    if (this._stillWatchingOpen) return
    this._stillWatchingOpen = true
    VideoPlayer.pause()
    this._hideOsd()
    if (this._nextCardShown) {
      this.tag('NextCard').hide()
      this._nextCardShown = false
    }
    this.tag('StillWatching').patch({ visible: true, alpha: 1 })
    probe.data('dialog', 'still-watching')
    this._refocus()
  }

  $playNextEpisode(nextEpisode) {
    const ep = nextEpisode || this._nextEpisode
    if (!ep) return
    const nextWithoutKeys = this._keyWasPressed ? 0 : (this._episodesWithoutKeys + 1)
    // Not _close(): going back first would remove this view and fireAncestors would find nobody.
    this._stopPlayback()
    this.fireAncestors('$playItem', ep.id, 0, { episodesWithoutKeys: nextWithoutKeys, replace: true })
  }

  $stillWatchingContinue() {
    this._stillWatchingOpen = false
    this._episodesWithoutKeys = 0
    this._keyWasPressed = true
    this.tag('StillWatching').patch({ visible: false, alpha: 0.001 })
    probe.data('dialog', null); this._refocus(); this.$playNextEpisode()
  }
  $stillWatchingExit() {
    this._stillWatchingOpen = false
    this.tag('StillWatching').patch({ visible: false, alpha: 0.001 })
    probe.data('dialog', null); this._close()
  }
  $stillWatchingFocus(label) { probe.focus({ area: 'dialog', dialog: 'still-watching', label }) }

  _openLayer() {
    if (this._layerOpen) return
    this._layerOpen = true
    probe.data('layer', 'open')
    this.tag('ControlsRow').show()
    if (this._hasCast) this.tag('CastPill').show()
    if (this._isEpisode && this._seasonEpisodesCount) {
      this.tag('Osd').setBottomOffset(240)
      this.tag('EpisodesPanel').show()
    }
    this._showOsd()
    clearTimeout(this._osdTimer)
    this._resetLayerTimer()
    this._refocus()
  }

  _closeLayer() {
    if (!this._layerOpen) return
    this._layerOpen = false
    clearTimeout(this._layerTimer)
    probe.data('layer', 'closed')
    this.tag('ControlsRow').hide()
    this.tag('CastPill').hide()
    if (this._isEpisode) {
      this.tag('Osd').setBottomOffset(0)
      this.tag('EpisodesPanel').hide()
    }
    if (this._castPanelOpen) this.$closeCastPanel()
    this._hideOsd()
    this._focusArea = 'controls'
    probe.focus({ area: 'player', id: this.itemId })
    this._refocus()
  }

  _resetLayerTimer() {
    clearTimeout(this._layerTimer)
    this._layerTimer = setTimeout(() => this._closeLayer(), 5000)
  }

  $resetLayerTimer() { this._resetLayerTimer() }
  $closeLayer() { this._closeLayer() }
  $focusPill() { if (!this._hasCast) return; this._focusArea = 'cast_pill'; this._refocus() }
  $focusTimeline() { this._focusArea = 'timeline'; this._refocus() }
  $focusControls() { this._focusArea = 'controls'; this._refocus() }
  $timelineUp() { if (this._hasCast) { this._focusArea = 'cast_pill'; this._refocus() } }
  $timelineDown() { this._focusArea = 'controls'; this._refocus() }
  $timelineSeek(delta) { this._seekRelative(delta) }
  $timelinePlayPause() { VideoPlayer.playPause() }
  $focusEpisodes() {
    if (!this._isEpisode || !this._seasonEpisodesCount) return
    this._focusArea = 'episodes'; this._refocus(); this.tag('EpisodesPanel').focusCurrent()
  }
  $playEpisode(card) { this.$playNextEpisode(card) }
  $openCastPanel() {
    if (!this._hasCast || this._castPanelOpen) return
    this._castPanelOpen = true
    this.tag('CastPanel').open({
      actors: this._actors,
      client: this.client,
      userId: this.session.userId,
      currentItemId: this.itemId,
    })
    probe.data('cast', this._actors.length)
    this._refocus()
  }
  $closeCastPanel() {
    if (!this._castPanelOpen) return
    this._castPanelOpen = false
    this.tag('CastPanel').close()
    probe.data('cast', 0)
    this._focusArea = 'cast_pill'
    this._refocus()
    this.tag('CastPill')._emitFocus()
  }

  $controlAction(action) {
    if (action === 'restart') {
      VideoPlayer.seek(0)
      this._updateOsd(0)
      this._updateSubtitles(0)
      this._updateSegments(0)
      this._sendProgress(0, this._isPaused)
      this._closeLayer()
    } else if (action === 'next') {
      this._closeLayer()
      this.$playNextEpisode()
    } else {
      this._closeLayer()
      this._openTrackMenu(action === 'subtitles' ? 1 : 0)
    }
  }

  _handleUp() {
    this._keyWasPressed = true
    if (this._hasError || this._trackMenuOpen) return !this._trackMenuOpen
    if (!this._layerOpen) this._openLayer()
    return true
  }
  _handleDown() {
    this._keyWasPressed = true
    if (this._hasError || this._trackMenuOpen) return !this._trackMenuOpen
    if (!this._layerOpen) this._openLayer()
    return true
  }

  _updateSegments(time) {
    if (!this._segments || this._segments.length === 0) {
      if (this._activeSegment !== null) {
        this._activeSegment = null
        this.tag('SkipButton').patch({ visible: false, alpha: 0.001 })
        this._refocus()
      }
      return
    }
    const seg = findActiveSegment(this._segments, time)
    if (seg !== this._activeSegment) {
      this._activeSegment = seg
      if (seg) this.tag('SkipButton').setLabel(segmentLabel(seg.type))
      this.tag('SkipButton').patch(seg ? { visible: true, alpha: 1 } : { visible: false, alpha: 0.001 })
      this._refocus()
    }
  }

  _handleSkip() {
    if (this._activeSegment) {
      const endSec = this._activeSegment.endSec
      VideoPlayer.seek(endSec)
      this._updateSegments(endSec)
      this._refocus()
      return true
    }
    return false
  }

  _handleEnter() {
    this._keyWasPressed = true
    if (this._hasError) {
      this._close()
      return true
    }
    if (this._trackMenuOpen) return false
    if (this._activeSegment) {
      return this._handleSkip()
    }
    if (this._layerOpen) {
      return false
    }
    this._showOsd()
    VideoPlayer.playPause()
    return true
  }

  _seekRelative(delta) {
    this._showOsd()
    const current = VideoPlayer.currentTime || 0
    const dur = VideoPlayer.duration || this._duration || Infinity
    const time = Math.max(0, Math.min(dur, current + delta))
    VideoPlayer.seek(time)
    probe.data('time', Math.floor(time))
    this._updateOsd(time)
    this._updateSubtitles(time)
    this._updateSegments(time)
    this._sendProgress(time, this._isPaused)
    return true
  }

  _handleLeft() {
    this._keyWasPressed = true
    if (this._hasError || this._layerOpen) return !this._hasError ? false : true
    if (this._trackMenuOpen) return false
    return this._seekRelative(-10)
  }

  _handleRight() {
    this._keyWasPressed = true
    if (this._hasError || this._layerOpen) return !this._hasError ? false : true
    if (this._trackMenuOpen) return false
    return this._seekRelative(10)
  }

  _handlePlay() { this._keyWasPressed = true; this._showOsd(); VideoPlayer.play(); return true }
  _handlePause() { this._keyWasPressed = true; this._showOsd(); VideoPlayer.pause(); return true }
  _handleStop() { this._keyWasPressed = true; this._close(); return true }
  _handleRewind() { return this._handleLeft() }
  _handleFastForward() { return this._handleRight() }

  _captureKey() {
    this._keyWasPressed = true
    if (this._layerOpen) {
      this._resetLayerTimer()
    } else if (!this._trackMenuOpen && !this._stillWatchingOpen) {
      this._showOsd()
    }
    return false
  }

  _onCanPlay() {
    if (typeof this._seekOnCanPlay === 'number') {
      const sec = this._seekOnCanPlay
      this._seekOnCanPlay = null
      VideoPlayer.seek(sec)
      return
    }
    if (this.startTicks > 0 && !this._didInitialSeek) {
      this._didInitialSeek = true
      VideoPlayer.seek(this.startTicks / 10000000)
    }
  }

  _sendStart() { return sendStartReport(this.client, this) }
  _sendProgress(currentTime, isPaused = false) { return sendProgressReport(this.client, this, currentTime, isPaused) }
  _sendStopped(failed = false) { return sendStopReport(this.client, this, VideoPlayer.currentTime, failed) }

  $videoPlayerCanPlay() { this._onCanPlay() }
  $videoPlayerLoadedMetadata() {
    if (typeof this._pendingAudio === 'number') {
      const idx = this._pendingAudio
      this._pendingAudio = null
      if (!this._switchAudioInFile(idx)) this._reopenWithAudio()
    }
    this._onCanPlay()
    this._updateOsd()
  }
  $videoPlayerPause() { this._isPaused = true; probe.data('paused', true); this._sendProgress(VideoPlayer.currentTime, true) }
  $videoPlayerPlay() { this._isPaused = false; probe.data('paused', false) }

  $videoPlayerPlaying() {
    this._isPaused = false
    probe.data('paused', false)
    probe.event('playing', { id: this.itemId })
    const time = VideoPlayer.currentTime || 0
    probe.data('time', Math.floor(time))
    this._setupLayers()
    this._updateOsd(time)
    this._sendStart()
  }

  $videoPlayerEnded() {
    probe.event('ended', { id: this.itemId })
    this._sendStopped(false)
    if (this._hasNext && this._enableNextEpisodeAutoPlay) {
      const dur = (VideoPlayer.duration && isFinite(VideoPlayer.duration)) ? VideoPlayer.duration : this._duration
      const action = nextAction({
        time: dur,
        duration: dur,
        outroStart: this._outroStart,
        hasNext: this._hasNext,
        episodesWithoutKeys: this._episodesWithoutKeys,
      })
      if (action === 'askStillWatching') {
        this._showStillWatching()
        return
      }
      this.$playNextEpisode()
    }
  }

  $videoPlayerTimeUpdate(args, currentTime) {
    const time = typeof currentTime === 'number' ? currentTime : (VideoPlayer.currentTime || 0)
    const sec = Math.floor(time)
    if (sec !== this._lastReportedSec) {
      this._lastReportedSec = sec
      probe.data('time', sec)
    }
    this._updateSubtitles(time)
    this._updateSegments(time)
    this._checkNextAction(time)
    if (this._osdVisible) {
      this._updateOsd(time)
    }
    if (sec - this._lastProgressSec >= 10) {
      this._lastProgressSec = sec
      this._sendProgress(time, this._isPaused)
    }
  }

  $videoPlayerError(e) {
    const msg = (e && e.event && e.event.message) || ''
    if (isPlaybackErrorIgnored(msg)) {
      return
    }
    probe.error('player', msg || 'playback error')
    this._showPlayerError(playerErrorMessage(msg))
  }
}

function canSwitchInFile() {
  return typeof HTMLMediaElement !== 'undefined' && 'audioTracks' in HTMLMediaElement.prototype
}

// The audioTracks list of the SDK <video id="video-player">, or null when the platform does not expose it.
function nativeAudioTracks() {
  const video = typeof document !== 'undefined' ? document.getElementById('video-player') : null
  return video && video.audioTracks && typeof video.audioTracks.length === 'number' ? video.audioTracks : null
}
