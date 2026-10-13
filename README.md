# 🛡️ Dota 2 新手入门教学网站

面向从《英雄联盟》《王者荣耀》转过来的 Dota 2 新手的入门教学网站。
**第一阶段：英雄图鉴** —— 从数据库读取英雄数据，卡片列表展示，点击查看详情和打法建议；
**第二阶段** —— 技能/装备/克制展示、搜索与筛选、后端分页与前端骨架屏；
**第三阶段** —— 技能标注主动/被动，新增魔晶/神杖技能（D/F 键），详情页徽章展示；
**第四阶段：对齐 dota2.com 官网** —— 官网 127 名英雄（英文名首字母序 + 官方中文名/简介/9 定位/主属性/复杂度/近战远程）、官网技能数据（技能名/描述/魔晶神杖效果/先天技能判定）、官网头像 CDN 图、主属性与复杂度筛选。

## 技术栈与版本

| 层 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 后端 | Java | 17 | 已在本机验证 17.0.19 |
| 后端 | Spring Boot | 3.5.16 | Boot 3 系列最终稳定版 |
| 后端 | MyBatis | 3.0.5 | 官方适配 Boot 3.5 的版本 |
| 数据库 | MySQL | 8.x | 需本地已安装并启动 |
| 前端 | Vue | 3.5.x | 组合式 API（`<script setup>`） |
| 前端 | Vite | 6.4.4 | 锁定 6.x：Vite 7/8 要求 Node ≥ 22.12 |
| 前端 | Vue Router | 4.6.x | 页面路由 |
| 前端 | Axios | 1.20.x | HTTP 请求 |

## 项目结构

