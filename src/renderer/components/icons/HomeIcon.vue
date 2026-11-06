<template>
  <BaseIcon :src="iconSrc" alt="home" :color="color" :size="size" />
</template>

<script>
import { defineComponent } from 'vue'
import BaseIcon from './BaseIcon.vue'
import iconSrc from '@assets/Vector.svg'

export default defineComponent({
  name: 'HomeIcon',
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
      default: '24px'
    }
  },
  setup() {
    return {
      iconSrc
    }
  }
})
</script>
