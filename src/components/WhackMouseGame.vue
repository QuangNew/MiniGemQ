<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Pause, Play, RotateCcw, Sparkles, Volume2, VolumeX } from '@lucide/vue'
import RageMouse from './RageMouse.vue'
import { hitLines, missLines, rageLines, skillLines } from '../data/ragebait'
import { useRageAudio } from '../composables/useRageAudio'
import { playImportedSound } from '../composables/useImportedSound'

const props = defineProps({
  assets: {
    type: Object,
    default: () => ({}),
  },
})

const GAME_LENGTH_MS = 90_000
const ATTACK_COOLDOWN_MS = 1_000
const SKILL_COOLDOWN_MS = 500
const SPAWN_INTERVAL_MS = 10_000
const BAIT_INTERVAL_MS = 2_350
const DANGER_RADIUS_PX = 145
const MAX_MICE = 5

const arenaRef = ref(null)
const running = ref(false)
const paused = ref(false)
const ended = ref(false)
const mice = ref([])
const splats = ref([])
const notices = ref([])
const score = ref(0)
const hits = ref(0)
const misses = ref(0)
const combo = ref(0)
const dodges = ref(0)
const elapsedMs = ref(0)
const nowMs = ref(0)
const attackReadyAt = ref(0)
const pointer = ref({ x: 0, y: 0, inside: false, swinging: false })
const statusLine = ref('Chuột đang khởi động miệng.')

const { enabled: audioEnabled, toggleAudio, play } = useRageAudio()

let mouseId = 0
let splatId = 0
let noticeId = 0
let startedAt = 0
let pausedAt = 0
let rafId = 0
const timers = new Set()

const remainingSeconds = computed(() => {
  return Math.max(0, Math.ceil((GAME_LENGTH_MS - elapsedMs.value) / 1000))
})

const accuracy = computed(() => {
  const swings = hits.value + misses.value
  if (!swings) return 100
  return Math.round((hits.value / swings) * 100)
})

const cooldownLeftMs = computed(() => {
  return Math.max(0, attackReadyAt.value - nowMs.value)
})

const cooldownRatio = computed(() => {
  return Math.max(0, Math.min(1, cooldownLeftMs.value / ATTACK_COOLDOWN_MS))
})

const canSwing = computed(() => cooldownLeftMs.value <= 0)

const primaryAction = computed(() => {
  if (!running.value || ended.value) return 'Bắt đầu'
  if (paused.value) return 'Tiếp tục'
  return 'Tạm dừng'
})

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function managedTimeout(callback, delay) {
  const id = window.setTimeout(() => {
    timers.delete(id)
    callback()
  }, delay)
  timers.add(id)
  return id
}

function managedInterval(callback, delay) {
  const id = window.setInterval(callback, delay)
  timers.add(id)
  return id
}

function clearTimers() {
  timers.forEach((id) => {
    window.clearTimeout(id)
    window.clearInterval(id)
  })
  timers.clear()
}

function buildMouse() {
  const y = randomBetween(24, 83)
  return {
    id: ++mouseId,
    x: randomBetween(12, 88),
    y,
    size: randomBetween(78, 100),
    tilt: randomBetween(-8, 8),
    state: 'taunt',
    skill: '',
    near: false,
    bubble: y < 33 ? 'below' : 'above',
    bait: pick(rageLines),
    nextSkillAt: 0,
  }
}

function spawnMouse(amount = 1) {
  if (!running.value || paused.value) return

  const openSlots = Math.max(0, MAX_MICE - mice.value.length)
  const spawnCount = Math.min(amount, openSlots)
  if (!spawnCount) {
    statusLine.value = 'Bầy chuột đã kín màn hình.'
    return
  }

  const nextMice = Array.from({ length: spawnCount }, buildMouse)
  mice.value.push(...nextMice)
  pushNotice('Chuột mới')
  statusLine.value = pick(rageLines)
  play('bait', statusLine.value)
}

function pushNotice(label, x = randomBetween(18, 82), y = randomBetween(20, 78)) {
  const notice = { id: ++noticeId, label, x, y }
  notices.value.push(notice)
  managedTimeout(() => {
    notices.value = notices.value.filter((item) => item.id !== notice.id)
  }, 900)
}

function pushSplat(label, x, y, type = 'hit') {
  const splat = { id: ++splatId, label, x, y, type }
  splats.value.push(splat)
  managedTimeout(() => {
    splats.value = splats.value.filter((item) => item.id !== splat.id)
  }, 650)
}

function startGame() {
  clearTimers()
  cancelAnimationFrame(rafId)
  running.value = true
  paused.value = false
  ended.value = false
  score.value = 0
  hits.value = 0
  misses.value = 0
  combo.value = 0
  dodges.value = 0
  elapsedMs.value = 0
  attackReadyAt.value = 0
  mice.value = []
  splats.value = []
  notices.value = []
  statusLine.value = 'Chuột đã vào sân.'
  startedAt = performance.now()
  nowMs.value = startedAt

  spawnMouse(2)
  managedInterval(() => spawnMouse(Math.random() > 0.72 ? 2 : 1), SPAWN_INTERVAL_MS)
  managedInterval(tauntLoop, BAIT_INTERVAL_MS)
  tick()
}

