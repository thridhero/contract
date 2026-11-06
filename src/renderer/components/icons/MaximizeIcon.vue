<template>
  <BaseIcon :src="iconSrc" alt="maximize" :color="color" :size="size" />
</template>

<script>
import { defineComponent } from 'vue'
import BaseIcon from './BaseIcon.vue'
import iconSrc from '@assets/Frame.svg'

export default defineComponent({
  name: 'MaximizeIcon',
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
