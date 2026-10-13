// ============================================================
// domain/focus.js —— 进阶页"滚动聚光灯"的判定
// ============================================================
//
// 进阶页滚动时，正在看的那一条会被点亮（金色边框 + 底色），其余压暗。
// "哪一条算正在看"的判据就是视口中心线离谁最近 —— 这个文件只做这件事。

/**
 * 从一批矩形里挑出中心离视口中心线最近的那一条。
 *
 * @param {{key: string, top: number, bottom: number}[]} rects
 *        各条目的视口坐标（getBoundingClientRect() 的 top/bottom 原样传进来）
 * @param {number} center
 *        视口中心线的 y 坐标（= window.innerHeight / 2）
 * @returns {string|null} 被选中条目的 key；一条都不在视口里时返回 null
 *
 * 为什么把这段单独抽出来：
 * 原来它和 el.getBoundingClientRect()、el.dataset.fk、focusedKey.value = …
 * 全揉在同一个 for 循环里。那个形状**只能靠滚动页面来验证** ——
 * 不碰 DOM 就没法断言"给这几条矩形、中心线在这，应该点亮第 3 条"。
 * 抽出来之后它只吃数字、只吐字符串，node --test 就能跑（见 test/focus.test.js）。
 */
export function pickFocusKey(rects, center) {
  // center 是视口中心线，所以视口底边就是它的两倍。
  // 写成有名字的局部变量，免得下面出现一个含义不明的裸 center * 2。
  const viewportBottom = center * 2

  let bestKey = null
  let bestDist = Infinity

  for (const r of rects) {
    // 纵向过滤：完全在视口上方或下方的（已经滚过去了 / 还没滚到）不参与评选。
    // 少了这一步，刚滚过屏幕的那一条会一直霸占焦点。
    if (r.bottom <= 0 || r.top >= viewportBottom) continue

    // 取中点离中心线最近的那一条
    const d = Math.abs((r.top + r.bottom) / 2 - center)
    if (d < bestDist) {
      bestDist = d
      bestKey = r.key
    }
  }

  return bestKey
}
