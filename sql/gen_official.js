// ============================================================
// gen_official.js —— 官网数据生成器（命令行入口）
//
// 把从官网接口抓下来的原始 JSON（sql/_official_raw/ 下 127 份）
// 和数据库导出的手工教学数据（our_heroes.tsv）合并，
// 生成 heroes_full.sql（127 英雄）和 skills_full.sql（全部技能）。
//
// 用法（Git Bash，在 sql/ 目录下执行）：
//   TMPW=$(cygpath -w /tmp)   # node 不认识 Git Bash 的 /tmp，转成 Windows 路径
//   node gen_official.js "$TMPW/herolist.json" "D:/VSCode-project/XM-01/sql/_official_raw" "$TMPW/our_heroes.tsv"
//
// 可选参数：
//   --date=YYYY-MM-DD   写进 SQL 文件头的生成日期（默认今天）。
//                       测试靠它得到逐字节可复现的输出。
//   --out-dir=<目录>    输出目录（默认 sql/ 自身）。测试用它在临时目录里跑完整流程。
//
// 这个文件只做四件事：解析参数、读写文件、把各阶段串起来、打印复核清单。
// 真正的生成规则在 lib/ 下：
//
//   lib/vocab.js    常量 + 6 张手工特例表（改规则只改这里）
//   lib/text.js     文本清洗与 %token% 占位符解析
//   lib/heroes.js   英雄行（官网数据 + 教学数据合并）
//   lib/skills.js   技能行（按键 / 来源 / 主动被动分类）
//   lib/render.js   SQL 渲染（纯字符串，日期是参数）
//   lib/review.js   人工复核清单（形状 / 严重度 / 格式化）
//
// 退出码：
//   0  一切正常
//   1  用法错误（参数没给全）
//   2  复核清单里有阻断项 —— SQL 文件仍然写出来了（方便查看），但 update_all.sh
//      的 `set -e` 会在这里停下，**不会**把可能有问题的数据导入数据库。
//      阻断判据见 lib/review.js 的 SEVERITY。
//
// 输出：heroes_full.sql、skills_full.sql（在 out-dir 下，覆盖旧文件）
// ============================================================

const fs = require('fs');
const path = require('path');

const { validateAliasKeys, buildHeroes } = require('./lib/heroes');
const { buildSkills, scanTokens } = require('./lib/skills');
const { renderHeroesSql, renderSkillsSql } = require('./lib/render');
const { emptyReview, mergeReview, hasBlocking, formatReview } = require('./lib/review');

// ============================================================
// 命令行参数
// ============================================================

const argv = process.argv.slice(2);
const opts = {};
const positional = [];
for (const a of argv) {
  const m = a.match(/^--([a-z][a-z-]*)=(.*)$/);
  if (m) opts[m[1]] = m[2];
  else positional.push(a);
}

const [herolistPath, rawDir, ourTsvPath] = positional;
if (!herolistPath || !rawDir || !ourTsvPath) {
  console.error('用法: node gen_official.js <herolist.json> <_official_raw目录> <our_heroes.tsv> [--date=YYYY-MM-DD] [--out-dir=目录]');
  process.exit(1);
}

const now = opts.date || new Date().toISOString().slice(0, 10);
const outDir = opts['out-dir'] || __dirname;

// ============================================================
// 一、读取输入数据
// ============================================================

console.log('=== 读取输入数据 ===');

// 1.1 官网英雄列表（顺序即官网展示顺序）
const heroList = JSON.parse(fs.readFileSync(herolistPath, 'utf8')).result.data.heroes;
console.log(`herolist.json: ${heroList.length} 名英雄`);
console.log('前 8 名顺序:', heroList.slice(0, 8).map(h => h.name_loc + '(' + h.name + ')').join(', '));

// 1.2 逐个读取官方全量数据
const heroDataByName = new Map(); // 官方名 → 英雄对象
for (const h of heroList) {
  const file = path.join(rawDir, 'hero_' + h.id + '.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8')).result.data.heroes[0];
  heroDataByName.set(data.name_loc, data);
}
console.log(`官方全量数据: ${heroDataByName.size} 份`);

// 1.3 校验俗称表（key 写错字会让俗称搜索静默失效，这里直接报错）
console.log(`俗称别名表: ${validateAliasKeys(heroDataByName)} 名英雄配置了俗称/旧名`);

// 1.4 手工教学数据（name, pos, tips, items, counters 制表符分隔）
//     由一键流水线从数据库导出（见 update_all.sh 第 2 步），名字已是官网中文名，可直接匹配
const teachingData = new Map(); // 英雄名 → 教学数据行
for (const line of fs.readFileSync(ourTsvPath, 'utf8').split(/\r?\n/)) {
  if (!line.includes('\t')) continue;
  const [name, pos, tips, items, counters] = line.split('\t');
  teachingData.set(name, { pos, tips, items, counters });
}
console.log(`手工教学数据: ${teachingData.size} 名英雄`);

// ============================================================
// 二、生成数据
// ============================================================

console.log('=== 生成英雄行 ===');
const heroes = buildHeroes({ heroList, heroDataByName, teachingData });
console.log(`英雄行: ${heroes.rows.length}`);

console.log('=== 生成技能行 ===');
const skills = buildSkills({ heroList, heroDataByName, heroRows: heroes.rows });
console.log(`技能行: ${skills.rows.length}`);

const tokens = scanTokens({ heroList, heroDataByName });

// 各阶段的复核清单并成一份（maxDescLen 取全局最长的那条）
const review = emptyReview();
mergeReview(review, heroes.review);
mergeReview(review, skills.review);
mergeReview(review, tokens.review);

// ============================================================
// 三、写出 SQL 文件
// ============================================================

console.log('=== 写出 SQL 文件 ===');

const heroSql = renderHeroesSql(heroes.rows, now);
fs.writeFileSync(path.join(outDir, 'heroes_full.sql'), heroSql, 'utf8');
console.log(`已写出 heroes_full.sql（${heroes.rows.length} 名英雄，${(heroSql.length / 1024).toFixed(0)} KB）`);

const skillSql = renderSkillsSql(skills.rows, now);
fs.writeFileSync(path.join(outDir, 'skills_full.sql'), skillSql, 'utf8');
console.log(`已写出 skills_full.sql（${skills.rows.length} 行技能，${(skillSql.length / 1024).toFixed(0)} KB）`);

// ============================================================
// 四、打印人工复核清单 + 决定退出码
// ============================================================

console.log(formatReview(review));

if (hasBlocking(review)) {
  console.error('');
  console.error('✗ 复核清单里有阻断项，退出码 2。');
  console.error('  heroes_full.sql / skills_full.sql 已经写出来了，可以打开看看，');
  console.error('  但 update_all.sh 会停在这一步，不会把这份数据导入数据库。');
  process.exit(2);
}
