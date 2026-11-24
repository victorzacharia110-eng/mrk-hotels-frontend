<template>
  <canvas ref="canvasEl" class="mrk-hero-canvas" aria-hidden="true"></canvas>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvasEl = ref(null)
let context = null
let frame = 0
let running = false
let lastDraw = 0
let width = 0
let height = 0

function resize() {
  const canvas = canvasEl.value
  if (!canvas || !context) return
  const rect = canvas.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  width = Math.max(rect.width, 1)
  height = Math.max(rect.height, 1)
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function polygon(points, fill, stroke) {
  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i += 1) context.lineTo(points[i][0], points[i][1])
  context.closePath()
  context.fillStyle = fill
  context.fill()
  if (stroke) {
    context.strokeStyle = stroke
    context.lineWidth = 1
    context.stroke()
  }
}

function project(x, y, z, cx, cy, scale, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const rx = x * cos - y * sin
  const ry = x * sin + y * cos
  return [cx + (rx - ry) * scale, cy + (rx + ry) * scale * 0.52 - z * scale]
}

function drawWindows(cx, cy, w, depth, h, scale, angle, color) {
  const p = (x, y, z) => project(x, y, z, cx, cy, scale, angle)
  context.strokeStyle = color
  context.lineWidth = Math.max(0.7, scale * 0.012)
  for (let z = 0.75; z < h - 0.2; z += 0.7) {
    for (let offset = -w / 2 + 0.35; offset < w / 2 - 0.1; offset += 0.55) {
      const a = p(offset, -depth / 2 - 0.01, z)
      const b = p(offset + 0.24, -depth / 2 - 0.01, z)
      context.beginPath()
      context.moveTo(a[0], a[1])
      context.lineTo(b[0], b[1])
      context.stroke()
    }
    for (let offset = -depth / 2 + 0.3; offset < depth / 2 - 0.1; offset += 0.55) {
      const a = p(w / 2 + 0.01, offset, z)
      const b = p(w / 2 + 0.01, offset + 0.24, z)
      context.beginPath()
      context.moveTo(a[0], a[1])
      context.lineTo(b[0], b[1])
      context.stroke()
    }
  }
}

function drawTower(cx, cy, w, depth, h, scale, angle, colors) {
  const p = (x, y, z) => project(x, y, z, cx, cy, scale, angle)
  const baseA = p(-w / 2, -depth / 2, 0)
  const baseB = p(w / 2, -depth / 2, 0)
  const baseC = p(w / 2, depth / 2, 0)
  const topA = p(-w / 2, -depth / 2, h)
  const topB = p(w / 2, -depth / 2, h)
  const topC = p(w / 2, depth / 2, h)
  const topD = p(-w / 2, depth / 2, h)

  polygon([baseA, baseB, topB, topA], colors.faceA, colors.edge)
  polygon([baseB, baseC, topC, topB], colors.faceB, colors.edge)
  polygon([topA, topB, topC, topD], colors.top, colors.edge)
  drawWindows(cx, cy, w, depth, h, scale, angle, colors.window)
}

function palette() {
  const dark = document.documentElement?.dataset?.theme === 'dark'
  if (dark) {
    return {
      faceA: 'rgba(32, 84, 139, 0.62)',
      faceB: 'rgba(18, 118, 116, 0.5)',
      top: 'rgba(107, 165, 224, 0.34)',
      edge: 'rgba(173, 213, 255, 0.38)',
      window: 'rgba(201, 232, 255, 0.46)',
      shadow: 'rgba(0, 12, 30, 0.5)',
      glow: 'rgba(53, 146, 255, 0.12)',
    }
  }
  return {
    faceA: 'rgba(28, 76, 126, 0.4)',
    faceB: 'rgba(24, 138, 130, 0.32)',
    top: 'rgba(92, 154, 214, 0.28)',
    edge: 'rgba(25, 74, 120, 0.32)',
    window: 'rgba(255, 255, 255, 0.62)',
    shadow: 'rgba(16, 55, 96, 0.16)',
    glow: 'rgba(45, 212, 191, 0.1)',
  }
}

function render(time) {
  if (!context) return
  context.clearRect(0, 0, width, height)
  const colors = palette()
  const cx = width * 0.74
  const cy = height * 0.55
  const scale = Math.min(width / 11, height / 6.5)
  const angle = Math.sin(time * 0.00016) * 0.09

  const glow = context.createRadialGradient(cx, cy - scale, 0, cx, cy - scale, scale * 4.6)
  glow.addColorStop(0, colors.glow)
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)

  context.save()
  context.globalAlpha = 0.75
  context.fillStyle = colors.shadow
  context.beginPath()
  context.ellipse(cx, cy + scale * 0.8, scale * 3.7, scale * 0.85, 0, 0, Math.PI * 2)
  context.fill()
  context.restore()

  drawTower(cx - scale * 1.4, cy + scale * 0.5, 1.6, 2.2, 2.7, scale, angle, colors)
  drawTower(cx + scale * 0.35, cy, 2.2, 2, 4.3, scale, angle, colors)
}

function draw(time) {
  if (!running) return
  frame = requestAnimationFrame(draw)
  if (time - lastDraw < 32) return
  lastDraw = time
  render(time)
}

function start() {
  if (running || !context) return
  running = true
  lastDraw = 0
  frame = requestAnimationFrame(draw)
}

function stop() {
  running = false
  cancelAnimationFrame(frame)
}

function handleVisibility() {
  if (document.hidden) stop()
  else start()
}

onMounted(() => {
  context = canvasEl.value?.getContext('2d') || null
  if (!context) return
  resize()
  window.addEventListener('resize', resize, { passive: true })
  document.addEventListener('visibilitychange', handleVisibility)
  start()
})

onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<style scoped>
.mrk-hero-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  opacity: 0.62;
}

:global(html[data-theme='dark']) .mrk-hero-canvas {
  opacity: 0.82;
}
</style>
