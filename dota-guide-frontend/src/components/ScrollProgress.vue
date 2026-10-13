<!--
  阅读进度条：顶栏下缘一条金线，随滚动变长。
  挂在 App.vue 里（全站都有），所以它不属于任何一个页面。

  两个刻意的设计：
    1. 用 transform: scaleX() 而不是 width —— scaleX 是合成器属性，
       改它不会触发重排/重绘，滚动时每帧都在改，用 width 会掉帧。
    2. progress 是 null 时整条不渲染（不是缩到 0）——
       页面短到滚不动时，挂着一条永远不动的空线看起来像卡住了。
       （判据见 src/domain/progress.js）
-->
<script setup>
import { useScrollMetrics } from '../composables/useScrollMetrics'

// 只需要 progress；scrollY 由别的组件用（同一个共享监听，多订阅一份不花代价）
const { progress } = useScrollMetrics()
</script>

<template>
  <div v-if="progress !== null" class="scroll-progress" aria-hidden="true">
    <i class="scroll-progress-fill" :style="{ transform: `scaleX(${progress})` }"></i>
  </div>
</template>

<style scoped>
/* 贴着顶栏下缘。
   ⚠️ 减 2px：--header-h 是"估算值 + 2px 余量"（见 main.css 的说明），
   直接写 var(--header-h) 会在顶栏下面留出一条 2px 的缝。
   顶栏自己底部的红色渐变线是 2px，进度条正好叠在同一位置、盖在它上面 */
.scroll-progress {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(var(--header-h) - 2px);
  height: 2px;
  z-index: 45;           /* 盖过各页的吸顶工具条（20），让开顶栏（50） */
  pointer-events: none;  /* 不吃鼠标事件：它横跨整个页面顶部，挡住的话顶栏就点不动了 */
}

.scroll-progress-fill {
  display: block;
  height: 100%;
  /* 从左边往右长：scaleX 默认以中心为原点，必须改成左对齐 */
  transform-origin: left center;
  /* 金色渐变，右端亮一点，扫过去有"点亮"的感觉 */
  background: linear-gradient(90deg, var(--red) 0%, var(--gold) 100%);
  /* 不加 transition：数值本来就是每帧算出来的（rAF 节流），
     再套一层过渡等于让动画滞后一帧，滚动时线会"追不上"手指 */
}
</style>
