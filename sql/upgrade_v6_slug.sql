-- ============================================================
-- Dota 2 新手入门教学网站 —— 第六阶段数据库升级脚本（英雄 slug 唯一标识）
--
-- 作用：给 hero 表新增 1 列：
--   slug —— 英雄英文内部名（axe / sven / crystal_maiden / nevermore...），
--           唯一索引。值从 avatar 头像 URL 的文件名自动提取（官网内部名），
--           教学页"代表英雄"链接用它（/heroes/sven），
--           比数字 id 稳定、可读，数据重灌也不会变。
--
-- ⚠️ 本脚本只需执行一次（MySQL 5.7 的 ALTER 不支持"列已存在则跳过"）：
--   重复执行会报 Duplicate column name，忽略即可，不影响数据。
-- ⚠️ 只适用于 avatar 已填充官网头像 URL 的库（第四阶段之后的库），
--   执行后会自动 UPDATE 好 127 名英雄的 slug，无需手工填。
--
-- 执行顺序（重要！）：
--   第 1 步：执行本文件（upgrade_v6_slug.sql）
--   第 2 步：执行 heroes_full.sql（新版 INSERT 带 slug 列）
-- ============================================================

-- 设置连接字符集：保证 COMMENT 里的中文写入时不乱码
SET NAMES utf8mb4;

USE dota_guide;

-- 1. 加列（name 之后：看表结构时"名字 → 英文内部名 → 俗称"挨在一起）
ALTER TABLE hero
    ADD COLUMN slug VARCHAR(64) NOT NULL DEFAULT '' COMMENT '英雄英文内部名（唯一，来自官网头像文件名，教学页详情链接用）' AFTER name;

-- 2. 从 avatar 头像 URL 自动提取英文内部名填充 slug：
--    SUBSTRING_INDEX(avatar, '/', -1)  → 取最后一个 / 之后的内容（如 axe.png）
--    外层再 SUBSTRING_INDEX(..., '.', 1) → 取第一个 . 之前的内容（axe）
UPDATE hero
SET slug = SUBSTRING_INDEX(SUBSTRING_INDEX(avatar, '/', -1), '.', 1)
WHERE avatar <> '';

-- 3. 加唯一索引：slug 是详情链接的唯一标识，不允许重复
ALTER TABLE hero
    ADD UNIQUE KEY uk_slug (slug);

-- 验证：应看到 127 名英雄都有英文内部名，且 empty_slug = 0
SELECT id, name, slug FROM hero ORDER BY id LIMIT 10;
SELECT COUNT(*) AS empty_slug FROM hero WHERE slug = '';
