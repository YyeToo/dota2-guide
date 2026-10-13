// ============================================================
// lib/skills.js —— 技能行生成
//
// 官网每个英雄有 6~15 个技能对象（多形态英雄的副技能、召唤物技能、派生法术……
// 还有魔晶/神杖的强化条目），本站的 hero_skill 表只展示其中一部分。
// 「哪些留下、留下叫什么、占不占按键」就是这个 module 全部的工作，分四类：
//
//   Q/W/E/R  基础技能 —— 前 3 个「非先天、非新增」的普通技能 + 第 1 个大招
//   D        魔晶（1400 金币）**新增**技能 —— 游戏里真的多一个技能位
//   F        神杖（4200 金币）**新增**技能
//   ''（空）  魔晶/神杖只**强化已有技能**的强化行 —— 不占按键，排最后
//
// 按键规则细节见 CONTEXT.md 的「技能按键」。这里要记住的坑：
//   官网数组顺序 ≠ 按键顺序。BASE_OVERRIDES 记录了按键对不上的英雄（巨魔战将），
//   它是唯一的例外来源，写错技能名会进复核清单而不是静默降级。
//
// 不碰文件系统，输入由调用方读好传进来。
// ============================================================

const { BASE_OVERRIDES, DROP_UPGRADES } = require('./vocab');
const { cleanText, applyManual, findValue } = require('./text');

/** 技能类型：behavior 位掩码 & 2 = 被动，& 2048 = 光环（光环也自动生效，按被动算） */
function typeOf(a) {
  return (a.behavior & 2) || (a.behavior & 2048) ? '被动' : '主动';
}

/** 判断技能是否「魔晶/神杖新增」（游戏里真的多一个技能位） */
function grantedBy(a) {
  if (a.ability_is_granted_by_shard) return 'shard';
  if (a.ability_is_granted_by_scepter) return 'scepter';
  return null;
}

/**
 * 挑出一个英雄的 4 个基础技能（Q/W/E/R）。
 * 正常情况：前 3 个「非先天、非新增」的普通技能(type=0) + 第 1 个大招(type=1)。
 * 注意大招不排除先天 —— 祈求者的「元素祈唤」就是先天 + 大招。
 */
function pickBaseAbilities(abilities) {
  const pool = abilities.filter(a =>
    !a.ability_is_innate &&
    !a.ability_is_granted_by_shard &&
    !a.ability_is_granted_by_scepter &&
    a.type === 0
  );
  const ult = abilities.find(a =>
    a.type === 1 && !a.ability_is_granted_by_shard && !a.ability_is_granted_by_scepter
  );
  const base = pool.slice(0, 3);
  if (ult) base.push(ult);
  return base;
}

/**
 * 生成全部技能行。
 *
 * @param {object[]} heroList       herolist.json 的 result.data.heroes
 * @param {Map}      heroDataByName 官方中文名 → 单英雄全量数据
 * @param {object[]} heroRows       buildHeroes 的产物（要用它的 id↔name 对应关系）
 * @returns {{ rows: object[], review: object }} rows: { heroId, key, type, source, name, desc, heroName }
 */
