-- ============================================================
-- Dota 2 新手入门教学网站 —— 第三阶段数据库升级脚本
--
-- 作用：给 hero_skill 表新增两列，支持"主动/被动"和"魔晶/神杖"：
--   1. skill_type   —— 技能类型：主动（要按键施放）/ 被动（自动生效）
--   2. skill_source —— 技能来源：基础 / 魔晶 / 神杖
--      （阿哈利姆魔晶、阿哈利姆神杖可以给英雄升级或新增技能）
--
-- ⚠️ 本脚本只需执行一次（MySQL 8 的 ALTER 不支持"列已存在则跳过"）：
--   重复执行会报 Duplicate column name，忽略即可，不影响数据。
--
-- 执行顺序（重要！）：
--   第 1 步：执行本文件（upgrade_v3.sql）
--   第 2 步：执行 skills_full.sql（新版：492 条基础技能带类型标注 + 246 条魔晶/神杖技能）
-- ============================================================

-- 设置连接字符集：保证 COMMENT 里的中文写入时不乱码
SET NAMES utf8mb4;

USE dota_guide;

-- hero_skill 新增两列
--   AFTER skill_key：放在按键列后面，看表结构时"按键 → 类型 → 来源"一目了然
--   NOT NULL DEFAULT：老数据自动填默认值（主动、基础），不需要回填
ALTER TABLE hero_skill
    ADD COLUMN skill_type   VARCHAR(10) NOT NULL DEFAULT '主动' COMMENT '主动/被动（被动无需按键施放）' AFTER skill_key,
    ADD COLUMN skill_source VARCHAR(10) NOT NULL DEFAULT '基础' COMMENT '来源：基础/魔晶/神杖' AFTER skill_type;

-- 验证：应看到 hero_skill 表多出 skill_type、skill_source 两列
SHOW COLUMNS FROM hero_skill;
