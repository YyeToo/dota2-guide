// ============================================================
// test/golden.test.js —— 全量 golden 测试
//
// 拿仓库里真实的两份输入（官网原始 JSON + 冻结的教学数据 TSV）跑完整条生成流程，
// 把结果和**仓库里已经发布的那两个 .sql 文件**逐字节对比。
//
// 为什么 golden 用「已发布的那个文件」而不是另存一份期望输出：
// 那两个 .sql 就是用户实际导入数据库的东西 —— 它们才是真正要保证的东西。
// 另存一份期望输出只会多一个可能过期的副本。
//
// 期望文件里的生成日期是**读出来当输入**的（不是硬编码），所以它永远自动吻合，
// 测试真正在比的是「除日期外的每一个字节」。
//
// ------------------------------------------------------------------
// 什么情况下会失败，以及该怎么办
// ------------------------------------------------------------------
//   1. 你改了 lib/ 里的规则，但没重新生成 → 说明改动有后果，看 diff 确认是否符合预期
//   2. 你改了数据库里的教学文案，跑了 update_all.sh → 提交的 SQL 更新了，
//      但 test/fixtures/our_heroes.tsv 还是旧的。按下面「刷新 fixture」重做一遍
//   3. 官网改版导致下载的数据变了 → 同 2
//
// 刷新 fixture（Git Bash）：
//   TMPW=$(cygpath -w /tmp)
//   "/c/Program Files/MySQL/MySQL Server 5.7/bin/mysql.exe" -uroot -p123456 \
//     --default-character-set=utf8 -N -B \
//     -e "SELECT name, pos, tips, items, counters FROM dota_guide.hero" > "$TMPW/our_heroes.tsv"
//   cp "$TMPW/our_heroes.tsv" sql/test/fixtures/our_heroes.tsv
//
// ------------------------------------------------------------------
// 为什么可能被跳过
// ------------------------------------------------------------------
// 官网原始 JSON（sql/_official_raw/，3.8MB / 130 份）被 .gitignore 排除了。
// 没有它就跑不了这个测试，此时会 skip 并提示 —— 单元测试（lib.test.js）不受影响。
// 想让它在新机器上也能跑，把 .gitignore 里 sql/_official_raw/ 那两行删掉即可
// （文件里原本就写了这句提示）。
// ============================================================

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildHeroes, validateAliasKeys } = require('../lib/heroes');
const { buildSkills, scanTokens } = require('../lib/skills');
const { renderHeroesSql, renderSkillsSql } = require('../lib/render');
const { emptyReview, mergeReview, hasBlocking, formatReview } = require('../lib/review');

const SQL_DIR = path.join(__dirname, '..');
const RAW_DIR = path.join(SQL_DIR, '_official_raw');
const FIXTURE_TSV = path.join(__dirname, 'fixtures', 'our_heroes.tsv');

const hasRawData = fs.existsSync(path.join(RAW_DIR, 'herolist.json')) && fs.existsSync(RAW_DIR);

/** 从已生成的 SQL 文件头里读生成日期（读不到就退回今天） */
function readDate(sqlText) {
  const m = sqlText.match(/^-- 生成日期：(\d{4}-\d{2}-\d{2})/m);
  return m ? m[1] : new Date().toISOString().slice(0, 10);
}

/** 找出第一处不同的行，连同上下文返回 —— 直接 assert.equal 整个文件会刷屏 */
function firstDiffLine(actual, expected) {
  const a = actual.split('\n');
  const b = expected.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return `第 ${i + 1} 行:\n  生成结果: ${JSON.stringify((a[i] ?? '<缺失>').slice(0, 200))}\n  已发布文件: ${JSON.stringify((b[i] ?? '<缺失>').slice(0, 200))}`;
    }
  }
  return '（逐行对比没有差异，但字节数不同 —— 大概是行尾符 CRLF/LF 的问题）';
}

