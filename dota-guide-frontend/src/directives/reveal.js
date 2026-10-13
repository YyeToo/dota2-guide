// ============================================================
// directives/reveal.js —— v-reveal：滚动到才入场
// ============================================================
//
// 用法：
//   <div class="hero-card card reveal" v-reveal>…</div>          ← 进视口时淡入上浮
//   <div class="hero-card card reveal" v-reveal="120">…</div>    ← 晚 120ms 再动
//   <div class="… reveal" v-reveal="60 * (i % 3)">…</div>        ← 同屏几张错开
//
// 元素上要自己带 `reveal` 类（隐藏态和过渡都定义在 main.css 的 .reveal 里），
// 指令只管**什么时候**把 .is-visible 加上去。
// 这样分工的好处：样式全在 CSS、时序全在 JS，两边都不用猜对方在干什么。
//
// ⚠️ 约束：只挂**不带动态 :class 绑定**的元素，或者动态 class 的值不会变。
//   原因：Vue 更新时是 `el.className = 静态类 + 动态类`（整体赋值），
//   我们自己加进去的 is-visible 不在那个字符串里，一旦触发就会**被抹掉**——
//   元素会退回隐藏态。详情页的技能卡有 :class，但它的值（skillBarClass）
//   对同一个技能是固定的，Vue 检测到没变化就不会重写 class，所以是安全的。
//   （真遇到会变的动态 class，就把入场标记换成 data- 属性，Vue 不管那些。）

import { prefersReducedMotion } from '../motion'

// 每个元素的观察器/定时器。用 WeakMap 而不是挂在 el._xxx 上：
// 一来不污染 DOM 节点，二来元素被移除后条目会被自动回收，不会泄漏。
const state = new WeakMap()

/**
 * 触发范围比视口**小一圈**：底部往上收 60px。
 * 意思是"元素要探出视口底边 60px 才开始动"，而不是一贴边就闪。
 *
 * ⚠️ 为什么是固定 60px，不是 -15% 这种百分比：
 *   百分比会随视口高度放大。1280×805 的窗口里 -15% 就是 121px ——
 *   比一张英雄卡还高，于是图鉴页首屏那排卡正好卡在"露了 60% 、但整张还是透明的"
 *   那条缝里：一进页面，筛选栏下面是一片约 100px 高的**空白**，
 *   往下滚 80px 卡片才浮上来。实测出来的就是这么个数。
 *   固定 60px 之后，会留在缝里的只剩"刚探出不到 60px"的元素 ——
 *   那点高度看起来就是"下面还有内容"，不会读成"这里缺了一块"。
 *   （本来想让挂载时"只要在视口里就直接显示"，但那需要在每个元素上同步读一次
 *     getBoundingClientRect，正是下面注释里说的、要避免的那种强制布局。）
 */
const ROOT_MARGIN = '0px 0px -60px 0px'

/** 延时摘掉前的兜底时长（入场动画本身 0.5s + 余量） */
const CLEAR_AFTER = 600

export const reveal = {
  mounted(el, binding) {
    // v-reveal="120" 里的 120；没写、写错、写负数都当 0
    const delay = Math.max(0, Number(binding.value) || 0)

    // ① 系统要求减弱动态效果 —— 直接显示终态，连观察器都不挂。
    //    （main.css 末尾还有一道 CSS 兜底，两道都留着：JS 这道管"挂载时已开"，
    //      CSS 那道管"挂载后才开"）
    if (prefersReducedMotion()) {
      el.classList.add('is-visible')
      return
    }

    // ② 交给 IntersectionObserver 判断"进没进视口"。
    //
    //    为什么不用 getBoundingClientRect 自己算：
    //    本页一次会挂 24~127 个 v-reveal，每个都读一次矩形 = 每个都强制一次
    //    同步布局（reflow）。观察器把这件事交给浏览器在渲染流程里统一算，
    //    零强制布局。
    //
    //    ⚠️ 关键点：观察器注册后会**立刻回调一次**，报告的正是"此刻在不在视口里"。
    //    这一个回调同时解决了两件本来要单独写代码的事：
    //      · 首屏的卡片 / 刷新页面后浏览器恢复的滚动位置 —— 它们本来就在视口里，
    //        于是直接显示、**不播动画**（一进页面就看到内容在自己动，很怪）
    //      · 真正在屏幕外的 —— 等滚到跟前再动
    //    而且这个回调跑在浏览器的"绘制之前"，所以元素不会先露一下再隐藏，没有闪烁。
    let firstCallback = true

    const io = new IntersectionObserver((entries) => {
      // 一次可能回多条（同一元素理论上只有一条），取最后一条就够
      const entry = entries[entries.length - 1]
      const isFirst = firstCallback
      firstCallback = false

      if (!entry.isIntersecting) return   // 还没滚到，继续等

      // 只在"这次要播动画"的时候才写延时：
      // 首屏直接显示的那批不写，免得本来就该静止的内容又被推后 120ms
      if (!isFirst && delay) {
        el.style.setProperty('--reveal-delay', delay + 'ms')
      }

      el.classList.add('is-visible')
      io.disconnect()   // 只播一次：之后不管怎么滚都不再触发，观察器立刻回收

      if (isFirst && !delay) return

      // 延时用完就摘掉。
      // ⚠️ 不摘会有个很难查的小毛病：transition-delay 是写在 .reveal 上的，
      //    它对**所有**过渡生效 —— 包括悬停时的边框变色。
      //    留着 120ms 的话，鼠标移上去边框要等一下才反应。
      const timer = setTimeout(() => {
        el.style.removeProperty('--reveal-delay')
      }, delay + CLEAR_AFTER)
      state.set(el, { io: null, timer })
    }, { rootMargin: ROOT_MARGIN })

    state.set(el, { io, timer: 0 })
    io.observe(el)
  },

  unmounted(el) {
    // 元素在还没滚到之前就被移除（换筛选条件、切路由）时必须清理，
    // 否则观察器一直挂在它身上 —— 闭包引用着 DOM，属于内存泄漏
    const s = state.get(el)
    if (!s) return
    s.io?.disconnect()
    clearTimeout(s.timer)
    state.delete(el)
  }
}
