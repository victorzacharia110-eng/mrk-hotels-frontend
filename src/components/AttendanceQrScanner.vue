<!--
  Attendance QR scanner modal. Starts the rear camera, decodes the rotating
  office clock-in QR with jsQR and emits the scanned token. Used at clock-in
  when the hotel requires the entrance QR as physical-presence proof.
-->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal scanner-modal">
      <div class="modal-head">
        <h2><i class="fas fa-qrcode"></i> {{ $t('attendance.qrRequired') }}</h2>
        <button class="modal-close" @click="$emit('close')"><i class="fas fa-xmark"></i></button>
      </div>

      <p class="muted">{{ $t('attendance.qrInstruction') }}</p>

      <div class="scanner-frame">
        <video ref="videoEl" autoplay playsinline muted></video>
        <canvas ref="canvasEl" class="scanner-canvas"></canvas>
        <div v-if="scanning && !error" class="scanner-status">
          <i class="fas fa-spinner fa-spin"></i> {{ $t('attendance.scanning') }}
        </div>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" @click="$emit('close')">
          {{ $t('attendance.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import jsQR from 'jsqr'

const { t } = useI18n()

const emit = defineEmits(['scanned', 'close'])

const videoEl = ref(null)
const canvasEl = ref(null)
const scanning = ref(true)
const error = ref('')

let stream = null
let raf = 0
let opening = false
let openingPromise = null
let openCancelled = false

function stop() {
  cancelAnimationFrame(raf)
  openCancelled = true
  if (stream) {
    stream.getTracks().forEach((tr) => tr.stop())
    stream = null
  }
}

async function start() {
  try {
    opening = true
    openCancelled = false
    openingPromise = navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: 'environment' } })
      .then((s) => {
        // If the start was cancelled while the permission prompt was shown,
        // stop the newly-acquired tracks immediately and bail out.
        if (openCancelled) {
          s.getTracks().forEach((tr) => tr.stop())
          return null
        }
        stream = s
        return s
      })
    const s = await openingPromise
    opening = false
    openingPromise = null
    if (!s) return
    if (!videoEl.value) return
    videoEl.value.srcObject = stream
    await videoEl.value.play().catch(() => { })
    tick()
  } catch {
    scanning.value = false
    error.value = t('attendance.cameraDenied')
  } finally {
    opening = false
    openingPromise = null
  }
}

function tick() {
  if (!canvasEl.value || !videoEl.value) return
  const canvas = canvasEl.value
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { videoWidth: vw, videoHeight: vh } = videoEl.value
  if (vw && vh) {
    canvas.width = vw
    canvas.height = vh
    ctx.drawImage(videoEl.value, 0, 0, vw, vh)
    const frame = ctx.getImageData(0, 0, vw, vh)
    const code = jsQR(frame.data, vw, vh, { inversionAttempts: 'dontInvert' })
    if (code?.data) {
      scanning.value = false
      emit('scanned', code.data)
      return
    }
  }
  raf = requestAnimationFrame(tick)
}

onMounted(start)
onUnmounted(stop)
</script>

<style scoped>
.scanner-modal {
  max-width: 460px;
}

.scanner-frame {
  position: relative;
  margin: 14px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #0f172a;
  aspect-ratio: 1 / 1;
}

.scanner-frame video,
.scanner-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-canvas {
  display: none;
}

.scanner-status {
  position: absolute;
  inset: auto 0 0;
  padding: 8px;
  text-align: center;
  background: rgba(15, 23, 42, 0.7);
  color: #e2e8f0;
  font-size: 13px;
}
</style>
