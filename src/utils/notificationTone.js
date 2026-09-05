/**
 * In-app sound + vibration for alerts (e.g. "order item ready").
 *
 * Ringtones are static WAV files under /public/audio, served at /audio/*.wav.
 * Browser autoplay policy: sound needs a user gesture on the tab at least
 * once; vibration (navigator.vibrate) needs no permission.
 */

export const READY_SOUNDS = [
  { id: 'hotel-bell', file: '/audio/ready-1.wav' },
  { id: 'triple-chime', file: '/audio/ready-2.wav' },
  { id: 'double-ping', file: '/audio/ready-3.wav' },
]

const READY_SOUNDS_BY_ID = new Map(READY_SOUNDS.map((s) => [s.id, s]))

const DEFAULTS = Object.freeze({
  enabled: true,
  sound: 'hotel-bell',
  vibration: true,
})

const audioCache = new Map()

function resolveFile(soundId) {
  return READY_SOUNDS_BY_ID.get(soundId)?.file ?? READY_SOUNDS[0].file
}

function getAudio(file) {
  let el = audioCache.get(file)
  if (!el) {
    el = new Audio(file)
    el.preload = 'auto'
    audioCache.set(file, el)
  }
  return el
}

/**
 * Unlocks audio playback for the tab. Call once: browsers refuse to start an
 * <audio> element without a prior user gesture, so we play the default tone
 * silently on the first tap/keypress anywhere.
 */
export function primeNotificationAudio() {
  if (typeof window === 'undefined') return
  const unlock = () => {
    const el = getAudio(resolveFile(DEFAULTS.sound))
    try {
      el.volume = 0
      const p = el.play()
      if (p) {
        p.then(() => {
          el.pause()
          el.currentTime = 0
          el.volume = 1
        }).catch(() => {})
      }
    } catch {
      /* Ignore — gesture still registered for later plays. */
    }
  }
  window.addEventListener('pointerdown', unlock, { once: true, passive: true })
  window.addEventListener('keydown', unlock, { once: true, passive: true })
  window.addEventListener('touchstart', unlock, { once: true, passive: true })
}

/**
 * Plays the selected ringtone and (optionally) vibrates.
 * @param {object} [options]
 * @param {string} [options.sound]  One of READY_SOUNDS ids.
 * @param {boolean} [options.vibration]
 */
export function playReadyTone({ sound = DEFAULTS.sound, vibration = DEFAULTS.vibration } = {}) {
  const el = getAudio(resolveFile(sound))
  try {
    el.volume = 1
    el.currentTime = 0
    const p = el.play()
    if (p) p.catch(() => {})
  } catch {
    /* Ignore blocked playback. */
  }
  if (vibration && navigator.vibrate) {
    try {
      navigator.vibrate([340, 160, 340, 160, 680])
    } catch {
      /* Ignore unsupported vibration. */
    }
  }
}

/**
 * Merges persisted/local settings with defaults and returns the tune params.
 */
export function normalizeAlertSettings(raw) {
  return {
    enabled: raw?.enabled !== false,
    sound: READY_SOUNDS_BY_ID.has(raw?.sound) ? raw.sound : DEFAULTS.sound,
    vibration: raw?.vibration !== false,
  }
}

export { DEFAULTS }