function buildSkills({ heroList, heroDataByName, heroRows }) {
  const review = { baseNot4: [], overrideMiss: [], grantedBoth: [], longSkillName: [], droppedUpgrades: [], keptDroppedUpgrades: [], maxDescLen: 0, descLenHero: '' };
  const rows = [];

  // 英雄名 → id（buildHeroes 已按官网顺序分配 1~127），技能行要挂到对应英雄上
  const idByName = new Map(heroRows.map(r => [r.name, r.id]));

  // 记录最长描述的 helper：长度和出处必须一起更新，否则输出会自相矛盾
  const noteDesc = (desc, who) => {
    if (desc.length > review.maxDescLen) {
      review.maxDescLen = desc.length;
      review.descLenHero = who;
    }
  };

  const KEYS = ['Q', 'W', 'E', 'R'];

  for (const h of heroList) {
    const d = heroDataByName.get(h.name_loc);
    const heroId = idByName.get(d.name_loc);
    const abilities = d.abilities;

    // ---- 基础 4 技能 ----
    let base = pickBaseAbilities(abilities);

    // 特例覆盖：BASE_OVERRIDES 手写的顺序优先（官网数组顺序和真实按键对不上的英雄）
    if (BASE_OVERRIDES[d.name_loc]) {
      const want = BASE_OVERRIDES[d.name_loc];
      base = want.map(nm => abilities.find(a => a.name_loc === nm)).filter(Boolean);
      if (base.length !== want.length) {
        review.overrideMiss.push(d.name_loc + ': ' + want.filter(nm => !abilities.some(a => a.name_loc === nm)).join('/'));
      }
    }

    if (base.length !== 4) review.baseNot4.push(d.name_loc + '(' + base.length + '个: ' + base.map(a => a.name_loc).join('/') + ')');

    const baseNames = new Set(base.map(a => a.name_loc));

    base.forEach((a, i) => {
      const desc = cleanText(a.desc_loc, a.special_values);
      rows.push({
        heroId, key: KEYS[i] || '', type: typeOf(a), source: '基础',
        name: a.name_loc, desc, heroName: d.name_loc,
      });
      if (a.name_loc.length > 50) review.longSkillName.push(d.name_loc + '/' + a.name_loc);
      noteDesc(desc, d.name_loc + '/' + a.name_loc);
    });

    // ---- 魔晶/神杖「新增技能」：D/F 键 ----
    for (const a of abilities) {
      const g = grantedBy(a);
      if (!g) continue;
      // 异常：一个技能同时是魔晶和神杖新增（正常不会发生）
      if (a.ability_is_granted_by_shard && a.ability_is_granted_by_scepter) review.grantedBoth.push(d.name_loc + '/' + a.name_loc);
      const desc = cleanText(a.desc_loc, a.special_values);
      rows.push({
        heroId, key: g === 'shard' ? 'D' : 'F', type: typeOf(a),
        source: g === 'shard' ? '魔晶' : '神杖',
        name: a.name_loc, desc, heroName: d.name_loc,
      });
      noteDesc(desc, d.name_loc + '/' + a.name_loc);
    }

    // ---- 魔晶/神杖「强化已有技能」：按键为空 '' ----
    // 只给「页面上会展示的技能」生成强化行：
    //   基础 4 技能 + 先天技能（先天技能官方也出神杖/魔晶强化，行名加「先天·」前缀说明来源）
    for (const a of abilities) {
      if (grantedBy(a)) continue; // 新增技能自身不再生成强化行（它俩不同时出现）
      const shown = baseNames.has(a.name_loc) || a.ability_is_innate;
      if (!shown) {
        // 被裁掉的技能（多形态英雄的副技能等）：
        //   DROP_UPGRADES 里的是「同名技能另一形态」，强化文本重复 → 直接丢弃；
        //   其余保留（祈求者派生法术、凯鸟形态技能等，强化文本是独有信息）
        if (!(a.ability_has_shard || a.ability_has_scepter)) continue;
        if (DROP_UPGRADES.has(d.name_loc + '/' + a.name_loc)) {
          review.droppedUpgrades.push(d.name_loc + '/' + a.name_loc + '(与已展示技能重复，已丢弃)');
          continue;
        }
        review.keptDroppedUpgrades.push(d.name_loc + '/' + a.name_loc);
      }
      const prefix = a.ability_is_innate ? '先天·' : '';

      if (a.ability_has_shard && a.shard_loc) {
        // applyManual：先处理「死占位符」改写，再做常规清洗（见 REPLACE_MANUAL 注释）
        // 第 3 个参数 'shard'：数值优先从 values_shard 取（魔晶加成值，见 findValue 注释）
        const desc = cleanText(applyManual(d.name_loc, a.name_loc, '魔晶', a.shard_loc), a.special_values, 'shard');
        rows.push({
          heroId, key: '', type: typeOf(a), source: '魔晶',
          name: prefix + a.name_loc + '·魔晶强化', desc, heroName: d.name_loc,
        });
        noteDesc(desc, d.name_loc + '/' + a.name_loc + '(魔晶)');
      }

      if (a.ability_has_scepter && a.scepter_loc) {
        // 'scepter'：数值优先从 values_scepter 取（神杖加成值）
        const desc = cleanText(applyManual(d.name_loc, a.name_loc, '神杖', a.scepter_loc), a.special_values, 'scepter');
        rows.push({
          heroId, key: '', type: typeOf(a), source: '神杖',
          name: prefix + a.name_loc + '·神杖强化', desc, heroName: d.name_loc,
        });
        noteDesc(desc, d.name_loc + '/' + a.name_loc + '(神杖)');
      }
    }
  }

  return { rows, review };
}

/**
 * 扫描所有 %token% 占位符，找出 cleanText 没能替换掉的。
 *
 * 为什么单独一遍而不是在 cleanText 里顺手记：cleanText 是纯函数，会被调用多次
 * （同一个 desc 既进技能行又比长度），在它内部记录会产生重复项。这里对每个
 * 文本只扫一次，去重也按「token + 出处」这个完整键来做。
 *
 * shard/scepter 文本先过一遍 applyManual（死占位符改写），剩下的才是真正没处理的。
 */
function scanTokens({ heroList, heroDataByName }) {
  const review = { tokenMiss: [] };

  for (const h of heroList) {
    const d = heroDataByName.get(h.name_loc);
    for (const a of d.abilities) {
      const checks = [
        ['desc', a.desc_loc, null],
        ['魔晶', applyManual(d.name_loc, a.name_loc, '魔晶', a.shard_loc), 'shard'],
        ['神杖', applyManual(d.name_loc, a.name_loc, '神杖', a.scepter_loc), 'scepter'],
      ];
      for (const [src, txt, mode] of checks) {
        if (!txt) continue;
        for (const m of String(txt).matchAll(/%([a-zA-Z0-9_]+)%/g)) {
          const token = m[1];
          const key = token + '(' + d.name_loc + '/' + a.name_loc + '/' + src + ')';
          if (findValue(a.special_values, token, mode) === null && !review.tokenMiss.includes(key)) {
            review.tokenMiss.push(key);
          }
        }
      }
    }
  }

  return { review };
}

module.exports = { buildSkills, scanTokens, typeOf, grantedBy, pickBaseAbilities };
