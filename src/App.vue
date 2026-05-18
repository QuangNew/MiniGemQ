<script setup>
import { computed, ref } from 'vue'
import { Bird, Swords, Worm } from '@lucide/vue'
import BirdShooterGame from './components/BirdShooterGame.vue'
import SnakeGame from './components/SnakeGame.vue'
import WhackMouseGame from './components/WhackMouseGame.vue'

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
</script>

<template>
  <main class="app-shell">
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
    </aside>

    <component :is="activeGame.component" :key="activeGame.id" />
  </main>
</template>
