<template>
  <div class="bg-gray-100 h-full  overflow-auto">
    <div class="bg-white border rounded p-4 h-full flex flex-col">
      <div class="flex-grow overflow-y-auto mb-4">
        <div v-for="(msg, index) in messages" :key="index" class="mb-2">
          <div :class="['p-2 rounded', msg.sender === 'user' ? 'bg-blue-100 ml-10 text-right' : 'bg-gray-100 mr-10']">
            {{ msg.text }}
          </div>
        </div>
      </div>
      <div class="flex mt-auto">
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          placeholder="Type your message..."
          class="flex-grow border rounded-l px-3 py-2"
        >
        <button
          @click="sendMessage"
          class="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ChatPanel',
  data() {
    return {
      messages: [
        { sender: 'other', text: 'Hello!' },
        { sender: 'user', text: 'Hi there!' }
      ],
      newMessage: ''
    }
  },
  methods: {
    sendMessage() {
      if (this.newMessage.trim()) {
        this.messages.push({ sender: 'user', text: this.newMessage })
        this.newMessage = ''

        // Simulate a response after a delay
        setTimeout(() => {
          this.messages.push({ sender: 'other', text: 'Thanks for your message!' })
        }, 1000)
      }
    }
  }
})
</script>
