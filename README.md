# 🛡️ Dota 2 新手入门教学网站

面向从《英雄联盟》《王者荣耀》转过来的 Dota 2 新手的入门教学网站。

英雄与技能数据全部对齐 **dota2.com 官网**（127 名英雄 / 795 条技能），并补充官网没有的
**新手打法建议、装备推荐、克制关系、1–5 号位教学**。

## 功能特性

- **英雄图鉴** —— 127 名英雄卡片列表；按主属性 / 复杂度 / 官网 9 定位 / 号位筛选；
  搜索支持俗称（搜"剑圣"出主宰、搜"冰女"出水晶室女）
- **英雄详情** —— 技能（主动/被动、魔晶/神杖、D/F 键）、装备推荐、克制关系、新手打法建议
- **新手须知** —— 1–5 号位资源分配体系 + 与 LOL/王者的关键差异，为转学玩家准备
- **进阶攻略** —— 对线期到中后期的运营思路（内容来源见页面内标注）
- **一键更新** —— `bash sql/update_all.sh` 从官网重新拉取数据并重建数据库

## 技术栈与版本

| 层 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 后端 | Java | 17 | 已在本机验证 17.0.19 |
| 后端 | Spring Boot | 3.5.16 | Boot 3 系列最终稳定版 |
| 后端 | MyBatis | 3.0.5 | 官方适配 Boot 3.5 的版本 |
| 数据库 | MySQL | **5.7**（实测 5.7.23） | 本项目不用窗口函数等 8.0 特性，5.7 及以上都能跑 |
| 前端 | Vue | 3.5.x | 组合式 API（`<script setup>`） |
| 前端 | Vite | 6.4.4 | 锁定 6.x：Vite 7/8 要求 Node ≥ 22.12 |
| 前端 | Vue Router | 4.6.x | 页面路由 |
| 前端 | Axios | 1.20.x | HTTP 请求 |

## 项目结构

```
XM-01/
├── README.md                     # 本文件：快速上手与接口文档
├── docs/
│   ├── DEVELOPMENT.md            # 开发笔记：历史版本升级、各阶段功能清单、阶段报错排查
│   └── agents/                   # AI 协作配置（issue 跟踪 / 术语标签 / 领域文档）
├── sql/                          # 数据库脚本与官网数据流水线
│   ├── init.sql                  # 建库建表 + 示例数据（全新安装第一步）
│   ├── heroes_full.sql           # 官网 127 名英雄数据（先清空 hero 表再导入）
│   ├── skills_full.sql           # 全部 795 条技能（先清空 hero_skill 表再导入）
│   ├── upgrade_v2~v6.sql         # 历史版本升级脚本（一般用不到，见 docs/DEVELOPMENT.md）
│   ├── update_all.sh             # 一键更新流水线
│   ├── download_official.js      # 流水线第 1 步：拉取官网原始数据
│   ├── gen_official.js           # 流水线第 3 步：生成 heroes_full / skills_full（命令行入口）
│   ├── lib/                      # 生成规则，按阶段分文件（改规则来这里）
│   │   ├── vocab.js              #   常量 + 手工特例表（俗称/按键特例/替换文案兜底）
│   │   ├── text.js               #   文本清洗与 %token% 占位符解析
│   │   ├── heroes.js             #   英雄行（官网数据 + 教学数据合并）
│   │   ├── skills.js             #   技能行（按键/来源/主动被动分类）
│   │   ├── render.js             #   SQL 渲染
│   │   └── review.js             #   人工复核清单（含严重度分级）
│   └── test/                     # 生成器测试（node --test）
│       ├── lib.test.js           #   各阶段规则的单元测试
│       ├── golden.test.js        #   全量对比：生成结果 vs 已发布的 .sql
│       └── fixtures/             #   golden 测试用的冻结输入
├── dota-guide-backend/           # 后端：Spring Boot 3 + MyBatis
│   ├── pom.xml                   # Maven 依赖清单（相当于 package.json）
│   ├── mvnw / mvnw.cmd           # Maven Wrapper：免安装 Maven
│   ├── src/main/
│   │   ├── java/com/dota/guide/  # controller / service / mapper / query / entity / common / config
│   │   └── resources/
│   │       ├── application.yml   # 数据库连接等配置
│   │       └── mapper/           # MyBatis 的 XML SQL（HeroMapper.xml）
│   └── src/test/                 # 后端集成测试（连真实数据库跑完整 HTTP 链路）
└── dota-guide-frontend/          # 前端：Vue 3 + Vite
    ├── vite.config.js
    └── src/
        ├── api/hero.js           # Axios 封装 + 接口函数
        ├── router/index.js       # 路由：/ 新手须知、/heroes 图鉴、/advanced 进阶
        ├── assets/main.css       # 全局样式（深色 + Dota 红金主题）
        └── views/                # 四个页面组件
```

