<!--
  根组件：整个应用的"骨架"
  <router-view> 是占位符：根据当前 URL，把对应的页面组件渲染在这里
  （访问 / 时渲染 GuideView，访问 /heroes/3 时渲染 HeroDetailView）
  页头、页脚在所有页面都显示，所以写在这里。
-->
<script setup>
import { watchEffect } from 'vue'
// 全站图标统一用 lucide-vue-next（SVG 图标库，替代原来的 emoji）：
// SVG 是矢量图形，任何分辨率都清晰；颜色走 CSS 的 currentColor，hover 变金色天然生效
import { Shield, BookOpen, Users, TrendingUp } from 'lucide-vue-next'
// 全站共享的滚动状态（模块级单例，全站只挂一个 scroll 监听）
import { useScrollMetrics } from './composables/useScrollMetrics'
// 视差位移的换算（纯函数，有单测）
import { parallaxOffset } from './domain/parallax'
// 全局小组件：阅读进度条 / 回到顶部按钮
import ScrollProgress from './components/ScrollProgress.vue'
import BackToTop from './components/BackToTop.vue'
import { prefersReducedMotion } from './motion'

const { scrollY } = useScrollMetrics()

// ---------- 背景光斑的视差 ----------
// 滚动时那三团彩色光斑（main.css 的 body::before）轻轻往下挪一点，
// 看起来像浮在页面后面的一层，而不是一层贴死的墙纸。
// 系数 0.05 + 上限 32px：这是全站幅度最大的一处视差，也刻意压得很小 ——
// 它铺满整个屏幕，动多了会晕。
//
// ⚠️ 写成 --glow-shift 这个 CSS 变量，而不是直接改 body::before 的 transform：
// 伪元素拿不到 DOM 引用（document.querySelector 选不到 ::before），
// 只能靠"给 body 设变量、伪元素读变量"这条路传进去。
//
// watchEffect 而不是 computed：这里要的是"scrollY 一变就往 DOM 上写一次"，
// 这个副作用就是目的本身，不是派生值。
watchEffect(() => {
  // 开了"减弱动态效果"就一次都不写，光斑钉在原地。
  // （main.css 末尾还有一条 CSS 兜底，管"页面开着的时候才去改系统设置"的情况）
  if (prefersReducedMotion()) return

  document.body.style.setProperty(
    '--glow-shift',
    parallaxOffset(scrollY.value, 0.05, 32) + 'px'
  )
})
</script>

<template>
  <div class="app">
    <!-- 页头 -->
    <header class="app-header">
      <!-- router-link：Vue Router 提供的"链接"，to 指定跳转路径 -->
      <router-link to="/" class="logo">
        <Shield :size="20" class="logo-icon" />
        <span>Dota 2 新手入门指南</span>
      </router-link>
      <span class="subtitle">从英雄联盟 / 王者荣耀 无缝转学 Dota 2</span>
      <!-- 导航菜单：当前路由对应的链接会自动加上 router-link-exact-active 类
           顺序（用户要求）：新手须知 → 英雄图鉴 → 进阶 -->
      <nav class="nav">
        <router-link to="/" class="nav-link">
          <BookOpen :size="15" />新手须知
        </router-link>
        <router-link to="/heroes" class="nav-link">
          <Users :size="15" />英雄图鉴
        </router-link>
        <router-link to="/advanced" class="nav-link">
          <TrendingUp :size="15" />进阶
        </router-link>
      </nav>
    </header>

    <!-- 页面主体：路由匹配到的页面组件渲染在这里 -->
    <main class="app-main">
      <router-view />
    </main>

    <!-- 页脚：版权声明（教学内容的出处标注在进阶页"内容来源"面板里） -->
    <footer class="app-footer">
      <p>Dota 2 及相关素材归 Valve 所有，本站为非官方学习站点</p>
    </footer>

    <!-- 全站浮层两个：阅读进度条（顶栏下缘）+ 回到顶部按钮（右下角）。
         都是 position: fixed，写在哪里都一样，放最后是为了不打断
         "页头 → 内容 → 页脚"这根阅读顺序 -->
    <ScrollProgress />
    <BackToTop />
  </div>
