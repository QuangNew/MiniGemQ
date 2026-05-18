<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw } from '@lucide/vue'
import { brainrotFoods, snakeStatusLines } from '../data/brainrot'

const GRID_SIZE = 18
const BASE_TICK_MS = 170
const MIN_TICK_MS = 82

const running = ref(false)
const paused = ref(false)
const ended = ref(false)
const snake = ref([])
const food = ref(null)
const score = ref(0)
const aura = ref(0)
const combo = ref(0)
const rotLevel = ref(0)
const tickMs = ref(BASE_TICK_MS)
const invertedTicks = ref(0)
const statusLine = ref('Rắn đang nằm doomscroll chờ bạn gọi dậy.')
const direction = ref({ x: 1, y: 0 })
const queuedDirection = ref({ x: 1, y: 0 })

let loopId = 0

const primaryAction = computed(() => {
  if (!running.value || ended.value) return 'Bắt đầu'
  if (paused.value) return 'Tiếp tục'
  return 'Tạm dừng'
})

const boardCells = computed(() => {
  const snakeMap = new Map()
  snake.value.forEach((segment, index) => {
    snakeMap.set(cellKey(segment), index)
  })

  return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
    const cell = {
      x: index % GRID_SIZE,
      y: Math.floor(index / GRID_SIZE),
    }
    const snakeIndex = snakeMap.get(cellKey(cell)) ?? -1
    const isFood = food.value?.x === cell.x && food.value?.y === cell.y

    return {
      ...cell,
      id: cellKey(cell),
      snakeIndex,
      isHead: snakeIndex === 0,
      isFood,
      food: isFood ? food.value : null,
    }
  })
})

const rotLabel = computed(() => {
  if (rotLevel.value < 8) return 'Ổn'
  if (rotLevel.value < 18) return 'Lệch'
  return 'Não rot'
})

function cellKey(cell) {
  return `${cell.x}:${cell.y}`
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function startGame() {
  clearTimeout(loopId)
  snake.value = [
    { x: 7, y: 9 },
    { x: 6, y: 9 },
    { x: 5, y: 9 },
  ]
  direction.value = { x: 1, y: 0 }
  queuedDirection.value = { x: 1, y: 0 }
  score.value = 0
  aura.value = 0
  combo.value = 0
  rotLevel.value = 0
  tickMs.value = BASE_TICK_MS
  invertedTicks.value = 0
  statusLine.value = 'Rắn đã online, aura đang ở mức tập sự.'
  running.value = true
  paused.value = false
  ended.value = false
  spawnFood()
  scheduleTick()
}

function togglePrimaryAction() {
  if (!running.value || ended.value) {
    startGame()
    return
  }

  paused.value = !paused.value
  statusLine.value = paused.value ? 'Rắn tạm AFK.' : 'Rắn quay lại farm tiếp.'

  if (paused.value) {
    clearTimeout(loopId)
  } else {
    scheduleTick()
  }
}

function scheduleTick() {
  clearTimeout(loopId)
  if (!running.value || paused.value || ended.value) return
  loopId = window.setTimeout(step, tickMs.value)
}

function step() {
  if (!running.value || paused.value || ended.value) return

  direction.value = queuedDirection.value
  const head = snake.value[0]
  const nextHead = {
    x: head.x + direction.value.x,
    y: head.y + direction.value.y,
  }

  const wrapped = wrapHead(nextHead)
  const hitSelf = snake.value.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)

  if (hitSelf) {
    endGame('Rắn tự cắn đuôi. Nội chiến aura kết thúc.')
    return
  }

  snake.value.unshift(nextHead)

  const ateFood = food.value && nextHead.x === food.value.x && nextHead.y === food.value.y
  if (ateFood) {
    eatFood(food.value)
  } else {
    snake.value.pop()
    if (wrapped) {
      aura.value -= 7
      rotLevel.value += 1
      statusLine.value = 'Wall skip kiểu Ohio, aura bị trừ nhẹ.'
    } else if (Math.random() > 0.86) {
      statusLine.value = pick(snakeStatusLines)
    }
  }

  if (invertedTicks.value > 0) {
    invertedTicks.value -= 1
  }

  scheduleTick()
}

function wrapHead(head) {
  let wrapped = false

  if (head.x < 0) {
    head.x = GRID_SIZE - 1
    wrapped = true
  } else if (head.x >= GRID_SIZE) {
    head.x = 0
    wrapped = true
  }

  if (head.y < 0) {
    head.y = GRID_SIZE - 1
    wrapped = true
  } else if (head.y >= GRID_SIZE) {
    head.y = 0
    wrapped = true
  }

  return wrapped
}

function eatFood(item) {
  combo.value += 1
  score.value += item.reward + combo.value * 9
  aura.value += item.aura
  rotLevel.value = clamp(rotLevel.value + item.rot, 0, 99)
  statusLine.value = `${item.line} +${item.reward}`

  if (item.type === 'skibidi') {
    tickMs.value = Math.max(MIN_TICK_MS, tickMs.value - 10)
  }

  if (item.type === 'ohio') {
    invertedTicks.value = 15
  }

  if (item.type === 'tax') {
    const taxAmount = Math.min(2, Math.max(0, snake.value.length - 3))
    if (taxAmount) {
      snake.value.splice(-taxAmount, taxAmount)
    }
  }

  if (item.type === 'sigma') {
    tickMs.value = Math.max(MIN_TICK_MS, tickMs.value - 5)
    snake.value.push({ ...snake.value[snake.value.length - 1] })
  }

  spawnFood()
}

