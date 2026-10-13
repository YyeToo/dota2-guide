// ============================================================
// lib/text.js —— 文本清洗与占位符解析
//
// 官网技能描述里混着 HTML 标签和 %token% 占位符，这个文件负责把它们
// 变成能直接写进 SQL 的纯文本。
//
// 全是纯函数：吃字符串吐字符串，不碰文件、不读时钟。
// ============================================================

const { REPLACE_MANUAL } = require('./vocab');

/**
 * 在 special_values 里按名字找第 1 个数值。
 * 官网占位符有坑：
 *   1. 大小写不一致（%abilitycooldown% 的定义名却是 AbilityCooldown）
 *   2. 复合占位符（%bonus_AbilityCooldown% = 前缀 bonus_ + 真实名 AbilityCooldown，
 *      意为"AbilityCooldown 这项加成值"）
 *   3. 魔晶/神杖强化文本里的数值藏在 values_shard / values_scepter 里
 *      （values_float 存的是基础值，加成值的基础往往是 0，直接取会显示"0 秒/0%"）
 * 所以查找顺序：精确 → 忽略大小写 → 去掉 bonus_ 前缀再精确/忽略大小写。
 *
 * @param mode null | 'shard' | 'scepter'：取哪个数值来源
 *        'shard'   —— 魔晶强化文本，优先 values_shard[0]
 *        'scepter' —— 神杖强化文本，优先 values_scepter[0]
 *        其余（技能基础描述）—— values_float[0] / values_int[0]
 *        对应数组为空时回退到基础值（强化没改这个数值的情况）
 */
function findValue(specialValues, token, mode) {
  const list = specialValues || [];
  const firstNum = v => {
    let num;
    if (mode === 'shard' && v.values_shard && v.values_shard.length) num = v.values_shard[0];
    else if (mode === 'scepter' && v.values_scepter && v.values_scepter.length) num = v.values_scepter[0];
    else if (v.values_float && v.values_float[0] !== undefined) num = v.values_float[0];
    else if (v.values_int && v.values_int[0] !== undefined) num = v.values_int[0];
    return num === undefined ? null : Number(num).toString(); // 120.0 → "120"
  };
  const t = token.toLowerCase();
  const direct = list.find(v => v.name === token);
  if (direct) return firstNum(direct);
  const ci = list.find(v => v.name.toLowerCase() === t);
  if (ci) return firstNum(ci);
  const stripped = token.replace(/^bonus_/, '');
  if (stripped !== token) {
    const s = t.replace(/^bonus_/, '');
    const direct2 = list.find(v => v.name === stripped);
    if (direct2) return firstNum(direct2);
    const ci2 = list.find(v => v.name.toLowerCase() === s);
    if (ci2) return firstNum(ci2);
  }
  return null;
}

/**
 * 官网描述清洗：
 *   1. 统一换行（详情页 CSS 是 pre-wrap，保留换行能显示段落）
 *   2. %% → 字面 %（先换成占位符 \u0000 防止被 token 替换吃掉）
 *   3. %token% → special_values 里同名项的"第 1 个数值"（技能 1 级时的取值）
 *   4. 去掉所有 HTML 标签（<font>、<b>、<br/> 等）
 */
function cleanText(raw, specialValues, mode) {
  if (!raw) return '';
  let t = String(raw).replace(/\r\n/g, '\n');
  // ⚠️ 顺序很重要：先替换 %token%，再把 %% 还原成字面 %。
  // 官网常写 "%damage%%%"（token 后面紧跟字面 %），
  // 如果先处理 %% 会把 token 的右括号 % 吃掉（%damage%|%% 中左边那个 %% 先被匹配），
  // 导致 token 永远匹配不上。
  t = t.replace(/%([a-zA-Z0-9_]+)%/g, (m, token) => {
    const val = findValue(specialValues, token, mode);
    if (val === null) return m; // 查不到就保留原文，方便复核清单发现
    return val;
  });
  t = t.replace(/%%/g, '%');
  t = t.replace(/<[^>]*>/g, '');
  t = t.replace(/[ \t]+/g, ' ');
  return t.trim();
}

/** 应用人工改写：key 命中时逐条替换原文子串，未命中（含片段找不到）直接抛错，防止改版后失效 */
function applyManual(heroName, abilityName, source, raw) {
  const pairs = REPLACE_MANUAL[heroName + '/' + abilityName + '/' + source];
  if (!pairs || !raw) return raw;
  let t = raw;
  for (const [from, to] of pairs) {
    if (!t.includes(from)) {
      throw new Error('REPLACE_MANUAL 片段未命中: ' + heroName + '/' + abilityName + '/' + source + ' ← ' + from.slice(0, 50));
    }
    t = t.replace(from, to);
  }
  return t;
}

module.exports = { findValue, cleanText, applyManual };
