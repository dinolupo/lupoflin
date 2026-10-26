import { Lightning, Utils } from '@lightningjs/sdk'
import { createClient, mapUser, normalizeServerUrl } from './lib/jellyfin.js'
import { probe } from './lib/probe.js'
import { clearAll, deviceId, forgetUser, lastUserId, loadServer, loadUsers, saveUser } from './lib/session.js'
import { applyBrand, colors, font } from './theme.js'
import DetailsView from './views/DetailsView.js'
import ExitDialog from './components/ExitDialog.js'
import GridView from './views/GridView.js'
import HomeView from './views/HomeView.js'
import MessageView from './views/MessageView.js'
import ProfileMenu from './components/ProfileMenu.js'
import ProfilesView from './views/ProfilesView.js'
import QuickConnectView from './views/QuickConnectView.js'
import ServerView from './views/ServerView.js'
import SplashView from './views/SplashView.js'
import AvatarPickerView from './views/AvatarPickerView.js'
import PlayerView from './views/PlayerView.js'
import SearchView from './views/SearchView.js'

const SPLASH_MIN_MS = 1500

// Root: loads the config, restores the session and swaps one full-screen view at a time.
export default class App extends Lightning.Component {
  static getFonts() {
    return [{ family: font, url: Utils.asset('fonts/Roboto-Regular.ttf') }]
  }

  static _template() {
    return {
      Background: { rect: true, w: 1920, h: 1080, color: colors.background },
      // Screens go in here; Perf comes after it so it is drawn on top by order alone.
      // Do not use zIndex/forceZIndexContext at the root: on 24/10/2026 it hid every view.
      Views: {},
      Dialog: {},
      Perf: {
        x: 1900,
        y: 1050,
        mount: 1,
        visible: false,
        text: { text: '', fontFace: font, fontSize: 24, textColor: colors.textDim },
      },
    }
  }

  _init() {
    this._stack = []
    this._show(SplashView, {}, 'splash')
    probe.ready()
    const started = Date.now()
    this._boot()
      .catch(e => {
        probe.error('boot', e)
        return () => this.$fatal('Errore di avvio', e.message)
      })
      .then(next => {
        probe.event('boot_done', { ms: Math.round(performance.now()) })
        setTimeout(next, Math.max(0, SPLASH_MIN_MS - (Date.now() - started)))
      })
  }

