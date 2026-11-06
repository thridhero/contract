<template>
  <BaseIcon :src="iconSrc" alt="minimize" :color="color" :size="size" />
</template>

<script>
import { defineComponent } from 'vue'
import BaseIcon from './BaseIcon.vue'
import iconSrc from '@assets/Minus.svg'

export default defineComponent({
  name: 'MinimizeIcon',
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
      default: '16px'
    }
  },
  setup() {
    return {
      iconSrc
    }
  }
})
</script>