```
XM-01/
├── sql/
│   ├── init.sql                  # 数据库初始化脚本（建库 + 建表 + 5 条示例数据，全新安装用，第四阶段表结构）
│   ├── heroes_full.sql           # 完整英雄数据（官网 127 名英雄，官网顺序/数据，会先清空 hero 表再导入）
│   ├── skills_full.sql           # 全部英雄技能（795 行：基础 508 + 神杖 150 + 魔晶 137，先清空 hero_skill 表）
│   ├── upgrade_v2.sql            # 升级脚本：给已有数据库加列 + 建技能表（⚠️ 只需执行一次）
│   ├── upgrade_v3.sql            # 升级脚本：hero_skill 表加 skill_type/skill_source 两列（⚠️ 只需执行一次）
│   ├── upgrade_v4.sql            # 升级脚本：hero 表加 pos/attr/attack/complexity/avatar 五列 + skill_desc 加宽（⚠️ 只需执行一次）
│   ├── upgrade_v5.sql            # 升级脚本：hero 表加 alias 俗称列（搜索俗称用，⚠️ 只需执行一次）
│   ├── update_all.sh             # 一键更新流水线：下载官网数据 → 导出教学数据 → 生成 SQL → 导入数据库
│   ├── download_official.js      # 流水线第 1 步：从官网接口下载原始数据（Node 自带 fetch，无需依赖）
│   ├── gen_official.js           # 流水线第 3 步：官网数据 + 教学数据 → 生成 heroes_full.sql / skills_full.sql
│   └── _official_raw/            # 官网接口原始 JSON（127 份英雄数据，生成器的输入，不提交 Git）
├── dota-guide-backend/           # 后端（Spring Boot 3 + MyBatis）
│   ├── pom.xml                   # Maven 依赖清单（相当于 package.json）
│   ├── mvnw / mvnw.cmd           # Maven Wrapper：免安装 Maven，首次运行自动下载
│   ├── .mvn/
│   │   ├── maven.config          # 附加 Maven 参数（指定使用项目内 settings.xml）
│   │   ├── settings.xml          # 阿里云镜像配置（解决国内下载依赖超时）
│   │   └── wrapper/              # Wrapper 配置（Maven 从阿里云下载）
│   └── src/main/
│       ├── java/com/dota/guide/
│       │   ├── DotaGuideApplication.java      # 启动类
│       │   ├── controller/HeroController.java # 控制层：REST 接口（列表支持 keyword/role/pos/attr/complexity 筛选）
│       │   ├── service/HeroService.java       # 业务层（分页参数兜底 + 详情组装）
│       │   ├── mapper/HeroMapper.java         # 数据访问层：SQL（含 attr/complexity 精确筛选）
│       │   ├── entity/Hero.java               # 实体类：对应 hero 表（含 pos/attr/attack/complexity/avatar）
│       │   ├── entity/HeroSkill.java          # 实体类：对应 hero_skill 技能表（一对多的"多"方，含类型/来源字段）
│       │   ├── entity/HeroDetailRow.java      # JOIN 查询的扁平行（英雄字段 + 技能字段）
│       │   ├── entity/HeroDetailVO.java       # 详情视图对象：Hero + List<HeroSkill>（继承演示）
│       │   ├── common/Result.java             # 统一返回格式 {code,message,data}
│       │   ├── common/PageResult.java         # 分页结果包装 {total, list}
│       │   ├── config/CorsConfig.java         # 跨域配置
│       │   └── exception/GlobalExceptionHandler.java  # 全局异常兜底
│       └── resources/application.yml          # 配置：端口、数据库连接、MyBatis
└── dota-guide-frontend/          # 前端（Vue 3 + Vite）
    ├── index.html                # 页面入口
    ├── vite.config.js            # Vite 配置（含跨域代理的备选方案注释）
    └── src/
        ├── main.js               # 应用入口：挂载 Vue + 路由
        ├── App.vue               # 根组件：页头/页脚/路由出口
        ├── api/hero.js           # Axios 封装 + 接口函数（列表带分页/筛选参数）
        ├── router/index.js       # 路由：/ 列表页，/heroes/:id 详情页，/guide 新手须知页
        ├── assets/main.css       # 全局样式（深色 + Dota 红金主题）
        └── views/
            ├── HomeView.vue      # 首页：官网头像卡片 + 主属性/复杂度页签 + 官网 9 定位筛选 + 分页 + 骨架屏
            ├── HeroDetailView.vue# 详情页：头像 + 属性/难度徽章 + 技能（徽章）+ 魔晶/神杖强化面板 + 装备 + 克制 + 打法建议
            └── GuideView.vue     # 新手须知页：1~5号位体系 + 与 LOL/王者 的差异
```

**请求链路**：前端 Axios → Controller（接请求）→ Service（业务）→ Mapper（SQL）→ MySQL → 原路返回 JSON。

## 环境准备

| 软件 | 要求 | 检查命令 |
|---|---|---|
| JDK | 17 或更高 | `java -version` |
| Maven | **不需要安装**（项目自带 mvnw） | — |
| MySQL | 8.x，已启动服务 | 能连上 `localhost:3306` |
| Node.js | 18+（22.11 已验证） | `node --version` |

## 启动步骤（按顺序）

### 第 1 步：初始化数据库

任选一种方式执行 SQL 脚本（**方式 B 适合没有 mysql 命令行的同学**）：

```bash
# 方式 A：命令行（在项目根目录 XM-01 下）
mysql -u root -p < sql/init.sql
# 方式 B：Navicat / MySQL Workbench / DBeaver 打开 sql 文件直接运行
```

#### 全新安装（还没有 dota_guide 数据库）

按顺序执行 3 个脚本：

1. [sql/init.sql](sql/init.sql) —— 建库建表 + 5 条示例数据（每名英雄 6 条示例技能，含魔晶/神杖）
2. [sql/heroes_full.sql](sql/heroes_full.sql) —— 官网全部 127 名英雄（官网中文名/简介/9 定位/主属性/复杂度/头像 + 本教学站装备推荐、克制关系）
3. [sql/skills_full.sql](sql/skills_full.sql) —— 全部英雄技能（795 行：官网技能名/描述 + 主动/被动标注 + 魔晶/神杖强化与新增技能）

