// ============================================================
// domain/progress.js —— 阅读进度条的百分比
// ============================================================
//
// 顶栏下面那条随滚动变长的金线（ScrollProgress 组件）。
// 它需要把"滚了多远"换算成 0~1 之间的一个数，这个文件只做这一件事。

/**
 * 阅读进度：滚过的距离 ÷ 还能滚的距离。
 *
 * @param {number} scrollTop      已滚动距离（window.scrollY）
 * @param {number} docHeight      文档总高度（document.documentElement.scrollHeight）
 * @param {number} viewportHeight 视口高度（window.innerHeight）
 * @returns {number|null} 0~1 的进度；**页面根本滚不动时返回 null**
 *
 * 为什么滚不动时要返回 null，而不是返回 0 或 1：
 * 那是"这一页压根没有进度可言"和"进度是 0%"两种完全不同的意思。
 * 返回 0 的话，短页面（比如后端挂了、只剩一个错误提示的详情页）顶上会挂着
 * 一条永远不动的空进度条 —— 看起来像卡住了。null 让组件直接不渲染。
 *
 * ⚠️ 分母是 docHeight - viewportHeight，不是 docHeight：
 * 滚到底时 scrollTop = 文档高 - 视口高（不是文档高），
 * 拿 docHeight 当分母的话永远到不了 1，进度条会差最后一截。
 */
export function progressOf(scrollTop, docHeight, viewportHeight) {
  const track = docHeight - viewportHeight

  // 页面比视口还短（或正好等长）→ 没有可滚动的距离。
  // 写成 !(track > 0) 而不是 track <= 0：顺手把 NaN 也接住了
  // （量不到高度时传进来的是 NaN，NaN 参与任何比较都是 false）
  if (!(track > 0)) return null

  // 挡掉"量不到滚动位置"：NaN 参与任何比较都是 false，下面两条夹取拦不住它，
  // 最后会把 NaN 原样返回出去（传进 CSS 变量就是那条声明静默作废）。
  // 这里退化成 0 —— 页面确实能滚，只是不知道滚到哪了，显示成"从头开始"最无害
  if (!Number.isFinite(scrollTop)) return 0

  const p = scrollTop / track

  // 夹到 0~1：移动端"橡皮筋"回弹会把 scrollY 拉成负数或超过上限，
  // 不夹的话进度条会缩到反方向、或者越过右边框
  if (p < 0) return 0
  if (p > 1) return 1
  return p
}
