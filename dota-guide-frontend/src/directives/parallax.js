// ============================================================
// directives/parallax.js —— v-parallax：随滚动做小幅位移
// ============================================================
//
// 用法：
//   <div class="banner parallax" v-parallax="{ speed: 0.1, max: 24 }">…</div>
//   speed 省略 = 0.1，max 省略 = 24
//
// 效果是"这一块比正文滚得慢一点"，看起来像浮在另一层。
// 位移量由纯函数 parallaxOffset 算（见 src/domain/parallax.js），
// 那个函数有单测；这里只负责读滚动位置、写进 CSS 变量。
//
// ⚠️ 两条使用约束，都是踩过才知道的：
//   1. 只挂**没有 transform 历史**的元素。位移是写进 --parallax-y、
//      由全局 .parallax 类翻成 transform 的；元素自己要是还有 transform
//      （比如悬停上浮），两条规则会互相覆盖，鼠标一上去就跳一下。
//   2. 挂在 overflow: hidden 的容器里时，位移上限要小于容器内边距，
//      不然元素一动就被裁掉一块（详情页横幅里的头像就是这么算的）。
//
// 【为什么是"一个共享监听 + 一张注册表"，而不是每个元素一个 scroll 监听】
// 一个页面上挂 v-parallax 的元素有两三个。每个都加一个 window 滚动监听，
// 滚动时就会有三次独立回调、三次 rAF 排队 —— 它们之间没有任何协调。
// 收成一个监听、在一帧里统一算完所有元素，代码还更短。

import { parallaxOffset } from '../domain/parallax'
import { prefersReducedMotion } from '../motion'

const DEFAULTS = { speed: 0.1, max: 24 }

/** 注册表：元素 → 它的参数。全站可能同时有两三个 */
const targets = new Map()

let bound = false       // 共享的 scroll 监听挂上了没有
let rafId = 0           // 排队中的 rAF 句柄，0 = 本帧不用再排

/**
 * 真正干活：把每个元素的位移写进它自己的 --parallax-y。
 *
 * ⚠️ 这里写的是 CSS 变量，不是直接写 transform。
 * 直接写 el.style.transform 会**整体覆盖**元素自己的 transform，
 * 以后想给它加个悬停位移就没地方写了。写变量则各管各的：
 * 位移这份数据由指令提供，怎么用由样式决定（全局 .parallax 类）。
 */
function apply() {
  const y = window.scrollY
  for (const [el, opt] of targets) {
    el.style.setProperty('--parallax-y', parallaxOffset(y, opt.speed, opt.max) + 'px')
  }
}

/** rAF 节流：滚动一次会连发几十个事件，一帧算一次就够 */
function requestUpdate() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    apply()
  })
}

function attach() {
  if (bound) return
  window.addEventListener('scroll', requestUpdate, { passive: true })
  bound = true
}

function detach() {
  if (!bound || targets.size) return
  window.removeEventListener('scroll', requestUpdate)
  cancelAnimationFrame(rafId)
  rafId = 0
  bound = false
}

export const parallax = {
  mounted(el, binding) {
    // 开了"减弱动态效果"就彻底不挂：元素保持原位（--parallax-y 没定义时
    // .parallax 里那条 transform 回落到 0px，等于没动）
    if (prefersReducedMotion()) return

    const opt = binding.value || {}
    targets.set(el, {
      // 参数兜底：写错了不至于让整个元素不见，最多是不动或者动得不对
      speed: Number.isFinite(opt.speed) ? opt.speed : DEFAULTS.speed,
      max: Number.isFinite(opt.max) ? opt.max : DEFAULTS.max
    })

    attach()
    // 立刻算一次再排帧：刷新页面、浏览器恢复滚动位置时，
    // 页面第一帧就停在中间了，不先算一次的话元素会"瞬移"到位
    apply()
  },

  unmounted(el) {
    targets.delete(el)
    el.style.removeProperty('--parallax-y')
    detach()   // 最后一个元素走了就摘掉共享监听
  }
}
