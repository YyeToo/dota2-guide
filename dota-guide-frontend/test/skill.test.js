// ============================================================
// test/skill.test.js —— 技能的两道是非题
// ============================================================
//
// 这两个谓词决定技能落在详情页的哪个面板、带不带"先天"标记。
// 它们只有一行实现，但**判据选错**（比如用"按键是不是空"代替"分类是不是强化"）
// 时页面不会报错，只会把技能摆到不该在的位置上。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isUpgradeSkill, isInnate } from '../src/domain/skill.js'

// ---------- 强化类 ----------

test('isUpgradeSkill：只认"魔晶强化"和"神杖强化"', () => {
  assert.equal(isUpgradeSkill({ skillCategory: '魔晶强化' }), true)
  assert.equal(isUpgradeSkill({ skillCategory: '神杖强化' }), true)
})

test('isUpgradeSkill："新增"类不算强化 —— 它们占独立按键，要进按键面板', () => {
  // ⚠️ 这条是最容易写错的地方：四个分类名字里都有"魔晶"/"神杖"，
  //    用 substring/includes('魔晶') 之类的写法会把"新增"也吞进来，
  //    于是 D/F 两个技能从按键面板里消失、跑进强化面板，还没有按键字母。
  assert.equal(isUpgradeSkill({ skillCategory: '魔晶新增' }), false)
  assert.equal(isUpgradeSkill({ skillCategory: '神杖新增' }), false)
})

test('isUpgradeSkill：判据是分类列，不是"按键为空"', () => {
  // 物化之前"分类是强化类"和"按键为空"恰好等价，所以两种写法当时都能跑对。
  // 等价是巧合，不是定义 —— 真出现"基础技能放不下第 5 个、只能挤进 D 键"这种边角时，
  // 两种写法就分道扬镳了。这条测试把判据钉在分类上。
  assert.equal(isUpgradeSkill({ skillCategory: '基础', skillKey: '' }), false)
  assert.equal(isUpgradeSkill({ skillCategory: '魔晶强化', skillKey: 'Q' }), true)
})

test('isUpgradeSkill：分类缺失时不算强化（走按键面板，不会整条消失）', () => {
  assert.equal(isUpgradeSkill({}), false)
  assert.equal(isUpgradeSkill({ skillCategory: null }), false)
})

// ---------- 先天技能 ----------

test('isInnate：数据库的 1/0 在这里转成布尔', () => {
  // 后端给的是 TINYINT（1/0），不是 true/false。
  // 转换收在这个函数里，模板才不会写出 `skill.isInnate === 1` 这种表示法泄漏的代码。
  assert.equal(isInnate({ isInnate: 1 }), true)
  assert.equal(isInnate({ isInnate: 0 }), false)
})

test('isInnate：只认数字 1，不认字符串 "1"', () => {
  // 这条同样是记录现状。后端字段是 TINYINT、MyBatis 映射成 Integer，
  // 所以这里是数字；真收到字符串说明映射改过了，那时候要修的是映射，
  // 不是在这儿加一个 `|| skill.isInnate === '1'` 把它盖住。
  assert.equal(isInnate({ isInnate: '1' }), false)
})

test('isInnate：字段缺失时不算先天', () => {
  assert.equal(isInnate({}), false)
  assert.equal(isInnate({ isInnate: null }), false)
})

test('isInnate：不看技能名的"先天·"前缀', () => {
  // 那是生成器为了把信息塞进名字里打的补丁，代价是技能名不再是官网原名。
  // 现在信息有正经的列了，名字回归干净；这个名字里带前缀但列为 0 的技能
  // 应该被判成"不是先天"。
  assert.equal(isInnate({ skillName: '先天·剑舞', isInnate: 0 }), false)
})
