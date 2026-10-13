// ============================================================
// domain/parallax.js —— 视差位移量的换算
// ============================================================
//
// 视差 = 让某个元素"滚得比别的东西慢一点"，于是看起来像浮在另一层。
// 本站只用在两处：页面背景的三团光斑（main.css 的 body::before）
// 和各页顶部的横幅文字（v-parallax 指令）。
//
// 这个文件只做一件事：把"滚了多远"换算成"这个元素该偏移多少像素"。

/**
 * 视差偏移量：滚动距离 × 速度，并夹在上限内。
 *
 * @param {number} scrollY 已滚动距离（window.scrollY）
 * @param {number} speed   速度系数（0.08 = 每滚 100px 位移 8px）。
 *                         正数 = 元素跟着往下挪，看起来比内容滚得慢、像在后层；
 *                         负数 = 往上挪，看起来跑得比内容快、像在前层
 * @param {number} max     位移上限（绝对值，像素）
 * @returns {number} 该写进 translate3d 的 y 偏移
 *
 * 为什么必须有上限：
 * 视差是"越小越高级、越大越头晕"的动效。没有上限的话，
 * 一个长页面上滚到底能位移几百像素 —— 背景光斑会整块飘走，视口边缘露出底色。
 * 夹住之后它的行为变成"开头几屏轻轻动一下，后面就不动了"，
 * 这才是"背景有点呼吸感"而不是"背景在乱跑"。
 * （main.css 里 body::before 留了 48px 的余量，上限必须开在 48 以内，
 *   否则位移到头时光斑会露出边。）
 */
export function parallaxOffset(scrollY, speed, max) {
  const raw = scrollY * speed

  // 量不到滚动位置时给 0：NaN 会一路传进 CSS 变量，
  // 让整条 transform 声明作废（不报错，只是不动，很难查）
  if (!Number.isFinite(raw)) return 0

  if (raw > max) return max
  if (raw < -max) return -max
  return raw
}