**请求链路**：前端 Axios → Controller（接请求）→ Service（业务）→ Mapper（SQL）→ MySQL
→ 原路返回 JSON。

## 环境准备

| 软件 | 要求 | 检查命令 |
|---|---|---|
| JDK | 17 或更高 | `java -version` |
| Maven | **不需要安装**（项目自带 mvnw） | — |
| MySQL | 5.7 或更高，已启动服务（本机实测 5.7.23） | 能连上 `localhost:3306` |
| Node.js | 18+（22.11 已验证） | `node --version` |

## 快速开始

### 第 1 步：初始化数据库

用 Navicat / MySQL Workbench / DBeaver 打开 sql 文件直接运行（没有图形工具就用命令行）：

```bash
# 在项目根目录 XM-01 下
mysql -u root -p < sql/init.sql
```

按顺序执行 3 个脚本，**顺序不能反**：

1. [sql/init.sql](sql/init.sql) —— 建库建表 + 5 条示例数据
2. [sql/heroes_full.sql](sql/heroes_full.sql) —— 官网全部 127 名英雄
3. [sql/skills_full.sql](sql/skills_full.sql) —— 全部 795 条技能

> 💡 后两个脚本会先清空表再插入，可重复执行。执行完需要**重启后端**。
>
> 如果你的数据库是早期版本建立的（缺列 / 缺表），见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

### 第 2 步：修改数据库账号密码

打开 [application.yml](dota-guide-backend/src/main/resources/application.yml)，
把 `username` / `password` 改成你自己的 MySQL 账号密码（默认 `root` / `123456`）。

### 第 3 步：启动后端

```bash
cd dota-guide-backend
mvnw.cmd spring-boot:run          # Windows CMD
.\mvnw.cmd spring-boot:run        # Windows PowerShell（注意开头的 .\）
./mvnw spring-boot:run            # Git Bash
```

- 首次运行会自动下载 Maven 本体和依赖（已配阿里云镜像，约 1~3 分钟），之后秒启动。
- 看到 `Started DotaGuideApplication` 即启动成功。
- 验证：浏览器打开 <http://localhost:8080/api/heroes>，应看到 JSON 数据。

### 第 4 步：启动前端

```bash
cd dota-guide-frontend
npm install     # 首次运行需装依赖
npm run dev
```

浏览器打开 **http://localhost:5173** 即可。

## 接口文档

统一返回格式 `{ code, message, data }`，code 200 为成功。

### 接口一：英雄列表（分页 + 筛选）

