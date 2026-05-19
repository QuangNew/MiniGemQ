export function playImportedSound(src, volume = 0.72) {
  if (!src || typeof window === 'undefined') return

  const audio = new Audio(src)
  audio.volume = volume
  audio.play().catch(() => {})
}
