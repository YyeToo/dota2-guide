// ============================================================
// test/lib.test.js —— lib/ 各阶段的单元测试
//
// 全部用手写的小数据，不读 _official_raw/、不连数据库，所以随时都能跑：
//   cd sql && node --test test/
//
// 覆盖的是「规则」本身：文本清洗的坑、按键分类的边界、复核清单的分级。
// 「跑完 127 个英雄结果对不对」由 golden.test.js 负责。
// ============================================================

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { cleanText, findValue, applyManual } = require('../lib/text');
const { typeOf, grantedBy, pickBaseAbilities } = require('../lib/skills');
const { sqlStr } = require('../lib/render');
const { emptyReview, mergeReview, hasBlocking, blockingHits } = require('../lib/review');
const { buildHeroes } = require('../lib/heroes');
const { buildSkills } = require('../lib/skills');
const { ALIASES, NEW_HERO_DATA, AVATAR_PREFIX } = require('../lib/vocab');

// ============================================================
// text.js
// ============================================================

describe('cleanText', () => {
  test('把 %token% 换成 special_values 里的第一个数值', () => {
    const sv = [{ name: 'damage', values_float: [120.0] }];
    assert.equal(cleanText('造成 %damage% 点伤害', sv), '造成 120 点伤害');
  });

  test('查不到的 token 保留原文（交给复核清单发现，不静默丢掉）', () => {
    assert.equal(cleanText('造成 %nope% 点伤害', []), '造成 %nope% 点伤害');
  });

  test('%% 还原成字面 %，且必须在 token 替换之后做', () => {
    // 官网常写 "%damage%%%"（token 紧跟字面 %）。若先处理 %%，
    // token 的右括号会被当成 %% 的左半边吃掉，token 永远匹配不上。
    const sv = [{ name: 'damage', values_float: [120] }];
    assert.equal(cleanText('造成 %damage%%% 伤害', sv), '造成 120% 伤害');
  });

  test('去掉 HTML 标签', () => {
    assert.equal(cleanText('造成 <b>100</b> 点伤害<br/>', []), '造成 100 点伤害');
  });

  test('把连续空格压成一个、首尾去空白', () => {
    assert.equal(cleanText('  造成   120    点伤害  ', []), '造成 120 点伤害');
  });

  test('空输入返回空串', () => {
    assert.equal(cleanText('', []), '');
    assert.equal(cleanText(null, []), '');
    assert.equal(cleanText(undefined, []), '');
  });

  test('120.0 显示成 120（不带小数点）', () => {
    const sv = [{ name: 'd', values_float: [120.0] }];
    assert.equal(cleanText('%d%', sv), '120');
  });
});

describe('findValue', () => {
  const sv = [
    { name: 'AbilityCooldown', values_float: [10] },
    { name: 'damage', values_float: [5], values_shard: [99], values_scepter: [77] },
  ];

  test('精确匹配', () => assert.equal(findValue(sv, 'damage', null), '5'));
  test('忽略大小写', () => assert.equal(findValue(sv, 'abilitycooldown', null), '10'));
  test('去掉 bonus_ 前缀再找', () => assert.equal(findValue(sv, 'bonus_damage', null), '5'));
  test('shard 模式优先取 values_shard', () => assert.equal(findValue(sv, 'damage', 'shard'), '99'));
  test('scepter 模式优先取 values_scepter', () => assert.equal(findValue(sv, 'damage', 'scepter'), '77'));
  test('shard 数组为空时回退到基础值', () => assert.equal(findValue(sv, 'AbilityCooldown', 'shard'), '10'));
  test('找不到返回 null', () => assert.equal(findValue(sv, 'nope', null), null));
  test('传空数组不炸', () => assert.equal(findValue(null, 'x', null), null));
});

describe('applyManual', () => {
  test('命中片段时整段替换（字面量取自 REPLACE_MANUAL，别手抄）', () => {
    const out = applyManual('主宰', '剑刃风暴', '神杖', '主宰每%attack_interval%秒对作用的敌人发动一次攻击');
    assert.equal(out, '主宰每隔数秒就会对作用范围内的敌人发动一次攻击');
  });

  test('片段里有 %%% 也能命中（沙王魔晶那条）', () => {
    const out = applyManual('沙王', '尾刺', '魔晶', '造成%caustic_damage_pct%%%伤害');
    assert.equal(out, '造成额外百分比伤害');
  });

  test('片段没命中就抛错（官网改文案后会立刻暴露，不会静默留下死占位符）', () => {
    assert.throws(
      () => applyManual('主宰', '剑刃风暴', '神杖', '官网把这句话改了'),
      /REPLACE_MANUAL 片段未命中/
    );
  });

  test('没有配置改写的技能原样返回', () => {
    assert.equal(applyManual('斧王', '狂战士之吼', '魔晶', '原文'), '原文');
  });

  test('文本为空时原样返回，不抛错', () => {
    // 空值直接穿透：调用方（buildSkills / scanTokens）都用 `if (!txt)` 挡在前面，
    // 所以这里不把 null 统一成 '' —— 保持「原样进、原样出」更不容易骗到调用方。
    assert.equal(applyManual('主宰', '剑刃风暴', '神杖', ''), '');
    assert.equal(applyManual('主宰', '剑刃风暴', '神杖', null), null);
    assert.equal(applyManual('主宰', '剑刃风暴', '神杖', undefined), undefined);
  });
});

