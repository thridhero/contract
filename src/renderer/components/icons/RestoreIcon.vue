<template>
  <BaseIcon :src="iconSrc" alt="restore" :color="color" :size="size" />
</template>

<script>
import { defineComponent } from 'vue'
import BaseIcon from './BaseIcon.vue'
import iconSrc from '@assets/restore.svg'

export default defineComponent({
  name: 'RestoreIcon',
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
