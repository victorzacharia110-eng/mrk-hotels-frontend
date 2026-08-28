<!--
  HolidayDecor.vue
  Google-Doodle-style animated decorations that float, fall or rain over the
  brand logo while a holiday is active. Renders nothing on ordinary days.

  The parent must be positioned (position: relative) — the decor anchors
  itself to the top-left of that box. Mode comes from the holiday record:
    float    — emojis gently bobbing around the logo
    fall     — emojis drifting down (e.g. Christmas snow)
    confetti — confetti pieces raining over the logo
-->

<template>
  <span
    v-if="holiday"
    class="holiday-decor"
    :class="`mode-${holiday.mode}`"
    :title="holiday.name"
    aria-hidden="true"
  >
    <template v-if="isConfetti">
      <span
        v-for="i in 14"
        :key="'c' + i"
        class="confetti-piece"
        :style="confettiStyle()"
      ></span>
    </template>
    <template v-else>
      <span
        v-for="(emoji, i) in holiday.emojis"
        :key="i"
        class="holiday-emoji"
        :style="emojiStyle(holiday.mode, i)"
        >{{ emoji }}</span
      >
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  holiday: { type: Object, default: null },
})

const isConfetti = computed(() => props.holiday?.mode === 'confetti')

/** Randomised placement/animation for a floating or falling emoji. */
function emojiStyle(mode, index) {
  const fall = mode === 'fall'
  return {
    left: `${(index * 23 + Math.random() * 12) % 88}%`,
    top: fall ? `${-14 + Math.random() * 6}%` : `${Math.random() * 62}%`,
    fontSize: `${14 + Math.random() * 12}px`,
    '--dur': `${fall ? 6 + Math.random() * 4 : 2.5 + Math.random() * 2}s`,
    '--delay': `${Math.random() * -6}s`,
  }
}

/** Randomised placement/animation for a confetti piece. */
function confettiStyle() {
  const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#ffd700']
  return {
    left: `${Math.random() * 96}%`,
    top: `${-10 + Math.random() * 6}%`,
    background: colors[Math.floor(Math.random() * colors.length)],
    width: `${6 + Math.random() * 6}px`,
    height: `${6 + Math.random() * 6}px`,
    '--dur': `${3 + Math.random() * 3}s`,
    '--delay': `${Math.random() * -8}s`,
  }
}
</script>

<style scoped>
.holiday-decor {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
  overflow: visible;
}

.holiday-emoji,
.confetti-piece {
  position: absolute;
  line-height: 1;
  will-change: transform;
}

/* Gentle bobbing around the logo. */
.mode-float .holiday-emoji {
  animation: holi-float var(--dur, 3s) ease-in-out var(--delay, 0s) infinite;
}

/* Drifting down over the logo (snow / falling theme). */
.mode-fall .holiday-emoji {
  animation: holi-fall var(--dur, 8s) linear var(--delay, 0s) infinite;
}

/* Confetti raining over the logo. */
.mode-confetti .confetti-piece {
  border-radius: 2px;
  animation: holi-confetti var(--dur, 4s) linear var(--delay, 0s) infinite;
}

@keyframes holi-float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-9px) rotate(10deg);
  }
}

@keyframes holi-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(150px) rotate(220deg);
    opacity: 0;
  }
}

@keyframes holi-confetti {
  0% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate(12px, 150px) rotate(360deg);
    opacity: 0;
  }
}
</style>
