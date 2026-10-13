import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置文件：相当于后端的 application.yml
// 注意：项目锁定 Vite 6（package.json 中 ^6.4.4）。
// 原因：Vite 7/8 要求 Node ≥ 22.12，当前 Node 22.11.0 不满足，升级 Node 后可换新版本。
export default defineConfig({
  // 启用 Vue 单文件组件（.vue）编译插件，缺了它 .vue 文件无法被识别
  plugins: [vue()],

  server: {
    // 开发服务器端口（Vite 默认就是 5173，显式写上更清晰）
    port: 5173

    // 【备选方案】开发代理：如果不想让后端配置 CORS，可以打开下面的注释。
    // 开启后，前端请求 /api/xxx 时 Vite 会转发到 http://localhost:8080/api/xxx，
    // 浏览器只和 5173 通信，就不存在跨域问题了。
    // 用代理时，src/api/hero.js 里的 baseURL 要改成 '/api'。
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:8080',
    //     changeOrigin: true
    //   }
    // }
  }
})
