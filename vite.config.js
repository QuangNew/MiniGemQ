import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'minigemq'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${repoName}/` : '/',
  plugins: [vue()],
}))
