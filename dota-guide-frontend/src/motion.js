// ============================================================
// motion.js —— 全站唯一的"减弱动态效果"开关
// ============================================================
//
// 用户在操作系统里打开"减少动态效果"（前庭功能障碍 / 晕动症人群会开）后，
// 浏览器会让 `prefers-reduced-motion: reduce` 这个媒体查询成立。
// 本站所有滚动动效都要先问过它：成立就【不播动画、直接显示】。
//
// 为什么单独一个文件、而不是各自写一遍 window.matchMedia：
//   问这个问题的地方有四个（v-reveal 指令、v-parallax 指令、
//   背景光斑的视差、回顶按钮的平滑滚动），字符串写错一个字不会报错，
//   只会静默地"这次不生效"。定义收在这一处，四处都对。
//
// ⚠️ 这是 CSS 媒体查询的 JS 版，它**只反映调用那一刻**的设置。
// 用户在当前页面开着的时候去改系统设置，已挂载的指令不会重新判断 ——
// 那种情况由 main.css 末尾那个 @media 块兜底（内容永远看得见）。

/**
 * 用户是否要求"减弱动态效果"。
 * @returns {boolean} true = 不要播动画，直接显示终态
 */
export function prefersReducedMotion() {
  // typeof window 判断是为了让这个模块在 node 里 import 也不炸
  // （纯函数测试、构建时的静态分析都可能碰到它）
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
