/**
 * Applies the hotel logo's dominant/accent colour to the stayview board
 * via CSS custom properties. Runs client-side from the logo the auth store
 * already holds; falls back to the default blue when there is no logo
 * (or when canvas reads are blocked, e.g. tainted cross-origin images).
 */
function logoAccent(logoUrl, store) {
  const root = document.documentElement
  const clear = () => {
    root.style.setProperty('--sv-accent', '')
    root.style.setProperty('--sv-accent-soft', '')
  }
  if (!logoUrl || !window?.Image || !document.createElement('canvas')) { clear(); return }
  const img = new window.Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const c = document.createElement('canvas')
      const size = 160
      c.width = size
      c.height = size
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)
      const buckets = new Map()
      const step = 7
      for (let p = 0; p < data.length; p += 4) {
        const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3]
        if (a < 125) continue
        if (r > 248 && g > 248 && b > 248) continue
        const key = (Math.round(r / step) * step) + ',' + (Math.round(g / step) * step) + ',' + (Math.round(b / step) * step)
        buckets.set(key, (buckets.get(key) || 0) + 1)
      }
      let best = null
      for (const [k, n] of buckets) {
        if (!best || n > best.n) best = { k, n }
      }
      if (!best) { clear(); return }
      const [r, g, b] = best.k.split(',').map(Number)
      const accent = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
      const soft = 'rgba(' + r + ', ' + g + ', ' + b + ', 0.12)'
      root.style.setProperty('--sv-accent', accent)
      root.style.setProperty('--sv-accent-soft', soft)
    } catch (e) {
      clear()
    }
  }
  img.onerror = clear
  img.src = logoUrl
}

export { logoAccent }