</template>

<style scoped>
/* scoped：样式只作用于本组件，不会污染其他组件 */
.app {
  /* 纵向弹性布局：页头在上、内容居中撑满、页脚在下 */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  /* 吸顶 + 半透明毛玻璃：
     position: sticky 让顶栏在页面滚动时固定在视口顶部；
     半透明浅色底 + backdrop-filter 把滚过的内容模糊掉，就是"毛玻璃"。
     底部红线改成"红 → 透明"的渐变线，见 .app-header::after */
  position: sticky;
  top: 0;
  z-index: 50;              /* 盖过各页面吸顶元素（筛选栏 z-index 20、详情页侧栏） */
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-8);
  /* ⚠️ 这里必须是【页面底色】的半透明版本（rgba(23,25,29,...) = --bg #17191d），
     不能用别的颜色——顶栏是"页面被拉长的一段"，用同色才不会有断层。
     blur 开到 28px + saturate 提饱和（参考站数值）：让滚过去的卡片
     颜色透上来时更鲜艳一点，玻璃感更强 */
  background: rgba(23, 25, 29, 0.72);
  backdrop-filter: blur(28px) saturate(1.8);
  -webkit-backdrop-filter: blur(28px) saturate(1.8); /* Safari 前缀 */
}

/* 底部渐变线：左侧品牌红，向右渐隐到透明（替代原来整条实线） */
.app-header::after {
  content: '';
  position: absolute;   /* 相对 .app-header 定位（sticky 元素也是定位元素） */
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--red) 0%, rgba(227, 85, 72, 0.38) 45%, transparent 100%);
}

.logo {
  display: inline-flex;   /* 图标和文字在一行内垂直居中对齐 */
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: bold;
  color: var(--text);
  text-decoration: none; /* 去掉链接下划线 */
}

.logo:hover {
  color: var(--gold); /* Dota 金 */
}

.logo-icon {
  color: var(--red); /* 盾牌图标用 Dota 红 */
}

.subtitle {
  font-size: 13px;
  color: var(--muted);
}

.nav {
  margin-left: auto; /* 把导航推到最右侧 */
  display: flex;
  gap: 20px;
}

.nav-link {
  display: inline-flex;  /* 图标和文字一行对齐 */
  align-items: center;
  gap: 5px;
  color: var(--muted);
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;   /* 窄屏横向滚动时每个链接不折行 */
  /* 底部 2px 透明线占位：激活时变橙线，避免布局上下跳动 */
  padding-bottom: 4px;
  border-bottom: 2px solid transparent;
}

.nav-link:hover {
  color: var(--gold);
}

/* 当前页面对应的导航链接：橙色文字 + 底部 2px 橙线（用户要求；橙色与 hover 的金色区分开） */
.nav-link.router-link-exact-active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

.app-main {
  flex: 1;      /* 撑满剩余高度，把页脚压到底部 */
  width: 100%;
}

.app-footer {
  padding: 20px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--muted-2);
  border-top: 1px solid var(--border);
}

.app-footer p {
  margin: 4px 0;
  line-height: 1.6;
}

/* ---------- 窄屏适配 ---------- */
/* ≤900px：导航换到第二行并横向滚动。
   修复"右侧导航贴边/被裁切"：不加这个断点时，641~900px 宽度下
   logo + 副标题把放不下的导航挤出页头右边缘被裁掉 */
@media (max-width: 900px) {
  .app-header {
    flex-wrap: wrap;  /* 页头两行：第一行 logo（+副标题），第二行导航 */
    padding: 12px 16px;
  }

  /* 导航独占一行，内容超宽时横向滚动 */
  .nav {
    width: 100%;
    margin-left: 0;
    overflow-x: auto;
    /* 右侧留白：滚到底时最后一个链接不贴边；底部留出滚动条空间 */
    padding: 0 12px 4px;
  }
}

/* ≤640px（手机）：隐藏副标题，空间只留给 logo + 导航 */
@media (max-width: 640px) {
  .subtitle {
    display: none;
  }
}
</style>
