// ============================================================
// test/progress.test.js —— 顶栏下面那条阅读进度线
// ============================================================
//
// 这个换算短得很，但它有两个地方特别容易写错，而且错了都不报错：
//   a) 分母用文档总高而不是"还能滚动的距离" → 进度条永远差最后一截
//   b) 短页面返回 0 而不是 null → 顶上挂一条永远不动的空进度条，看着像卡死

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { progressOf } from '../src/domain/progress.js'

// 约定：文档 5000px 高、视口 1000px → 能滚的距离是 4000px
const DOC = 5000
const VIEW = 1000

test('progressOf：滚到一半 → 0.5', () => {
  assert.equal(progressOf(2000, DOC, VIEW), 0.5)
})

test('progressOf：没滚动 → 0', () => {
  assert.equal(progressOf(0, DOC, VIEW), 0)
})

test('progressOf：滚到底 → 正好 1', () => {
  // ⚠️ 这一条是"分母必须是 docHeight - viewportHeight"的直接体现。
  // 滚到底时 scrollY = 5000 - 1000 = 4000，不是 5000。
  // 分母若写成文档总高 5000，这里算出来是 0.8 —— 进度条永远填不满
  assert.equal(progressOf(4000, DOC, VIEW), 1)
})

test('progressOf：页面比视口短 → null（这一页没有进度可言）', () => {
  // 后端挂了、只剩一个错误提示的详情页就是这种。返回 0 的话
  // 屏幕上会挂一条永远不动、也永远填不满的线，看起来像卡住了
  assert.equal(progressOf(0, 400, VIEW), null)
})

test('progressOf：文档高度和视口正好相等 → null（还是滚不动）', () => {
  // 边界：track = 0 说明一像素都滚不动，同样没有进度可言。
  // 注意这里不能返回 0 ——「滚不动」和「进度是 0%」是两回事
  assert.equal(progressOf(0, VIEW, VIEW), null)
})

test('progressOf：量不到高度（NaN）→ null，而不是 NaN', () => {
  // NaN 一路传下去会让 CSS 变量失效、进度条宽度变成默认值，
  // 是那种"不报错但就是不对"的 bug。在这里就地拦住
  assert.equal(progressOf(0, NaN, VIEW), null)
  assert.equal(progressOf(0, VIEW, NaN), null)
})

test('progressOf：量不到滚动位置（NaN）→ 退化成 0，而不是 NaN', () => {
  // 和上一条的区别：这里是"页面确实能滚，只是不知道滚到哪了"，
  // 所以进度条该照常显示（显示成从头开始），而不是整条不显示。
  // 注意 NaN 参与任何比较都是 false，光靠下面那两条夹取是拦不住它的
  assert.equal(progressOf(NaN, DOC, VIEW), 0)
  assert.equal(progressOf(undefined, DOC, VIEW), 0)
})

test('progressOf：移动端回弹把 scrollY 拉成负数 → 夹到 0', () => {
  // 顶到页面最上面继续下拉时，iOS 的橡皮筋回弹会让 scrollY 变成负数。
  // 不夹的话进度条会往左缩出去
  assert.equal(progressOf(-120, DOC, VIEW), 0)
})

test('progressOf：scrollY 超过可滚动距离 → 夹到 1', () => {
  // 同理，到底之后继续往回弹会超过上限
  assert.equal(progressOf(4500, DOC, VIEW), 1)
})