// ============================================================
// skills.js —— 分类规则
// ============================================================

describe('typeOf', () => {
  test('behavior & 2 = 被动', () => assert.equal(typeOf({ behavior: 2 }), '被动'));
  test('behavior & 2048 = 光环，也算被动', () => assert.equal(typeOf({ behavior: 2048 }), '被动'));
  test('都不是 = 主动', () => assert.equal(typeOf({ behavior: 0 }), '主动'));
  test('位掩码可以叠加', () => assert.equal(typeOf({ behavior: 2 | 2048 }), '被动'));
});

describe('grantedBy', () => {
  test('魔晶新增 → shard', () => assert.equal(grantedBy({ ability_is_granted_by_shard: true }), 'shard'));
  test('神杖新增 → scepter', () => assert.equal(grantedBy({ ability_is_granted_by_scepter: true }), 'scepter'));
  test('只强化不新增 → null', () => assert.equal(grantedBy({ ability_has_shard: true, ability_has_scepter: true }), null));
});

describe('pickBaseAbilities', () => {
  const ab = (name, opts = {}) => ({
    name_loc: name, type: 0, behavior: 0, special_values: [],
    ability_is_innate: false, ability_is_granted_by_shard: false, ability_is_granted_by_scepter: false,
    ...opts,
  });

  test('取前 3 个普通技能 + 第 1 个大招', () => {
    const list = [ab('Q'), ab('W'), ab('E'), ab('R', { type: 1 }), ab('X')];
    assert.deepEqual(pickBaseAbilities(list).map(a => a.name_loc), ['Q', 'W', 'E', 'R']);
  });

  test('先天技能不占基础技能位', () => {
    const list = [ab('先天', { ability_is_innate: true }), ab('Q'), ab('W'), ab('E'), ab('R', { type: 1 })];
    assert.deepEqual(pickBaseAbilities(list).map(a => a.name_loc), ['Q', 'W', 'E', 'R']);
  });

  test('魔晶/神杖新增技能不占基础技能位', () => {
    const list = [ab('魔晶技', { ability_is_granted_by_shard: true }), ab('Q'), ab('W'), ab('E'), ab('R', { type: 1 })];
    assert.deepEqual(pickBaseAbilities(list).map(a => a.name_loc), ['Q', 'W', 'E', 'R']);
  });

  test('先天大招也算大招（祈求者的元素祈唤）', () => {
    const list = [ab('Q'), ab('W'), ab('E'), ab('大招', { type: 1, ability_is_innate: true })];
    assert.deepEqual(pickBaseAbilities(list).map(a => a.name_loc), ['Q', 'W', 'E', '大招']);
  });

  test('技能不够 4 个时返回几个算几个（由调用方记进复核清单）', () => {
    assert.equal(pickBaseAbilities([ab('Q'), ab('W')]).length, 2);
  });
});

// ============================================================
// render.js
// ============================================================

describe('sqlStr', () => {
  test('单引号翻倍', () => assert.equal(sqlStr("it's"), "it''s"));
  test('反斜杠转义', () => assert.equal(sqlStr('a\\b'), 'a\\\\b'));
  test('null/undefined 变空串', () => {
    assert.equal(sqlStr(null), '');
    assert.equal(sqlStr(undefined), '');
  });
});

// ============================================================
// review.js —— 复核清单分级
// ============================================================

