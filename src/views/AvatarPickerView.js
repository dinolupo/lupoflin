import { Img, Lightning } from '@lightningjs/sdk'
import CategoryTabs from '../components/CategoryTabs.js'
import ConfirmDialog from '../components/ConfirmDialog.js'
import Tile from '../components/Tile.js'
import { groupByCategory, visibleWindow } from '../lib/avatarGrid.js'
import { probe } from '../lib/probe.js'
import { colors, font } from '../theme.js'

export default class AvatarPickerView extends Lightning.Component {
  static _template() {
    return {
      Header: {
        x: 90,
        y: 40,
        Avatar: {
          w: 70,
          h: 70,
          rect: true,
          color: colors.tile,
          shader: { type: Lightning.shaders.RoundedRectangle, radius: 35 },
          clipping: true,
          Initial: {
            x: 35,
            y: 35,
            mount: 0.5,
            text: { text: '', fontFace: font, fontSize: 32, textColor: colors.textDim },
          },
          Image: { alpha: 0.001 },
        },
        Title: {
          x: 90,
          y: 35,
          mountY: 0.5,
          text: { text: '', fontFace: font, fontSize: 36, textColor: colors.text },
        },
      },
      Tabs: {
        type: CategoryTabs,
        x: 90,
        y: 140,
      },
      Grid: {
        x: 255,
        y: 220,
        w: 1420,
        h: 540,
        clipping: true,
        boundsMargin: [0, 0, 0, 180],
        Items: {
          boundsMargin: [0, 0, 0, 180],
        },
      },
      Dialog: {},
    }
  }

  async _init() {
    this._area = 'tabs'
    this._tabIndex = 0
    this._gridIndex = 0
    this._tileMap = new Map()

    const userName = this.user && this.user.name ? this.user.name : ''
    this.tag('Header.Title').text.text = `Scegli un'icona per ${userName}`

    const initial = (userName || '?').slice(0, 1).toUpperCase()
    this.tag('Header.Avatar.Initial').text.text = initial

    if (this.user && this.user.imageTag && this.client) {
      const imgUrl = this.client.userImageUrl(this.user.id, this.user.imageTag)
      const img = this.tag('Header.Avatar.Image')
      img.on('txLoaded', () => img.setSmooth('alpha', 1, { duration: 0.2 }))
      img.patch({ w: 70, h: 70, texture: { ...Img(imgUrl).cover(70, 70), hasAlpha: true } })
    }

    let list = this.avatars
    if (!list && this.client) {
      list = await this.client.avatars()
    }
    const rawList = list || []
    this._categories = groupByCategory(rawList)
    this._currentCategory = this._categories[0] || { name: 'Altre', items: [] }
    this._items = this._currentCategory.items || []

    this.tag('Tabs').categories = this._categories
    this._updateGrid()

    probe.view('avatars', {
      categories: this._categories.map(c => c.name),
      total: rawList.length,
    })
    probe.data('category', this._currentCategory.name)
    probe.focus({ area: 'tabs', index: 0, label: this._currentCategory.name })

    this._refocus()
  }

  $tabChanged(category, index) {
    this._tabIndex = index
    this._currentCategory = category
    this._items = category.items || []
    this._gridIndex = 0

    // Rebuild grid for the new category at index 0
    this.tag('Grid.Items').y = 0
    this._tileMap.clear()
    this.tag('Grid.Items').children = []
    this._updateGrid()

    probe.data('category', category.name)
    probe.focus({ area: 'tabs', index: this._tabIndex, label: category.name })
    this._refocus()
  }

  _updateGrid() {
    const total = this._items.length
    if (total === 0) {
      this._tileMap.clear()
      this.tag('Grid.Items').children = []
      return
    }

    const cols = 8
    const totalRows = Math.ceil(total / cols)
    const focusedRow = Math.floor(this._gridIndex / cols)
    const half = Math.floor((3 - 1) / 2) // 1

    let vStart = focusedRow - half
    let vEnd = vStart + 3 - 1
    if (vEnd >= totalRows) {
      vEnd = totalRows - 1
      vStart = Math.max(0, vEnd - 3 + 1)
    }
    if (vStart < 0) {
      vStart = 0
    }

    const targetY = -vStart * 180
    this.tag('Grid.Items').setSmooth('y', targetY, { duration: 0.2 })

    const win = visibleWindow({
      index: this._gridIndex,
      columns: cols,
      rowsVisible: 3,
      extraRows: 1,
      total,
    })

    const needed = new Set()
    for (let i = win.first; i <= win.last; i++) {
      needed.add(i)
    }

    const available = []
    for (const [idx, tile] of this._tileMap.entries()) {
      if (!needed.has(idx)) {
        this._tileMap.delete(idx)
        available.push(tile)
      }
    }

    for (const idx of needed) {
      if (this._tileMap.has(idx)) continue
      const item = this._items[idx]
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = col * 180
      const y = row * 180

      if (available.length > 0) {
        const tile = available.pop()
        tile.updateAvatar(item, x, y)
        this._tileMap.set(idx, tile)
      } else {
        const tile = this.stage.c({
          type: Tile,
          w: 150,
          h: 150,
          round: true,
          label: item.name,
          imageUrl: item.url,
          hasAlpha: true,
          x,
          y,
        })
        tile.item = item
        this.tag('Grid.Items').childList.add(tile)
        this._tileMap.set(idx, tile)
      }
    }

    while (available.length > 0) {
      const tile = available.pop()
      this.tag('Grid.Items').childList.remove(tile)
    }
  }

