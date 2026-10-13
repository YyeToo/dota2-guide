// ============================================================
// download_official.js —— 一键流水线第 1 步：下载官网原始数据
//
// 作用：从 dota2.com 官网接口拉取最新英雄数据，存到 _official_raw/ 目录：
//   herolist.json —— 英雄列表（127 名，官网展示顺序，自带中文）
//   hero_N.json   —— 每个英雄的全量数据（英雄字段 + 全部技能，含技能名/描述/魔晶神杖效果）
//
// 为什么"下载"和"生成 SQL"要分成两个脚本：
//   下载要访问外网（慢、可能失败），生成只读本地文件（快、稳定）。
//   分开后可以单独重跑任一步，调试方便。
//
// 用法（Git Bash，在 sql/ 目录下执行，node 22 自带 fetch 无需装依赖）：
//   node download_official.js
//
// 说明：
//   - 请求间隔 200ms，避免给官网服务器造成压力
//   - 单个请求失败自动重试 3 次（官网偶发抽风，重试一般能救回来）
//   - 全部下载完会打印成败统计；失败清单记在 _official_raw/download.log
// ============================================================

const fs = require('fs');
const path = require('path');

// ---------- 配置 ----------
const BASE = 'https://www.dota2.com/datafeed';      // 官网数据接口根地址
const OUT_DIR = path.join(__dirname, '_official_raw'); // 输出目录（脚本自己所在的目录下）
const DELAY_MS = 200;        // 每次请求之间的间隔（毫秒），礼貌限速
const RETRY = 3;             // 单个请求失败后的重试次数
const TIMEOUT_MS = 15000;    // 单个请求超时时间（15 秒没响应就放弃）

// ---------- 小工具 ----------
// 睡一下：await sleep(200) 会暂停 200 毫秒再继续（配合 for 循环实现限速）
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的 GET 请求
 * @param {string} url 完整接口地址
 * @returns 解析好的 JSON 对象；重试用完还是失败就抛错
 */
async function getJson(url) {
  let lastErr = null;
  for (let i = 1; i <= RETRY; i++) {
    try {
      // AbortController：超过 TIMEOUT_MS 还没响应就主动掐断请求（fetch 没有内置超时）
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) {
        throw new Error('HTTP ' + resp.status);
      }
      return await resp.json();
    } catch (e) {
      lastErr = e;
      console.log(`  ⚠ ${url} 第 ${i}/${RETRY} 次失败（${e.message}），${i < RETRY ? '2 秒后重试' : '放弃'}`);
      if (i < RETRY) await sleep(2000); // 重试前多等一会，给服务器缓一缓
    }
  }
  throw lastErr;
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  // 保证输出目录存在（recursive: true = 目录不存在就建，存在不报错）
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const failList = [];   // 下载失败的英雄（id + 原因），最后写进 download.log
  const start = Date.now();

  // ---- 第 1 步：英雄列表（官网展示顺序 + 英雄 id，后面逐个英雄下载要用到 id）----
  console.log('▶ 下载英雄列表 herolist.json ...');
  const herolist = await getJson(`${BASE}/herolist?language=schinese`);
  fs.writeFileSync(path.join(OUT_DIR, 'herolist.json'), JSON.stringify(herolist));
  const heroes = herolist.result.data.heroes;
  console.log(`✓ 英雄列表 ${heroes.length} 名英雄，前 3 名：${heroes.slice(0, 3).map(h => h.name_loc).join('、')}...`);

  // ---- 第 2 步：逐个英雄下载全量数据 ----
  // 全量数据里自带全部技能对象（name_loc/desc_loc/shard_loc/scepter_loc 等），
  // 所以技能不用再单独调 abilitydata 接口
  console.log(`▶ 逐个英雄下载全量数据（共 ${heroes.length} 个，预计 ${Math.ceil(heroes.length * 0.3 / 60)} 分钟）...`);
  for (let i = 0; i < heroes.length; i++) {
    const h = heroes[i];
    const file = path.join(OUT_DIR, `hero_${h.id}.json`);
    try {
      const data = await getJson(`${BASE}/herodata?language=schinese&hero_id=${h.id}`);
      fs.writeFileSync(file, JSON.stringify(data));
      // 每 10 个打印一次进度（127 个全打会刷屏）
      if ((i + 1) % 10 === 0 || i === heroes.length - 1) {
        console.log(`  进度 ${i + 1}/${heroes.length}`);
      }
    } catch (e) {
      failList.push(`hero_${h.id} (${h.name_loc})：${e.message}`);
      console.log(`  ✗ ${h.name_loc} 下载失败：${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  // ---- 收尾：写失败日志 + 打印总结 ----
  if (failList.length) {
    fs.writeFileSync(path.join(OUT_DIR, 'download.log'), failList.join('\n') + '\n');
    console.log(`\n✗ ${failList.length} 个英雄下载失败，清单见 _official_raw/download.log（重跑本脚本会覆盖）`);
    process.exit(1); // 非 0 退出码：让流水线脚本知道这里失败了，停下来别往下走
  } else {
    fs.writeFileSync(path.join(OUT_DIR, 'download.log'), '全部成功\n');
  }
  console.log(`\n✓ 全部下载完成（${heroes.length} 个英雄，耗时 ${((Date.now() - start) / 1000).toFixed(0)} 秒），原始数据在 _official_raw/ 目录`);
}

// 入口：执行 main()，出错时打印堆栈并以非 0 退出（流水线脚本靠退出码判断成败）
main().catch((e) => {
  console.error('✗ 下载流程异常退出：', e.message);
  process.exit(1);
});
