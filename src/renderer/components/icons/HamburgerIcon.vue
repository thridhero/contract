<template>
  <BaseIcon :src="iconSrc" alt="hamburger" :color="color" :size="size" />
</template>

<script>
import { defineComponent } from 'vue'
import BaseIcon from './BaseIcon.vue'
import iconSrc from '@assets/HamburgerIcon.svg'

export default defineComponent({
  name: 'HamburgerIcon',
  components: {
    BaseIcon
  },
  props: {
    color: {
      type: String,
      default: 'currentColor'
    },
    size: {
      type: String,
      default: '20px'
    }
  },
  setup() {
    return {
      iconSrc
    }
  }
})
</script>