function togglePrimaryAction() {
  if (!running.value || ended.value) {
    startGame()
    return
  }

  if (paused.value) {
    paused.value = false
    startedAt += performance.now() - pausedAt
    statusLine.value = 'Chuột quay lại cà khịa.'
    tick()
    return
  }

  paused.value = true
  pausedAt = performance.now()
  statusLine.value = 'Tạm dừng, chuột đang luyện mồm.'
  cancelAnimationFrame(rafId)
}

function resetGame() {
  startGame()
}

function endGame() {
  running.value = false
  paused.value = false
  ended.value = true
  clearTimers()
  cancelAnimationFrame(rafId)
  statusLine.value = score.value > 700 ? 'Tạm ổn, chuột bắt đầu tôn trọng bạn.' : 'Chuột đang cười khá lớn.'
}

function tick() {
  nowMs.value = performance.now()
  elapsedMs.value = nowMs.value - startedAt
  splats.value = splats.value.slice()

  if (elapsedMs.value >= GAME_LENGTH_MS) {
    elapsedMs.value = GAME_LENGTH_MS
    endGame()
    return
  }

  if (running.value && !paused.value) {
    rafId = requestAnimationFrame(tick)
  }
}

function tauntLoop() {
  if (!running.value || paused.value || !mice.value.length) return

  const mouse = pick(mice.value)
  const line = pick(rageLines)
  mouse.bait = line
  mouse.state = 'taunt'
  mouse.skill = ''
  statusLine.value = line
  play('bait', line)
}

function updatePointer(event) {
  const rect = arenaRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = clamp(event.clientX - rect.left, 0, rect.width)
  const y = clamp(event.clientY - rect.top, 0, rect.height)
  pointer.value = { ...pointer.value, x, y, inside: true }

  if (!running.value || paused.value) return

  mice.value.forEach((mouse) => {
    const mousePx = {
      x: (mouse.x / 100) * rect.width,
      y: (mouse.y / 100) * rect.height,
    }
    const distance = Math.hypot(mousePx.x - x, mousePx.y - y)
    mouse.near = distance < DANGER_RADIUS_PX

    if (mouse.near && nowMs.value >= mouse.nextSkillAt) {
      useMouseSkill(mouse, { x, y }, rect)
    }
  })
}

function leaveArena() {
  pointer.value = { ...pointer.value, inside: false, swinging: false }
  mice.value.forEach((mouse) => {
    mouse.near = false
  })
}

function useMouseSkill(mouse, cursor, rect) {
  mouse.nextSkillAt = nowMs.value + SKILL_COOLDOWN_MS
  mouse.state = 'evade'
  mouse.skill = Math.random() > 0.45 ? 'DASH' : 'BLINK'
  mouse.bait = pick(skillLines)
  dodges.value += 1
  statusLine.value = mouse.bait

  if (mouse.skill === 'BLINK') {
    mouse.x = randomBetween(11, 89)
    mouse.y = randomBetween(23, 84)
  } else {
    const mousePx = {
      x: (mouse.x / 100) * rect.width,
      y: (mouse.y / 100) * rect.height,
    }
    const dx = mousePx.x - cursor.x || randomBetween(-1, 1)
    const dy = mousePx.y - cursor.y || randomBetween(-1, 1)
    const length = Math.hypot(dx, dy) || 1
    const dash = randomBetween(118, 214)
    const nextX = mousePx.x + (dx / length) * dash + randomBetween(-34, 34)
    const nextY = mousePx.y + (dy / length) * dash + randomBetween(-28, 28)
    mouse.x = (clamp(nextX, 54, rect.width - 54) / rect.width) * 100
    mouse.y = (clamp(nextY, 64, rect.height - 58) / rect.height) * 100
  }

  mouse.y = clamp(mouse.y, 20, 86)
  mouse.x = clamp(mouse.x, 10, 90)
  mouse.bubble = mouse.y < 33 ? 'below' : 'above'
  mouse.tilt = randomBetween(-12, 12)
  play('skill', mouse.bait)

  managedTimeout(() => {
    if (!mice.value.some((item) => item.id === mouse.id)) return
    mouse.state = 'taunt'
    mouse.skill = ''
  }, 330)
}

function swingOnArena(event) {
  if (event.button !== 0 || !running.value || paused.value) return
  swingHammer()

  if (!canSwing.value) {
    statusLine.value = `Búa hồi ${Math.ceil(cooldownLeftMs.value / 100) / 10}s.`
    return
  }

  attackReadyAt.value = performance.now() + ATTACK_COOLDOWN_MS
  combo.value = 0
  misses.value += 1

  const rect = arenaRef.value.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const y = ((event.clientY - rect.top) / rect.height) * 100
  const line = pick(missLines)
  statusLine.value = line
  pushSplat('HỤT', x, y, 'miss')
  play('miss', line)
}

