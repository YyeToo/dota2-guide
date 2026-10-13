// ============================================================
// lib/review.js —— 人工复核清单
//
// 生成器跑完会留下一堆「规则没覆盖到」的痕迹（取不到 4 个基础技能、%token%
// 没查到、手写覆盖没命中……）。以前它们直接打到 stdout，埋在几十行输出里，
// 扫过去根本看不见 —— 现在它们是一等公民：
//
//   1. 每个阶段把自己的发现交回来（mergeReview）
//   2. 按严重度决定要不要让整条流水线失败（hasBlocking / exitCodeFor）
//   3. 格式化成人能读的清单（formatReview）
//
// 严重度分两档，判据是「这个问题会不会让写进数据库的数据出错」：
//
//   阻断（blocking）—— 数据已经不对了，或者有规则静默失效没生效，必须人看一眼
//   提示（notice）  —— 只是值得知道（比如某条描述特别长），常年存在，不阻断
//
// 升级为阻断的那些，以前全是静默的：BASE_OVERRIDES 写错技能名只会打一行软警告，
// DROP_UPGRADES 的 key 写错则完全没有校验。现在它们会让 update_all.sh 直接停下。
// ============================================================

/** 复核清单的空表。字段名和 formatReview 的输出一一对应 */
function emptyReview() {
  return {
    // ---- 阻断类 ----
    baseNot4: [],            // 基础技能没取到 4 个的英雄（Q/W/E/R 映射可能错位）
    noPos: [],               // TSV 里 pos 为空且 POS_FALLBACK 没覆盖
    grantedBoth: [],         // 一个技能既是魔晶新增又是神杖新增（数据异常）
    tokenMiss: [],           // %token% 没在 special_values 里查到
    overrideMiss: [],        // BASE_OVERRIDES 手写的技能名在官网数据里查不到
    manualMiss: [],          // REPLACE_MANUAL 的片段没命中（applyManual 抛错前的最后一道）

    // ---- 提示类 ----
    longIntro: [],           // 简介超 500 字（会被数据库列宽截断）
    emptyRole: [],           // 官方定位全为 0
    longSkillName: [],       // 技能名超 50 字
    droppedUpgrades: [],     // 被裁掉的强化行里"内容重复"而丢弃的
    keptDroppedUpgrades: [], // 被裁掉但仍保留强化行的（独有信息）
    maxDescLen: 0,           // 技能描述最长字数（决定 skill_desc 列要多宽）
    descLenHero: '',         // 最长描述的出处
  };
}

/**
 * 把某个阶段交回来的部分清单并进总清单。
 * maxDescLen 和 descLenHero 是一对（最长描述 + 它的出处），必须同进同退，
 * 否则会出现「描述长度是 A 的、出处写着 B」这种自相矛盾的输出 —— 所以单独处理。
 */
function mergeReview(target, partial) {
  if (!partial) return target;
  for (const [key, value] of Object.entries(partial)) {
    if (key === 'maxDescLen' || key === 'descLenHero') continue;
    if (Array.isArray(value)) target[key].push(...value);
    else target[key] = value;
  }
  if (partial.maxDescLen > target.maxDescLen) {
    target.maxDescLen = partial.maxDescLen;
    target.descLenHero = partial.descLenHero;
  }
  return target;
}

/**
 * 复核清单的分级。key → 'blocking' | 'notice'
 * 新增一类复核项时，必须在这里给它定级，否则 printReview 会把它漏掉。
 */
const SEVERITY = {
  baseNot4: 'blocking',
  noPos: 'blocking',
  grantedBoth: 'blocking',
  tokenMiss: 'blocking',
  overrideMiss: 'blocking',
  manualMiss: 'blocking',

  longIntro: 'notice',
  emptyRole: 'notice',
  longSkillName: 'notice',
  droppedUpgrades: 'notice',
  keptDroppedUpgrades: 'notice',
};

/** 这条清单项此刻是否真的有内容（数字看是否 > 0，数组看是否非空） */
function isHit(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return value > 0;
  return false;
}

