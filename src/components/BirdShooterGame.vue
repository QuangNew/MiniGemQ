<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Pause, Play, RotateCcw } from '@lucide/vue'
import { birdHitLines, birdMissLines, birdTaunts, birdTypes } from '../data/brainrot'
import { playImportedSound } from '../composables/useImportedSound'

const props = defineProps({
  assets: {
    type: Object,
    default: () => ({}),
  },
})

const GAME_LENGTH_MS = 75_000
const SHOT_COOLDOWN_MS = 320
const SPAWN_INTERVAL_MS = 850
const MAX_BIRDS = 8

const arenaRef = ref(null)
const running = ref(false)
const paused = ref(false)
const ended = ref(false)
const birds = ref([])
const bursts = ref([])
const score = ref(0)
const combo = ref(0)
const shots = ref(0)
const hits = ref(0)
const escaped = ref(0)
const elapsedMs = ref(0)
const nowMs = ref(0)
const shotReadyAt = ref(0)
const pointer = ref({ x: 0, y: 0, inside: false, firing: false })
const statusLine = ref('Bầy chim đang livestream trên dây điện.')

let birdId = 0
let burstId = 0
let rafId = 0
let spawnId = 0
let startedAt = 0
let pausedAt = 0
let lastFrameAt = 0

const remainingSeconds = computed(() => {
  return Math.max(0, Math.ceil((GAME_LENGTH_MS - elapsedMs.value) / 1000))
})

const accuracy = computed(() => {
  if (!shots.value) return 100
  return Math.round((hits.value / shots.value) * 100)
})

const cooldownLeftMs = computed(() => Math.max(0, shotReadyAt.value - nowMs.value))
const cooldownRatio = computed(() => Math.max(0, Math.min(1, cooldownLeftMs.value / SHOT_COOLDOWN_MS)))
const canShoot = computed(() => cooldownLeftMs.value <= 0)

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

function startGame() {
  clearInterval(spawnId)
  cancelAnimationFrame(rafId)
  running.value = true
  paused.value = false
  ended.value = false
  birds.value = []
  bursts.value = []
  score.value = 0
  combo.value = 0
  shots.value = 0
  hits.value = 0
  escaped.value = 0
  elapsedMs.value = 0
  shotReadyAt.value = 0
  statusLine.value = 'Bầu trời mở lobby.'
  startedAt = performance.now()
  lastFrameAt = startedAt
  nowMs.value = startedAt

  spawnBird(3)
  spawnId = window.setInterval(() => spawnBird(Math.random() > 0.74 ? 2 : 1), SPAWN_INTERVAL_MS)
  rafId = requestAnimationFrame(tick)
}

function togglePrimaryAction() {
  if (!running.value || ended.value) {
    startGame()
    return
  }

  if (paused.value) {
    paused.value = false
    startedAt += performance.now() - pausedAt
    lastFrameAt = performance.now()
    statusLine.value = 'Chim quay lại feed For You.'
    rafId = requestAnimationFrame(tick)
    return
  }

  paused.value = true
  pausedAt = performance.now()
  statusLine.value = 'Tạm dừng, chim đang họp drama.'
  cancelAnimationFrame(rafId)
}

function tick(timestamp) {
  if (!running.value || paused.value) return

  nowMs.value = timestamp
  elapsedMs.value = timestamp - startedAt

  if (elapsedMs.value >= GAME_LENGTH_MS) {
    elapsedMs.value = GAME_LENGTH_MS
    endGame()
    return
  }

  const delta = Math.min(48, timestamp - lastFrameAt) / 1000
  lastFrameAt = timestamp
  updateBirds(delta, timestamp)
  rafId = requestAnimationFrame(tick)
}

function updateBirds(delta, timestamp) {
  const nextBirds = []

  birds.value.forEach((bird) => {
    const x = bird.x + bird.vx * delta
    const y = clamp(bird.baseY + Math.sin(timestamp / 230 + bird.phase) * bird.wobble, 10, 88)
    const escapedScreen = bird.direction > 0 ? x > 112 : x < -12

    if (escapedScreen) {
      handleEscape(bird)
      return
    }

    nextBirds.push({ ...bird, x, y })
  })

  birds.value = nextBirds
}

