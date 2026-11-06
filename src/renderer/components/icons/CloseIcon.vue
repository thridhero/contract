<template>
  <BaseIcon :src="iconSrc" alt="close" :color="color" :size="size" />
</template>

<script>
import { defineComponent } from 'vue'
import BaseIcon from './BaseIcon.vue'
import iconSrc from '@assets/Close.svg'

export default defineComponent({
  name: 'CloseIcon',
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