function spawnFood() {
  const occupied = new Set(snake.value.map(cellKey))
  const emptyCells = []

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = { x, y }
      if (!occupied.has(cellKey(cell))) {
        emptyCells.push(cell)
      }
    }
  }

  if (!emptyCells.length) {
    endGame('Bạn lấp kín board. Rắn chính thức tốt nghiệp não rot.')
    return
  }

  const position = pick(emptyCells)
  food.value = {
    ...pick(brainrotFoods),
    ...position,
  }
}

function endGame(message) {
  clearTimeout(loopId)
  running.value = false
  paused.value = false
  ended.value = true
  statusLine.value = message
}

function queueDirection(nextDirection) {
  const candidate =
    invertedTicks.value > 0 ? { x: -nextDirection.x, y: -nextDirection.y } : nextDirection

  if (
    snake.value.length > 1 &&
    candidate.x + direction.value.x === 0 &&
    candidate.y + direction.value.y === 0
  ) {
    statusLine.value = 'Quay 180 độ là tự ratio bản thân.'
    return
  }

  queuedDirection.value = candidate
}

function handleKeydown(event) {
  const keyMap = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  }
  const nextDirection = keyMap[event.key.toLowerCase()]

  if (nextDirection) {
    event.preventDefault()
    queueDirection(nextDirection)
  }

  if (event.key === ' ') {
    event.preventDefault()
    togglePrimaryAction()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  clearTimeout(loopId)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <section class="game-shell" aria-label="Rắn Săn Mồi Brainrot">
    <header class="game-header">
      <div>
        <p class="eyebrow">Minigame 02</p>
        <h1>Rắn Săn Mồi</h1>
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

    <section class="hud-strip" aria-label="Thông số rắn">
      <div class="hud-item">
        <span>Điểm</span>
        <strong>{{ score }}</strong>
      </div>
      <div class="hud-item">
        <span>Aura</span>
        <strong>{{ aura }}</strong>
      </div>
      <div class="hud-item">
        <span>Combo</span>
        <strong>x{{ combo }}</strong>
      </div>
      <div class="hud-item">
        <span>Độ dài</span>
        <strong>{{ snake.length }}</strong>
      </div>
      <div class="hud-item">
        <span>Rot</span>
        <strong>{{ rotLabel }}</strong>
      </div>
    </section>

    <section
      class="arena snake-arena"
      :class="{ 'is-inverted': invertedTicks > 0 }"
      aria-label="Sân rắn săn mồi"
    >
      <div
        class="snake-board"
        :style="{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }"
      >
        <div
          v-for="cell in boardCells"
          :key="cell.id"
          class="snake-cell"
          :class="[
            {
              'is-snake': cell.snakeIndex >= 0,
              'is-head': cell.isHead,
              'is-food': cell.isFood,
            },
            cell.isFood ? `food-${cell.food.type}` : '',
          ]"
        >
          <span v-if="cell.isFood">{{ cell.food.label }}</span>
          <span v-else-if="cell.isHead" class="snake-face">
            {{ invertedTicks > 0 ? '??' : '>' }}
          </span>
        </div>
      </div>

      <div class="snake-controls" aria-label="Điều hướng rắn">
        <button class="icon-button" type="button" title="Lên" @click="queueDirection({ x: 0, y: -1 })">
          <ArrowUp :size="18" aria-hidden="true" />
        </button>
        <button
          class="icon-button"
          type="button"
          title="Trái"
          @click="queueDirection({ x: -1, y: 0 })"
        >
          <ArrowLeft :size="18" aria-hidden="true" />
        </button>
        <button
          class="icon-button"
          type="button"
          title="Phải"
          @click="queueDirection({ x: 1, y: 0 })"
        >
          <ArrowRight :size="18" aria-hidden="true" />
        </button>
        <button
          class="icon-button"
          type="button"
          title="Xuống"
          @click="queueDirection({ x: 0, y: 1 })"
        >
          <ArrowDown :size="18" aria-hidden="true" />
        </button>
      </div>

      <div v-if="!running || paused || ended" class="arena-state">
        <strong v-if="ended">Rắn gục</strong>
        <strong v-else-if="paused">Đang tạm dừng</strong>
        <strong v-else>Sẵn sàng</strong>
        <span>{{ statusLine }}</span>
      </div>
    </section>

    <footer class="game-feed" aria-live="polite">
      <span class="status-dot" :class="{ 'is-hot': invertedTicks > 0 }"></span>
      <strong>{{ invertedTicks > 0 ? 'Ohio mode' : `${tickMs}ms` }}</strong>
      <span>{{ statusLine }}</span>
    </footer>
  </section>
</template>
