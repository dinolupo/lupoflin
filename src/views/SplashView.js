import { Lightning, Utils } from '@lightningjs/sdk'

// Full-screen brand logo while the app boots. The image is 1920 wide on purpose: the webOS UI plane
// is 1920x1080 even on 4K TVs, a bigger texture only costs GPU memory.
export default class SplashView extends Lightning.Component {
  static _template() {
    return {
      Logo: { w: 1920, h: 1080, src: Utils.asset('images/splash.jpg'), alpha: 0.001 },
    }
  }

  _init() {
    this.tag('Logo').setSmooth('alpha', 1, { duration: 0.6 })
  }
}
