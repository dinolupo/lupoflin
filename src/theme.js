// Netflix-like palette and sizes. Change values here, not inside components.
// Public brand: LupoFlin, amber. A private build (scripts/package.mjs --private) overrides name and brand
// colours through config.brand, applied by applyBrand() at boot before the first screen.
export const brand = { name: 'LupoFlin' }

export const colors = {
  background: 0xff141414,
  text: 0xffffffff,
  textDim: 0xffb3b3b3,
  brand: 0xfff59f15,
  focus: 0xffffffff,
  tile: 0xff2a2a2a,
  progressTrack: 0xff555555,
  progressTrackBright: 0xff777777,
  brandBright: 0xffffc040,
  error: 0xffff5555,
}

// config.brand: { name, color: '#rrggbb', colorBright: '#rrggbb' }, every field optional.
export function applyBrand(config) {
  if (!config) return
  const argb = hex => 0xff000000 + parseInt(hex.replace('#', ''), 16)
  if (config.name) brand.name = config.name
  if (config.color) colors.brand = argb(config.color)
  if (config.colorBright) colors.brandBright = argb(config.colorBright)
}

export const font = 'Regular'

export const layout = {
  sideMargin: 80,
  rowGap: 40,
  tileGap: 16,
  poster: { w: 220, h: 330 },
  wide: { w: 400, h: 225 },
  profile: { w: 200, h: 200 },
  billboard: { h: 560 },
  grid: {
    columns: 7,
    rowHeight: 400,
  },
}
