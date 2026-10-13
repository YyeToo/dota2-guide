-- ============================================================
-- Dota 2 新手入门教学网站 —— 第十一阶段数据库升级脚本
--
-- 作用（两件事，一起做是因为都要 ALTER 同一张表，分两个脚本反而多一条路径）：
--   1. hero_skill 表物化三列分类事实，前端不再解析技能名：
--        skill_category —— 基础 / 魔晶新增 / 神杖新增 / 魔晶强化 / 神杖强化
--        is_innate      —— 1 = 先天技能（出生自带、不占按键也不占技能位）
--        sort_order     —— 本行在本英雄技能列表里的位次，每个英雄 1..n 连续
--      同时删掉 skill_source —— 它说的「基础/魔晶/神杖」已经被 skill_category
--      完整蕴含，两列并存只会给「哪天它俩不一致」留机会，而这种不一致没有测试能发现。
--   2. 修掉 skill_type 列注释和默认值里的历史乱码
--      （症状：DEFAULT 显示成 ä¸»åŠ¨ 而不是 主动）。
--      ⚠️ 注意这是**列元数据**脏了，不是数据脏了 —— 修复方式只能是 MODIFY COLUMN。
--         乱码来源就是 upgrade_v3.sql 那一句 ADD COLUMN（已确认文案逐字对上），
--         而 init.sql 里的建表语句一直是干净的，所以全新安装的用户不会遇到这个问题。
--
-- ⚠️ 本脚本只需执行一次：重复执行会报 Duplicate column name / Can't DROP，
--    忽略即可，不影响数据。
--
-- 执行顺序（重要！）：
--   第 1 步：执行本文件（upgrade_v7.sql）
--   第 2 步：执行 skills_full.sql（重新导入全部技能，新版本带三列分类事实）
--
-- 为什么第 1 步里直接 TRUNCATE 掉了技能数据：
--   物化 sort_order 需要一个「行内位次」的计算，而它必须复刻原来那句
--   ORDER BY (skill_key='') ASC, FIELD(...) ASC, id ASC —— 三级排序。
--   MySQL 5.7 **没有窗口函数**（ROW_NUMBER 之类会直接报 1064），
--   得靠自连接的计数子查询硬凑，又长又容易写错。
--   而下一步 skills_full.sql 本来就会先 TRUNCATE 再全量插入，
--   任何回填出来的值都会被立刻覆盖掉 —— 写一段马上就被丢弃的复杂 SQL 不划算。
--   hero_skill 里全是官网数据，没有一条是手写的（手写教学数据在 hero 表的
--   tips/items/counters/pos 上），随时可以重新生成，所以清空是安全的。
--
--   ⚠️ 所以：跑完本脚本、还没跑 skills_full.sql 之前，详情接口会读不到技能。
--      这是预期内的中间状态，跑完第 2 步就恢复。
-- ============================================================

-- 设置连接字符集：本文件里有中文的 DEFAULT 和 COMMENT，靠这一句保证不乱码。
-- 实测 MySQL 26.7 的客户端不认 --default-character-set 参数，文件里写了才生效。
SET NAMES utf8mb4;

USE dota_guide;

-- ---------- 1. 加三列 ----------
--   AFTER skill_type：让「类型 → 分类 → 是否先天 → 位次」连着排，看表结构时一目了然
--   NOT NULL DEFAULT：老数据自动填默认值，先不用管，下一步会被整体重灌覆盖
ALTER TABLE hero_skill
    ADD COLUMN skill_category VARCHAR(10) NOT NULL DEFAULT '基础'
        COMMENT '技能分类：基础/魔晶新增/神杖新增/魔晶强化/神杖强化' AFTER skill_type,
    ADD COLUMN is_innate TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '是否先天技能：1=先天（出生自带、不占按键），0=否' AFTER skill_category,
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0
        COMMENT '在本英雄技能列表里的位次，每个英雄 1..n 连续' AFTER is_innate;

-- ---------- 2. 删掉被 skill_category 蕴含的旧列 ----------
ALTER TABLE hero_skill DROP COLUMN skill_source;

-- ---------- 3. 修乱码：把 skill_type 的默认值和注释按正确文案整列重写 ----------
-- MODIFY COLUMN 不只是改定义，它会把整列的元数据重写一遍，
-- 所以默认值和注释都会用这里写的正确文案覆盖掉原来的乱码。
-- （skill_source 的乱码不用单独修 —— 它上一步已经被删掉了。）
ALTER TABLE hero_skill
    MODIFY COLUMN skill_type VARCHAR(10) NOT NULL DEFAULT '主动'
        COMMENT '技能类型：主动/被动（被动自动生效，无需按键）';

-- ---------- 4. 清空技能数据（理由见文件头） ----------
TRUNCATE TABLE hero_skill;

-- ---------- 5. 换索引 ----------
-- uk_hero_order 的最左前缀就是 hero_id，单列的 idx_hero_id 从此是多余的，
-- 留着只会让每次写入都多维护一棵索引。
-- 加 UNIQUE 是为了让「同一个英雄有两个相同位次」直接导入失败，
-- 而不是让接口静默返回一个顺序错乱的技能列表。
ALTER TABLE hero_skill
    DROP INDEX idx_hero_id,
    ADD UNIQUE KEY uk_hero_order (hero_id, sort_order);

-- ---------- 验证 ----------
-- 应看到 8 列：id / hero_id / skill_key / skill_type / skill_category
--              / is_innate / sort_order / skill_name / skill_desc（共 9 列，无 skill_source）
-- 重点看 skill_type 那行的 Default 是不是「主动」、Comment 是不是中文 ——
-- 如果还是 ä¸»åŠ¨ 这种乱码，说明这个脚本没有用带 SET NAMES 的方式执行。
SHOW FULL COLUMNS FROM hero_skill;

-- 应看到 uk_hero_order 是 UNIQUE，且 idx_hero_id 已经不在
SHOW INDEX FROM hero_skill;
