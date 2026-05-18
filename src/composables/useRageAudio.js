import { ref } from 'vue'
import { audioClips } from '../data/ragebait'

const pick = (items) => items[Math.floor(Math.random() * items.length)]

export function useRageAudio() {
  const enabled = ref(false)
  const availableClips = ref([])
  let checkedClips = false
  let audioContext

  async function detectClips() {
    if (checkedClips || typeof window === 'undefined') return
    checkedClips = true

    const checks = audioClips.map(async (clip) => {
      try {
        const response = await fetch(clip.src, { method: 'HEAD', cache: 'no-store' })
        return response.ok ? clip : null
      } catch {
        return null
      }
    })

    availableClips.value = (await Promise.all(checks)).filter(Boolean)
  }

  function unlockContext() {
    if (typeof window === 'undefined') return null
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }
    return audioContext
  }

  function toggleAudio() {
    enabled.value = !enabled.value
    if (enabled.value) {
      unlockContext()
      detectClips()
    }
  }

  async function play(kind, line = '') {
    if (!enabled.value || typeof window === 'undefined') return
    await detectClips()

    const pool = availableClips.value.filter((clip) => clip.kind === kind)
    if (pool.length) {
      const clip = pick(pool)
      const audio = new Audio(clip.src)
      audio.volume = kind === 'hit' ? 0.75 : 0.6
      audio.play().catch(() => speak(line))
      return
    }

    if (kind === 'hit' || kind === 'miss') {
      thump(kind)
      return
    }

    speak(line)
  }

  function speak(line) {
    if (!line || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(line)
    utterance.lang = 'vi-VN'
    utterance.rate = 1.15
    utterance.pitch = 1.25
    utterance.volume = 0.75
    window.speechSynthesis.speak(utterance)
  }

  function thump(kind) {
    const context = unlockContext()
    if (!context) return

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = kind === 'hit' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(kind === 'hit' ? 128 : 84, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(44, context.currentTime + 0.16)
    gain.gain.setValueAtTime(0.22, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.18)
  }

  return {
    enabled,
    toggleAudio,
    play,
  }
}