/** 跑一遍完整生成流程（和 gen_official.js 做的事一样，只是不写文件） */
function runPipeline() {
  const heroList = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'herolist.json'), 'utf8')).result.data.heroes;

  const heroDataByName = new Map();
  for (const h of heroList) {
    const data = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'hero_' + h.id + '.json'), 'utf8')).result.data.heroes[0];
    heroDataByName.set(data.name_loc, data);
  }
  validateAliasKeys(heroDataByName);

  const teachingData = new Map();
  for (const line of fs.readFileSync(FIXTURE_TSV, 'utf8').split(/\r?\n/)) {
    if (!line.includes('\t')) continue;
    const [name, pos, tips, items, counters] = line.split('\t');
    teachingData.set(name, { pos, tips, items, counters });
  }

  const heroes = buildHeroes({ heroList, heroDataByName, teachingData });
  const skills = buildSkills({ heroList, heroDataByName, heroRows: heroes.rows });
  const tokens = scanTokens({ heroList, heroDataByName });

  const review = emptyReview();
  mergeReview(review, heroes.review);
  mergeReview(review, skills.review);
  mergeReview(review, tokens.review);

  return { heroes, skills, review };
}

describe('golden：生成器输出 == 已发布的 SQL 文件', { skip: hasRawData ? false : '缺少 sql/_official_raw/（官网原始数据，被 .gitignore 排除）' }, () => {
  const publishedHeroSql = fs.readFileSync(path.join(SQL_DIR, 'heroes_full.sql'), 'utf8');
  const publishedSkillSql = fs.readFileSync(path.join(SQL_DIR, 'skills_full.sql'), 'utf8');
  const date = readDate(publishedHeroSql);

  const { heroes, skills, review } = runPipeline();

  test('heroes_full.sql 逐字节一致', () => {
    const actual = renderHeroesSql(heroes.rows, date);
    assert.equal(actual.length, publishedHeroSql.length,
      '字节数不同：\n' + firstDiffLine(actual, publishedHeroSql));
    assert.equal(actual, publishedHeroSql, firstDiffLine(actual, publishedHeroSql));
  });

  test('skills_full.sql 逐字节一致', () => {
    const actual = renderSkillsSql(skills.rows, date);
    assert.equal(actual.length, publishedSkillSql.length,
      '字节数不同：\n' + firstDiffLine(actual, publishedSkillSql));
    assert.equal(actual, publishedSkillSql, firstDiffLine(actual, publishedSkillSql));
  });

  // 下面几条被上面的逐字节对比蕴含，但独立的断言能在失败时直接指出「哪个数字变了」，
  // 不用去 diff 二十万字节的输出。

  test('英雄 127 名、技能 795 行', () => {
    assert.equal(heroes.rows.length, 127);
    assert.equal(skills.rows.length, 795);
  });

  test('slug 唯一且不为空（fresh-install 那个坑的守卫）', () => {
    const slugs = heroes.rows.map(r => r.slug);
    assert.equal(slugs.filter(s => !s).length, 0, '有英雄的 slug 是空的');
    assert.equal(new Set(slugs).size, slugs.length, 'slug 有重复');
  });

  test('hero 表的列清单里带 slug（生成器与 init.sql 的一致性）', () => {
    // 这个断言针对的是一个真实发生过的 bug：提交的 SQL 少了 slug 列，
    // 而 init.sql 里 slug 是 NOT NULL UNIQUE DEFAULT ''，
    // 结果全新安装时所有英雄的 slug 都是 ''，第二条就撞唯一键，
    // 导入到第 27 行时报 Duplicate entry '' for key 'uk_slug'，最终 0 行英雄。
    const insertLine = publishedHeroSql.split('\n').find(l => l.startsWith('INSERT INTO hero'));
    assert.match(insertLine, /\bslug\b/, 'heroes_full.sql 的 INSERT 没写 slug 列');
    assert.match(insertLine, /\balias\b/, 'heroes_full.sql 的 INSERT 没写 alias 列');
  });

  test('复核清单里没有阻断项', () => {
    assert.equal(hasBlocking(review), false, formatReview(review));
  });
});