function whackMouse(id) {
  if (!running.value || paused.value) return
  swingHammer()

  if (!canSwing.value) {
    statusLine.value = `Chờ cooldown ${Math.ceil(cooldownLeftMs.value / 100) / 10}s.`
    return
  }

  const mouse = mice.value.find((item) => item.id === id)
  if (!mouse) return

  attackReadyAt.value = performance.now() + ATTACK_COOLDOWN_MS
  hits.value += 1
  combo.value += 1
  const reward = 100 + Math.min(160, combo.value * 15)
  score.value += reward
  const line = pick(hitLines)
  statusLine.value = `${line} +${reward}`
  pushSplat(line.toUpperCase(), mouse.x, mouse.y, 'hit')
  mice.value = mice.value.filter((item) => item.id !== id)
  if (props.assets.soundUrl) {
    playImportedSound(props.assets.soundUrl, 0.78)
  } else {
    play('hit', line)
  }

  if (!mice.value.length) {
    managedTimeout(() => spawnMouse(1), 520)
  }
}

function swingHammer() {
  pointer.value = { ...pointer.value, swinging: true }
  managedTimeout(() => {
    pointer.value = { ...pointer.value, swinging: false }
  }, 180)
}

onMounted(() => {
  nowMs.value = performance.now()
})

onBeforeUnmount(() => {
  clearTimers()
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <section class="game-shell" aria-label="Đập Chuột Rage">
    <header class="game-header">
      <div>
        <p class="eyebrow">Minigame 01</p>
        <h1>Đập Chuột Rage</h1>
      </div>

      <div class="header-actions">
        <button class="icon-button primary" type="button" @click="togglePrimaryAction">
          <Play v-if="!running || paused || ended" :size="18" aria-hidden="true" />
          <Pause v-else :size="18" aria-hidden="true" />
          <span>{{ primaryAction }}</span>
        </button>
        <button class="icon-button" type="button" title="Chơi lại" @click="resetGame">
          <RotateCcw :size="18" aria-hidden="true" />
        </button>
        <button class="icon-button" type="button" title="Âm thanh" @click="toggleAudio">
          <Volume2 v-if="audioEnabled" :size="18" aria-hidden="true" />
          <VolumeX v-else :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <section class="hud-strip" aria-label="Thông số trận">
      <div class="hud-item">
        <span>Điểm</span>
        <strong>{{ score }}</strong>
      </div>
      <div class="hud-item">
        <span>Combo</span>
        <strong>x{{ combo }}</strong>
      </div>
      <div class="hud-item">
        <span>Chuẩn</span>
        <strong>{{ accuracy }}%</strong>
      </div>
      <div class="hud-item">
        <span>Né</span>
        <strong>{{ dodges }}</strong>
      </div>
      <div class="hud-item">
        <span>Thời gian</span>
        <strong>{{ remainingSeconds }}s</strong>
      </div>
    </section>

    <section
      ref="arenaRef"
      class="arena"
      :class="{ 'is-paused': paused, 'is-ended': ended }"
      aria-label="Sân đập chuột"
      @pointermove="updatePointer"
      @pointerleave="leaveArena"
      @pointerdown="swingOnArena"
    >
      <div class="arena-grid" aria-hidden="true"></div>
      <div class="cooldown-rail" aria-hidden="true">
        <span :style="{ transform: `scaleX(${1 - cooldownRatio})` }"></span>
      </div>

      <RageMouse
        v-for="mouse in mice"
        :key="mouse.id"
        :mouse="mouse"
        :character-image="assets.imageUrl"
        @whack="whackMouse"
      />

      <span
        v-for="splat in splats"
        :key="splat.id"
        class="splat"
        :class="`is-${splat.type}`"
        :style="{ left: `${splat.x}%`, top: `${splat.y}%` }"
      >
        {{ splat.label }}
      </span>

      <span
        v-for="notice in notices"
        :key="notice.id"
        class="spawn-notice"
        :style="{ left: `${notice.x}%`, top: `${notice.y}%` }"
      >
        <Sparkles :size="16" aria-hidden="true" />
        {{ notice.label }}
      </span>

      <div
        v-if="pointer.inside"
        class="hammer"
        :class="{ 'is-swinging': pointer.swinging, 'is-cooling': !canSwing }"
        :style="{ left: `${pointer.x}px`, top: `${pointer.y}px` }"
        aria-hidden="true"
      ></div>

      <div v-if="!running || paused || ended" class="arena-state">
        <strong v-if="ended">Hết giờ</strong>
        <strong v-else-if="paused">Đang tạm dừng</strong>
        <strong v-else>Sẵn sàng</strong>
        <span>{{ statusLine }}</span>
      </div>
    </section>

    <footer class="game-feed" aria-live="polite">
      <span class="status-dot" :class="{ 'is-hot': !canSwing }"></span>
      <strong>{{ canSwing ? 'Búa sẵn sàng' : 'Búa đang hồi' }}</strong>
      <span>{{ statusLine }}</span>
    </footer>
  </section>
</template>