function spawnBird(amount = 1, override = {}) {
  if (!running.value || paused.value) return

  const room = Math.max(0, MAX_BIRDS - birds.value.length)
  const count = Math.min(room, amount)
  if (!count) return

  const created = []
  for (let index = 0; index < count; index += 1) {
    const type = override.type ? birdTypes.find((item) => item.type === override.type) : pick(birdTypes)
    const fromLeft = override.direction ? override.direction > 0 : Math.random() > 0.5
    const direction = fromLeft ? 1 : -1
    const speed = randomBetween(type.speed[0], type.speed[1]) * direction
    const baseY = override.y ?? randomBetween(16, 82)

    created.push({
      ...type,
      id: ++birdId,
      x: override.x ?? (fromLeft ? -7 : 107),
      y: baseY,
      baseY,
      vx: speed,
      direction,
      size: override.size ?? randomBetween(0.88, 1.12),
      phase: randomBetween(0, Math.PI * 2),
      taunt: pick(birdTaunts),
    })
  }

  birds.value.push(...created)
}

function handleEscape(bird) {
  escaped.value += 1
  combo.value = 0

  if (bird.escapePenalty) {
    score.value = Math.max(0, score.value - bird.escapePenalty)
    statusLine.value = `${bird.name} trốn thoát và thu Fanum tax -${bird.escapePenalty}.`
    return
  }

  statusLine.value = `${bird.name} vừa bay khỏi khung hình như một ý tưởng tệ.`
}

function shootArena(event) {
  if (event.button !== 0 || !running.value || paused.value) return
  fireCrosshair()

  if (!canShoot.value) {
    statusLine.value = `Đạn hồi ${Math.ceil(cooldownLeftMs.value / 100) / 10}s.`
    return
  }

  setShotCooldown()
  shots.value += 1
  combo.value = 0

  const point = eventPoint(event)
  pushBurst('MISS', point.xPercent, point.yPercent, 'miss')
  statusLine.value = pick(birdMissLines)
}

function shootBird(id) {
  if (!running.value || paused.value) return
  fireCrosshair()

  if (!canShoot.value) {
    statusLine.value = `Reload attention span ${Math.ceil(cooldownLeftMs.value / 100) / 10}s.`
    return
  }

  const bird = birds.value.find((item) => item.id === id)
  if (!bird) return

  setShotCooldown()
  shots.value += 1
  hits.value += 1
  combo.value += 1
  const reward = bird.reward + combo.value * 13
  score.value += reward
  statusLine.value = `${pick(birdHitLines)} +${reward}`
  playImportedSound(props.assets.soundUrl, 0.72)
  pushBurst(`+${reward}`, bird.x, bird.y, 'hit')
  birds.value = birds.value.filter((item) => item.id !== id)

  if (bird.splits && bird.size > 0.72) {
    spawnBird(2, {
      type: 'npc',
      x: bird.x,
      y: bird.y,
      size: 0.72,
      direction: -bird.direction,
    })
    statusLine.value = 'Sigma chim vỡ thành hai NPC nhỏ. Nội dung đã nhân bản.'
  }
}

function setShotCooldown() {
  shotReadyAt.value = performance.now() + SHOT_COOLDOWN_MS
}

function eventPoint(event) {
  const rect = arenaRef.value.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    xPercent: ((event.clientX - rect.left) / rect.width) * 100,
    yPercent: ((event.clientY - rect.top) / rect.height) * 100,
  }
}

function updatePointer(event) {
  const rect = arenaRef.value?.getBoundingClientRect()
  if (!rect) return

  pointer.value = {
    ...pointer.value,
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height),
    inside: true,
  }
}

function leaveArena() {
  pointer.value = { ...pointer.value, inside: false, firing: false }
}

function fireCrosshair() {
  pointer.value = { ...pointer.value, firing: true }
  window.setTimeout(() => {
    pointer.value = { ...pointer.value, firing: false }
  }, 120)
}

function pushBurst(label, x, y, type) {
  const burst = { id: ++burstId, label, x, y, type }
  bursts.value.push(burst)
  window.setTimeout(() => {
    bursts.value = bursts.value.filter((item) => item.id !== burst.id)
  }, 620)
}