describe('复核清单', () => {
  test('空清单没有任何阻断项', () => {
    assert.equal(hasBlocking(emptyReview()), false);
    assert.deepEqual(blockingHits(emptyReview()), []);
  });

  test('token 没查到算阻断项', () => {
    const r = emptyReview();
    r.tokenMiss.push('foo(斧王/狂战士之吼/desc)');
    assert.equal(hasBlocking(r), true);
    assert.deepEqual(blockingHits(r), ['%token% 未命中']);
  });

  test('简介过长只是提示，不阻断', () => {
    const r = emptyReview();
    r.longIntro.push('某个英雄(600字)');
    assert.equal(hasBlocking(r), false);
  });

  test('maxDescLen 和 descLenHero 是一对，合并时同进同退', () => {
    const target = emptyReview();
    mergeReview(target, { maxDescLen: 100, descLenHero: '甲/技能A' });
    // 更短的描述：两个字段都不该被动
    mergeReview(target, { maxDescLen: 50, descLenHero: '乙/技能B' });
    assert.equal(target.maxDescLen, 100);
    assert.equal(target.descLenHero, '甲/技能A');
    // 更长的描述：两个字段一起换
    mergeReview(target, { maxDescLen: 200, descLenHero: '丙/技能C' });
    assert.equal(target.maxDescLen, 200);
    assert.equal(target.descLenHero, '丙/技能C');
  });

  test('数组合并是追加，不是覆盖', () => {
    const target = emptyReview();
    mergeReview(target, { noPos: ['甲'] });
    mergeReview(target, { noPos: ['乙'] });
    assert.deepEqual(target.noPos, ['甲', '乙']);
  });
});

// ============================================================
// heroes.js
// ============================================================

describe('buildHeroes', () => {
  const makeHeroData = (over = {}) => ({
    name_loc: '斧王', name: 'npc_dota_hero_axe',
    role_levels: [1, 0, 0, 1, 0, 0, 0, 0, 0], // 核心、控制
    primary_attr: 0, attack_capability: 1, complexity: 1,
    hype_loc: '<b>斧王</b>是力量的化身', npe_desc_loc: '',
    abilities: [],
    ...over,
  });

  const build = (heroData, teaching) => buildHeroes({
    heroList: [{ name_loc: heroData.name_loc, id: 1 }],
    heroDataByName: new Map([[heroData.name_loc, heroData]]),
    teachingData: new Map(teaching),
  });

  test('官网字段照规则映射', () => {
    const { rows } = build(makeHeroData(), [['斧王', { pos: '3号位', tips: 'T', items: 'I', counters: 'C' }]]);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      id: 1, name: '斧王', slug: 'axe', alias: ALIASES['斧王'] || '',
      role: '核心、控制', pos: '3号位', attr: '力量', attack: '近战', complexity: 1,
      avatar: AVATAR_PREFIX + 'axe.png', intro: '斧王是力量的化身',
      tips: 'T', items: 'I', counters: 'C',
    });
  });

  test('id 按官网顺序从 1 开始递增', () => {
    const list = [{ name_loc: '甲', id: 10 }, { name_loc: '乙', id: 20 }];
    const data = new Map([['甲', makeHeroData({ name_loc: '甲' })], ['乙', makeHeroData({ name_loc: '乙' })]]);
    const { rows } = buildHeroes({
      heroList: list, heroDataByName: data,
      teachingData: new Map([['甲', { pos: '1' }], ['乙', { pos: '2' }]]),
    });
    assert.deepEqual(rows.map(r => r.id), [1, 2]);
  });

  test('教学数据缺失时退到 NEW_HERO_DATA 内置兜底', () => {
    const name = Object.keys(NEW_HERO_DATA)[0];
    const { rows } = build(makeHeroData({ name_loc: name }), []);
    assert.equal(rows[0].pos, NEW_HERO_DATA[name].pos);
    assert.equal(rows[0].tips, NEW_HERO_DATA[name].tips);
  });

  test('既没有教学数据也没有兜底数据就抛错（绝不静默跳过英雄）', () => {
    assert.throws(() => build(makeHeroData({ name_loc: '查无此英雄' }), []), /请先补齐数据/);
  });

  test('没有 hype_loc 时退回 npe_desc_loc', () => {
    const { rows } = build(makeHeroData({ hype_loc: '', npe_desc_loc: '备用简介' }), [['斧王', { pos: '3' }]]);
    assert.equal(rows[0].intro, '备用简介');
  });

  test('pos 为空记进复核清单', () => {
    const { review } = build(makeHeroData(), [['斧王', { pos: '' }]]);
    assert.deepEqual(review.noPos, ['斧王']);
  });

  test('定位全为 0 记进复核清单', () => {
    const { review } = build(makeHeroData({ role_levels: [0, 0, 0, 0, 0, 0, 0, 0, 0] }), [['斧王', { pos: '3' }]]);
    assert.deepEqual(review.emptyRole, ['斧王']);
  });

  test('简介超 500 字记进复核清单', () => {
    const { review } = build(makeHeroData({ hype_loc: '啊'.repeat(501) }), [['斧王', { pos: '3' }]]);
    assert.deepEqual(review.longIntro, ['斧王(501字)']);
  });
});