/** 有哪些阻断项被触发了（返回中文标题列表） */
function blockingHits(review) {
  return Object.keys(SEVERITY)
    .filter(k => SEVERITY[k] === 'blocking' && isHit(review[k]))
    .map(k => TITLES[k]);
}

/** 有没有阻断项。CLI 用它决定退出码 */
function hasBlocking(review) {
  return blockingHits(review).length > 0;
}

const TITLES = {
  baseNot4: '基础技能没取到 4 个的英雄',
  noPos: '没有号位信息',
  grantedBoth: '双来源新增技能',
  tokenMiss: '%token% 未命中',
  overrideMiss: 'BASE_OVERRIDES 未命中',
  manualMiss: 'REPLACE_MANUAL 未命中',
  longIntro: '简介超 500 字',
  emptyRole: '官方定位全空',
  longSkillName: '技能名超 50 字',
  droppedUpgrades: '被丢弃的强化行',
  keptDroppedUpgrades: '被裁掉但保留的强化行',
};

/**
 * 格式化成人能读的复核清单。返回整段文本（含开头的换行），CLI 直接 console.log 即可。
 * 分两段输出：有内容的阻断项排前面，提示项排后面。
 */
function formatReview(review) {
  const lines = [];
  lines.push('\n=========== 人工复核清单 ============');

  // ---- 第一部分：阻断项 ----
  const blocking = blockingHits(review);
  if (blocking.length) {
    lines.push('');
    lines.push('⚠️  以下问题会让写进数据库的数据出错，流水线已判定为失败：');
    lines.push('');

    const not4 = review.baseNot4;
    if (not4.length) {
      lines.push('【1】基础技能没取到 4 个的英雄（需人工确认按键映射）:');
      not4.forEach(x => lines.push('  - ' + x));
    }

    if (review.overrideMiss.length) {
      lines.push('【2】BASE_OVERRIDES 里手写的技能名在官网数据里查不到:');
      review.overrideMiss.forEach(x => lines.push('  - ' + x));
    }

    if (review.manualMiss.length) {
      lines.push('【3】REPLACE_MANUAL 的片段没命中（官网文案改了？）:');
      review.manualMiss.forEach(x => lines.push('  - ' + x));
    }

    if (review.noPos.length) {
      lines.push('【4】没有号位信息（TSV 里 pos 为空且 POS_FALLBACK 未覆盖）:');
      review.noPos.forEach(x => lines.push('  - ' + x));
    }

    if (review.grantedBoth.length) {
      lines.push('【5】一个技能既是魔晶新增又是神杖新增（数据异常）:');
      review.grantedBoth.forEach(x => lines.push('  - ' + x));
    }

    if (review.tokenMiss.length) {
      lines.push('【6】%token% 没在 special_values 里查到（保留原文写进了描述）:');
      review.tokenMiss.forEach(x => lines.push('  - ' + x));
    }
  } else {
    lines.push('');
    lines.push('✓ 阻断项：无');
  }

  // ---- 第二部分：提示项 ----
  lines.push('');
  lines.push('---------- 以下是提示，不阻断流水线 ----------');
  lines.push('');

  lines.push('【A】被裁掉的技能还带着魔晶/神杖强化:');
  lines.push('  保留强化行（独有信息）:');
  review.keptDroppedUpgrades.forEach(x => lines.push('    - ' + x));
  if (!review.keptDroppedUpgrades.length) lines.push('    （无）');
  lines.push('  丢弃强化行（与已展示技能重复）:');
  review.droppedUpgrades.forEach(x => lines.push('    - ' + x));
  if (!review.droppedUpgrades.length) lines.push('    （无）');

  lines.push('');
  lines.push('【B】其他:');
  lines.push('  简介超500字: ' + (review.longIntro.join(', ') || '无'));
  lines.push('  官方定位全空: ' + (review.emptyRole.join(', ') || '无'));
  lines.push('  技能名超50字: ' + (review.longSkillName.join(', ') || '无'));
  lines.push('  技能描述最长: ' + review.maxDescLen + ' 字（' + review.descLenHero + '）');

  return lines.join('\n');
}

module.exports = { emptyReview, mergeReview, hasBlocking, blockingHits, formatReview, SEVERITY, TITLES };
