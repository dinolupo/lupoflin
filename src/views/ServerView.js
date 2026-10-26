import { Lightning, Utils } from '@lightningjs/sdk'
import Keyboard from '../components/Keyboard.js'
import { createClient, normalizeServerUrl } from '../lib/jellyfin.js'
import { probe } from '../lib/probe.js'
import { saveServer } from '../lib/session.js'
import { colors, font } from '../theme.js'

export default class ServerView extends Lightning.Component {
  static _template() {
    return {
      rect: true,
      w: 1920,
      h: 1080,
      color: colors.background,
      Brand: {
        x: 960,
        y: 50,
        mountX: 0.5,
        w: 220,
        h: 90,
        src: Utils.asset('images/logo-header.png'),
      },
      Title: {
        x: 960,
        y: 165,
        mountX: 0.5,
        text: {
          text: 'Collega il tuo server Jellyfin',
          fontFace: font,
          fontSize: 38,
          textColor: colors.text,
        },
      },
      AddressBox: {
        x: 960,
        y: 235,
        mountX: 0.5,
        w: 908,
        h: 64,
        rect: true,
        color: 0xff222222,
        shader: { type: Lightning.shaders.RoundedRectangle, radius: 8 },
        Value: {
          x: 24,
          y: 34,
          mountY: 0.5,
          text: {
            text: 'http://',
            fontFace: font,
            fontSize: 28,
            textColor: colors.text,
          },
        },
      },
      Keyboard: {
        x: 960,
        y: 325,
        mountX: 0.5,
        type: Keyboard,
        initialText: 'http://',
      },
      Status: {
        x: 960,
        y: 725,
        mountX: 0.5,
        text: {
          text: '',
          fontFace: font,
          fontSize: 24,
          textColor: colors.error,
        },
      },
    }
  }

  _init() {
    this._text = this.text || 'http://'
    this.tag('AddressBox.Value').text.text = this._text
    this.tag('Keyboard').setValue(this._text)
    probe.view('server', { text: this._text })
    probe.data('text', this._text)
  }

  $keyboardInput(text) {
    this._text = text
    this.tag('AddressBox.Value').text.text = text
    probe.data('text', text)
  }

  async $keyboardSubmit(text) {
    if (this._submitting) return
    this._submitting = true
    const url = normalizeServerUrl(text)
    if (!url || url === 'http:' || url === 'https:') {
      this._submitting = false
      this._setStatus("Server non raggiungibile: controlla l'indirizzo")
      probe.event('server_error', { text })
      return
    }
    this._setStatus('')
    const client = createClient({ server: url, deviceId: this.deviceId })
    try {
      const info = await client.publicInfo()
      saveServer(this.storage, url)
      probe.event('server_saved', { name: info.ServerName })
      this._submitting = false
      this.fireAncestors('$serverSaved', { client, url })
    } catch (e) {
      this._submitting = false
      this._setStatus("Server non raggiungibile: controlla l'indirizzo")
      probe.event('server_error', { text, error: e.message })
    }
  }

  _setStatus(msg) {
    this.tag('Status').text.text = msg
  }

  _handleBack() {
    this.fireAncestors('$askExit')
    return true
  }

  _getFocused() {
    return this.tag('Keyboard')
  }
}
