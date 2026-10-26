import { Lightning } from '@lightningjs/sdk'
import Tile from '../components/Tile.js'
import { probe } from '../lib/probe.js'
import { colors, font, layout } from '../theme.js'

// "Who's watching?": the public users of the server as square profile tiles. Props: users, client, lastUserId, hasGetAvatar.
// Calls on the ancestors: $profileSelected(user), $manageProfile(user), $askExit().
export default class ProfilesView extends Lightning.Component {
  static _template() {
    return {
      Title: { x: 960, y: 240, mountX: 0.5, text: { text: 'Chi vuole guardare?', fontFace: font, fontSize: 64, textColor: colors.text } },
      Profiles: { y: 390, forceZIndexContext: true },
      ManageButton: {
        x: 960,
        y: 720,
        mountX: 0.5,
        w: 240,
        h: 56,
        rect: true,
        color: 0x22ffffff,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
        visible: false,
        Label: {
          x: 120,
          y: 28,
          mount: 0.5,
          text: { text: 'Gestisci profili', fontFace: font, fontSize: 24, textColor: colors.textDim },
        },
      },
    }
  }

  _init() {
    const { w, h } = layout.profile
    const gap = 60
    const users = this.users || []
    let initialIndex = 0
    if (this.lastUserId) {
      const idx = users.findIndex(u => u.id === this.lastUserId)
      if (idx >= 0) initialIndex = idx
    }
    this._index = initialIndex
    this._managing = false
    this._focusArea = 'profiles'

    if (this.hasGetAvatar) {
      this.tag('ManageButton').visible = true
    }

    const total = users.length * w + Math.max(0, users.length - 1) * gap
    this.tag('Profiles').patch({ x: (1920 - total) / 2 })
    this.tag('Profiles').children = users.map((user, i) => ({
      type: Tile,
      x: i * (w + gap),
      w,
      h,
      radius: 12,
      centerLabel: true,
      showLabel: true,
      label: user.name,
      imageUrl: user.imageTag ? this.client.userImageUrl(user.id, user.imageTag) : null,
      hasAlpha: true,
      Badge: {
        x: w / 2,
        y: h / 2,
        mount: 0.5,
        w: 56,
        h: 56,
        rect: true,
        color: 0xcc000000,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 28 },
        visible: false,
        Icon: {
          x: 28,
          y: 28,
          mount: 0.5,
          text: { text: '✏', fontFace: font, fontSize: 28, textColor: colors.text },
        },
      },
    }))
    probe.view('profiles', { profiles: users.map(u => u.name) })
    this._publishFocus()
  }

  _publishFocus() {
    if (this._focusArea === 'button') {
      probe.focus({ area: 'button', label: this._managing ? 'Fine' : 'Gestisci profili' })
      return
    }
    const user = this.users && this.users[this._index]
    probe.focus({ index: this._index, label: user ? user.name : null, managing: this._managing })
  }

  _paintButton() {
    const btn = this.tag('ManageButton')
    if (!btn || !btn.visible) return
    const focused = this._focusArea === 'button'
    btn.color = focused ? colors.focus : 0x22ffffff
    btn.tag('Label').text.textColor = focused ? colors.background : colors.textDim
    btn.tag('Label').text.text = this._managing ? 'Fine' : 'Gestisci profili'
  }

  _move(delta) {
    const next = this._index + delta
    if (next < 0 || next >= (this.users || []).length) return
    this._index = next
    this._publishFocus()
    this._refocus()
  }

  _handleLeft() {
    if (this._focusArea === 'profiles') this._move(-1)
    return true
  }

  _handleRight() {
    if (this._focusArea === 'profiles') this._move(1)
    return true
  }

  _handleDown() {
    if (this._focusArea === 'profiles' && this.tag('ManageButton').visible) {
      this._focusArea = 'button'
      this._paintButton()
      this._publishFocus()
      this._refocus()
      return true
    }
    return true
  }

  _handleUp() {
    if (this._focusArea === 'button') {
      this._focusArea = 'profiles'
      this._paintButton()
      this._publishFocus()
      this._refocus()
      return true
    }
    return true
  }

  _handleEnter() {
    if (this._focusArea === 'button') {
      this._managing = !this._managing
      this.tag('Profiles').children.forEach(tile => {
        if (tile.tag('Badge')) tile.tag('Badge').visible = this._managing
      })
      this._paintButton()
      this._publishFocus()
      return true
    }
    const user = this.users && this.users[this._index]
    if (user) {
      if (this._managing) {
        this.fireAncestors('$manageProfile', user)
      } else {
        this.fireAncestors('$profileSelected', user)
      }
    }
    return true
  }

  _handleBack() {
    if (this._managing) {
      this._managing = false
      this.tag('Profiles').children.forEach(tile => {
        if (tile.tag('Badge')) tile.tag('Badge').visible = false
      })
      this._paintButton()
      this._publishFocus()
      return true
    }
    this.fireAncestors('$askExit')
    return true
  }

  _getFocused() {
    if (this._focusArea === 'button') {
      return undefined
    }
    return this.tag('Profiles').children[this._index]
  }
}
