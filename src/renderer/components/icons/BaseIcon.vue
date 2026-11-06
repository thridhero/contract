<template>
  <img
    :src="src"
    :alt="alt"
    class="base-icon"
    :style="{ color: color, width: size, height: size }"
  />
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'BaseIcon',
  props: {
    src: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: 'icon'
    },
    color: {
      type: String,
      default: 'currentColor'
    },
    size: {
      type: String,
      default: '24px'
    }
  }
})
</script>

<style scoped>
.base-icon {
  display: inline-block;
  vertical-align: middle;
}
</style>
