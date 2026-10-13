-- ============================================================
-- Dota 2 新手入门教学网站 —— 第五阶段数据库升级脚本（搜索俗称优化）
--
-- 作用：给 hero 表新增 1 列：
--   alias —— 英雄俗称/旧译名（顿号分隔，如 主宰 → "剑圣、尤涅若"）
--
-- 为什么需要：官网中文名（主宰/水晶室女/米拉娜...）和玩家日常叫法
--   （剑圣/冰女/白虎...）不一样，搜索框只搜 name 会搜不到。
--   alias 列存俗称，keyword 搜索改为 name/alias/intro 三字段匹配，
--   且"名字命中"排在"别名命中""简介命中"前面（搜"兽"时真正的"獸"排第一）。
--
-- ⚠️ 本脚本只需执行一次（MySQL 5.7 的 ALTER 不支持"列已存在则跳过"）：
--   重复执行会报 Duplicate column name，忽略即可，不影响数据。
--
-- 执行顺序（重要！）：
--   第 1 步：执行本文件（upgrade_v5.sql）
--   第 2 步：执行 heroes_full.sql（新版 INSERT 带 alias 列）
-- ============================================================

-- 设置连接字符集：保证 COMMENT 里的中文写入时不乱码
SET NAMES utf8mb4;

USE dota_guide;

-- alias 放在 name 之后：看表结构时"名字 → 俗称"挨在一起
ALTER TABLE hero
    ADD COLUMN alias VARCHAR(200) NOT NULL DEFAULT '' COMMENT '英雄俗称/旧译名（顿号分隔，搜索用；官网无此数据）' AFTER name;

-- 验证：应看到 hero 表多出 alias 一列
SHOW COLUMNS FROM hero;
