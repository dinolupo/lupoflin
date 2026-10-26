import { Lightning } from '@lightningjs/sdk'
import { probe } from '../lib/probe.js'
import { colors, font } from '../theme.js'

const POLL_MS = 3000
const MAX_POLLS = 100 // 5 minutes

// Login without a keyboard: show a Quick Connect code, the user approves it from a logged-in device.
// Props: client, user. Calls on the ancestors: $loggedIn(auth), $showProfiles(), $fatal(title, message).
export default class QuickConnectView extends Lightning.Component {
  static _template() {
    return {
      Title: { x: 960, y: 220, mountX: 0.5, text: { text: '', fontFace: font, fontSize: 56, textColor: colors.text } },
      Help: {
        x: 960,
        y: 330,
        mountX: 0.5,
        text: {
          text: 'Da un dispositivo già collegato: Jellyfin → Impostazioni → Quick Connect, poi inserisci il codice',
          fontFace: font,
          fontSize: 30,
          textColor: colors.textDim,
          wordWrapWidth: 1400,
          textAlign: 'center',
        },
      },
      Code: { x: 960, y: 460, mountX: 0.5, text: { text: '……', fontFace: font, fontSize: 140, textColor: colors.brand, letterSpacing: 24 } },
      Status: { x: 960, y: 700, mountX: 0.5, text: { text: 'Richiesta del codice…', fontFace: font, fontSize: 28, textColor: colors.textDim } },
    }
  }

  _init() {
    this.tag('Title').text.text = `Accedi come ${this.user.name}`
    probe.view('quickconnect', { user: this.user.name })
    this._start()
  }

  async _start() {
    try {
      if (!(await this.client.quickConnectEnabled())) {
        this.fireAncestors('$fatal', 'Quick Connect disattivato', 'Attivalo nel pannello di controllo di Jellyfin.')
        return
      }
      const { code, secret } = await this.client.quickConnectInitiate()
      this.tag('Code').text.text = code
      this.tag('Status').text.text = 'In attesa di approvazione…'
      probe.data('code', code)
      this._poll(secret, 0)
    } catch (e) {
      probe.error('quickconnect', e)
      this.fireAncestors('$fatal', 'Server non raggiungibile', e.message)
    }
  }

  _poll(secret, count) {
    if (count >= MAX_POLLS) {
      this.tag('Status').text.text = 'Codice scaduto: premi Indietro e riprova'
      return
    }
    this._timer = setTimeout(async () => {
      if (!this.attached) return
      try {
        if (await this.client.quickConnectAuthorized(secret)) {
          const auth = await this.client.authenticateWithQuickConnect(secret)
          this.fireAncestors('$loggedIn', auth)
        } else {
          this._poll(secret, count + 1)
        }
      } catch (e) {
        probe.error('quickconnect', e)
        this.tag('Status').text.text = `Errore: ${e.message}`
      }
    }, POLL_MS)
  }

  _detach() {
    clearTimeout(this._timer)
  }

  _handleBack() {
    this.fireAncestors('$showProfiles')
  }
}
