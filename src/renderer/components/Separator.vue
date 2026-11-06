<template>
  <div
    class="separator cursor-col-resize transition-colors relative flex-shrink-0 z-10"
    :class="{ 'is-dragging': isDragging }"
    @mousedown="startDrag"
  ></div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'Separator',
  props: {
    leftWidth: {
      type: Number,
      default: 0
    },
    rightWidth: {
      type: Number,
      default: 0
    },
    minWidth: {
      type: Number,
      default: 200
    }
  },
  emits: ['resize'],
  setup(props, { emit }) {
    const isDragging = ref(false)

    const startDrag = (event: MouseEvent) => {
      event.preventDefault()

      isDragging.value = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const startX = event.clientX
      const startWidth = props.leftWidth || props.rightWidth
      const isRightResize = props.rightWidth > 0

      const doDrag = (e: MouseEvent) => {
        const dx = e.clientX - startX
        let newWidth: number

        if (isRightResize) {
          newWidth = startWidth - dx
        } else {
          newWidth = startWidth + dx
        }

        if (newWidth < props.minWidth) {
          newWidth = props.minWidth
        }

        emit('resize', newWidth)
      }

      const stopDrag = () => {
        isDragging.value = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', doDrag)
        document.removeEventListener('mouseup', stopDrag)
      }

      document.addEventListener('mousemove', doDrag)
      document.addEventListener('mouseup', stopDrag)
    }

    return {
      startDrag,
      isDragging
    }
  }
})
</script>

<style scoped>
.separator {
  width: 1px;
  background-color: var(--content-border, #d1d5db);
  position: relative;
}

.separator::before {
  content: '';
  position: absolute;
  top: 0;
  left: -3px;
  right: -3px;
  bottom: 0;
  cursor: col-resize;
  background-color: transparent;
}

.separator:hover,
.separator.is-dragging {
  background-color: var(--btn-primary-bg, #60a5fa);
}

.separator:hover::before,
.separator.is-dragging::before {
  background-color: var(--btn-primary-bg, #60a5fa);
}
</style>