`GET /api/heroes`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keyword` | string | 否 | 模糊搜索英雄名 / **俗称** / 简介，三列同时匹配；结果按"名字命中 > 俗称命中 > 简介命中"排序 |
| `role` | string | 否 | 按官网定位模糊筛选，如 `role=核心`（核心/辅助/爆发/控制/打野/肉盾/逃生/推进/先手） |
| `pos` | string | 否 | 按号位模糊筛选，如 `pos=3号位` |
| `attr` | string | 否 | 按主属性**精确**筛选：`力量` / `敏捷` / `智力` / `全才`（官网数据，分布 36/35/34/22） |
| `complexity` | int | 否 | 按复杂度**精确**筛选：`1` 简单 / `2` 中等 / `3` 困难（分布 55/59/13） |
| `page` | int | 否 | 页码，默认 1（小于 1 按 1 处理） |
| `size` | int | 否 | 每页条数，默认 24，上限 500（小于 1 按 24 处理） |

示例：`GET /api/heroes?keyword=斧&role=核心&attr=力量&complexity=1&page=1&size=24`

```json
{
  "code": 200, "message": "success",
  "data": {
    "total": 127,
    "list": [
      { "id": 2, "name": "斧王", "role": "核心、控制、肉盾、先手", "pos": "3号位",
        "attr": "力量", "attack": "近战", "complexity": 1,
        "avatar": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png",
        "intro": "...", "tips": "...", "items": "...", "counters": "..." }
    ]
  }
}
```

### 接口二：英雄详情（含技能列表）

`GET /api/heroes/{key}`

`key` 有两种写法，返回结构完全相同：

| 写法 | 例子 | 说明 |
|---|---|---|
| **slug** | `/api/heroes/sven`、`/api/heroes/crystal_maiden` | 英雄的**英文内部名**，全表唯一且稳定。站内链接（首页卡片、新手须知「代表英雄」表格）都用它 —— 数据重灌不会变、URL 还能读懂 |
| 数字 id | `/api/heroes/3` | 数据库内部编号。第七阶段之前留下的书签仍然有效，新链接不必再用 |

> 💡 后端自己分辨 `key` 是哪种（纯数字试 id，否则当 slug），前端不用判断。

```json
{
  "code": 200, "message": "success",
  "data": {
    "id": 2, "name": "斧王", "role": "核心、控制、肉盾、先手", "pos": "3号位",
    "attr": "力量", "attack": "近战", "complexity": 1, "avatar": "https://.../axe.png",
    "intro": "...", "tips": "...", "items": "先锋盾、闪烁匕首", "counters": "怕远程消耗型英雄...",
    "skills": [
      { "id": 1, "skillKey": "Q", "skillType": "主动", "skillCategory": "基础", "isInnate": 0, "sortOrder": 1, "skillName": "狂战士之吼", "skillDesc": "..." },
      { "id": 5, "skillKey": "", "skillType": "被动", "skillCategory": "魔晶强化", "isInnate": 0, "sortOrder": 5, "skillName": "反击螺旋·魔晶强化", "skillDesc": "..." }
    ]
  }
}
```

技能字段一览：

| 字段 | 取值 | 含义 |
|---|---|---|
| `skillKey` | `Q`/`W`/`E`/`R`/`D`/`F` 或空串 | 按键。**空串 = 魔晶/神杖只强化已有技能，不占新按键**，D/F 只出现在新增技能上（127 英雄共 69 条：D 键 37 条、F 键 32 条） |
| `skillType` | 主动 / 被动 | 被动自动生效、无需按键 |
| `skillCategory` | 基础 / 魔晶新增 / 神杖新增 / 魔晶强化 / 神杖强化 | 这个技能的来源，以及它是"多给一个技能位"还是"强化已有技能" |
| `isInnate` | 1 / 0 | 先天技能（出生自带、随等级自动升级，如剑圣的剑舞）。全库 18 条 |
| `sortOrder` | 1..n | 本行在该英雄技能列表里的位次，**每个英雄都是 1..n 连续**（库里靠 `UNIQUE KEY (hero_id, sort_order)` 兜底） |

> 💡 **顺序不用前端算。** 接口按 `sortOrder` 返回，就是页面该显示的顺序
> （Q→W→E→R→D→F，无按键的"强化类"排最后，魔晶在神杖前）——这个顺序由生成器算好
> 写进了数据库，`HeroMapper.xml` 里只剩 `ORDER BY s.sort_order` 一句。
> 前端也不必再从名字前缀或空按键去反推分类，直接读 `skillCategory` / `isInnate` 即可。

404 示例：`{ "code": 404, "message": "英雄不存在（sven）", "data": null }`

## 一键更新流水线

Dota 出新版本，或改了数据库里的教学文案想重新整合时，一条命令：

```bash
bash sql/update_all.sh
```

自动完成 4 步：

1. [download_official.js](sql/download_official.js) —— 从官网接口拉取最新数据存到 `sql/_official_raw/`（限速 + 重试，失败清单记在 download.log）
2. **导出数据库里的手工教学数据** —— 号位/装备/克制/打法建议是官网没有的，导出成 TSV 供合并
3. [gen_official.js](sql/gen_official.js) —— 合并两边数据，生成 `heroes_full.sql` / `skills_full.sql`
4. **导入数据库** —— 先英雄后技能，最后打印总数/分布校验

> 💡 官网新增英雄（>127）时生成器会报"请先补齐数据！"——按提示在
> [sql/lib/vocab.js](sql/lib/vocab.js) 的 `NEW_HERO_DATA` 里补上数据即可。
> 表结构不变，跑完后端无需重启。

> ⚠️ 生成器发现**阻断级问题**时会以退出码 2 结束，流水线停在第 3 步、
> **不会**把数据导入数据库（SQL 文件仍会写出，方便查看）。这些是会让写进库里的
> 数据出错的状况：key 写错字的俗称、手写覆盖的文案片段没命中、`%token%` 查不到数值等。
> 看它打印的「人工复核清单」即可定位。

## 常见报错与解决

| 报错 | 原因 | 解决 |
|---|---|---|
| `Communications link failure` / `Connection refused` | MySQL 没启动，或密码错误 | 启动 MySQL 服务；核对 application.yml 的账号密码 |
| 接口请求约 30 秒才返回，且 code 为 500 | 数据库连不上，连接池 30 秒超时 | 同上：核对账号密码、确认 MySQL 已启动 |
| `Public Key Retrieval is not allowed` | MySQL 8 的 `caching_sha2_password` 认证方式限制（5.7 用 `mysql_native_password`，不会遇到） | 本项目 URL 已内置 `allowPublicKeyRetrieval=true` |
| `Unknown database 'dota_guide'` | 没执行初始化脚本 | 先执行 sql/init.sql |
| 浏览器 Console 报 CORS | 跨域被拦 | ① 确认后端已启动（8080）；② 确认 CorsConfig 存在；③ 或改用 vite.config.js 里的代理方案 |
| 前端显示"加载失败/网络错误" | 后端没启动或端口不对 | 先单独打开 `http://localhost:8080/api/heroes` 验证后端 |
| 列表页报 400，筛选条件是中文 | 中文参数没做 URL 编码 | 浏览器/axios 会自动编码；用 curl 手测时转成百分号编码（力量 = `%E5%8A%9B%E9%87%8F`） |
| 下载依赖超时 / 卡住 | 访问 Maven 中央仓库慢 | 已内置阿里云镜像；若在 IDEA 里构建，需在 IDEA 的 Maven 设置里配镜像 |
| `mvnw` 提示找不到 JAVA_HOME | JDK 未装或环境变量缺失 | 安装 JDK 17 并配置 JAVA_HOME |
| PowerShell 提示"找不到命令 mvnw.cmd" | PowerShell 默认不从当前目录加载命令 | 命令前加 `.\` |
| 8080 / 5173 端口被占用 | 其他程序占用了端口 | 改 application.yml 的 `server.port`；前端改 vite.config.js |
| 页面中文乱码 | 字符集问题 | 数据库已用 utf8mb4；确保 IDE 文件编码为 UTF-8 |
| `npm install` 很慢或失败 | npm 官方源慢 | `npm config set registry https://registry.npmmirror.com` 后重试 |
| 想升级 Vite 7/8 报 Node 版本错误 | Vite 7/8 要求 Node ≥ 22.12 | 保持项目锁定的 Vite 6，或先升级 Node |

