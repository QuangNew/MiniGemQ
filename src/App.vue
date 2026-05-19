<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  Bird,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Music2,
  Swords,
  Trash2,
  Upload,
  Worm,
} from '@lucide/vue'
import BirdShooterGame from './components/BirdShooterGame.vue'
import SnakeGame from './components/SnakeGame.vue'
import WhackMouseGame from './components/WhackMouseGame.vue'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp)$/i
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3'])
const AUDIO_EXTENSIONS = /\.mp3$/i

const games = [
  {
    id: 'whack-mouse',
    title: 'Đập Chuột',
    subtitle: 'Rage edition',
    eyebrow: 'Minigame 01',
    component: WhackMouseGame,
    icon: Swords,
  },
  {
    id: 'brainrot-snake',
    title: 'Rắn Săn Mồi',
    subtitle: 'Aura farm',
    eyebrow: 'Minigame 02',
    component: SnakeGame,
    icon: Worm,
  },
  {
    id: 'bird-shooter',
    title: 'Bắn Chim',
    subtitle: 'Não rot arcade',
    eyebrow: 'Minigame 03',
    component: BirdShooterGame,
    icon: Bird,
  },
]

const activeGameId = ref(games[0].id)
const activeGame = computed(() => games.find((game) => game.id === activeGameId.value) ?? games[0])
const appShellRef = ref(null)
const isFullscreen = ref(false)
const assetMessage = ref('')
const assetInputs = reactive({
  image: null,
  sound: null,
})

const customAssets = reactive(
  Object.fromEntries(
    games.map((game) => [
      game.id,
      {
        imageUrl: '',
        imageName: '',
        soundUrl: '',
        soundName: '',
      },
    ]),
  ),
)

const activeGameAssets = computed(() => customAssets[activeGame.value.id])
const fullscreenLabel = computed(() => (isFullscreen.value ? 'Thoát toàn màn hình' : 'Toàn màn hình'))

function setAssetInput(kind, element) {
  assetInputs[kind] = element
}

function openAssetPicker(kind) {
  assetInputs[kind]?.click()
}

function isAllowedAsset(kind, file) {
  if (kind === 'image') {
    return IMAGE_TYPES.has(file.type) || IMAGE_EXTENSIONS.test(file.name)
  }

  return AUDIO_TYPES.has(file.type) || AUDIO_EXTENSIONS.test(file.name)
}

function importAsset(kind, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  if (!isAllowedAsset(kind, file)) {
    assetMessage.value =
      kind === 'image'
        ? 'Chỉ nhận PNG, JPEG, JPG, GIF hoặc WEBP.'
        : 'Chỉ nhận âm thanh MP3.'
    return
  }

  const assets = customAssets[activeGame.value.id]
  const urlKey = kind === 'image' ? 'imageUrl' : 'soundUrl'
  const nameKey = kind === 'image' ? 'imageName' : 'soundName'

  if (assets[urlKey]) {
    URL.revokeObjectURL(assets[urlKey])
  }

  assets[urlKey] = URL.createObjectURL(file)
  assets[nameKey] = file.name
  assetMessage.value =
    kind === 'image'
      ? `Đã đổi nhân vật cho ${activeGame.value.title}.`
      : `Đã đổi âm thanh cho ${activeGame.value.title}.`
}

function clearAsset(kind) {
  const assets = customAssets[activeGame.value.id]
  const urlKey = kind === 'image' ? 'imageUrl' : 'soundUrl'
  const nameKey = kind === 'image' ? 'imageName' : 'soundName'

  if (assets[urlKey]) {
    URL.revokeObjectURL(assets[urlKey])
  }

  assets[urlKey] = ''
  assets[nameKey] = ''
  assetMessage.value =
    kind === 'image'
      ? `Đã dùng lại nhân vật mặc định của ${activeGame.value.title}.`
      : `Đã dùng lại âm thanh mặc định của ${activeGame.value.title}.`
}

