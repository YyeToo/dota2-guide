// ============================================================
// lib/heroes.js —— 英雄行生成
//
// 一个英雄行 = 官网数据（name / role / attr / attack / complexity / avatar /
// intro）+ 本站教学数据（pos / tips / items / counters）+ 手工配置的俗称（alias）。
//
// 「教学数据从哪来」是这里唯一的难点，三条路按顺序退：
//   1. TSV（流水线从数据库导出的）—— 正常情况，127 个英雄都走这条
//   2. NEW_HERO_DATA（写死在 vocab.js 里的）—— 导出时数据库里还没有这个英雄
//      （官网新增英雄时会出现，教学数据只能现写）
//   3. 都没有 → 直接抛错。绝不静默跳过：少一个英雄比报错危险得多
//
// 这个 module 不碰文件系统。herolist / 官网数据 / TSV 都由调用方读好传进来，
// 所以测试可以拿几个手写的英雄对象直接跑，不需要 130 份 JSON 摆在硬盘上。
// ============================================================

const { ROLE_NAMES, ATTR_NAMES, ATTACK_NAMES, AVATAR_PREFIX, POS_FALLBACK, NEW_HERO_DATA, ALIASES } = require('./vocab');
const { cleanText } = require('./text');

/**
 * 生成全部英雄行。
 *
 * @param {object[]} heroList         herolist.json 的 result.data.heroes（顺序即官网顺序）
 * @param {Map}      heroDataByName   官方中文名 → herodata 接口返回的单英雄全量数据
 * @param {Map}      teachingData     官方中文名 → { pos, tips, items, counters }（TSV 导出）
 * @returns {{ rows: object[], review: object }} rows 每项是一个完整的 hero 行
 */
function buildHeroes({ heroList, heroDataByName, teachingData }) {
  const review = { emptyRole: [], longIntro: [], noPos: [] };
  const rows = [];

  let newId = 0;
  for (const h of heroList) {
    newId += 1;
    const d = heroDataByName.get(h.name_loc);
    const name = d.name_loc;

    // ---- role：官网 9 定位，role_levels 数组顺序 = ROLE_NAMES 的顺序 ----
    const role = d.role_levels
      .map((lv, i) => (lv > 0 ? ROLE_NAMES[i] : ''))
      .filter(Boolean)
      .join('、');
    if (!role) review.emptyRole.push(name);

    // ---- attr / attack / complexity ----
    // 官网数值 → 中文名的映射，查不到时兜底成全才 / 近战
    const attr = ATTR_NAMES[d.primary_attr] || '全才';
    const attack = ATTACK_NAMES[d.attack_capability] || '近战';
    const complexity = d.complexity;

    // ---- avatar：官网头像 CDN 地址 ----
    const avatar = AVATAR_PREFIX + d.name.replace(/^npc_dota_hero_/, '') + '.png';

    // ---- slug：英雄英文内部名（第七阶段新增列）----
    // 和头像文件名同源（axe / sven / crystal_maiden / nevermore...），
    // 站内教学页详情链接用，数据重灌也不会变
    const slug = d.name.replace(/^npc_dota_hero_/, '');

    // ---- intro：官网卡片宣传语（hype_loc），清洗 HTML ----
    let intro = cleanText(d.hype_loc, null);
    if (!intro) intro = cleanText(d.npe_desc_loc, null); // 极少数英雄没有 hype
    if (intro.length > 500) review.longIntro.push(name + '(' + intro.length + '字)');

    // ---- pos / tips / items / counters：教学数据，三条路按顺序退 ----
    const old = teachingData.get(name);
    let pos, tips, items, counters;
    if (old) {
      pos = old.pos || (POS_FALLBACK[name] || '');
      if (!pos) review.noPos.push(name);
      tips = old.tips; items = old.items; counters = old.counters;
    } else if (NEW_HERO_DATA[name]) {
      // 导出数据漏了这个英雄：用 vocab 里内置的手写数据兜底
      const n = NEW_HERO_DATA[name];
      pos = n.pos; tips = n.tips; items = n.items; counters = n.counters;
    } else {
      throw new Error('英雄 ' + name + ' 既不在教学数据 TSV 也不在 NEW_HERO_DATA，请先补齐数据！');
    }

    // ---- alias：玩家俗称 / 旧译名（ALIASES 表，没配的存空字符串）----
    const alias = ALIASES[name] || '';

    rows.push({ id: newId, name, slug, alias, role, pos, attr, attack, complexity, avatar, intro, tips, items, counters });
  }

  return { rows, review };
}

/**
 * 校验 ALIASES 的 key 都是官网真实存在的英雄名。
 * 俗称表里写错一个字（比如「钢背兽」写成「刚背兽」），搜索就会静默失效 —— 用户搜不到，
 * 页面上也看不出异常。所以这里宁可让整条流水线挂掉。
 *
 * @returns {number} 配置了俗称的英雄数（给 CLI 打日志用）
 */
function validateAliasKeys(heroDataByName) {
  const names = Object.keys(ALIASES);
  for (const k of names) {
    if (!heroDataByName.has(k)) {
      throw new Error('ALIASES 里的英雄名在官网数据中不存在（写错字了？）: ' + k);
    }
  }
  return names.length;
}

module.exports = { buildHeroes, validateAliasKeys };
