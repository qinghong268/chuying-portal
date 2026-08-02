# 雏鹰计划宣传官网

PC Web 全栈 monorepo：前台宣传 + 雏鹰报名/积分申请 + 管理后台。

## Workspace 布局

| 包 | 路径 | 说明 |
|----|------|------|
| `@chuying/shared` | `shared/` | 共享类型与业务常量 |
| `@chuying/server` | `server/` | Express REST + SQLite |
| `@chuying/client` | `client/` | Vite + React 前台与后台 |

## 安装与启动

```bash
npm install
npm run dev        # 同时启动 server + client（推荐）
npm run dev:all    # 同上，plan 别名
```

| 服务 | 地址 | 说明 |
|------|------|------|
| API Server | `http://localhost:5179` | Express；可通过 `PORT` 覆盖 |
| Vite Client | `http://localhost:5173`（默认） | 开发时 `/api` 代理至 5179 |

单独启动：

```bash
npm run dev:server   # 仅 API
npm run dev:client   # 仅前端
```

## 演示账号（一键登录）

登录页选择角色即可，无需密码：

| 角色 | 邮箱 | 入口 |
|------|------|------|
| 雏鹰 | `eagle@demo` | 登录后进入 `/me` 个人中心 |
| 管理员 | `admin@demo` | `/admin` 后台（八类权限包，不含 `permission`） |
| 超级管理员 | `super@demo` | `/admin` 全权限含 `permission` |

## 业务常量（`@chuying/shared`）

| 常量 | 值 | 含义 |
|------|-----|------|
| `WATCH_PROGRESS_THRESHOLD` | **99** | 线上活动观看进度 ≥99% 可申请心得（类型一） |
| `OFFLINE_APPLY_WINDOW_HOURS` | **24** | 线下活动结束后 24 小时内可申请心得 |
| `REFLECTION_MIN_LEN` / `REFLECTION_MAX_LEN` | **300–400** | 心得正文字数区间 |

## 构建与测试

```bash
npm run build    # shared → client → server
npm test         # server 端 Vitest（含冒烟与领域测试）
```

生产部署：先 `npm run build`，再启动 server（client 静态资源由 server 或 CDN 托管，见 `server` 配置）。

## 文档

- 设计规格：`docs/superpowers/specs/2026-08-02-chuying-portal-design.md`
- 实现计划：`docs/superpowers/plans/2026-08-02-chuying-portal.md`
- PRD 与用例：`docs/prd/`

## V1 范围说明

已实现：CMS 首页、活动/课程、雏鹰报名与积分申请、管理后台与八类权限包、演示三角色登录。

未纳入 V1：移动端适配、商城、SSO。
