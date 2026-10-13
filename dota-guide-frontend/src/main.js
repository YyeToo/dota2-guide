// ============================================================
// 应用入口文件：创建 Vue 应用实例，挂载到 index.html 的 <div id="app">
// Vite 会从 index.html 的 <script type="module" src="/src/main.js">
// 开始加载本文件以及它引用的所有模块
// ============================================================
import { createApp } from 'vue'
import App from './App.vue'      // 根组件：整个页面的骨架（页头/页脚/内容区）
import router from './router'    // 路由配置：决定 URL 与页面组件的对应关系
import './assets/main.css'      // 全局样式：对所有组件生效
// 全局自定义指令（滚动动效）：注册一次，所有组件的模板里都能直接用
import { reveal } from './directives/reveal'      // v-reveal  滚动到才入场
import { parallax } from './directives/parallax'  // v-parallax 随滚动小幅位移

// createApp(根组件).use(插件).mount(挂载点)
// .use(router)：让所有组件都能使用 router-view、router-link、useRouter 等能力
const app = createApp(App).use(router)

// 注册全局指令。
// ⚠️ directive('名字', ...) 的名字就是模板里 `v-名字` 的那一串：
//    注册成 'reveal' → 模板写 v-reveal。多写个 v-（'vreveal' / 'v-reveal'）
//    不会报错，只会静默失效 —— 指令没生效是"没有动画"，很容易被当成"还没做"
app.directive('reveal', reveal)
app.directive('parallax', parallax)

app.mount('#app')
