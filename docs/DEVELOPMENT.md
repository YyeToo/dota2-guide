# 开发笔记

这份文档收录**只有开发/维护时才会用到**的内容，从 [README](../README.md) 拆出来，
避免主页过长。

**什么时候需要看这里：**

- 你的数据库是**早期版本**建立的，需要升级到当前结构
- 你想了解项目各阶段分别做了什么
- 你遇到了 `Unknown column` 这类**只有老数据库才会出现**的报错

**全新安装请直接看 [README 的快速开始](../README.md#快速开始)** —— 不需要本文档。

---

## 历史版本数据库升级路径

> ⚠️ **按你的数据库停在哪个阶段，选一条执行**，不是全都跑一遍。
> 所有 `upgrade_vN.sql` 都**只需执行一次**，重复执行会报"列已存在"。
> 每条路径执行完都要**重启后端**。

### 已有第一阶段数据库（hero 表已有英雄数据）

按顺序执行 3 个脚本：

1. [sql/upgrade_v2.sql](../sql/upgrade_v2.sql) —— 给 hero 表加 `items`/`counters` 两列 + 新建 `hero_skill` 表
2. [sql/heroes_full.sql](../sql/heroes_full.sql) —— 重新导入全部 127 名英雄（先清空 hero 表，id 重新从 1 开始，保证和技能表对得上）
3. [sql/skills_full.sql](../sql/skills_full.sql) —— 导入全部技能（先清空 hero_skill 表，共 795 行）

> 💡 3 个脚本均可重复执行（后两个会先清空再插入，结果一致）。

### 已有第二阶段数据库（技能表已有 492 行，缺"类型/来源"两列）

按顺序执行 2 个脚本（**顺序不能反**：skills_full.sql 新版要写 skill_type/skill_source 列，必须先加好列）：

1. [sql/upgrade_v3.sql](../sql/upgrade_v3.sql) —— 给 hero_skill 表加 `skill_type`/`skill_source` 两列
2. [sql/skills_full.sql](../sql/skills_full.sql) —— 重新导入全部技能

> 💡 执行期间旧后端的详情接口会短暂报 `Unknown column` 错误，属正常现象。

### 已有第三阶段数据库（升级到第四阶段：官网对齐）

按顺序执行 3 个脚本（**顺序不能反**：heroes_full.sql 新版要写 attr 等新列，必须先加好列）：

1. [sql/upgrade_v4.sql](../sql/upgrade_v4.sql) —— hero 表加 `pos`/`attr`/`attack`/`complexity`/`avatar` 五列 + `skill_desc` 加宽到 1000
2. [sql/heroes_full.sql](../sql/heroes_full.sql) —— 官网 127 名英雄（官网英文名首字母序 + 官网 hero_id；6 名英雄换了官方译名：刚背兽→钢背兽、原始兽→獸、德鲁伊→独行德鲁伊、剃刀→雷泽、穆尔塔→琼英碧灵、先知→自然先知；新增 4 名：米拉娜、复仇之魂、酒仙、朗戈）
3. [sql/skills_full.sql](../sql/skills_full.sql) —— 官网技能数据（先清空 hero_skill 表，共 795 行）

> 💡 执行期间旧后端的列表接口会短暂报 `Unknown column` 错误，属正常现象。

### 已有第四阶段数据库（升级到第五阶段：搜索俗称优化）

按顺序执行 2 个脚本（**顺序不能反**：heroes_full.sql 新版要写 alias 列，必须先加好列）：

1. [sql/upgrade_v5.sql](../sql/upgrade_v5.sql) —— hero 表加 `alias` 俗称/旧译名列
2. [sql/heroes_full.sql](../sql/heroes_full.sql) —— 重新导入英雄数据（新版带俗称列，108 名英雄配置了俗称/旧名）

> 💡 执行完重启后端，前端刷新后：搜"剑圣"出主宰、搜"冰女"出水晶室女、搜"剃刀"出雷泽；
> 搜"兽"时名字命中的排最前。

### 已有第五阶段数据库（升级到第七阶段：slug 唯一标识）

执行 1 个脚本：

1. [sql/upgrade_v6_slug.sql](../sql/upgrade_v6_slug.sql) —— hero 表加 `slug` 唯一列，从 avatar URL 文件名自动提取英文内部名（如 `axe`/`sven`/`crystal_maiden`）

> 💡 执行完重启后端，即可使用 `GET /api/heroes/slug/{slug}` 接口。
> （第六阶段是纯前端 UI 改造，没有数据库变更，所以从第五阶段直接跳到第七阶段。）

---

## 阶段报错排查

数据库结构停留在早期版本时，后端会报 `Unknown column`。对照下表定位你该跑哪条升级路径：

| 报错 | 数据库停留在 | 解决 |
|---|---|---|
| `Unknown column 'items'`，或 `hero_skill doesn't exist` | 第一阶段 | 执行 upgrade_v2.sql → heroes_full.sql → skills_full.sql |
| `Unknown column 'skill_type'` | 第二阶段 | 执行 upgrade_v3.sql → skills_full.sql |
| `Unknown column 'attr'`（或 pos / attack / complexity / avatar） | 第三阶段 | 执行 upgrade_v4.sql → heroes_full.sql → skills_full.sql |

---

## 各阶段功能清单

**第一阶段（英雄图鉴 MVP）**

- ✅ 英雄基础数据：全部 127 名英雄（中文名/定位/简介/新手打法建议）
- ✅ 卡片列表 + 详情页 + 路由 + 统一返回格式 + CORS

**第二阶段（已完成）**

- ✅ 英雄技能数据表（`hero_skill`，一对多关联查询）
- ✅ 装备推荐、克制关系（hero 表新增 `items` / `counters` 列）
- ✅ 列表搜索 / 按定位筛选（`keyword` / `role` / `pos` 参数）
- ✅ 后端分页（`page` / `size`，返回 `{total, list}`）+ 前端骨架屏

**第三阶段（已完成）**

- ✅ 技能标注主动/被动（`skill_type` 列；光环类等自动生效技能也算被动）
- ✅ 魔晶/神杖技能（`skill_source` 列；纯强化不占按键、skill_key 为空，新增技能才标 D/F 键）
- ✅ 详情页技能徽章：被动（灰）/ 魔晶（紫）/ 神杖（金）+ 独立"魔晶/神杖强化"面板

**第四阶段（已完成）：对齐 dota2.com 官网**

- ✅ 官网 127 名英雄：英文名首字母序 + 官网 hero_id、官方中文名/简介、官网 9 定位（role 列）、主属性（力量/敏捷/智力/全才）、攻击方式（近战/远程）、复杂度（1-3）
- ✅ 官网技能数据 795 条：官方技能名/描述（token 数值已替换、HTML 已清洗）、魔晶/神杖强化与新增技能（D/F 键）、被动判定（behavior 位掩码）
- ✅ 官网头像 CDN 图（steamstatic.com 直链，列表卡片 + 详情页大图）
- ✅ 列表页：主属性页签筛选（全部/力量/敏捷/智力/全才）+ 复杂度页签筛选（简单/中等/困难）+ 定位下拉改官网 9 定位
- ✅ 详情页：头像 + 主属性/攻击方式/难度/号位徽章 + 官网定位多标签
- ✅ 本教学站自创体系保留：1-5 号位（pos 列，官网没有）、新手打法建议/装备/克制（官网没有）
- ✅ 一键更新流水线 update_all.sh（下载官网数据 → 导出教学数据 → 生成 SQL → 导入数据库，可重复执行）

**第五阶段（已完成）：搜索俗称优化**

- ✅ hero 表新增 `alias` 俗称/旧译名列（upgrade_v5.sql），108 名英雄配置了俗称（剑圣、冰女、屠夫、卡尔、电狗...）
- ✅ 搜索框三列同时匹配：官方名（name）/ 俗称（alias）/ 简介（intro）
- ✅ 结果按命中权重排序：名字命中 > 俗称命中 > 简介命中（搜"兽"时真正叫"獸"的英雄排最前）
- ✅ 俗称数据随流水线维护：ALIASES 表写在 gen_official.js 里，每次重新生成 heroes_full.sql 自动带上

**第六阶段（已完成）：前端 UI 改造（无数据库变更）**

- ✅ 路由重构：首页改为「新手须知」，英雄图鉴移到 `/heroes`
- ✅ 全站 emoji 换 lucide-vue-next SVG 图标；导航激活态、`:focus-visible` 焦点框
- ✅ 图鉴筛选栏吸顶、搜索 300ms 防抖、新手推荐区、加载更多
- ✅ 响应式修复：窄屏导航横向滚动、表格横向滚动、断点从 640px 提到 900px

**第七阶段（已完成）：slug 唯一标识**

- ✅ hero 表新增 `slug` 唯一列（upgrade_v6_slug.sql），从 avatar URL 自动提取英文内部名
- ✅ 新增接口 `GET /api/heroes/slug/{slug}`，站内教学链接改用 slug 而非 id
- ✅ 前端按参数是否为纯数字自动选路：数字走 `/{id}`，否则走 `/slug/{slug}`