async function toggleFullscreen() {
  if (typeof document === 'undefined') return

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await appShellRef.value?.requestFullscreen?.()
  } catch {
    assetMessage.value = 'Trình duyệt không cho phép toàn màn hình.'
  }
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === appShellRef.value
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)

  Object.values(customAssets).forEach((assets) => {
    if (assets.imageUrl) URL.revokeObjectURL(assets.imageUrl)
    if (assets.soundUrl) URL.revokeObjectURL(assets.soundUrl)
  })
})
</script>

<template>
  <main ref="appShellRef" class="app-shell" :class="{ 'is-fullscreen': isFullscreen }">
    <aside class="collection-panel" aria-label="Bộ sưu tập game">
      <div class="brand-block">
        <span class="brand-mark">MGQ</span>
        <div>
          <p>MiniGemQ</p>
          <strong>Bộ sưu tập xả stress</strong>
        </div>
      </div>

      <nav class="game-list" aria-label="Danh sách game">
        <button
          v-for="game in games"
          :key="game.id"
          class="game-tile"
          :class="{ 'is-active': activeGame.id === game.id }"
          type="button"
          @click="activeGameId = game.id"
        >
          <component :is="game.icon" :size="20" aria-hidden="true" />
          <span>
            <strong>{{ game.title }}</strong>
            <small>{{ game.subtitle }}</small>
          </span>
        </button>
      </nav>

      <section class="custom-panel" aria-label="Tùy biến game">
        <div class="panel-heading">
          <span>Tùy biến</span>
          <strong>{{ activeGame.title }}</strong>
        </div>

        <input
          :ref="(element) => setAssetInput('image', element)"
          class="visually-hidden"
          type="file"
          accept=".png,.jpeg,.jpg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
          @change="importAsset('image', $event)"
        />
        <input
          :ref="(element) => setAssetInput('sound', element)"
          class="visually-hidden"
          type="file"
          accept=".mp3,audio/mpeg"
          @change="importAsset('sound', $event)"
        />

        <div class="asset-row">
          <div class="asset-icon">
            <ImageIcon :size="18" aria-hidden="true" />
          </div>
          <span>
            <strong>Nhân vật</strong>
            <small>{{ activeGameAssets.imageName || 'Mặc định' }}</small>
          </span>
          <button class="asset-button" type="button" title="Import ảnh" @click="openAssetPicker('image')">
            <Upload :size="17" aria-hidden="true" />
          </button>
          <button
            class="asset-button"
            type="button"
            title="Xóa ảnh custom"
            :disabled="!activeGameAssets.imageUrl"
            @click="clearAsset('image')"
          >
            <Trash2 :size="17" aria-hidden="true" />
          </button>
        </div>

        <div class="asset-row">
          <div class="asset-icon">
            <Music2 :size="18" aria-hidden="true" />
          </div>
          <span>
            <strong>Âm thanh</strong>
            <small>{{ activeGameAssets.soundName || 'Mặc định' }}</small>
          </span>
          <button class="asset-button" type="button" title="Import MP3" @click="openAssetPicker('sound')">
            <Upload :size="17" aria-hidden="true" />
          </button>
          <button
            class="asset-button"
            type="button"
            title="Xóa âm thanh custom"
            :disabled="!activeGameAssets.soundUrl"
            @click="clearAsset('sound')"
          >
            <Trash2 :size="17" aria-hidden="true" />
          </button>
        </div>

        <button class="fullscreen-button" type="button" @click="toggleFullscreen">
          <Minimize2 v-if="isFullscreen" :size="18" aria-hidden="true" />
          <Maximize2 v-else :size="18" aria-hidden="true" />
          <span>{{ fullscreenLabel }}</span>
        </button>

        <p class="asset-message" aria-live="polite">{{ assetMessage }}</p>
      </section>
    </aside>

    <component :is="activeGame.component" :key="activeGame.id" :assets="activeGameAssets" />
  </main>
</template>
