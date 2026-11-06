<template>
  <div class="flex items-center justify-center min-h-full">
    <img 
      v-if="imageUrl" 
      :src="imageUrl" 
      :style="{ transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }" 
      class="max-w-full shadow-sm border border-[var(--content-border)] bg-white rounded" 
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  imageUrl: string
  scale: number
}>()
</script>