  _getFocused() {
    if (this.tag('Dialog.Confirm')) {
      return this.tag('Dialog.Confirm')
    }
    if (this._area === 'tabs') {
      return this.tag('Tabs')
    }
    return this._tileMap.get(this._gridIndex) || this
  }

  _handleUp() {
    if (this._area === 'tabs') {
      return true
    }
    if (this._gridIndex < 8) {
      this._area = 'tabs'
      this._refocus()
      probe.focus({ area: 'tabs', index: this._tabIndex, label: this._currentCategory.name })
      probe.data('category', this._currentCategory.name)
      return true
    }
    this._gridIndex -= 8
    this._updateGrid()
    this._refocus()
    const item = this._items[this._gridIndex]
    probe.focus({ area: 'grid', index: this._gridIndex, label: item ? item.name : '' })
    return true
  }

  _handleDown() {
    if (this._area === 'tabs') {
      if (this._items.length > 0) {
        this._area = 'grid'
        this._gridIndex = 0
        this._updateGrid()
        this._refocus()
        const item = this._items[this._gridIndex]
        probe.focus({ area: 'grid', index: this._gridIndex, label: item ? item.name : '' })
      }
      return true
    }
    if (this._gridIndex + 8 < this._items.length) {
      this._gridIndex += 8
      this._updateGrid()
      this._refocus()
      const item = this._items[this._gridIndex]
      probe.focus({ area: 'grid', index: this._gridIndex, label: item ? item.name : '' })
      return true
    }
    return true
  }

  _handleLeft() {
    if (this._area === 'tabs') return false
    if (this._gridIndex % 8 > 0) {
      this._gridIndex--
      this._updateGrid()
      this._refocus()
      const item = this._items[this._gridIndex]
      probe.focus({ area: 'grid', index: this._gridIndex, label: item ? item.name : '' })
      return true
    }
    return true
  }

  _handleRight() {
    if (this._area === 'tabs') return false
    if (this._gridIndex % 8 < 7 && this._gridIndex < this._items.length - 1) {
      this._gridIndex++
      this._updateGrid()
      this._refocus()
      const item = this._items[this._gridIndex]
      probe.focus({ area: 'grid', index: this._gridIndex, label: item ? item.name : '' })
      return true
    }
    return true
  }

  _handleEnter() {
    if (this._area === 'tabs') {
      if (this._items.length > 0) {
        this._area = 'grid'
        this._gridIndex = 0
        this._updateGrid()
        this._refocus()
        const item = this._items[this._gridIndex]
        probe.focus({ area: 'grid', index: this._gridIndex, label: item ? item.name : '' })
      }
      return true
    }
    if (this._area === 'grid') {
      const item = this._items[this._gridIndex]
      if (!item) return true
      const oldImageUrl =
        this.user && this.user.imageTag && this.client
          ? this.client.userImageUrl(this.user.id, this.user.imageTag)
          : null
      this.tag('Dialog').patch({
        Confirm: {
          type: ConfirmDialog,
          userName: this.user ? this.user.name : '',
          oldImageUrl,
          newImageUrl: item.url,
        },
      })
      this._refocus()
      return true
    }
    return false
  }

  $closeAvatarConfirm() {
    this.tag('Dialog').patch({ Confirm: undefined })
    probe.data('dialog', null)
    this._refocus()
    const item = this._items[this._gridIndex]
    probe.focus({ area: 'grid', index: this._gridIndex, label: item ? item.name : '' })
  }

  async $avatarConfirmed() {
    const item = this._items[this._gridIndex]
    if (!item) return
    try {
      await this.client.setAvatar(item.id)
      const me = await this.client.me()
      this.fireAncestors('$userUpdated', me)
      this.fireAncestors('$back')
    } catch (err) {
      if (this.tag('Dialog.Confirm')) {
        this.tag('Dialog.Confirm').setError('Icona non salvata')
      }
    }
  }

  _handleBack() {
    this.fireAncestors('$back')
    return true
  }
}
