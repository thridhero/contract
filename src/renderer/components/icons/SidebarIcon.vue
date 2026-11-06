<template>
  <BaseIcon :src="iconSrc" alt="sidebar" :color="color" :size="size" />
</template>

<script>
import { defineComponent } from 'vue'
import BaseIcon from './BaseIcon.vue'
import iconSrc from '@assets/SidebarIcon.svg'

export default defineComponent({
  name: 'SidebarIcon',
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