  // Returns the function that shows the first real screen, run when the splash time is over.
  async _boot() {
    this.config = await this._loadConfig()
    applyBrand(this.config.brand)
    probe.telemetry(this.config.telemetry)
    this._startPerf(!!this.config.showPerf)
    this.storage = window.localStorage
    this.deviceId = deviceId(this.storage)

    let server = loadServer(this.storage)
    if (!server) {
      let queryServer = null
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search)
        if (params.has('server')) {
          queryServer = params.get('server')
        }
      }
      if (queryServer !== null) {
        server = normalizeServerUrl(queryServer)
      } else {
        server = normalizeServerUrl(this.config.server)
      }
    }
    if (!server) {
      return () => this.$showServer()
    }

    this.client = createClient({ server, deviceId: this.deviceId })
    const users = await this.client.publicUsers()
    return () => this.$showProfiles(users)
  }

  // XHR, not fetch: on webOS the app runs from file://, where fetch cannot read local files (status 0 = ok).
  _loadConfig() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.onload = () => {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch (e) {
          reject(new Error('static/config.local.json non valido o mancante (copia config.example.json)'))
        }
      }
      xhr.onerror = () => reject(new Error('static/config.local.json non trovato (copia config.example.json)'))
      xhr.open('GET', Utils.asset('config.local.json'))
      xhr.send()
    })
  }

  // Frames per second and worst frame time, published every second (probe + optional on-screen text).
  _startPerf(show) {
    let frames = 0
    let worst = 0
    let since = Date.now()
    this.stage.on('frameStart', () => {
      frames++
      worst = Math.max(worst, this.stage.dt * 1000)
    })
    if (show) this.tag('Perf').visible = true
    this._perfTimer = setInterval(() => {
      const now = Date.now()
      const fps = Math.round((frames * 1000) / (now - since))
      const worstMs = Math.round(worst)
      probe.data('perf', { fps, worstMs })
      probe.event('perf', { fps, worstMs })
      if (show) this.tag('Perf').text.text = `${fps} fps · peggiore ${worstMs} ms`
      frames = 0
      worst = 0
      since = now
    }, 1000)
  }

  _show(type, props, name) {
    this._currentView = { Type: type, props, name }
    const views = this.tag('Views')
    views.patch({ View: undefined })
    views.patch({ View: { type, ...props } })
    if (name === 'splash') probe.view('splash')
    this._refocus()
  }

  _push(type, props, name) {
    const currentView = this.tag('Views.View')
    const state = currentView ? currentView.navState : undefined
    if (this._currentView) {
      this._stack.push({ ...this._currentView, state })
    }
    this._show(type, props, name)
  }

  $back() {
    const entry = this._stack.pop()
    if (entry) {
      this._show(entry.Type, { ...entry.props, navState: entry.state }, entry.name)
      return
    }
    this.$askExit()
  }

  _showHome(session) {
    this.session = session
    if (this._cachedAvatars === undefined || this._cachedAvatars === null) {
      this.client.avatars().then(res => {
        this._cachedAvatars = res
        if (res === null) this._hasGetAvatar = false
      }).catch(() => {})
    }
    this._show(HomeView, { client: this.client, session }, 'home')

    let queryItem = null
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search)
      if (params.has('item')) {
        queryItem = params.get('item')
      }
    }
    if (queryItem && !this._deepLinkHandled) {
      this._deepLinkHandled = true
      this.$openItem(queryItem)
    }
  }

  $openLibrary(view) {
    this._push(GridView, { client: this.client, session: this.session, view }, 'grid')
  }

  $openSearch() {
    this._push(SearchView, { client: this.client, session: this.session }, 'search')
  }

  $openItem(itemId) {
    this._push(DetailsView, { client: this.client, session: this.session, itemId }, 'details')
  }

  // options.replace: the new player takes the place of the one that asks (next episode), so Back
  // still goes to the screen the first playback was opened from.
  $playItem(itemId, startTicks = 0, options = {}) {
    const props = {
      client: this.client,
      session: this.session,
      itemId,
      startTicks,
      episodesWithoutKeys: options.episodesWithoutKeys || 0,
    }
    if (options.replace) this._show(PlayerView, props, 'player')
    else this._push(PlayerView, props, 'player')
  }

  $setVideoLayer(active) {
    const bg = this.tag('Background')
    if (bg) bg.visible = !active
    if (active) {
      this.stage.setClearColor([0, 0, 0, 0])
    } else {
      this.stage.setClearColor(0xff141414)
    }
  }

  $showServer() {
    this._stack = []
    this._show(ServerView, { storage: this.storage, deviceId: this.deviceId }, 'server')
  }

  async $serverSaved({ client }) {
    this.client = client
    await this.$showProfiles()
  }

  async $showProfiles(users) {
    this._stack = []
    try {
      const list = users || (await this.client.publicUsers())
      const lastId = lastUserId(this.storage)
      this._show(ProfilesView, {
        client: this.client,
        users: list,
        lastUserId: lastId,
        hasGetAvatar: this._hasGetAvatar !== false,
      }, 'profiles')
    } catch (e) {
      this.$fatal('Server non raggiungibile', e.message)
    }
  }

  async $profileSelected(user) {
    const savedUsers = loadUsers(this.storage)
    const saved = savedUsers[user.id]
    if (saved && saved.token) {
      const client = createClient({ server: this.client.base, deviceId: this.deviceId, token: saved.token })
      try {
        const me = await client.me()
        this.client = client
        saveUser(this.storage, saved)
        const session = { server: this.client.base, ...saved, imageTag: (me && me.PrimaryImageTag) || null }
        probe.event('login', { user: saved.userName || user.name, cached: true })
        this._showHome(session)
        return
      } catch (e) {
        if (e.status === 401) {
          forgetUser(this.storage, user.id)
        } else {
          probe.error('login', e)
          this.$fatal('Accesso non riuscito', e.message)
          return
        }
      }
    }

    try {
      const auth = await this.client.authenticateByName(user.name, '')
      this.client = createClient({ server: this.client.base, deviceId: this.deviceId, token: auth.token })
      this.$loggedIn(auth)
    } catch (e) {
      if (e.status === 401) {
        this._show(QuickConnectView, { client: this.client, user }, 'quickconnect')
      } else {
        probe.error('login', e)
        this.$fatal('Accesso non riuscito', e.message)
      }
    }
  }

  $loggedIn(auth) {
    this._stack = []
    saveUser(this.storage, auth)
    const session = { server: this.client.base, ...auth }
    probe.event('login', { user: auth.userName, cached: false })
    this._showHome(session)
  }

  $fatal(title, message) {
    probe.error('fatal', `${title}: ${message}`)
    this._show(MessageView, { title, message }, 'message')
    probe.view('message', { title, message })
  }

  // Back that no screen handled (home, profiles, messages) asks to leave the app. It must never reach the SDK
  // Application: that would destroy Lightning but leave the webOS window open on an empty screen.
  _handleBack() {
    if (this._stack && this._stack.length > 0) {
      this.$back()
      return
    }
    this.$askExit()
  }

  $askExit() {
    if (this.tag('Dialog.Exit')) return
    this.tag('Dialog').patch({ Exit: { type: ExitDialog } })
    probe.data('dialog', 'exit')
    this._refocus()
  }

  $exitFocus(button) {
    probe.focus({ dialog: 'exit', label: button })
  }

  $exitCancelled() {
    this.tag('Dialog').patch({ Exit: undefined })
    probe.data('dialog', null)
    probe.event('exit_cancelled')
    this._refocus()
  }

  // window.close() really ends the webOS app (webOS.platformBack() would only send it to the background).
  $exitConfirmed() {
    probe.event('exit')
    window.close()
  }

  $openProfileMenu() {
    if (this.tag('Dialog.ProfileMenu')) return
    this.tag('Dialog').patch({
      ProfileMenu: {
        type: ProfileMenu,
        userName: this.session && this.session.userName,
        hasAvatarPicker: this._hasGetAvatar !== false,
      },
    })
    probe.data('dialog', 'profile')
    this._refocus()
  }

  $closeProfileMenu() {
    this.tag('Dialog').patch({ ProfileMenu: undefined })
    probe.data('dialog', null)
    this._refocus()
  }

  async $openAvatarPicker(user) {
    this.tag('Dialog').patch({ ProfileMenu: undefined })
    probe.data('dialog', null)
    if (!this._cachedAvatars) {
      this._cachedAvatars = await this.client.avatars().catch(() => null)
    }
    const targetUser = user || (this.session && {
      id: this.session.userId,
      name: this.session.userName,
      imageTag: this.session.imageTag,
    })
    this._push(AvatarPickerView, {
      client: this.client,
      user: targetUser,
      avatars: this._cachedAvatars,
    }, 'avatars')
  }

  async $manageProfile(user) {
    const savedUsers = loadUsers(this.storage)
    let userClient = this.client
    const saved = savedUsers[user.id]
    if (saved && saved.token) {
      userClient = createClient({ server: this.client.base, deviceId: this.deviceId, token: saved.token })
    } else {
      try {
        const auth = await this.client.authenticateByName(user.name, '')
        saveUser(this.storage, auth)
        userClient = createClient({ server: this.client.base, deviceId: this.deviceId, token: auth.token })
      } catch (e) {
        // Never fall back to the current client: the icon would be applied to the wrong profile.
        probe.event('manage_profile_error', { user: user.name, status: e.status || 0 })
        return
      }
    }
    if (!this._cachedAvatars) {
      // The profiles screen may have no logged-in client: ask with the profile's own token.
      this._cachedAvatars = await userClient.avatars().catch(() => null)
    }
    this._push(AvatarPickerView, {
      client: userClient,
      user,
      avatars: this._cachedAvatars,
    }, 'avatars')
  }

  $userUpdated(me) {
    const updated = mapUser(me)
    const savedUsers = loadUsers(this.storage)
    if (savedUsers[updated.id]) {
      saveUser(this.storage, { ...savedUsers[updated.id], imageTag: updated.imageTag })
    }
    if (this.session && this.session.userId === updated.id) {
      this.session.imageTag = updated.imageTag
    }
  }

  async $switchProfile() {
    this.tag('Dialog').patch({ ProfileMenu: undefined })
    probe.data('dialog', null)
    await this.$showProfiles()
  }

  async $disconnect() {
    this.tag('Dialog').patch({ ProfileMenu: undefined })
    probe.data('dialog', null)
    const savedUsers = loadUsers(this.storage)
    const tokens = Object.values(savedUsers).map(u => u.token).filter(Boolean)
    await Promise.all(
      tokens.map(token => {
        const client = createClient({ server: this.client.base, deviceId: this.deviceId, token })
        return client.logout().catch(() => {})
      })
    )
    clearAll(this.storage)
    this.$showServer()
  }

  _getFocused() {
    return this.tag('Dialog.Exit') || this.tag('Dialog.ProfileMenu') || this.tag('Views.View')
  }
}
