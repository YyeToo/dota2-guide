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
| 数据库 | MySQL | 8.x | 需本地已安装并启动 |
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
│   └── gen_official.js           # 流水线第 3 步：生成 heroes_full / skills_full
├── dota-guide-backend/           # 后端：Spring Boot 3 + MyBatis
│   ├── pom.xml                   # Maven 依赖清单（相当于 package.json）
│   ├── mvnw / mvnw.cmd           # Maven Wrapper：免安装 Maven
│   └── src/main/
│       ├── java/com/dota/guide/  # controller / service / mapper / entity / common / config
│       └── resources/application.yml   # 端口、数据库连接、MyBatis 配置
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
| MySQL | 8.x，已启动服务 | 能连上 `localhost:3306` |
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
| `page` | int | 否 | 页码，默认 1 |
| `size` | int | 否 | 每页条数，默认 24，上限 100 |

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

`GET /api/heroes/{id}`

```json
{
  "code": 200, "message": "success",
  "data": {
    "id": 2, "name": "斧王", "role": "核心、控制、肉盾、先手", "pos": "3号位",
    "attr": "力量", "attack": "近战", "complexity": 1, "avatar": "https://.../axe.png",
    "intro": "...", "tips": "...", "items": "先锋盾、闪烁匕首", "counters": "怕远程消耗型英雄...",
    "skills": [
      { "id": 1, "skillKey": "Q", "skillType": "主动", "skillSource": "基础", "skillName": "狂战士之吼", "skillDesc": "..." },
      { "id": 5, "skillKey": "", "skillType": "被动", "skillSource": "魔晶", "skillName": "反击螺旋·魔晶强化", "skillDesc": "..." }
    ]
  }
}
```

> 💡 技能按 Q→W→E→R→D→F 排序，无按键的"强化类"排最后。
> `skillType` = 主动/被动（被动自动生效无需按键）；`skillSource` = 基础/魔晶/神杖；
> **`skillKey` 为空 = 魔晶/神杖只强化已有技能（不占新按键）**，D/F 只出现在新增技能上
> （127 英雄共 69 条：D 键 37 条、F 键 32 条）。

404 示例：`{ "code": 404, "message": "英雄不存在（id=99）", "data": null }`

### 接口三：按 slug 查英雄详情

`GET /api/heroes/slug/{slug}`，如 `/api/heroes/slug/sven`

`slug` 是英雄的**英文内部名**（`sven` / `nevermore` / `crystal_maiden`），全表唯一且稳定，
不会随数据重灌而变化 —— 站内的教学链接用它而不是 id。返回结构与接口二完全相同。

> 💡 前端按参数是否为纯数字自动选路：数字走 `/{id}`，否则走 `/slug/{slug}`。

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

> 💡 官网新增英雄（>127）时生成器会报"请先补齐数据！"——按提示在 gen_official.js 的
> NEW_HERO_DATA 里补上数据即可。表结构不变，跑完后端无需重启。

## 常见报错与解决

| 报错 | 原因 | 解决 |
|---|---|---|
| `Communications link failure` / `Connection refused` | MySQL 没启动，或密码错误 | 启动 MySQL 服务；核对 application.yml 的账号密码 |
| 接口请求约 30 秒才返回，且 code 为 500 | 数据库连不上，连接池 30 秒超时 | 同上：核对账号密码、确认 MySQL 已启动 |
| `Public Key Retrieval is not allowed` | MySQL 8 认证方式限制 | 本项目 URL 已内置 `allowPublicKeyRetrieval=true` |
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

## 更多文档

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) —— 历史版本升级路径、各阶段功能清单、阶段报错排查