#### 已有第一阶段数据库（hero 表已有英雄数据）

按顺序执行 3 个脚本：

1. [sql/upgrade_v2.sql](sql/upgrade_v2.sql) —— 给 hero 表加 `items`/`counters` 两列 + 新建 `hero_skill` 表（⚠️ 只执行一次，重复执行会报"列已存在"）
2. [sql/heroes_full.sql](sql/heroes_full.sql) —— 重新导入全部 127 名英雄（先清空 hero 表，id 重新从 1 开始，保证和技能表对得上）
3. [sql/skills_full.sql](sql/skills_full.sql) —— 导入全部技能（先清空 hero_skill 表，新版共 795 行）

> 💡 3 个脚本均可重复执行（后两个会先清空再插入，结果一致）。执行完数据后需要**重启后端**
> （新代码查询了 items/counters 列和 hero_skill 表），前端刷新即可看到搜索、分页、技能等内容。

#### 已有第二阶段数据库（技能表已有 492 行，缺"类型/来源"两列）

按顺序执行 2 个脚本（**顺序不能反**：skills_full.sql 新版要写 skill_type/skill_source 列，必须先加好列）：

1. [sql/upgrade_v3.sql](sql/upgrade_v3.sql) —— 给 hero_skill 表加 `skill_type`/`skill_source` 两列（⚠️ 只执行一次，重复执行会报"列已存在"）
2. [sql/skills_full.sql](sql/skills_full.sql) —— 重新导入全部技能（先清空 hero_skill 表，共 795 行）

> 💡 执行期间旧后端的详情接口会短暂报 Unknown column 错误，属正常现象。
> 执行完**重启后端**（新代码查询了这两个新列），前端刷新即可看到 被动/魔晶/神杖 徽章。

#### 已有第三阶段数据库（升级到第四阶段：官网对齐）

按顺序执行 3 个脚本（**顺序不能反**：heroes_full.sql 新版要写 attr 等新列，必须先加好列）：

1. [sql/upgrade_v4.sql](sql/upgrade_v4.sql) —— hero 表加 `pos`/`attr`/`attack`/`complexity`/`avatar` 五列 + `skill_desc` 加宽到 1000（⚠️ 只执行一次，重复执行会报"列已存在"）
2. [sql/heroes_full.sql](sql/heroes_full.sql) —— 官网 127 名英雄（官网英文名首字母序 + 官网 hero_id；6 名英雄换了官方译名：刚背兽→钢背兽、原始兽→獸、德鲁伊→独行德鲁伊、剃刀→雷泽、穆尔塔→琼英碧灵、先知→自然先知；新增 4 名：米拉娜、复仇之魂、酒仙、朗戈）
3. [sql/skills_full.sql](sql/skills_full.sql) —— 官网技能数据（先清空 hero_skill 表，共 795 行）

> 💡 执行期间旧后端的列表接口会短暂报 Unknown column 错误，属正常现象。
> 执行完**重启后端**，前端刷新即可看到官网头像卡片、主属性/复杂度筛选、官网定位标签。

#### 已有第四阶段数据库（升级到第五阶段：搜索俗称优化）

按顺序执行 2 个脚本（**顺序不能反**：heroes_full.sql 新版要写 alias 列，必须先加好列）：

1. [sql/upgrade_v5.sql](sql/upgrade_v5.sql) —— hero 表加 `alias` 俗称/旧译名列（⚠️ 只执行一次，重复执行会报"列已存在"）
2. [sql/heroes_full.sql](sql/heroes_full.sql) —— 重新导入英雄数据（新版带俗称列，108 名英雄配置了俗称/旧名）

> 💡 执行完**重启后端**（新代码搜索时匹配 alias 列），前端刷新即可：
> 搜"剑圣"出主宰、搜"冰女"出水晶室女、搜"剃刀"出雷泽；搜"兽"时名字命中的排最前。

### 第 2 步：修改数据库账号密码

