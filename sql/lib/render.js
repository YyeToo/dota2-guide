// ============================================================
// lib/render.js —— SQL 文件渲染
//
// 把英雄行 / 技能行渲染成 heroes_full.sql、skills_full.sql 的完整文本。
//
// 这一层是纯的：给它同样的 rows 和同样的日期，它吐出的字节完全一样。
// 生成日期是**参数**不是 `new Date()` —— 否则每次跑都产生一个新文件，
// golden 测试（sql/test/）就没法逐字节对比了。真实日期由 CLI 传进来。
//
// 这里不做任何数据加工，只做两件事：拼字符串、转义。
// ============================================================

/** SQL 字符串转义：单引号翻倍、反斜杠转义（数据里有英文缩写时不炸） */
function sqlStr(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * 渲染 heroes_full.sql 全文。
 * @param {object[]} rows buildHeroes 的产物
 * @param {string}   now  'YYYY-MM-DD'，写进文件头的生成日期
 */
function renderHeroesSql(rows, now) {
  let sql = `-- ============================================================
-- heroes_full.sql —— 英雄全量数据（第四阶段：对齐 dota2.com 官网）
-- 生成日期：${now}（由 sql/gen_official.js 生成，请勿手改本文件）
--
-- 数据来源：
--   https://www.dota2.com/datafeed/herolist?language=schinese （127 名英雄列表）
--   https://www.dota2.com/datafeed/herodata?language=schinese&hero_id=N （逐英雄全量）
--   tips / items / counters 沿用本站手工教学数据（6 个改名英雄自动平移，4 个新增英雄新写）
--   alias 俗称/旧名列（剑圣→主宰、冰女→水晶室女...）来自生成器的 ALIASES 表
--   slug 英文内部名列（axe/sven/crystal_maiden...）来自官网内部名（与头像文件名同源）
--
-- 执行前请先跑 upgrade_v4.sql（给 hero 表加 pos/attr/attack/complexity/avatar 五列）、
-- upgrade_v5.sql（给 hero 表加 alias 俗称列，搜索框搜俗称要用）和
-- upgrade_v6_slug.sql（给 hero 表加 slug 唯一标识列，教学页详情链接用）
--
-- ⚠️ 中文乱码坑（结论是实测出来的，别按想当然改）：
--   本文件开头有一句 SET NAMES utf8mb4; —— **那一句才是真正生效的那道**。
--   实测：只要文件里有它，两个 mysql 客户端配不配 --default-character-set 结果都对；
--   而没有它时，MySQL 26.7 的客户端会按 latin1 处理，中文全变成 ä¸»åŠ¨ 这种乱码。
--   也就是说 26.7 客户端**根本不认** --default-character-set 参数
--   （不是"utf8mb4 参数有 bug"，是参数整个不生效），光靠命令行参数挡不住。
--   命令照抄这个即可，参数留着是给「将来某个脚本忘了写 SET NAMES」兜底：
--     mysql -u root -p --default-character-set=utf8mb4 < heroes_full.sql
--
-- 本文件会：TRUNCATE hero 表 → 重新插入 127 名英雄（id 1~127 = 官网英文名首字母顺序）
-- ============================================================

SET NAMES utf8mb4;
USE dota_guide;

TRUNCATE TABLE hero;
-- 重置自增计数器：TRUNCATE 本身会重置，这里显式写一次保险
ALTER TABLE hero AUTO_INCREMENT = 1;

INSERT INTO hero (id, name, slug, alias, \`role\`, pos, attr, attack, complexity, avatar, intro, tips, items, counters) VALUES
`;

  for (const r of rows) {
    sql += `-- ${r.id}. ${r.name}（${r.attr} / ${r.attack} / 复杂度${r.complexity} / ${r.pos || '未定号位'}）${r.alias ? '【俗称：' + r.alias + '】' : ''}\n`;
    sql += `(${r.id}, '${sqlStr(r.name)}', '${sqlStr(r.slug)}', '${sqlStr(r.alias)}', '${sqlStr(r.role)}', '${sqlStr(r.pos)}', '${sqlStr(r.attr)}', '${sqlStr(r.attack)}', ${r.complexity}, '${sqlStr(r.avatar)}', '${sqlStr(r.intro)}', '${sqlStr(r.tips)}', '${sqlStr(r.items)}', '${sqlStr(r.counters)}'),\n`;
  }
  sql = stripTrailingComma(sql);

  sql += `-- ============ 校验：应看到 127 行 ============
SELECT COUNT(*) AS hero_total FROM hero;
-- 主属性分布：力量 36 / 敏捷 35 / 智力 34 / 全才 22
SELECT attr, COUNT(*) FROM hero GROUP BY attr;
-- 复杂度分布
SELECT complexity, COUNT(*) FROM hero GROUP BY complexity;
-- 俗称别名覆盖率（约 100 名英雄有俗称/旧名）
SELECT COUNT(*) AS alias_total FROM hero WHERE alias <> '';
-- slug 唯一标识覆盖率（应 127 人都有、无重复）
SELECT COUNT(*) AS slug_total FROM hero WHERE slug <> '';
`;

  return sql;
}

/**
 * 渲染 skills_full.sql 全文。
 * @param {object[]} rows buildSkills 的产物
 * @param {string}   now  'YYYY-MM-DD'
 */
function renderSkillsSql(rows, now) {
  let sql = `-- ============================================================
-- skills_full.sql —— 技能全量数据（第四阶段：对齐 dota2.com 官网）
-- 生成日期：${now}（由 sql/gen_official.js 生成，请勿手改本文件）
--
-- 数据来源：官网 herodata 接口的 abilities 数组（desc_loc / shard_loc / scepter_loc）
--
-- 按键规则（沿用第三阶段约定）：
--   Q/W/E/R —— 基础技能 + 大招
--   D —— 魔晶（1400 金币）"新增"技能（游戏里真的多一个技能位）
--   F —— 神杖（4200 金币）"新增"技能
--   ''（空）—— 魔晶/神杖只"强化已有技能"的强化行，不占新按键
-- 技能名后缀：·魔晶强化 / ·神杖强化
-- 描述：官网 desc_loc 清洗后（HTML 标签去掉、%token% 已替换成对应数值、%% 还原为 %；
--       魔晶/神杖强化文本的数值取自 values_shard / values_scepter 的加成值）
--
-- 分类事实（这三列是物化出来的，让调用方不用再解析名字，见 lib/skills.js 头部）：
--   skill_category  基础 / 魔晶新增 / 神杖新增 / 魔晶强化 / 神杖强化
--   is_innate       1 = 先天技能（不占按键、不占技能位）
--   sort_order      本行在这个英雄技能列表里的位次，从 1 开始、每个英雄内连续。
--                   ⚠️ 接口就是按这一列排的，不要再另外 ORDER BY。
--                   它**不等于**下面的行序历史上曾经等过的那句 FIELD(...) 排序，
--                   物化时已经把 D/F 的顺序差异算进去了。
--
-- 执行前请先跑 upgrade_v7.sql（加 skill_category / is_innate / sort_order 三列，
-- 并顺手修掉老库里 skill_type/skill_source 注释的乱码）
-- 执行前请先跑 upgrade_v4.sql（skill_desc 加宽到 1000，官网描述比手写的长）
-- 字符集坑与 heroes_full.sql 头部同一套说明，照抄那条命令即可。
--
-- 本文件会：TRUNCATE hero_skill 表 → 重新插入全部技能（hero_id 对应 heroes_full.sql 的 1~127）
-- ============================================================

SET NAMES utf8mb4;
USE dota_guide;

TRUNCATE TABLE hero_skill;
ALTER TABLE hero_skill AUTO_INCREMENT = 1;

-- 列清单必须和 upgrade_v7.sql 改完后的表结构一致，少一列会静默插错位
INSERT INTO hero_skill (hero_id, skill_key, skill_type, skill_category, is_innate, sort_order, skill_name, skill_desc) VALUES
`;

  // 按英雄分组输出，每个英雄一块注释，方便新手对照。
  // 输出顺序就是 sort_order 顺序 —— 导入后的 id 和接口返回的顺序从此一致，
  // 不会再出现「文件里是 F,D，接口返回 D,F」这种要靠 SQL 掰回来的情况。
  let lastHero = null;
  for (const s of rows) {
    if (s.heroName !== lastHero) {
      sql += `\n-- ---------- ${s.heroName}（hero_id=${s.heroId}） ----------\n`;
      lastHero = s.heroName;
    }
    sql += `(${s.heroId}, '${sqlStr(s.key)}', '${s.type}', '${s.category}', ${s.innate}, ${s.sortOrder}, '${sqlStr(s.name)}', '${sqlStr(s.desc)}'),\n`;
  }
  sql = stripTrailingComma(sql);

  sql += `-- ============ 校验：应看到 ${rows.length} 行 ============
SELECT COUNT(*) AS skill_total FROM hero_skill;
-- 按键分布（第四阶段官方数据，仅供参考；D/F 数量 = 官网魔晶/神杖新增技能总数）
SELECT skill_key, COUNT(*) FROM hero_skill GROUP BY skill_key ORDER BY FIELD(skill_key, 'Q', 'W', 'E', 'R', 'D', 'F', '');
-- 分类分布：基础 / 魔晶新增 / 神杖新增 / 魔晶强化 / 神杖强化
SELECT skill_category, COUNT(*) FROM hero_skill GROUP BY skill_category;
-- 先天技能条数
SELECT COUNT(*) AS innate_total FROM hero_skill WHERE is_innate = 1;

-- ⚠️ 下面这条**应当返回 0 行**。返回了行说明某个英雄的 sort_order 有断号或重号，
--    接口就会按错误的顺序返回技能，而且不会报任何错。
SELECT hero_id, COUNT(*) AS n, MIN(sort_order) AS lo, MAX(sort_order) AS hi
FROM hero_skill GROUP BY hero_id HAVING lo <> 1 OR hi <> n;
`;

  return sql;
}

/** 最后一行 VALUES 的逗号换成分号，并空出一行 */
function stripTrailingComma(sql) {
  return sql.replace(/,\n$/, ';\n\n');
}

module.exports = { renderHeroesSql, renderSkillsSql, sqlStr };
