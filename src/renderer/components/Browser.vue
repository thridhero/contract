<template>
  <div class="bg-gray-100 h-full flex flex-col">

    <!-- 导航栏 -->
    <div class="flex items-center gap-2 px-4 py-2 bg-white border-b">
      <button @click="goBack" class="p-2 rounded hover:bg-gray-100 disabled:opacity-50" :disabled="!canGoBack">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
      </button>
      
      <button @click="goForward" class="p-2 rounded hover:bg-gray-100 disabled:opacity-50" :disabled="!canGoForward">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
      
      <button @click="refresh" class="p-2 rounded hover:bg-gray-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
        </svg>
      </button>
      
      <button @click="goHome" class="p-2 rounded hover:bg-gray-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      </button>
      
      <input 
        v-model="currentUrl" 
        @keyup.enter="navigateToUrl"
        class="flex-grow mx-2 px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        type="text" 
        placeholder="Enter URL..."
      >
      
      <button @click="navigateToUrl" class="p-2 rounded hover:bg-gray-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
    
    <!-- 浏览器内容区域 -->
    <div class="bg-white border rounded m-4 flex-grow">
      <webview
        ref="browserFrame"
        :src="url"
        class="w-full h-full"
        allowpopups
        plugins
        :webpreferences="'allowRunningInsecureContent=true, javascript=true'"
      ></webview>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'BrowserPanel',
  data() {
    return {
      url: 'https://www.baidu.com',
      currentUrl: 'https://www.baidu.com',
      history: ['https://www.baidu.com'],
      currentIndex: 0,
      canGoBack: false,
      canGoForward: true
    }
  },
  mounted() {
    // 初始化当前URL
    this.currentUrl = this.url;
    this.setupWebviewEvents();
  },
  methods: {
    setupWebviewEvents() {
      // 获取webview元素并设置事件监听
      const webview = this.$refs.browserFrame;
      if (webview) {
        webview.addEventListener('did-stop-loading', () => {
          this.currentUrl = webview.src;
        });
        
        webview.addEventListener('did-navigate', (event) => {
          this.currentUrl = event.url;
          // 更新历史记录
          this.history = this.history.slice(0, this.currentIndex + 1);
          this.history.push(event.url);
          this.currentIndex++;
          this.updateNavigationState();
        });
        
        webview.addEventListener('did-navigate-in-page', (event) => {
          this.currentUrl = event.url;
        });
        
        webview.addEventListener('page-title-updated', (event) => {
          document.title = event.title;
        });
      }
    },
    navigateToUrl() {
      const webview = this.$refs.browserFrame;
      if (webview && this.isValidUrl(this.currentUrl)) {
        webview.loadURL(this.addProtocol(this.currentUrl));
      } else if (webview) {
        // 如果不是有效URL，则使用百度搜索
        const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(this.currentUrl)}`;
        webview.loadURL(searchUrl);
      }
    },
    goBack() {
      const webview = this.$refs.browserFrame;
      if (webview && this.canGoBack && webview.canGoBack()) {
        webview.goBack();
      }
    },
    goForward() {
      const webview = this.$refs.browserFrame;
      if (webview && this.canGoForward && webview.canGoForward()) {
        webview.goForward();
      }
    },
    refresh() {
      const webview = this.$refs.browserFrame;
      if (webview) {
        webview.reload();
      }
    },
    goHome() {
      this.currentUrl = 'https://www.baidu.com';
      this.navigateToUrl();
    },
    updateNavigationState() {
      const webview = this.$refs.browserFrame;
      if (webview) {
        this.canGoBack = webview.canGoBack();
        this.canGoForward = webview.canGoForward();
      }
    },
    isValidUrl(string) {
      try {
        new URL(string);
        return true;
      } catch (_) {
        // 检查是否是带有协议的URL
        try {
          new URL('http://' + string);
          return true;
        } catch (_) {
          return false;
        }
      }
    },
    addProtocol(url) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (this.isValidUrl('http://' + url)) {
          return 'http://' + url;
        }
      }
      return url;
    }
  }
})
</script>