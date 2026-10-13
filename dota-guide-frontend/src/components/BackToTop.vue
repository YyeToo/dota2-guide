<!--
  回到顶部按钮：滚过一段距离后从右下角浮出来。
  挂在 App.vue 里（全站都有）。

  为什么做它：本轮把新手须知页从"面板内滑动"改成了整页纵向滚动，
  页面一下子变长了（三节叠起来），滚到底想回页首只能一路往回拖。
  图鉴页更极端——127 张卡，滚到底回顶要拉很久。
-->
<script setup>
import { computed } from 'vue'
import { ArrowUp } from 'lucide-vue-next'
import { useScrollMetrics } from '../composables/useScrollMetrics'
import { prefersReducedMotion } from '../motion'

const { scrollY } = useScrollMetrics()

/** 滚过这么多才出现。取 600：大约是"一屏多一点"，在这个位置用户已经需要它了，
 *  而在页面顶部附近它不会来挡内容 */
const SHOW_AFTER = 600

const visible = computed(() => scrollY.value > SHOW_AFTER)

function toTop() {
  // 开了"减弱动态效果"就跳过去，不要平滑滚动 ——
  // 平滑滚动本身就是一段长距离的位移动画，正是这个设置要避免的东西
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}
</script>

<template>
  <Transition name="btt">
    <button v-if="visible" class="back-to-top" type="button" aria-label="回到顶部" @click="toTop">
      <ArrowUp :size="18" />
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 45;          /* 和进度条同级：都在页面内容之上、顶栏之下 */
  width: 42px;
  height: 42px;
  padding: 0;           /* 覆盖全局 button 的 8px 20px，圆形按钮要正圆 */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  /* 和吸顶工具条同一套玻璃配方，但因为它是浮在内容上面的独立按钮，
     底色比 --card 实一点，滚动时不会被背后的卡片"'穿"得看不清轮廓 */
  background: var(--glass-bg);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: var(--glass-shadow);
  color: var(--muted);
}

.back-to-top:hover {
  color: var(--gold);
  border-color: var(--gold);
}

/* 进出场：淡入 + 从下方浮 8px。
   用 Vue 内置的 <Transition> 而不是自己加类 —— 元素是被 v-if 创建/销毁的，
   没有 Transition 的话它只会"啪"地出现或者"啪"地消失，
   连给 CSS 过渡的机会都没有（元素已经不在 DOM 里了） */
.btt-enter-active,
.btt-leave-active {
  transition: opacity 0.2s var(--ease-std), transform 0.2s var(--ease-std);
}

.btt-enter-from,
.btt-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* 无障碍：减弱动态效果时不要这段浮入淡出，直接出现 */
@media (prefers-reduced-motion: reduce) {
  .btt-enter-active,
  .btt-leave-active {
    transition-duration: 0.01ms;
  }

  .btt-enter-from,
  .btt-leave-to {
    transform: none;
  }
}

/* 窄屏：右下角是拇指区，按钮缩小一点、离边近一点，不挡内容 */
@media (max-width: 640px) {
  .back-to-top {
    right: 16px;
    bottom: 16px;
    width: 38px;
    height: 38px;
  }
}
</style>
