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
#   - 表结构不会变（第四阶段结构），后端无需重启，前端刷新即可看到新数据
#   - 官网如果新增了英雄（>127），生成器会报"请先补齐数据！"——
#     按提示在 gen_official.js 的 NEW_HERO_DATA 里补号位和教学文案即可
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
# ⚠️ 导入中文必须用 --default-character-set=utf8（26.7 客户端的 utf8mb4 参数有坑，会被静默当 latin1）
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
"$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8 -N -B \
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
"$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8 < heroes_full.sql
echo "✓ heroes_full.sql 导入完成"
"$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8 < skills_full.sql
echo "✓ skills_full.sql 导入完成"

# ============================================================
# 收尾：校验 + 提示
# ============================================================
echo ""
echo "================ 校验 ================"
echo "英雄总数 / 技能总数 / 主属性分布 / 技能来源分布："
"$MYSQL" -u"$DB_USER" -p"$DB_PASS" --default-character-set=utf8 -N -e "
  SELECT CONCAT('英雄: ', COUNT(*)) FROM $DB_NAME.hero;
  SELECT CONCAT('技能: ', COUNT(*)) FROM $DB_NAME.hero_skill;
  SELECT CONCAT('主属性-', attr, ': ', COUNT(*)) FROM $DB_NAME.hero GROUP BY attr;
  SELECT CONCAT('技能来源-', skill_source, ': ', COUNT(*)) FROM $DB_NAME.hero_skill GROUP BY skill_source;
"
echo ""
echo "✓ 全部完成！"
echo "  表结构没变，后端不用重启；浏览器刷新 http://localhost:5173 即可看到新数据"
echo "  想验证编码：浏览器打开英雄列表，中文显示正常即成功"