打开 [application.yml](dota-guide-backend/src/main/resources/application.yml)，把 `username` / `password` 改成你自己的 MySQL 账号密码（默认 `root` / `123456`）。

### 第 3 步：启动后端

```bash
cd dota-guide-backend
# Windows CMD：
mvnw.cmd spring-boot:run
# Windows PowerShell（注意开头的 .\ ：PowerShell 不允许直接执行当前目录的命令）：
.\mvnw.cmd spring-boot:run
# Git Bash：
./mvnw spring-boot:run
```

- 首次运行会自动下载 Maven 本体和依赖（已配阿里云镜像，约 1~3 分钟），之后秒启动。
- 看到 `Started DotaGuideApplication` 即启动成功。
- 验证：浏览器打开 <http://localhost:8080/api/heroes>，应看到 JSON 数据。

### 第 4 步：启动前端

```bash
cd dota-guide-frontend
npm install     # 首次运行需装依赖（已用 npmmirror 镜像）
npm run dev
```

浏览器打开 **http://localhost:5173**，即可看到英雄图鉴，点击卡片进入详情页。

## 接口文档

统一返回格式 `{ code, message, data }`，code 200 为成功。

### 接口一：英雄列表（分页 + 筛选）

`GET /api/heroes`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keyword` | string | 否 | 模糊搜索英雄名 / **俗称**（剑圣、冰女、屠夫...）/ 简介，三列同时匹配；结果按"名字命中 > 俗称命中 > 简介命中"排序 |
| `role` | string | 否 | 按官网定位模糊筛选，如 `role=核心`（核心/辅助/爆发/控制/打野/肉盾/逃生/推进/先手） |
| `pos` | string | 否 | 按号位模糊筛选，如 `pos=3号位` |
| `attr` | string | 否 | 按主属性**精确**筛选：`力量` / `敏捷` / `智力` / `全才`（官网数据，分布 36/35/34/22） |
| `complexity` | int | 否 | 按复杂度**精确**筛选：`1` 简单（官网"新手可玩"）/ `2` 中等 / `3` 困难（分布 55/59/13） |
| `page` | int | 否 | 页码，默认 1 |
| `size` | int | 否 | 每页条数，默认 24，上限 100 |

示例：`GET /api/heroes?keyword=斧&role=核心&attr=力量&complexity=1&page=1&size=24`

成功响应（data 是 `{ total, list }`，前端用 total 计算总页数）：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 127,
    "list": [
      {
        "id": 2, "name": "斧王", "role": "核心、控制、肉盾、先手", "pos": "3号位",
        "attr": "力量", "attack": "近战", "complexity": 1,
        "avatar": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png",
        "intro": "...", "tips": "...", "items": "...", "counters": "..."
      }
    ]
  }
}
```

### 接口二：英雄详情（含技能列表）

