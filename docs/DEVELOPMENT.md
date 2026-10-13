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

> 💡 执行完重启后端，即可在详情接口 `GET /api/heroes/{key}` 里用 slug 查询（如 `/api/heroes/sven`）。
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
- ✅ 俗称数据随流水线维护：ALIASES 表写在 [sql/lib/vocab.js](../sql/lib/vocab.js) 里，每次重新生成 heroes_full.sql 自动带上

**第六阶段（已完成）：前端 UI 改造（无数据库变更）**

- ✅ 路由重构：首页改为「新手须知」，英雄图鉴移到 `/heroes`
- ✅ 全站 emoji 换 lucide-vue-next SVG 图标；导航激活态、`:focus-visible` 焦点框
- ✅ 图鉴筛选栏吸顶、搜索 300ms 防抖、新手推荐区、加载更多
- ✅ 响应式修复：窄屏导航横向滚动、表格横向滚动、断点从 640px 提到 900px

**第七阶段（已完成）：slug 唯一标识**

- ✅ hero 表新增 `slug` 唯一列（upgrade_v6_slug.sql），从 avatar URL 自动提取英文内部名
- ✅ 详情接口支持按 slug 查询，站内教学链接改用 slug 而非 id
  （当时是单独加了一条 `GET /api/heroes/slug/{slug}`，前端按参数是不是纯数字自动选路；
  后来合并成一条 `GET /api/heroes/{key}`，见下面的「内部重构」）

---

## 内部重构（无用户可见变化）

这几项不改功能、不改数据，但改动面大，单独记在这里，方便日后 `git log` 对不上时回查。

### 生成器拆分 + 测试安全网

原先 `sql/gen_official.js` 是 794 行的单文件：常量表、文本清洗、英雄行、技能行、
SQL 渲染、复核清单全挤在一起，改任何一条规则都要先读完整个文件。
现在拆成一个薄 CLI（只做参数解析和读写文件）+ `sql/lib/` 下六个阶段模块，
输出逐字节不变。

**改生成规则时去 [sql/lib/](../sql/lib/)**：

| 想改什么 | 去哪个文件 |
|---|---|
| 俗称表、按键特例、替换文案、兜底数据 | `lib/vocab.js` |
| 占位符解析、HTML 清洗规则 | `lib/text.js` |
| 英雄行怎么拼、教学数据从哪来 | `lib/heroes.js` |
| 技能按键/来源/主动被动的判定 | `lib/skills.js` |
| SQL 文件长什么样 | `lib/render.js` |
| 复核清单有哪些项、哪些算阻断 | `lib/review.js` |

同时补上了两层测试（跑法见 [README](../README.md#跑测试)）：生成器的
golden 逐字节对比 + 后端连真实数据库的集成测试。它们守的是一类
编译期发现不了的 bug —— SQL 文件、表结构、代码三者不一致。
`heroes_full.sql` 曾经缺 `slug` 列就是这类，症状是全新安装时英雄表 0 行。

### 英雄查询链路：SQL 搬进 XML，两个详情接口合一

**改了什么**

- `HeroMapper` 的 SQL 从 `@Select` 注解搬进 [mapper/HeroMapper.xml](../dota-guide-backend/src/main/resources/mapper/HeroMapper.xml)；
  Java 接口只剩 3 个方法声明
- 列表和计数共用的 5 个 WHERE 谓词抽成 `<sql id="filters">` 片段
- `findDetailRows(id)` + `findDetailRowsBySlug(slug)` 合成一个 `findByKey(key, numericKey)`
- 详情返回类型从 `List<HeroDetailRow>`（扁平行）改成 `HeroDetailVO`，
  嵌套结构由 `<collection>` 在 MyBatis 内部折叠；`HeroDetailRow`（205 行）和
  Service 里 40 行的 `assembleDetail` 一起删掉
- 新的 `HeroQuery` 参数对象收掉 Controller 的 7 个 `@RequestParam`
  和原来散在 Service 里的 page/size 兜底
- 接口 `GET /api/heroes/{id}` + `GET /api/heroes/slug/{slug}` 合并成 `GET /api/heroes/{key}`；
  前端 `api/hero.js` 里那段「按是不是纯数字选请求地址」的正则删掉

**为什么**

改之前，同一件事（"这个英雄是谁"）有两条几乎一样的代码路径，
差别只有 WHERE 条件一个用 id 一个用 slug；而"列表和总数要用同一套筛选条件"
这件事靠一句注释「改了一处，记得同步改另一处」来维持。

**要改英雄相关的 SQL 或字段，去 XML 文件**，不用碰 .java。

**踩到的坑（省得下次再踩）**

- **`mybatis.mapper-locations` 必须显式配。** 原版 MyBatis 的 Spring Boot Starter
  **不会**默认扫描 `resources/mapper/`，不配的话 XML 照样会被打进 jar，
  但根本不被读取，症状是启动正常、一调用就报
  `Invalid bound statement (not found): ...HeroMapper.xxx`。
  （网上"默认就扫 `classpath*:/mapper/**/*.xml`"说的是 MyBatis-**Plus**，本项目是原版。）
- **带 `<collection>` 的 `resultMap` 不会自动映射外层列。**
  MyBatis 默认 `autoMappingBehavior=PARTIAL`，含义是"含嵌套映射的 resultMap 不做自动映射"，
  所以 14 个英雄字段要一个个写 `<result>`，漏写的会**静默变成 null**、不报错。
- **`size` 上限从 100 提到 500**，修的是一个静默截断：集成测试的 `fetchAllHeroes()`
  传 `size=500` 想一次拿完 127 个英雄，被 100 的上限砍掉后只拿到前 100 个，
  有 27 个英雄从来没被"遍历检查字段"的测试覆盖过，而测试全绿。
  现在 `fetchAllHeroes()` 里加了一条「拿到的条数 == total」断言，
  同样的问题再出现会直接失败而不是静默少测。

**验证方式**：拿改动前后的两个 jar 各起一个实例，对 14 个请求做响应体逐字节对比 ——
12 个完全一致（含全部带技能的详情 payload，证明技能顺序和内容没变）。
两处不同都是有意为之：404 的提示文案（原来会写 `id=` / `slug=`，合并后只能写 key），
以及上面说的 `size` 上限。