// ============================================================
// skills.js —— 端到端（hand-written 英雄数据）
// ============================================================

describe('buildSkills', () => {
  const ability = (name, over = {}) => ({
    name_loc: name, type: 0, behavior: 0, special_values: [], desc_loc: name + '的描述',
    ability_is_innate: false, ability_is_granted_by_shard: false, ability_is_granted_by_scepter: false,
    ability_has_shard: false, ability_has_scepter: false, shard_loc: '', scepter_loc: '',
    ...over,
  });

  const run = (abilities, heroName = '斧王') => {
    const heroData = { name_loc: heroName, abilities };
    return buildSkills({
      heroList: [{ name_loc: heroName, id: 1 }],
      heroDataByName: new Map([[heroName, heroData]]),
      heroRows: [{ id: 1, name: heroName }],
    });
  };

  test('4 个基础技能依次占 Q/W/E/R', () => {
    const { rows } = run([ability('Q'), ability('W'), ability('E'), ability('R', { type: 1 })]);
    assert.deepEqual(rows.map(r => [r.key, r.source]), [['Q', '基础'], ['W', '基础'], ['E', '基础'], ['R', '基础']]);
  });

  test('魔晶新增占 D、神杖新增占 F', () => {
    const { rows } = run([
      ability('Q'), ability('W'), ability('E'), ability('R', { type: 1 }),
      ability('魔晶技', { ability_is_granted_by_shard: true }),
      ability('神杖技', { ability_is_granted_by_scepter: true }),
    ]);
    assert.deepEqual(rows.slice(4).map(r => [r.key, r.source, r.name]),
      [['D', '魔晶', '魔晶技'], ['F', '神杖', '神杖技']]);
  });

  test('强化已有技能的行按键为空、名字带后缀', () => {
    const { rows } = run([
      ability('Q'), ability('W'), ability('E'), ability('R', { type: 1 }),
      ability('Q', { ability_has_shard: true, shard_loc: '强化后的描述' }),
    ]);
    const up = rows.filter(r => r.key === '');
    assert.equal(up.length, 1);
    assert.equal(up[0].name, 'Q·魔晶强化');
    assert.equal(up[0].source, '魔晶');
    assert.equal(up[0].desc, '强化后的描述');
  });

  test('先天技能的强化行名字加「先天·」前缀', () => {
    const { rows } = run([
      ability('Q'), ability('W'), ability('E'), ability('R', { type: 1 }),
      ability('固有', { ability_is_innate: true, ability_has_scepter: true, scepter_loc: '先天强化' }),
    ]);
    assert.equal(rows.find(r => r.key === '').name, '先天·固有·神杖强化');
  });

  test('基础技能不足 4 个记进复核清单', () => {
    const { review } = run([ability('Q'), ability('W')]);
    assert.equal(review.baseNot4.length, 1);
    assert.match(review.baseNot4[0], /^斧王\(2个: Q\/W\)$/);
  });

  test('BASE_OVERRIDES 缺技能时记进 overrideMiss 并降级（软校验）', () => {
    // 巨魔战将是唯一配了 BASE_OVERRIDES 的英雄
    const { review } = run([ability('Q'), ability('W'), ability('E'), ability('R', { type: 1 })], '巨魔战将');
    assert.equal(review.overrideMiss.length, 1);
    assert.match(review.overrideMiss[0], /^巨魔战将: /);
  });

  test('一个技能同时是魔晶和神杖新增 → 记进 grantedBoth', () => {
    const { review } = run([
      ability('Q'), ability('W'), ability('E'), ability('R', { type: 1 }),
      ability('双来源', { ability_is_granted_by_shard: true, ability_is_granted_by_scepter: true }),
    ]);
    assert.deepEqual(review.grantedBoth, ['斧王/双来源']);
  });

  test('被动技能标成被动', () => {
    const { rows } = run([ability('Q', { behavior: 2 }), ability('W'), ability('E'), ability('R', { type: 1 })]);
    assert.equal(rows[0].type, '被动');
    assert.equal(rows[1].type, '主动');
  });

  test('技能描述里的 %token% 会替换成数值', () => {
    const { rows } = run([
      ability('Q', { desc_loc: '造成 %damage% 点伤害', special_values: [{ name: 'damage', values_float: [120] }] }),
      ability('W'), ability('E'), ability('R', { type: 1 }),
    ]);
    assert.equal(rows[0].desc, '造成 120 点伤害');
  });
});
