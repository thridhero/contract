<template>
  <BaseIcon :src="iconSrc" alt="add" :color="color" :size="size" />
</template>

<script>
import { defineComponent } from 'vue'
import BaseIcon from './BaseIcon.vue'
import iconSrc from '@assets/Add.svg'

export default defineComponent({
  name: 'AddIcon',
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