function endGame() {
  running.value = false
  paused.value = false
  ended.value = true
  clearInterval(spawnId)
  cancelAnimationFrame(rafId)
  statusLine.value =
    accuracy.value > 58 ? 'Bầu trời đã bị dọn feed khá sạch.' : 'Chim đang đăng recap miss của bạn.'
}

onMounted(() => {
  nowMs.value = performance.now()
})

onBeforeUnmount(() => {
  clearInterval(spawnId)
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <section class="game-shell" aria-label="Bắn Chim Não Rot">
    <header class="game-header">
      <div>
        <p class="eyebrow">Minigame 03</p>
        <h1>Bắn Chim</h1>
      </div>

      <div class="header-actions">
        <button class="icon-button primary" type="button" @click="togglePrimaryAction">
          <Play v-if="!running || paused || ended" :size="18" aria-hidden="true" />
          <Pause v-else :size="18" aria-hidden="true" />
          <span>{{ primaryAction }}</span>
        </button>
        <button class="icon-button" type="button" title="Chơi lại" @click="startGame">
          <RotateCcw :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <section class="hud-strip" aria-label="Thông số bắn chim">
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
        <span>Thoát</span>
        <strong>{{ escaped }}</strong>
      </div>
      <div class="hud-item">
        <span>Thời gian</span>
        <strong>{{ remainingSeconds }}s</strong>
      </div>
    </section>

    <section
      ref="arenaRef"
      class="arena bird-arena"
      aria-label="Sân bắn chim"
      @pointermove="updatePointer"
      @pointerleave="leaveArena"
      @pointerdown="shootArena"
    >
      <div class="sky-lines" aria-hidden="true"></div>
      <div class="cooldown-rail" aria-hidden="true">
        <span :style="{ transform: `scaleX(${1 - cooldownRatio})` }"></span>
      </div>

      <button
        v-for="bird in birds"
        :key="bird.id"
        class="bird-target"
        :class="[`bird-${bird.type}`, { 'is-left': bird.direction < 0, 'has-custom-art': assets.imageUrl }]"
        :style="{
          left: `${bird.x}%`,
          top: `${bird.y}%`,
          '--bird-color': bird.color,
          '--bird-scale': bird.size,
        }"
        type="button"
        :aria-label="`Bắn ${bird.name}`"
        @pointerdown.stop.prevent="shootBird(bird.id)"
      >
        <span class="speech-bubble">{{ bird.taunt }}</span>
        <span class="bird-label">{{ bird.label }}</span>
        <img
          v-if="assets.imageUrl"
          class="bird-art custom-character-art"
          :src="assets.imageUrl"
          alt=""
          draggable="false"
        />
        <svg v-else class="bird-art" viewBox="0 0 112 80" aria-hidden="true">
          <path class="bird-wing back" d="M45 42 C18 12 8 35 34 55" />
          <path class="bird-body" d="M29 45 C42 18 82 19 94 46 C80 67 45 70 29 45" />
          <path class="bird-wing front" d="M53 43 C28 12 18 34 46 58" />
          <circle class="bird-eye" cx="76" cy="38" r="4" />
          <path class="bird-beak" d="M93 42 L108 47 L93 52 Z" />
          <path class="bird-tail" d="M30 45 L10 31 L18 48 L9 62 Z" />
        </svg>
      </button>

      <span
        v-for="burst in bursts"
        :key="burst.id"
        class="bird-burst"
        :class="`is-${burst.type}`"
        :style="{ left: `${burst.x}%`, top: `${burst.y}%` }"
      >
        {{ burst.label }}
      </span>

      <div
        v-if="pointer.inside"
        class="crosshair"
        :class="{ 'is-firing': pointer.firing, 'is-cooling': !canShoot }"
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
      <span class="status-dot" :class="{ 'is-hot': !canShoot }"></span>
      <strong>{{ canShoot ? 'Đạn sẵn sàng' : 'Đang reload' }}</strong>
      <span>{{ statusLine }}</span>
    </footer>
  </section>
</template>
