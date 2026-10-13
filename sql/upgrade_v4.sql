-- ============================================================
-- Dota 2 新手入门教学网站 —— 第四阶段数据库升级脚本
--
-- 作用：按官网（dota2.com/heroes）对齐英雄数据，给 hero 表新增 5 列：
--   1. pos        —— 号位：1-5号位（本教学站自创体系，官网没有号位概念）
--   2. attr       —— 主属性：力量 / 敏捷 / 智力（官网数据）
--   3. attack     —— 攻击方式：近战 / 远程（官网数据）
--   4. complexity —— 操作复杂度：1 简单 / 2 中等 / 3 困难（官网数据）
--   5. avatar     —— 英雄头像图 URL（官网 CDN，直接引用不占本地空间）
--
-- 另外 role 列的语义变化：从"定位（号位）"改为官网的 9 种定位标签
--   （核心/辅助/爆发/控制/打野/肉盾/逃生/推进/先手，顿号分隔），
--   号位单独存 pos 列。
--
-- 还顺带加宽 skill_desc 列：官网技能描述比手写的长
--   （最长的接近 300 字，VARCHAR(300) 有截断风险，放宽到 1000 留足余量）。
--
-- ⚠️ 本脚本只需执行一次（MySQL 8 的 ALTER 不支持"列已存在则跳过"）：
--   重复执行会报 Duplicate column name，忽略即可，不影响数据。
--
-- 执行顺序（重要！）：
--   第 1 步：执行本文件（upgrade_v4.sql）
--   第 2 步：执行 heroes_full.sql（新版 127 名英雄，官网顺序/官网数据）
--   第 3 步：执行 skills_full.sql（新版技能，官网技能名/描述/魔晶神杖效果）
-- ============================================================

-- 设置连接字符集：保证 COMMENT 里的中文写入时不乱码
SET NAMES utf8mb4;

USE dota_guide;

-- hero 新增 5 列（放在 role 之后，看表结构时"定位 → 号位 → 属性 → 攻击 → 复杂度"一目了然）
ALTER TABLE hero
    ADD COLUMN pos        VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '号位：1-5号位（本教学站体系，官网无此概念）' AFTER `role`,
    ADD COLUMN attr       VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '主属性：力量/敏捷/智力（官网数据）' AFTER pos,
    ADD COLUMN attack     VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '攻击方式：近战/远程（官网数据）' AFTER attr,
    ADD COLUMN complexity TINYINT      NOT NULL DEFAULT 1 COMMENT '操作复杂度：1简单/2中等/3困难（官网数据）' AFTER attack,
    ADD COLUMN avatar     VARCHAR(200) NOT NULL DEFAULT '' COMMENT '英雄头像图 URL（官网 CDN）' AFTER complexity;

-- hero_skill 加宽描述列（官网描述比手写长，VARCHAR(300) 会截断）
ALTER TABLE hero_skill
    MODIFY COLUMN skill_desc VARCHAR(1000) NOT NULL COMMENT '技能效果（官网描述清洗后，最长约 300 字）';

-- 验证：应看到 hero 表多出 pos、attr、attack、complexity、avatar 五列
SHOW COLUMNS FROM hero;
