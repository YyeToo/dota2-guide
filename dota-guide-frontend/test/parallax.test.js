// ============================================================
// test/parallax.test.js —— 视差位移量
// ============================================================
//
// 视差是这个项目里"最容易做过头"的动效：位移大了立刻从"背景有点呼吸感"
// 变成"背景在乱跑"。所以这里最要紧的一条是上限真的夹得住。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parallaxOffset } from '../src/domain/parallax.js'

test('parallaxOffset：位移 = 滚动距离 × 速度', () => {
  // 背景光斑用 0.1：滚 100px，光斑跟着往下挪 10px（看起来比内容滚得慢）
  assert.equal(parallaxOffset(100, 0.1, 40), 10)
  assert.equal(parallaxOffset(300, 0.08, 40), 24)
})

test('parallaxOffset：没滚动就不位移', () => {
  assert.equal(parallaxOffset(0, 0.1, 40), 0)
})

test('parallaxOffset：超过上限就停在 上限 上，不继续涨', () => {
  // ⚠️ 这条是重点。上限存在的意义就是"开头几屏轻轻动一下，后面不动了"。
  // 夹不住的话，一个长页面滚到底能位移几百像素 —— 背景光斑整块飘走，
  // 视口边缘会露出页面底色（main.css 里给 body::before 留了 48px 余量，
  // 上限必须开在 48 以内，就是为它）
  assert.equal(parallaxOffset(1000, 0.1, 40), 40)
  assert.equal(parallaxOffset(99999, 0.5, 40), 40)
})

test('parallaxOffset：负速度（元素跑得比内容快）同样夹得住', () => {
  assert.equal(parallaxOffset(-500, 0.1, 40), -40)
  assert.equal(parallaxOffset(-100, 0.1, 40), -10)
})

test('parallaxOffset：刚好等于上限时不改数', () => {
  assert.equal(parallaxOffset(400, 0.1, 40), 40)
  assert.equal(parallaxOffset(-400, 0.1, 40), -40)
})

test('parallaxOffset：速度为 0 → 元素完全不动（等于没挂视差）', () => {
  assert.equal(parallaxOffset(5000, 0, 40), 0)
})

test('parallaxOffset：量不到滚动位置（NaN）→ 0，而不是 NaN', () => {
  // NaN 传进 CSS 变量会让整条 transform 声明作废 —— 不报错，元素只是不动，
  // 属于"很难查"的那类问题。在这里就地拦住
  assert.equal(parallaxOffset(NaN, 0.1, 40), 0)
  assert.equal(parallaxOffset(undefined, 0.1, 40), 0)
})
