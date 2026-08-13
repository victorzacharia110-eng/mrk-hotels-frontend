<!--
  Clock-in selfie capture modal. Starts the front camera, shows a live preview
  and captures a JPEG frame when the staff member confirms. Emits the captured
  File so clock-in can attach it as the photo proof-of-presence. This is what
  makes an impersonated clock-in visible: the photo shows who actually held
  the phone.
-->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal scanner-modal">
      <div class="modal-head">
        <h2><i class="fas fa-user"></i> {{ $t('attendance.selfieTitle') }}</h2>
        <button class="modal-close" @click="$emit('close')"><i class="fas fa-xmark"></i></button>
      </div>

      <p class="muted">{{ $t('attendance.selfieInstruction') }}</p>

      <div class="selfie-frame">
        <video ref="videoEl" autoplay playsinline muted></video>
        <img v-if="captured" :src="previewUrl" alt="selfie" class="selfie-preview" />
        <div v-if="error" class="alert alert-error">{{ error }}</div>
      </div>

      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" @click="retake">
          <i class="fas fa-rotate-left"></i> {{ $t('attendance.retake') }}
        </button>
        <button v-if="captured" type="button" class="btn btn-primary" @click="confirm">
          <i class="fas fa-check"></i> {{ $t('attendance.usePhoto') }}
        </button>
        <button v-else type="button" class="btn btn-primary" @click="capture">
          <i class="fas fa-camera"></i> {{ $t('attendance.takePhoto') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits(['captured', 'close'])

const videoEl = ref(null)
const captured = ref(false)
const previewUrl = ref('')
const error = ref('')

let stream = null
let opening = false
let openingPromise = null
let openCancelled = false

function stop() {
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
      .getUserMedia({ audio: false, video: { facingMode: 'user' } })
      .then((s) => {
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
    if (videoEl.value) {
      videoEl.value.srcObject = stream
      await videoEl.value.play().catch(() => { })
    }
  } catch {
    error.value = t('attendance.cameraDenied')
  }
}

/** Grabs a single JPEG frame from the live preview into a File. */
function capture() {
  const video = videoEl.value
  if (!video || !video.videoWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      // keep the live preview running underneath; just overlay the captured image
      captured.value = true
      previewUrl.value = URL.createObjectURL(blob)
      photoFile.value = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
    },
    'image/jpeg',
    0.85
  )
}

const photoFile = ref(null)

function retake() {
  captured.value = false
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function confirm() {
  if (photoFile.value) emit('captured', photoFile.value)
  retake()
  emit('close')
}

onMounted(start)
onUnmounted(() => {
  // cancel any pending permission prompt and stop the camera
  stop()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped>
.scanner-modal {
  max-width: 420px;
}

.selfie-frame {
  position: relative;
  margin: 14px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #0f172a;
  aspect-ratio: 3 / 4;
}

.selfie-frame video,
.selfie-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.selfie-preview {
  transform: scaleX(-1);
}
</style>
