# 雏英计划宣传官网

SoftTong「**雏英计划**」PC Web 全栈站点：前台宣传与加入申请、雏英报名/积分申请、管理后台（内容 / 活动 / 审核 / 权限）。

技术栈：npm workspaces monorepo · Vite + React · Express · SQLite（`better-sqlite3`）。

> 本仓库**不含** `docs/`（产品 PRD / 设计稿仅本地保留）。按下文即可完整克隆、安装、开发与部署。

---

## 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | **18+**（建议 20 LTS） |
| 包管理 | npm（随 Node 自带） |
| 系统 | Windows / macOS / Linux；native 模块需可编译（Windows 一般已带 VS Build Tools 即可） |

可选：`git`（克隆仓库）。

---

## 快速开始（开发）

```bash
git clone https://github.com/qinghong268/chuying-portal.git
cd chuying-portal
npm install
npm run dev
```

| 服务 | 地址 | 说明 |
| --- | --- | --- |
| 前端 Vite | http://localhost:5173 | `/api` 代理到 5179 |
| API Express | http://localhost:5179 | SQLite 自动 migrate + seed |

浏览器打开 **http://localhost:5173**。

单独启动：

```bash
npm run dev:server   # 仅 API
npm run dev:client   # 仅前端
```

### 重置演示库

数据库默认路径：`server/data/chuying.db`（已被 gitignore，首次启动自动创建）。

若演示密码对不上、或 seed 数据过旧：

```bash
# 停掉 npm run dev 后
rm server/data/chuying.db        # Windows: del server\data\chuying.db*
# 也可删 chuying.db-wal / chuying.db-shm
npm run dev
```

---

## 演示账号

登录页支持 **账号 + 密码**，也可 **一键演示登录**（无需密码）。

三角色共用密码 **`Demo1234!`**：

| 角色 | 账号 | 密码 | 登录后入口 |
| --- | --- | --- | --- |
| 雏英 | `eagle@demo` | `Demo1234!` | `/me` 个人中心 |
| 管理员 | `admin@demo` | `Demo1234!` | `/admin`（八类权限包，不含 `permission`） |
| 超级管理员 | `super@demo` | `Demo1234!` | `/admin`（含权限包管理） |

---

## 生产部署（单进程）

构建后由 Express **同时提供 API 与前端静态资源**（存在 `client/dist` 时自动启用）。

```bash
git clone https://github.com/qinghong268/chuying-portal.git
cd chuying-portal
npm install
npm run build
```

设置环境变量后启动：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | **生产必填** | 会话 JWT 签名密钥；勿用默认值 |
| `PORT` | 否 | 默认 `5179` |
| `DATABASE_PATH` | 否 | SQLite 文件绝对/相对路径；默认 `server/data/chuying.db` |
| `CLIENT_DIST` | 否 | 前端构建目录；默认仓库内 `client/dist` |
| `NODE_ENV` | 建议 | 设为 `production` 时强制要求 `JWT_SECRET` |

**Linux / macOS 示例：**

```bash
export NODE_ENV=production
export JWT_SECRET='请换成足够长的随机串'
export PORT=5179
npm start
```

**Windows PowerShell 示例：**

```powershell
$env:NODE_ENV = "production"
$env:JWT_SECRET = "请换成足够长的随机串"
$env:PORT = "5179"
npm start
```

浏览器访问：`http://localhost:5179`（或你的服务器 IP/域名 + 端口）。

> 首次启动会 migrate 并写入演示账号（库为空时）。生产环境请尽快修改密码或替换用户数据，并妥善备份 `DATABASE_PATH`。

反向代理（可选）：Nginx / Caddy 将 443 反代到 `PORT`，并配置 HTTPS。

---

## 仓库结构

| 包 | 路径 | 说明 |
| --- | --- | --- |
| `@chuying/shared` | `shared/` | 共享类型与业务常量 |
| `@chuying/server` | `server/` | Express REST + SQLite |
| `@chuying/client` | `client/` | Vite + React 前台与后台 |

npm scope / 罗马字 `chuying` **有意保留**（与产品中文名「雏英」并存）。

---

## 业务常量（`@chuying/shared`）

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `WATCH_PROGRESS_THRESHOLD` | **99** | 线上活动观看进度 ≥99% 可申请心得（类型一） |
| `OFFLINE_APPLY_WINDOW_HOURS` | **24** | 线下活动结束后 24 小时申请窗（另受「积分申请通道截止」约束） |
| `REFLECTION_MIN_LEN` / `REFLECTION_MAX_LEN` | **300–400** | 心得正文字数 |

活动规则摘要：

- **报名截止** = 活动开始时间（开始后不可报名）
- **积分申请通道截止**由后台配置，前台活动详情可见

---

## 脚本一览

```bash
npm install          # 安装全部 workspace 依赖
npm run dev          # 开发：API + Vite
npm run build        # 构建 shared → client → server
npm start            # 生产：启动已构建的 server（需先 build）
npm test             # server 端 Vitest
```

---

## V1 范围

**已实现：** CMS 首页与计划介绍、活动/课程、加入申请与审核、雏英报名与积分申请、管理后台与权限包、演示三角色账号密码 + 一键登录。

**未纳入 V1：** 移动端适配、商城、企业 SSO、加入通过后自动开户（见本地 `docs/prd/known-gaps.md`，不在本公开仓库内）。
