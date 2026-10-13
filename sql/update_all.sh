#!/usr/bin/env bash
# ============================================================
# update_all.sh —— 一键更新流水线（第四阶段：官网数据 → 数据库全自动）
#
# 作用：一条命令把项目数据更新到官网最新版，共 4 步：
#   第 1 步：node download_official.js   下载官网最新英雄数据（herolist + 127 份全量）
#   第 2 步：导出数据库里的手工教学数据   （号位/装备/克制/打法建议——官网没有，本教学站自写，
#            our_heroes.tsv                先进数据库保管，这里导出来和官网数据合并）
#   第 3 步：node gen_official.js        合并两边数据，生成 heroes_full.sql + skills_full.sql
#   第 4 步：导入数据库                   先清空再插入（heroes → skills 顺序），可重复执行
#
# 用法（Git Bash，在项目任意目录执行都可以）：
#   bash sql/update_all.sh
#   或 cd sql && ./update_all.sh
#
# 适用场景：
#   - Dota 出新版本/新英雄后，更新本项目数据
#   - 改了数据库里的教学文案（tips/items/counters/pos）后，重新整合进 SQL 文件
#
# 注意：
#   - 本脚本假设数据库已经是当前结构。老库请先按 docs/DEVELOPMENT.md 跑完
#     upgrade_v7.sql（hero_skill 加 skill_category / is_innate / sort_order 三列），
#     否则第 4 步导入时报 Unknown column
#   - 表结构不变，后端无需重启，前端刷新即可看到新数据
#   - 官网如果新增了英雄（>127），生成器会报"请先补齐数据！"——
#     按提示在 lib/vocab.js 的 NEW_HERO_DATA 里补号位和教学文案即可
#   - 生成规则都在 lib/ 下按阶段分文件，gen_official.js 只是命令行入口
#   - 生成器以退出码 2 结束时（复核清单里有阻断项），本脚本会停在第 3 步，
#     不会把数据导进数据库；SQL 文件仍然写出来了，可以打开看是哪里的问题
# ============================================================

# 出错立即停止（set -e）：任何一步失败就停下，不带着坏数据往下走
set -e

# 切到脚本所在目录（sql/），保证后面用相对路径找文件不出错
cd "$(dirname "$0")"
echo "工作目录：$(pwd)"

# ---------- 本机配置（按你的环境改这两个变量） ----------
DB_USER=root
DB_PASS=123456
DB_NAME=dota_guide

# 找 mysql 客户端：优先用已验证的 5.7 版全路径（不在 PATH 里），
# 找不到再退回 PATH 里的 mysql，最后试 26.7 版
#
# ⚠️ 字符集：真正挡住乱码的是**每个 .sql 文件开头的 SET NAMES utf8mb4;**，不是这个参数。
#    实测（两个客户端 × 三种 --default-character-set × 有无 SET NAMES）：
#      - 文件里有 SET NAMES  → 怎么跑都对
#      - 文件里没有它、客户端是 26.7 → 中文全变 ä¸»åŠ¨ 这种乱码
#    也就是说 26.7 客户端**根本不认** --default-character-set 参数
#    （不是"utf8mb4 参数有 bug"，是参数整个不生效）。
#    这里仍然传 --default-character-set=utf8mb4：对 5.7 客户端有效，
#    能兜住「将来某个脚本忘了写 SET NAMES」；用 utf8mb4 而不是 utf8 是因为
#    utf8 是 3 字节的旧类型，和库的 utf8mb4 不是一回事。
MYSQL=""
if [ -f "/c/Program Files/MySQL/MySQL Server 5.7/bin/mysql.exe" ]; then
  MYSQL="/c/Program Files/MySQL/MySQL Server 5.7/bin/mysql.exe"
elif command -v mysql >/dev/null 2>&1; then
  MYSQL="mysql"
elif [ -f "/c/Program Files/MySQL/MySQL Server 26.7/bin/mysql.exe" ]; then
  MYSQL="/c/Program Files/MySQL/MySQL Server 26.7/bin/mysql.exe"
