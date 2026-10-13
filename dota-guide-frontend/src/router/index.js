// ============================================================
// 路由配置：管理"哪个 URL 显示哪个页面组件"
// 本项目有四个页面：/ 首页（新手须知）、/heroes 英雄图鉴、/heroes/:id 详情页、/advanced 进阶页
// ⚠️ 默认首页是新手须知（用户要求），英雄图鉴在 /heroes
// ============================================================
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import HeroDetailView from '../views/HeroDetailView.vue'
import GuideView from '../views/GuideView.vue'
import AdvancedView from '../views/AdvancedView.vue'

// 路由表：一个对象 = 一条路由规则
const routes = [
  {
    path: '/',            // 首页 = 新手须知（用户要求：默认首页为新手须知）
    name: 'guide',
    component: GuideView
  },
  {
    path: '/heroes',      // 英雄图鉴（原首页，改到这里）
    name: 'heroes',
    component: HomeView
  },
  {
    path: '/heroes/:id',  // :id 是动态参数，匹配 /heroes/1、/heroes/2 ...
    name: 'hero-detail',
    component: HeroDetailView,
    // props: true —— 把 URL 里的 id 自动作为 props 传给组件，
    // 组件里写 defineProps(['id']) 就能直接拿到，不必再写 useRoute()
    props: true
  },
  {
    path: '/advanced',    // 进阶页：久远Vortex 四篇教学 PDF 的总结，纯静态
    name: 'advanced',
    component: AdvancedView
  }
]

const router = createRouter({
  // HTML5 History 模式：URL 干净无 # 号（如 /heroes/3）
  // 另一种 hash 模式 URL 是 /#/heroes/3，不需要服务器配置，但不好看
  history: createWebHistory(),
  routes
})

export default router
