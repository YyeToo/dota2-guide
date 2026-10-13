-- ============================================================
-- Dota 2 新手入门教学网站 —— 第二阶段数据库升级脚本
--
-- 作用（对应"下一步规划"第 1、2 项）：
--   1. 给 hero 表新增两列：items（装备推荐）、counters（克制关系）
--   2. 新建 hero_skill 表（英雄技能表），与 hero 表形成"一对多"关系
--      —— 一个英雄（1）对应多条技能（多），这是数据库最常用的关系之一
--
-- ⚠️ 本脚本只需执行一次（MySQL 8 的 ALTER 不支持"列已存在则跳过"）：
--   重复执行会报 Duplicate column name，忽略即可，不影响数据。
--
-- 执行顺序（重要！）：
--   第 1 步：执行本文件（upgrade_v2.sql）
--   第 2 步：重新执行 heroes_full.sql（新版本带了装备/克制数据）
--   第 3 步：执行 skills_full.sql（导入全部技能数据）
-- ============================================================

-- 设置连接字符集：COMMENT 和默认值里的中文靠这一句保证不乱码。
-- ⚠️ 这句不是可选的装饰。本机服务器 character_set_server=latin1，客户端不显式指定
--    会话字符集就会用错；而 --default-character-set 参数并不总是生效
--    （实测 MySQL 26.7 的客户端会把它整个忽略掉，静默退回 latin1）。
--    只有写在文件里的 SET NAMES 才不依赖是哪个客户端、传了什么参数。
--    （其他 upgrade_vN.sql 早就有这句，本文件是唯一漏掉的，补上。）
SET NAMES utf8mb4;

USE dota_guide;

-- 1. hero 表新增两列
--    AFTER tips：指定新列放在 tips 列后面，保持表结构可读性（不写则追加到表尾）
--    VARCHAR(500)：装备名用顿号分隔（如"先锋盾、闪烁匕首"），500 足够
--    NOT NULL DEFAULT ''：老数据自动补空字符串，避免 NULL 带来的判空麻烦
ALTER TABLE hero
    ADD COLUMN items    VARCHAR(500) NOT NULL DEFAULT '' COMMENT '推荐装备（顿号分隔）' AFTER tips,
    ADD COLUMN counters VARCHAR(500) NOT NULL DEFAULT '' COMMENT '克制关系与注意事项' AFTER items;

-- 2. 新建英雄技能表（一对多的"多"方）
--    关键字段 hero_id：它指向 hero.id，表示"这条技能属于哪个英雄"
--    一个英雄有 4 条技能记录（Q/W/E/R），hero_id 相同
--
--    关于外键：教学项目故意【不】加 FOREIGN KEY 约束，原因有二：
--      a) 加上外键后，TRUNCATE hero 表会报错（MySQL 不允许清空被引用的父表），
--         会破坏 heroes_full.sql"随时重跑"的便利性；
--      b) 真实项目里外键约束常被应用层替代。但逻辑上 hero_id 就是外键，
--         查询时用它关联，心里要清楚这层关系。
CREATE TABLE IF NOT EXISTS hero_skill (
    id         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键，自增',
    hero_id    BIGINT       NOT NULL                COMMENT '所属英雄 id（对应 hero.id，逻辑外键）',
    skill_key  VARCHAR(10)  NOT NULL                COMMENT '按键：Q/W/E/R（R 为大招）',
    skill_name VARCHAR(50)  NOT NULL                COMMENT '技能名',
    skill_desc VARCHAR(300) NOT NULL                COMMENT '技能效果（新手向描述）',
    PRIMARY KEY (id),
    -- 索引：按 hero_id 查技能是最频繁的操作，建索引加速
    KEY idx_hero_id (hero_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '英雄技能表（与 hero 一对多）';

-- 3. 验证：应看到 hero 表多出 items、counters 两列；hero_skill 表存在
SHOW COLUMNS FROM hero;
SHOW TABLES;