`GET /api/heroes/{id}`，如 `/api/heroes/1`

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 2,
    "name": "斧王",
    "role": "核心、控制、肉盾、先手",
    "pos": "3号位",
    "attr": "力量",
    "attack": "近战",
    "complexity": 1,
    "avatar": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png",
    "intro": "...",
    "tips": "...",
    "items": "先锋盾、闪烁匕首",
    "counters": "怕远程消耗型英雄...",
    "skills": [
      { "id": 1, "skillKey": "Q", "skillType": "主动", "skillSource": "基础", "skillName": "狂战士之吼", "skillDesc": "..." },
      { "id": 3, "skillKey": "E", "skillType": "被动", "skillSource": "基础", "skillName": "反击螺旋", "skillDesc": "..." },
      { "id": 5, "skillKey": "", "skillType": "被动", "skillSource": "魔晶", "skillName": "反击螺旋·魔晶强化", "skillDesc": "..." },
      { "id": 6, "skillKey": "", "skillType": "主动", "skillSource": "神杖", "skillName": "淘汰之刃·神杖强化", "skillDesc": "..." }
    ]
  }
}
```

> 💡 技能按 Q→W→E→R→D→F 排序，无按键的"强化类"排最后。字段说明：`skillType` = 主动/被动（被动自动生效无需按键）；
> `skillSource` = 基础/魔晶/神杖；**`skillKey` 为空 = 魔晶/神杖只强化已有技能（不占新按键）**，
> D/F 只出现在魔晶/神杖**新增技能**上（127 英雄共 69 条：D 键 37 条、F 键 32 条）。
> 技能名带 **"先天·"前缀 = 官网先天技能**（出生自带、随等级自动升级，如剑圣的剑舞）。

404 示例（id 不存在）：`{ "code": 404, "message": "英雄不存在（id=99）", "data": null }`

## 一键更新流水线（官网数据 → 数据库）

想更新数据（Dota 出新版本/新英雄，或改了数据库里的教学文案想重新整合）时，一条命令搞定：

```bash
bash sql/update_all.sh
```

脚本自动完成 4 步（每步对应一个可单独重跑的脚本，都有详细中文注释）：

1. **[sql/download_official.js](sql/download_official.js)** —— 从 dota2.com 官网接口拉取最新数据（herolist + 127 份英雄全量 JSON，自带中文），存到 `sql/_official_raw/`；带限速（200ms/请求）、超时和失败重试，失败清单记在 download.log
2. **导出数据库里的手工教学数据** —— 号位/装备/克制/打法建议是官网没有的（本教学站自写），平时保管在数据库里，这一步导出成 TSV 供合并
3. **[sql/gen_official.js](sql/gen_official.js)** —— 合并官网数据 + 教学数据，生成 `heroes_full.sql` / `skills_full.sql`，并打印人工复核清单
4. **导入数据库** —— 先英雄后技能（两个文件都会先 TRUNCATE 再插入），最后打印总数/分布校验

生成器做的事（每一步都有注释，可当 Node 文件处理的教学例子）：

1. **英雄**：取官网 `name_loc`（中文名）/`hype_loc`（简介）/`role_levels`（9 定位，>0 的拼成"核心、控制..."）/`primary_attr`（0力量 1敏捷 2智力 3全才）/`attack_capability`（1近战 2远程）/`complexity`（1-3）/头像 CDN 地址；号位/装备/克制/打法建议按英雄名从 TSV 直取（官网新增英雄用 NEW_HERO_DATA 里内置的手写数据兜底）
2. **技能**：每人取前 3 个"非先天、非新增"的普通技能 + 第 1 个"大招类"技能作 Q/W/E/R；魔晶/神杖**新增技能**标 D/F 键；只强化的技能名加"·魔晶强化"/"·神杖强化"后缀、按键留空；先天技能加"先天·"前缀
3. **文本清洗**：官网描述是 `%token%` + HTML 混合格式，生成器先替换数值 token 再剥 HTML 标签；个别官网数据缺失的死 token 已人工改写（REPLACE_MANUAL 列表），运行时会输出人工复核清单

> 💡 官网如果新增了英雄（>127），生成器会报"请先补齐数据！"——按提示在 gen_official.js 的
> NEW_HERO_DATA 里补上号位和教学文案即可，这是设计好的保护机制。
> 表结构不变，跑完流水线后端无需重启，前端刷新即可。

## 常见报错与解决

| 报错 | 原因 | 解决 |
|---|---|---|
| `Communications link failure` / `Connection refused` | MySQL 没启动，或密码错误 | 启动 MySQL 服务；核对 application.yml 的账号密码 |
| 接口请求约 30 秒才返回，且 code 为 500 | 数据库连不上（密码错 / 服务没启动），连接池 30 秒超时 | 同上：核对账号密码、确认 MySQL 服务已启动 |
| `Public Key Retrieval is not allowed` | MySQL 8 认证方式限制 | 本项目 URL 已内置 `allowPublicKeyRetrieval=true`，老项目里需要手动加上 |
| `Unknown database 'dota_guide'` | 没执行初始化脚本 | 先执行 sql/init.sql |
| 浏览器 Console 报 CORS（`Access-Control-Allow-Origin`） | 跨域被拦 | ① 确认后端已启动（8080）；② 确认 CorsConfig 存在；③ 或改用 vite.config.js 里的代理方案 |
| 前端显示"加载失败/网络错误" | 后端没启动或端口不对 | 先单独打开 `http://localhost:8080/api/heroes` 验证后端；检查 api/hero.js 的 baseURL |
| 列表页加载失败，后端日志报 `Unknown column 'items'` 或 `hero_skill doesn't exist` | 数据库还是第一阶段结构，缺新列/新表 | 按顺序执行 upgrade_v2.sql → heroes_full.sql → skills_full.sql（见第 1 步），然后重启后端 |
| 详情页加载失败，后端日志报 `Unknown column 'skill_type'` | 数据库还是第二阶段结构，技能表缺"类型/来源"两列 | 先执行 upgrade_v3.sql → skills_full.sql（见第 1 步），然后重启后端 |
| 列表页加载失败，后端日志报 `Unknown column 'attr'`（或 pos/attack/complexity/avatar） | 数据库还是第三阶段结构，hero 表缺官网对齐的新列 | 先执行 upgrade_v4.sql → heroes_full.sql → skills_full.sql（见第 1 步），然后重启后端 |
| 列表页报 400，筛选条件是中文（attr=力量 等） | 中文参数没做 URL 编码就塞进了 URL | 浏览器/axios 会自动编码，一般不会遇到；用 curl 手测时把中文转成百分号编码（如 力量 = %E5%8A%9B%E9%87%8F） |
| 下载依赖超时 / 卡住 | 访问 Maven 中央仓库慢 | 本项目已内置阿里云镜像（.mvn/settings.xml + wrapper 配置）；若在 IDEA 里构建，需在 IDEA 的 Maven 设置里配阿里云镜像 |
| `mvnw` 提示找不到 JAVA_HOME | JDK 未装或环境变量缺失 | 安装 JDK 17 并配置 JAVA_HOME |
| PowerShell 提示"找不到命令 mvnw.cmd" | PowerShell 默认不从当前目录加载命令 | 命令前加 `.\`，即 `.\mvnw.cmd spring-boot:run` |
| 8080 / 5173 端口被占用 | 其他程序占用了端口 | 改 application.yml 的 `server.port`；前端改 vite.config.js 的 `server.port` |
| 页面中文乱码 | 字符集问题 | 数据库已用 utf8mb4；确保 IDE 文件编码为 UTF-8 |
| `npm install` 很慢或失败 | npm 官方源慢 | `npm config set registry https://registry.npmmirror.com` 后重试 |
| 想升级 Vite 7/8 报 Node 版本错误 | Vite 7/8 要求 Node ≥ 22.12 | 保持项目锁定的 Vite 6，或先升级 Node |