> 数据库停留在早期版本结构导致的报错（`Unknown column 'attr'` 等），见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 跑测试

```bash
# 生成器测试（71 条，不需要数据库、不需要官网原始数据）
cd sql
node --test

# 后端集成测试（11 条，需要 MySQL 在跑、dota_guide 库有数据）
cd dota-guide-backend
./mvnw test
```

生成器测试分两层：

- `lib.test.js` —— 各阶段规则的单元测试（占位符替换顺序、按键分配边界、复核清单分级……）
- `golden.test.js` —— 拿仓库里真实的两份输入跑完整条流水线，把结果和**已发布的
  `heroes_full.sql` / `skills_full.sql` 逐字节对比**。这两个文件正是要保证的东西，
  所以直接拿它们当期望值。**它会在 `sql/_official_raw/` 不存在时自动跳过**（该目录被
  `.gitignore` 排除），unit 测试不受影响。

后端集成测试连真实数据库、走完整 HTTP 链路（MockMvc → Controller → Service → Mapper），
断言的是「SQL 文件、表结构、代码三者是否一致」这类编译期发现不了的问题 ——
比如 127 个英雄的 slug 是否唯一非空、每个英雄是否都挂得上技能、中文有没有乱码、
每个英雄的 `sortOrder` 是不是 1..n 连续。
它是**只读**的，对着生产库跑也安全。

## 常见命令速查

```bash
# 后端：编译 / 启动 / 打包 / 测试
cd dota-guide-backend
./mvnw compile              # 只编译
./mvnw spring-boot:run      # 编译并启动
./mvnw package              # 打包成可执行 jar
./mvnw test                 # 跑集成测试（需数据库在跑）

# 前端：开发 / 构建
cd dota-guide-frontend
npm run dev                 # 开发服务器（5173）
npm run build               # 生产构建（输出到 dist/）

# 数据流水线：生成器测试
cd sql
node --test                 # 跑生成器测试
```

## 更多文档

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) —— 历史版本升级路径、各阶段功能清单、阶段报错排查