fi
if [ -z "$MYSQL" ]; then
  echo "✗ 找不到 mysql 客户端，请安装 MySQL 或改脚本里的路径"; exit 1
fi
echo "mysql 客户端：$MYSQL"

# Git Bash 的 /tmp 是假的 Unix 路径，node 不认；cygpath 转成 Windows 路径
TMPW=$(cygpath -w /tmp)

# ============================================================
# 第 1 步：下载官网最新数据（约 1~2 分钟，速度看网络）
# ============================================================
echo ""
echo "================ 第 1 步：下载官网数据 ================"
node download_official.js

# ============================================================
# 第 2 步：从数据库导出手工教学数据
#   -N 不打印列名  -B 批处理模式（制表符分隔，正好是生成器要的 TSV 格式）
#   导出格式：name \t pos \t tips \t items \t counters
# ============================================================
echo ""
echo "================ 第 2 步：导出数据库里的教学数据 ================"
"$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8mb4 -N -B \
  -e "SELECT name, pos, tips, items, counters FROM $DB_NAME.hero" > "$TMPW/our_heroes.tsv"
echo "✓ 已导出 $(wc -l < "$TMPW/our_heroes.tsv") 行到 $TMPW/our_heroes.tsv"

# ============================================================
# 第 3 步：合并官网数据 + 教学数据，生成两个 SQL 文件
# ============================================================
echo ""
echo "================ 第 3 步：生成 SQL ================"
node gen_official.js \
  "$(pwd)/_official_raw/herolist.json" \
  "$(pwd)/_official_raw" \
  "$TMPW/our_heroes.tsv"

# ============================================================
# 第 4 步：导入数据库（先英雄后技能；两个文件都会先 TRUNCATE 再插入）
# ============================================================
echo ""
echo "================ 第 4 步：导入数据库 ================"
"$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8mb4 < heroes_full.sql
echo "✓ heroes_full.sql 导入完成"
"$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8mb4 < skills_full.sql
echo "✓ skills_full.sql 导入完成"

# ============================================================
# 收尾：校验 + 提示
# ============================================================
echo ""
echo "================ 校验 ================"
echo "英雄总数 / 技能总数 / 主属性分布 / 技能分类分布："
"$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8mb4 -N -e "
  SELECT CONCAT('英雄: ', COUNT(*)) FROM $DB_NAME.hero;
  SELECT CONCAT('技能: ', COUNT(*)) FROM $DB_NAME.hero_skill;
  SELECT CONCAT('主属性-', attr, ': ', COUNT(*)) FROM $DB_NAME.hero GROUP BY attr;
  SELECT CONCAT('技能分类-', skill_category, ': ', COUNT(*)) FROM $DB_NAME.hero_skill GROUP BY skill_category;
"

# sort_order 连续性检查：每个英雄的技能位次必须是 1..n 且不重号。
# 以前没有这一条 —— 顺序错乱是完全静默的：接口照常返回 200，只是技能顺序不对，
# 而"顺序不对"在人眼看着一堆技能卡时很难发现。
BAD_ORDER=$("$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8mb4 -N -B -e "
  SELECT COUNT(*) FROM (
    SELECT hero_id FROM $DB_NAME.hero_skill
    GROUP BY hero_id
    HAVING MIN(sort_order) <> 1 OR MAX(sort_order) <> COUNT(*)
  ) AS bad;
")
if [ "$BAD_ORDER" != "0" ]; then
  echo "✗ 有 $BAD_ORDER 个英雄的 sort_order 不连续（每个英雄应为 1..n）"
  echo "  多半是生成器 lib/skills.js 的 compareSkills 或编号那一步被改坏了，别急着用这份数据"
  exit 1
fi
echo "✓ sort_order 连续，每个英雄都是 1..n"
echo ""
echo "✓ 全部完成！"
echo "  表结构没变，后端不用重启；浏览器刷新 http://localhost:5173 即可看到新数据"
echo "  想验证编码：浏览器打开英雄列表，中文显示正常即成功"
