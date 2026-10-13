// ============================================================
// test/vocab.test.js —— 词汇表的对应关系
// ============================================================
//
// 跑法（在 dota-guide-frontend 目录下）：
//     npm test
//
// 这个文件断言的**不是**"函数算得对"，而是"对应关系没被改坏"：
// 数据库里出现一个没见过的主属性值，界面会走到哪一支、长什么样。
// 这些对应关系以前是散在模板里的字符串拼接，改了没人知道；现在能被钉住。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { attrToken, categoryBadge, skillBarClass, UNKNOWN_TOKEN } from '../src/domain/vocab.js'

// ---------- 主属性 ----------

test('attrToken：四种主属性各有一个 token', () => {
  assert.equal(attrToken('力量'), 'str')
  assert.equal(attrToken('敏捷'), 'agi')
  assert.equal(attrToken('智力'), 'int')
  assert.equal(attrToken('全才'), 'all')
})

test('attrToken：没见过的值一律走 unknown，绝不返回原值', () => {
  // ⚠️ 这是整个文件的重点。返回原值是**最诱人**的兜底写法：
  //    `attrToken('野性')` → '野性'，模板拼出 data-token="野性"，
  //    CSS 里没有这条规则 —— 页面只是"没有颜色"，不报错、不警告、不留痕。
  //    测试跑不过才是唯一能发现的时机。
  assert.equal(attrToken('野性'), UNKNOWN_TOKEN)
  assert.equal(attrToken(''), UNKNOWN_TOKEN)
  assert.equal(attrToken(null), UNKNOWN_TOKEN)
  assert.equal(attrToken(undefined), UNKNOWN_TOKEN)
})

test('attrToken：token 必须是纯 ASCII —— 它要拼进 CSS 属性选择器', () => {
  // 中文做选择器不是不行，是会被两个地方绊倒：
  //   1. CSS 里得和模板逐字一致，多一个空格就失配
  //   2. 将来要 minify / 换工具链时，非 ASCII 标识符是常见的踩坑点
  for (const attr of ['力量', '敏捷', '智力', '全才', '野性']) {
    assert.match(attrToken(attr), /^[a-z]+$/)
  }
})

// ---------- 技能分类 ----------

test('categoryBadge：魔晶两项共用徽章、神杖两项共用徽章', () => {
  assert.deepEqual(categoryBadge({ skillCategory: '魔晶新增' }), { text: '魔晶', cls: 'badge-shard' })
  assert.deepEqual(categoryBadge({ skillCategory: '魔晶强化' }), { text: '魔晶', cls: 'badge-shard' })
  assert.deepEqual(categoryBadge({ skillCategory: '神杖新增' }), { text: '神杖', cls: 'badge-scepter' })
  assert.deepEqual(categoryBadge({ skillCategory: '神杖强化' }), { text: '神杖', cls: 'badge-scepter' })
})

test('categoryBadge：普通技能和未知分类都不给徽章', () => {
  // 基础技能没有徽章可标；未知分类给 null 让模板 v-if 直接不渲染，
  // 而不是画出个没有文字的空白徽章
  assert.equal(categoryBadge({ skillCategory: '基础' }), null)
  assert.equal(categoryBadge({ skillCategory: '还不知道叫什么' }), null)
  assert.equal(categoryBadge({}), null)
  assert.equal(categoryBadge({ skillCategory: null }), null)
})

// ---------- 技能按键 ----------

test('skillBarClass：R/D/F 各有自己的色条', () => {
  assert.equal(skillBarClass({ skillKey: 'R' }), 'skill-r')
  assert.equal(skillBarClass({ skillKey: 'D' }), 'skill-d')
  assert.equal(skillBarClass({ skillKey: 'F' }), 'skill-f')
})

test('skillBarClass：Q/W/E 走 skill-plain，不是 skill-unknown', () => {
  // ⚠️ 这条是三支里最容易写丢的一支：把 Q/W/E 和"没见过的按键"合并，
  //    每个基础技能卡都会凭空多出一条中性色条 —— 而且因为"看起来也还行"，
  //    这种视觉回归在评审里几乎不会被发现。
  for (const k of ['Q', 'W', 'E']) {
    assert.equal(skillBarClass({ skillKey: k }), 'skill-plain')
  }
})

test('skillBarClass：没见过的按键走 skill-unknown，和 Q/W/E 区分开', () => {
  // 合并这一支的后果和上一条相反：官网改键位时新按键会静默长得和普通技能一样，
  // 等于"异常"和"正常"共用一个外观，谁都看不出来
  assert.equal(skillBarClass({ skillKey: 'Z' }), 'skill-unknown')
  assert.equal(skillBarClass({ skillKey: '' }), 'skill-unknown')
  assert.equal(skillBarClass({}), 'skill-unknown')
})

test('skillBarClass：按键统一按小写比对', () => {
  // 官网的 skill_key 全是大写（R/D/F/Q/W/E），但"大写"是数据现状、不是接口约定，
  // 所以比对前统一降一档。这条测试是防止有人把 .toLowerCase() 当成冗余删掉。
  assert.equal(skillBarClass({ skillKey: 'r' }), 'skill-r')
  assert.equal(skillBarClass({ skillKey: 'q' }), 'skill-plain')
})

test('skillBarClass：只降大小写，不 trim —— 带空格的按键算 unknown', () => {
  // 这条不是在测"应该如此"，是在**记录现状**：实现里没有 trim。
  // 真遇到带空格的按键，正确做法是去生成器那边修数据（skill_key 是物化列），
  // 而不是让渲染层悄悄容错 —— 悄悄容错会把数据问题一直捂到线上。
  assert.equal(skillBarClass({ skillKey: ' r ' }), 'skill-unknown')
})