## 写给转学玩家的 Dota 小知识

> 💡 这部分内容已做成网站页面：前端启动后访问 http://localhost:5173/guide 即可在站内查看（页头导航"📖 新手须知"）。

**1~5 号位**（Dota 的资源分配体系，LOL/王者没有的概念，新手最容易困惑）：

| 位置 | 职责 | 对应本项目示例 |
|---|---|---|
| 1 号位 | 主力核心，吃最多资源，后期大哥 | 斯温 |
| 2 号位 | 中单，前中期节奏核心 | 影魔 |
| 3 号位 | 劣势路核心，抗压 + 先手开团 | 斧王 |
| 4 号位 | 游走/节奏辅助 | 帕吉 |
| 5 号位 | 纯辅助，买眼保人，几乎不吃资源 | 水晶室女 |

其他关键差异：Dota **没有固定打野位**；可以**反补**己方小兵压制对手；**死亡会掉钱**；所有英雄**免费解锁**；回城需要买 **TP 卷轴**（不是免费技能）。

**魔晶与神杖**（装备可以改变技能，LOL/王者没有的概念）：购买阿哈利姆魔晶（1400 金币）或阿哈利姆神杖（4200 金币）后，可以**强化已有技能甚至获得新技能**。绝大多数英雄是"强化"（不占新按键）；只有少数英雄会真正**新增技能**（游戏里多出一个技能位，绑定 D/F 键，如食人魔魔法师、司夜刺客、巨牙海民）。每个英雄的强化内容各不相同，详见各英雄详情页（魔晶标紫、神杖标金、被动标灰）。

