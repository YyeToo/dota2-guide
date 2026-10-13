// ============================================================
// test/scrollspy.test.js —— 新手须知页：读到哪一节，哪个页签该亮
// ============================================================
//
// 和 focus.test.js 一样，这条判据原来是页面里"读坐标 + 比大小 + 写状态"
// 揉在一起的循环，只能靠滚动页面拿肉眼验证。抽成纯函数之后，
// 下面这些边角情况（间隙、读到底、还在顶部）都能直接断言。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickActiveSection } from '../src/domain/scrollspy.js'

// 约定：判定线 y = 130，模拟"顶栏 68px + 吸顶页签栏 62px"的下边缘
const LINE = 130

/** 造一节：给上边缘和高度，算出 top/bottom */
const sec = (key, top, height) => ({ key, top, bottom: top + height })

// 三节的典型布局：每节 600px 高，间隔 24px（就是 .guide 的 gap）
const THREE = [
  sec('positions', 154, 600),    // bottom 754
  sec('differences', 778, 600),   // bottom 1378
  sec('whys', 1402, 600)          // bottom 2002
]

test('pickActiveSection：判定线落在哪一节里，就高亮哪一节', () => {
  // positions 的 top 154 > 130，还在它上面 —— 一节都没滚到
  assert.equal(pickActiveSection(THREE, LINE), null)

  // 整体上移 100px：positions 的 top 变成 54（滚过判定线），bottom 654 仍在下面
  const scrolled = THREE.map((r) => sec(r.key, r.top - 100, r.bottom - r.top))
  assert.equal(pickActiveSection(scrolled, LINE), 'positions')
})

test('pickActiveSection：判定线划出这一节的底部后，仍然算这一节', () => {
  // 这一节很长、读者读到中后段时判定线早已划出它的底部。
  // 只要还没轮到下一节，高亮就不该丢掉
  const rects = [
    sec('positions', -800, 600),   // bottom -200，整节都在屏幕上方
    sec('differences', -100, 600), // 判定线 130 在它内部
    sec('whys', 600, 600)
  ]
  assert.equal(pickActiveSection(rects, LINE), 'differences')
})

test('pickActiveSection：判定线正好落在两节的间隙里时，回退到上一节', () => {
  // ⚠️ 这条是本节流列表最容易翻车的地方，也是"规则 2"存在的理由。
  // 三节之间是 24px 的 flex gap，滚动时判定线一定会从这段间隙里穿过去。
  // 只按"判定线在不在某节内部"判的话，穿过的一瞬间会全部不高亮，
  // 页签上的金色闪一下又回来 —— 用户看到的是"高亮丢了"
  const rects = [
    sec('positions', -500, 620),   // bottom 120，在判定线上方
    sec('differences', 144, 620),  // top 144 > 130：判定线正落在 120~144 这段间隙里
    sec('whys', 788, 620)
  ]
  assert.equal(pickActiveSection(rects, LINE), 'positions')
})

test('pickActiveSection：还没滚到任何一节（在读顶部横幅）时，谁都不高亮', () => {
  // 页面刚打开时，横幅 + 页签栏占满第一屏，三节都还在下面。
  // 这时如果点亮第一个页签，会让人误以为"已经在第一节里了"
  const rects = [
    sec('positions', 900, 600),
    sec('differences', 1524, 600),
    sec('whys', 2148, 600)
  ]
  assert.equal(pickActiveSection(rects, LINE), null)
})

test('pickActiveSection：读完最后一节后继续往下滚，高亮停在最后一节上', () => {
  const rects = [
    sec('positions', -3000, 600),
    sec('differences', -2376, 600),
    sec('whys', -1752, 600)   // 全部在屏幕上方
  ]
  assert.equal(pickActiveSection(rects, LINE), 'whys')
})

test('pickActiveSection：真到了底，就取最后一节', () => {
  // 这一节比较短、整屏都装得下：页面滚到底时它整个都还在判定线【下面】。
  // 没有 atBottom 兜底的话，读者明明在看最后一节，高亮却停在倒数第二节上
  const rects = [
    sec('positions', -2000, 600),
    sec('differences', -1376, 600),
    sec('whys', 200, 400)   // top 200 > 130：判定线还没进到它里面
  ]
  assert.equal(pickActiveSection(rects, LINE, { atBottom: true }), 'whys')
})

test('pickActiveSection：到了底就以最后一节为准，哪怕判定线还在倒数第二节里', () => {
  // ⚠️ 这条钉的是"规则 1 排在规则 2 前面"这个顺序。
  // 页面到底时，短一点的最后一节整个待在屏幕下半部分，而判定线（在屏幕上部）
  // 还划在倒数第二节身上。按顺序判定的话会挑中倒数第二节 ——
  // 那一节此刻已经完全滚出屏幕了，读者看的是最下面那一节
  const rects = [
    sec('positions', -3000, 600),
    sec('differences', -300, 600),  // 判定线 130 还在它里面
    sec('whys', 400, 380)           // 屏幕下半部分的最后一节
  ]
  assert.equal(pickActiveSection(rects, LINE, { atBottom: true }), 'whys')
  // 同样这组坐标，只要还能继续滚，就该老实按判定线判
  assert.equal(pickActiveSection(rects, LINE), 'differences')
})

test('pickActiveSection：同样是上面那种情况，没到底就不该硬点最后一节', () => {
  // 和上一条对照：不传 atBottom（说明页面还能继续滚），
  // 就该老实回退到"已经滚过的最后一节"，而不是提前点亮最后一节
  const rects = [
    sec('positions', -2000, 600),
    sec('differences', -1376, 600),
    sec('whys', 200, 400)
  ]
  assert.equal(pickActiveSection(rects, LINE), 'differences')
  assert.equal(pickActiveSection(rects, LINE, { atBottom: false }), 'differences')
})

test('pickActiveSection：只有一节、且它盖住判定线时，就是它', () => {
  assert.equal(pickActiveSection([sec('positions', -100, 600)], LINE), 'positions')
})

test('pickActiveSection：空数组返回 null（不抛异常）', () => {
  // 页签栏在挂载时就要算一次，这一刻 DOM 还没收集完也是可能的
  assert.equal(pickActiveSection([], LINE), null)
  assert.equal(pickActiveSection([], LINE, { atBottom: true }), null)
})

test('pickActiveSection：返回的是 key 字符串，不是下标或元素', () => {
  const key = pickActiveSection([sec('whys', -50, 600)], LINE)
  assert.equal(typeof key, 'string')
  assert.equal(key, 'whys')
})
