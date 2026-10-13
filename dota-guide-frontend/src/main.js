// ============================================================
// 应用入口文件：创建 Vue 应用实例，挂载到 index.html 的 <div id="app">
// Vite 会从 index.html 的 <script type="module" src="/src/main.js">
// 开始加载本文件以及它引用的所有模块
// ============================================================
import { createApp } from 'vue'
import App from './App.vue'      // 根组件：整个页面的骨架（页头/页脚/内容区）
import router from './router'    // 路由配置：决定 URL 与页面组件的对应关系
import './assets/main.css'       // 全局样式：对所有组件生效

// createApp(根组件).use(插件).mount(挂载点)
// .use(router)：让所有组件都能使用 router-view、router-link、useRouter 等能力
createApp(App).use(router).mount('#app')