## 已完成的功能清单

**第一阶段（英雄图鉴 MVP）**
- ✅ 英雄基础数据：全部 123 名英雄（中文名/定位/简介/新手打法建议）
- ✅ 卡片列表 + 详情页 + 路由 + 统一返回格式 + CORS

**第二阶段（已完成）**
- ✅ 英雄技能数据表（`hero_skill`，一对多关联查询）
- ✅ 装备推荐、克制关系（hero 表新增 `items` / `counters` 列）
- ✅ 列表搜索 / 按定位筛选（`keyword` / `role` / `pos` 参数）
- ✅ 后端分页（`page` / `size`，返回 `{total, list}`）+ 前端骨架屏

**第三阶段（已完成）**
- ✅ 技能标注主动/被动（`skill_type` 列；光环类等自动生效技能也算被动）
- ✅ 魔晶/神杖技能（`skill_source` 列，123 名英雄 × 2 = 246 条；纯强化不占按键、skill_key 为空，新增技能才标 D/F 键）
- ✅ 详情页技能徽章：被动（灰）/ 魔晶（紫）/ 神杖（金）+ 独立"魔晶/神杖强化"面板

**第四阶段（已完成）：对齐 dota2.com 官网**
- ✅ 官网 127 名英雄：英文名首字母序 + 官网 hero_id、官方中文名/简介、官网 9 定位（role 列）、主属性（力量/敏捷/智力/全才）、攻击方式（近战/远程）、复杂度（1-3）
- ✅ 官网技能数据 795 条：官方技能名/描述（token 数值已替换、HTML 已清洗）、魔晶/神杖强化与新增技能（D/F 键）、先天技能判定（"先天·"前缀）、被动判定（behavior 位掩码）
- ✅ 官网头像 CDN 图（steamstatic.com 直链，列表卡片 + 详情页大图）
- ✅ 列表页：主属性页签筛选（全部/力量/敏捷/智力/全才）+ 复杂度页签筛选（简单/中等/困难）+ 定位下拉改官网 9 定位
- ✅ 详情页：头像 + 主属性/攻击方式/难度/号位徽章 + 官网定位多标签 + 先天技能徽章
- ✅ 本教学站自创体系保留：1-5 号位（pos 列，官网没有）、新手打法建议/装备/克制（官网没有）
- ✅ 一键更新流水线 update_all.sh（下载官网数据 → 导出教学数据 → 生成 SQL → 导入数据库，可重复执行）

**第五阶段（已完成）：搜索俗称优化**
- ✅ hero 表新增 `alias` 俗称/旧译名列（upgrade_v5.sql），108 名英雄配置了俗称（剑圣、冰女、屠夫、卡尔、电狗...）
- ✅ 搜索框三列同时匹配：官方名（name）/ 俗称（alias）/ 简介（intro）
- ✅ 结果按命中权重排序：名字命中 > 俗称命中 > 简介命中（搜"兽"时真正叫"獸"的英雄排最前）
- ✅ 俗称数据随流水线维护：ALIASES 表写在 gen_official.js 里，每次重新生成 heroes_full.sql 自动带上

## 常见命令速查

```bash
# 后端：编译 / 启动 / 打包
cd dota-guide-backend
./mvnw compile              # 只编译
./mvnw spring-boot:run      # 编译并启动
./mvnw package              # 打包成可执行 jar

# 前端：开发 / 构建
cd dota-guide-frontend
npm run dev                 # 开发服务器（5173）
npm run build               # 生产构建（输出到 dist/）
```
