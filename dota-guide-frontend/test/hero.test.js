// ============================================================
// test/hero.test.js —— 英雄字段的三种展示换算
// ============================================================
//
// 这三个函数回答的都是"这一列的值该怎么画"：
//   定位字符串 → 若干个小徽章 / 复杂度 → 星数 / 号位 → 进度条填充百分比。
//
// 它们以前是 HeroDetailView 里的三个 computed，只有打开浏览器、点进某个
// 具体英雄才验证得到。现在只吃字符串和数字，测试里三行就能覆盖一个边界。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { splitRoles, complexityStars, posFillPercent } from '../src/domain/hero.js'

// ---------- 定位 ----------

test('splitRoles：拆开顿号分隔的定位', () => {
  assert.deepEqual(splitRoles('核心、控制、肉盾、先手'), ['核心', '控制', '肉盾', '先手'])
})

test('splitRoles：中英文逗号也拆 —— 官网换过标点', () => {
  // 只认顿号的写法在官网改用逗号的那天会静默退化成"整串当成一个标签"，
  // 界面上就是一个特别长的小徽章，不难看，所以也没人会发现。
  assert.deepEqual(splitRoles('核心,控制'), ['核心', '控制'])
  assert.deepEqual(splitRoles('核心，控制'), ['核心', '控制'])
  assert.deepEqual(splitRoles('核心, 控制、肉盾'), ['核心', '控制', '肉盾'])
})

test('splitRoles：顺手清掉多余空格和空标签', () => {
  // "核心、、控制" 会 split 出一个空串 —— 若不过滤，模板 v-for 会渲染出一个
  // 没有文字的小徽章（边框还在，看得见）
  assert.deepEqual(splitRoles(' 核心 、 控制 '), ['核心', '控制'])
  assert.deepEqual(splitRoles('核心、、控制'), ['核心', '控制'])
})

test('splitRoles：空值返回空数组，不是 [""]', () => {
  // 返回 [''] 的话模板会渲染出一个空徽章，所以这里必须给空数组，调用方直接 v-for
  assert.deepEqual(splitRoles(''), [])
  assert.deepEqual(splitRoles(null), [])
  assert.deepEqual(splitRoles(undefined), [])
})

// ---------- 复杂度 ----------

test('complexityStars：1/2/3 星', () => {
  assert.equal(complexityStars(1), '★')
  assert.equal(complexityStars(2), '★★')
  assert.equal(complexityStars(3), '★★★')
})

test('complexityStars：接受数字字符串（后端给的是字符串时也能跑）', () => {
  assert.equal(complexityStars('2'), '★★')
})

test('complexityStars：缺值或越界一律按 1 颗星处理', () => {
  // 宁可少画一颗星，也不要画出空字符串（徽章变成"难度 "）或者超长的星串
  for (const bad of [0, 4, -1, 1.5, null, undefined, '', 'abc']) {
    assert.equal(complexityStars(bad), '★', `complexityStars(${JSON.stringify(bad)}) 应该是 1 颗星`)
  }
})

// ---------- 号位 ----------

test('posFillPercent：1 号位满格、5 号位 20%', () => {
  // "资源优先级"：1 号位吃资源最多，所以画满
  assert.equal(posFillPercent('1号位'), 100)
  assert.equal(posFillPercent('2号位'), 80)
  assert.equal(posFillPercent('3号位'), 60)
  assert.equal(posFillPercent('4号位'), 40)
  assert.equal(posFillPercent('5号位'), 20)
})

test('posFillPercent：复合号位取第一个数字', () => {
  // 数据里有 "4/5号位" 这种值（两个位置都能打），取靠前那个
  assert.equal(posFillPercent('4/5号位'), 40)
})

test('posFillPercent：解析不出合法号位时返回 0（模板据此不画进度条）', () => {
  // 返回 0 而不是某个默认值：0 在模板里 v-if 判假，整条进度条不渲染，
  // 好过画一根空条子让人以为"这个英雄不吃资源"
  for (const bad of ['', null, undefined, '全位置', '0号位', '6号位']) {
    assert.equal(posFillPercent(bad), 0, `posFillPercent(${JSON.stringify(bad)}) 应该是 0`)
  }
})
