<script setup>
defineProps({
  mouse: {
    type: Object,
    required: true,
  },
  characterImage: {
    type: String,
    default: '',
  },
})

defineEmits(['whack'])
</script>

<template>
  <button
    class="rage-mouse"
    :class="[`is-${mouse.state}`, { 'is-near': mouse.near }]"
    :style="{
      left: `${mouse.x}%`,
      top: `${mouse.y}%`,
      '--mouse-size': `${mouse.size}px`,
      '--mouse-tilt': `${mouse.tilt}deg`,
    }"
    :aria-label="`Đập chuột: ${mouse.bait}`"
    type="button"
    @pointerdown.stop.prevent="$emit('whack', mouse.id)"
  >
    <span class="speech-bubble" :class="{ 'is-below': mouse.bubble === 'below' }">
      {{ mouse.bait }}
    </span>

    <span v-if="mouse.skill" class="skill-tag">{{ mouse.skill }}</span>

    <img
      v-if="characterImage"
      class="mouse-art custom-character-art"
      :src="characterImage"
      alt=""
      draggable="false"
    />

    <svg v-else class="mouse-art" viewBox="0 0 128 96" aria-hidden="true">
      <path
        class="tail"
        d="M20 66 C4 70 2 48 17 45 C30 42 31 56 21 58 C14 60 15 66 20 66"
      />
      <ellipse class="body" cx="69" cy="58" rx="42" ry="27" />
      <circle class="ear outer" cx="47" cy="31" r="16" />
      <circle class="ear inner" cx="47" cy="31" r="8" />
      <circle class="ear outer" cx="88" cy="31" r="16" />
      <circle class="ear inner" cx="88" cy="31" r="8" />
      <ellipse class="face" cx="69" cy="51" rx="34" ry="29" />
      <circle class="eye" cx="57" cy="46" r="4" />
      <circle class="eye" cx="81" cy="46" r="4" />
      <path class="brow" d="M50 39 L62 35" />
      <path class="brow" d="M76 35 L89 39" />
      <path class="nose" d="M67 55 L74 55 L70 61 Z" />
      <path class="mouth" d="M58 66 Q70 73 84 66" />
      <path class="whisker" d="M50 58 H24" />
      <path class="whisker" d="M51 64 L25 72" />
      <path class="whisker" d="M87 58 H115" />
      <path class="whisker" d="M86 64 L113 72" />
      <ellipse class="paw" cx="45" cy="78" rx="12" ry="6" />
      <ellipse class="paw" cx="91" cy="78" rx="12" ry="6" />
    </svg>
  </button>
</template>
