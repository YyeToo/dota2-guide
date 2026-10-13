// ============================================================
// test/focus.test.js —— 进阶页滚动聚光灯：谁该被点亮
// ============================================================
//
// 这是本批次里**唯一一个"以前根本没法测"**的函数。
//
// 它原来是 AdvancedView 里那个 for 循环：读 getBoundingClientRect()、
// 比距离、直接写 focusedKey.value，三件事揉在一起。要验证只能真的滚动页面，
// 用肉眼看"是不是这一条亮了"。抽成纯函数之后，只要给几组数字就能把
// 边角情况全钉住 —— 特别是下面那条"完全滚出屏幕的条目不能霸占焦点"。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickFocusKey } from '../src/domain/focus.js'

// 约定：center = 300，代表 600px 高的视口；视口纵坐标范围 0~600
const CENTER = 300

/** 造一条矩形记录：给上边缘和高度，算出 top/bottom */
const rect = (key, top, height) => ({ key, top, bottom: top + height })

test('pickFocusKey：取中点离中心线最近的那一条', () => {
  const rects = [
    rect('a', 0, 100),    // 中点 50  → 距离 250
    rect('b', 250, 100),  // 中点 300 → 距离 0
    rect('c', 500, 100)   // 中点 550 → 距离 250
  ]
  assert.equal(pickFocusKey(rects, CENTER), 'b')
})

test('pickFocusKey：比的是"中点"，不是"上边缘"', () => {
  // 这两条能区分两种写法：
  //   按上边缘比 —— a 的上边缘 280 离 300 只差 20，比 b 的 200 近，会选 a
  //   按中点比   —— b 的中点 230 离 300 差 70，比 a 的 420（差 120）近，选 b
  // 读者视线的落点是卡片中心，所以中点才是对的（这也是原实现的意图）
  const rects = [
    rect('a', 280, 280),  // 中点 420 → 距离 120
    rect('b', 200, 60)    // 中点 230 → 距离  70
  ]
  assert.equal(pickFocusKey(rects, CENTER), 'b')
})

test('pickFocusKey：全部滚出屏幕上方时返回 null', () => {
  // 用户滚到页面最底下的"来源"区域时，当前面板可能一条都不在视口里。
  // 返回 null，调用方就保持现状 —— 否则会把焦点跳到屏幕外某条上，
  // 结果是一条早就滚过去、看不见的卡片一直亮着。
  const rects = [rect('a', -300, 100), rect('b', -150, 100)]
  assert.equal(pickFocusKey(rects, CENTER), null)
})

test('pickFocusKey：全部还没滚到（在视口下方）时返回 null', () => {
  const rects = [rect('a', 700, 100), rect('b', 900, 100)]
  assert.equal(pickFocusKey(rects, CENTER), null)
})

test('pickFocusKey：空数组返回 null', () => {
  assert.equal(pickFocusKey([], CENTER), null)
})

test('pickFocusKey：刚滚过去的那一条不参与评选', () => {
  // ⚠️ 这条是整个过滤存在的理由，也是最反直觉的一条：
  //    a 完全在视口上方（bottom = -10），但因为只滚过去一点点，
  //    它离中心线只有 330；而 b 是一条很长、大部分在屏幕外的卡片，
  //    中点离中心线有 797.5。**没有过滤的话 a 会赢** —— 于是一条已经看不见的
  //    卡片会一直霸占焦点，直到下一条的中点越过它。
  const rects = [
    rect('a', -50, 40),      // 中点 -30   → 距离 330，但完全在视口上方
    rect('b', -1000, 1005)   // 中点 -497.5 → 距离 797.5，但 bottom=5，还在视口里
  ]
  assert.equal(pickFocusKey(rects, CENTER), 'b')
})

test('pickFocusKey：判"在不在视口里"用的是 center*2，不是写死的 600', () => {
  // center 就是视口中心线，所以视口下边界是它的两倍。
  // 这条用一个不同的 center 验证函数没有把 600 写死在里面。
  const rects = [
    rect('a', 100, 100),   // center=200 时：中点 150，距离 50
    rect('b', 500, 100)    // top 500 >= 400（= center*2），在视口下方，不参与
  ]
  assert.equal(pickFocusKey(rects, 200), 'a')
})

test('pickFocusKey：返回的是 key，不是下标或元素', () => {
  const key = pickFocusKey([rect('laning-3', 250, 100)], CENTER)
  assert.equal(typeof key, 'string')
  assert.equal(key, 'laning-3')
})
