// ============================================================
// composables/useScrollMetrics.js —— 全站共享的"滚动到哪了"
// ============================================================
//
// 谁要用：
//   · ScrollProgress 进度条  —— 要 progress（0~1）
//   · BackToTop 回顶按钮     —— 要 scrollY（滚过 600px 才出现）
//   · App.vue 背景光斑视差   —— 要 scrollY
//
// 【为什么写成"模块级单例"而不是各用各的】
// 这三个都是"滚动的下游"，如果每个组件自己 ref + 自己 addEventListener，
// 滚动一次就会有三次独立的回调、三次 rAF 排队，而且它们读的是同一组数字。
// 这里把数字和监听都收在一个模块里：**全站只挂一个 scroll 监听**，
// 三个消费者订阅同一个 ref —— 一次滚动，Vue 批量更新三处。
//
// ⚠️ 这个"单例"不是全局可变状态的坏味道：它里面只有"浏览器当前滚到哪了"
// 这一个客观事实，没有业务状态。谁都能读，只有浏览器能写。

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { progressOf } from '../domain/progress'

/** 当前滚动距离（window.scrollY）。全站共用同一个 */
const scrollY = ref(0)

/** 阅读进度 0~1；页面短到滚不动时是 null（进度条据此决定自己不显示） */
const progress = ref(null)

/** 订阅者数量：归零时才摘掉监听 */
let subscribers = 0
let rafId = 0
let bound = false
let bodyObserver = null

/** 重新量一次，把结果写进两个 ref */
function measure() {
  rafId = 0
  const doc = document.documentElement
  scrollY.value = window.scrollY
  progress.value = progressOf(window.scrollY, doc.scrollHeight, window.innerHeight)
}

/** rAF 节流：滚动一次连发几十个事件，一帧算一次足够（多了也是白算） */
function requestMeasure() {
  if (rafId) return
  rafId = requestAnimationFrame(measure)
}

function bind() {
  if (bound) return
  // passive: true —— 声明不会调 preventDefault，浏览器不用等回调结束才滚动，更跟手
  window.addEventListener('scroll', requestMeasure, { passive: true })
  window.addEventListener('resize', requestMeasure)

  // 文档变高变矮也要重算，而且**它不会触发 scroll 事件**：
  //   · 路由切换（长页面 → 短页面）
  //   · 图鉴页点"加载更多"，卡片追加进来
  // 少这一个观察器，进度条会一直到用户下次滚动才"想起来"自己该变多长。
  // 观察 body 而不是 documentElement：body 的内容盒高度跟的正是页面内容。
  // （回调里只写 ref、不改布局，不会有"观察 → 改动 → 再观察"的抖动循环）
  bodyObserver = new ResizeObserver(requestMeasure)
  bodyObserver.observe(document.body)

  bound = true
}

function unbind() {
  if (!bound) return
  window.removeEventListener('scroll', requestMeasure)
  window.removeEventListener('resize', requestMeasure)
  bodyObserver.disconnect()
  bodyObserver = null
  cancelAnimationFrame(rafId)
  rafId = 0
  bound = false
}

/**
 * 订阅滚动状态。在组件 setup 里调用即可，挂载/卸载的接线由 composable 负责。
 * @returns {{scrollY: import('vue').Ref<number>, progress: import('vue').Ref<number|null>}}
 */
export function useScrollMetrics() {
  onMounted(() => {
    subscribers++
    bind()
    // 立刻量一次：刷新页面时浏览器会恢复上次的滚动位置，
    // 等第一次 scroll 事件的话，第一帧的进度条/回顶按钮会是错的
    measure()
  })

  onBeforeUnmount(() => {
    subscribers--
    if (subscribers <= 0) unbind()   // 最后一个订阅者走了，监听就该摘掉
  })

  return { scrollY, progress }
}
