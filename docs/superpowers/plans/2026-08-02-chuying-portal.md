# 雏鹰计划宣传官网 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可运行的 PC Web 全栈 V1：前台宣传（计划+公司+精选活动/课程）+ 雏鹰报名/积分申请 + 管理后台八权限包 + 演示三角色登录。

**Architecture:** 单仓库双应用——`client/`（Vite React TS，路由 `/` 前台、`/admin` 后台）+ `server/`（Express REST + better-sqlite3）。共享类型与业务常量在 `shared/`。鉴权用 httpOnly JWT Cookie；演示账号种子数据一键登录。

**Tech Stack:** Node 20+ · pnpm/npm（优先 `registry.npmmirror.com`）· Vite 5 · React 18 · React Router 6 · Express 4 · better-sqlite3 · zod · vitest · TypeScript 5

## Global Constraints

- PC only，1366×768+；V1 不做移动端适配
- 视觉真源：`docs/prd/globaluser-uiux-设计系统-方案A.md`（Primary `#0D9488`，Accent `#D97706`，Noto Sans SC）
- 线上进度阈值 `WATCH_PROGRESS_THRESHOLD = 99`；线下窗口 `OFFLINE_APPLY_WINDOW_HOURS = 24`（endAt + 24h）
- 心得 300–400 字（字符长度）；类型二模板五码：`contest_award|speech|project_contrib|honor|other_special`
- 驳回后再提 = **新单**；申请人不可改分值；审批人可改最终分值
- 演示登录：雏鹰 / 管理员 / 超级管理员；无真实 SSO
- 页面 PRD：`docs/prd/globaluser.md` 及 `globaluser-*.md`；设计规格：`docs/superpowers/specs/2026-08-02-chuying-portal-design.md`
- 缺素材用占位，禁止编造公司业绩数字
- Commit 仅在用户要求时执行；本计划步骤中的 Commit 在用户授权后做

**Parallelism 总则（SDD）：** Task 之间顺序执行并 review；标注 `Parallelism:` 的 Task **内部**可并行写互不冲突的文件。

---

## File Structure（锁定）

```
雏鹰官网/
├── package.json                 # workspaces: client, server, shared
├── shared/
│   ├── package.json
│   ├── src/constants.ts         # 99 / 24h / 字数 / 权限包 code / 模板 code
│   ├── src/types.ts             # UserRole, ActivityMode, ApplicationStatus…
│   └── src/permissions.ts       # PERMISSION_PACKAGES
├── server/
│   ├── package.json
│   ├── src/index.ts
│   ├── src/db.ts                # sqlite open + migrate
│   ├── src/seed.ts
│   ├── src/middleware/auth.ts
│   ├── src/domain/eligibility.ts
│   ├── src/routes/*.ts
│   └── tests/*.test.ts
└── client/
    ├── package.json
    ├── index.html
    ├── src/main.tsx
    ├── src/styles/tokens.css    # 方案 A CSS 变量
    ├── src/api/client.ts
    ├── src/auth/AuthContext.tsx
    ├── src/layouts/PortalLayout.tsx
    ├── src/layouts/AdminLayout.tsx
    └── src/pages/**/*.tsx
```

---

### Task 1: 仓库脚手架与共享常量

**Files:**
- Create: `package.json`, `shared/package.json`, `shared/src/constants.ts`, `shared/src/types.ts`, `shared/src/permissions.ts`, `shared/src/index.ts`, `server/package.json`, `client/package.json`, `.gitignore`, `README.md`
- Test: `shared` 由 server 测试间接覆盖；本 Task 用 `node -e` 校验导出

**Interfaces:**
- Produces: `WATCH_PROGRESS_THRESHOLD`, `OFFLINE_APPLY_WINDOW_HOURS`, `REFLECTION_MIN_LEN`, `REFLECTION_MAX_LEN`, `PermissionCode`, `PointTemplateCode`

**Parallelism:** 可并行初始化 `shared/` 与空的 `server/`+`client/` package.json（无交叉依赖时）

- [ ] **Step 1: 根 package.json workspaces**

```json
{
  "name": "chuying-portal",
  "private": true,
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "npm run dev -w server & npm run dev -w client",
    "test": "npm run test -w server",
    "build": "npm run build -w shared && npm run build -w client && npm run build -w server"
  }
}
```

- [ ] **Step 2: 写入 shared 常量与类型**

```ts
// shared/src/constants.ts
export const WATCH_PROGRESS_THRESHOLD = 99;
export const OFFLINE_APPLY_WINDOW_HOURS = 24;
export const REFLECTION_MIN_LEN = 300;
export const REFLECTION_MAX_LEN = 400;
export const POINT_TEMPLATE_CODES = [
  "contest_award",
  "speech",
  "project_contrib",
  "honor",
  "other_special",
] as const;
```

```ts
// shared/src/permissions.ts
export const PERMISSION_PACKAGES = [
  "content",
  "join_review",
  "activity",
  "point_type",
  "point_review",
  "user",
  "dashboard",
  "permission",
] as const;
export type PermissionCode = (typeof PERMISSION_PACKAGES)[number];
```

- [ ] **Step 3: 安装依赖（中国镜像）**

```bash
npm config set registry https://registry.npmmirror.com
cd "D:\仓库\FunnyProjects\雏鹰官网" && npm install
```

Expected: workspaces 安装成功，无 ERESOLVE 死锁。

- [ ] **Step 4: 校验导出**

```bash
node -e "const c=require('./shared/src/constants.ts')" 
```

若 TS 未编译：先为 shared 加 `"type":"module"` + `tsx` 或把常量暂用 `.mjs`；推荐 shared 用 `tsc` 出 `dist/`，server/client 依赖 `@chuying/shared`。

更稳妥：

```bash
npm run build -w shared
node -e "const {WATCH_PROGRESS_THRESHOLD}=require('./shared/dist/constants.js'); if(WATCH_PROGRESS_THRESHOLD!==99) process.exit(1)"
```

Expected: exit 0

---

### Task 2: 数据库 Schema、迁移与种子

**Files:**
- Create: `server/src/db.ts`, `server/src/migrate.sql`（或 migrate 函数）, `server/src/seed.ts`, `server/data/.gitkeep`
- Test: `server/tests/db.seed.test.ts`

**Interfaces:**
- Produces: `getDb()`, `migrate()`, `seed()`；表：`users`, `admin_grants`, `content_blocks`, `join_applications`, `activities`, `enrollments`, `watch_progress`, `courses`, `point_type_templates`, `point_applications`, `point_ledger`
- Seed users: `eagle@demo` / `admin@demo` / `super@demo`（密码统一 `demo123` 或演示一键免密 token）

- [ ] **Step 1: 写失败测试 — 种子后应有三角色**

```ts
// server/tests/db.seed.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { migrate, seed, getDb } from "../src/db";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  migrate();
  seed();
});

it("seeds three demo users with roles", () => {
  const rows = getDb()
    .prepare("SELECT role FROM users ORDER BY role")
    .all() as { role: string }[];
  expect(rows.map((r) => r.role).sort()).toEqual([
    "admin",
    "eagle",
    "super_admin",
  ]);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm run test -w server -- tests/db.seed.test.ts
```

Expected: FAIL（模块/表不存在）

- [ ] **Step 3: 实现 migrate + seed（含五积分模板、首页三 CMS 块 key）**

必含 blockKey：`home_hero`, `home_plan_promo`, `home_company_promo`；模板五码启用；超管 `admin_grants` 含全部包；普通 admin 含除 `permission` 外的包。

- [ ] **Step 4: 测试通过**

```bash
npm run test -w server -- tests/db.seed.test.ts
```

Expected: PASS

---

### Task 3: 鉴权中间件与演示登录 API

**Files:**
- Create: `server/src/middleware/auth.ts`, `server/src/routes/auth.ts`, `server/src/index.ts`（挂载路由）
- Test: `server/tests/auth.test.ts`

**Interfaces:**
- Produces: `POST /api/auth/demo-login` body `{ role: 'eagle'|'admin'|'super_admin' }` → Set-Cookie；`GET /api/auth/me`；`POST /api/auth/logout`
- Consumes: seed users

- [ ] **Step 1: 失败测试 — demo-login 返回角色**

```ts
it("demo-login as eagle returns role eagle", async () => {
  const res = await request(app)
    .post("/api/auth/demo-login")
    .send({ role: "eagle" });
  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe("eagle");
});
```

- [ ] **Step 2: 实现 JWT Cookie + 路由，测试 PASS**

规则：雏鹰不可访问后续 `/api/admin/*`（Task 6 再挂守卫）；本 Task 完成 `requireAuth` / `requireRole`。

---

### Task 4: 积分申请资格纯函数（TDD 核心）

**Files:**
- Create: `server/src/domain/eligibility.ts`
- Test: `server/tests/eligibility.test.ts`

**Interfaces:**
- Produces:

```ts
export function canApplyActivityReflection(input: {
  enrolled: boolean;
  mode: "online" | "offline";
  progressPercent: number;
  activityEndAt: number; // ms
  now: number;
}): { ok: true } | { ok: false; reason: string };

export function isReflectionLengthOk(text: string): boolean;
```

- [ ] **Step 1: 红灯用例**

```ts
it("online requires progress >= 99", () => {
  const r = canApplyActivityReflection({
    enrolled: true,
    mode: "online",
    progressPercent: 98.9,
    activityEndAt: Date.now() + 86400000,
    now: Date.now(),
  });
  expect(r.ok).toBe(false);
});

it("offline only within endAt + 24h", () => {
  const end = Date.parse("2026-08-01T10:00:00+08:00");
  const r = canApplyActivityReflection({
    enrolled: true,
    mode: "offline",
    progressPercent: 0,
    activityEndAt: end,
    now: end + 24 * 3600 * 1000 + 1,
  });
  expect(r.ok).toBe(false);
});

it("reflection length 300-400", () => {
  expect(isReflectionLengthOk("测".repeat(299))).toBe(false);
  expect(isReflectionLengthOk("测".repeat(300))).toBe(true);
  expect(isReflectionLengthOk("测".repeat(400))).toBe(true);
  expect(isReflectionLengthOk("测".repeat(401))).toBe(false);
});
```

- [ ] **Step 2: 实现至全绿**（常量必须从 `@chuying/shared` 引入，禁止魔法数）

---

### Task 5: 内容 / 活动 / 课程 / 加入 只读与写入 API

**Files:**
- Create: `server/src/routes/content.ts`, `activities.ts`, `courses.ts`, `join.ts`, `enrollments.ts`, `progress.ts`
- Test: `server/tests/api.public.test.ts`（抽检）

**Interfaces:**
- `GET /api/content/home` → 已发布 blocks
- `GET /api/activities`, `GET /api/activities/:id`, `GET /api/activities/featured?limit=3`
- `POST /api/activities/:id/enroll`（eagle）
- `PUT /api/activities/:id/progress` body `{ percent }`（eagle，0–100）
- `GET /api/courses`, `GET /api/courses/:id`, `GET /api/courses/featured?limit=3`
- `POST /api/join`（访客可）

**Parallelism:** 4 个 route 文件可由同一 Task 内并行起草，最后统一挂载与测一条冒烟。

- [ ] **Step 1: 实现路由 + 种子活动各 1 线上/1 线下 + 课程 2 条**
- [ ] **Step 2: 冒烟**

```bash
npm run test -w server -- tests/api.public.test.ts
```

---

### Task 6: 积分申请与审批 API + 流水

**Files:**
- Create: `server/src/routes/pointApps.ts`, `server/src/routes/admin/pointApps.ts`, `server/src/routes/admin/pointTypes.ts`
- Test: `server/tests/pointApps.test.ts`

**Interfaces:**
- `GET /api/me/point-applications/eligible-activities`
- `POST /api/me/point-applications`（type1/type2；服务端再跑 eligibility）
- `GET /api/me/point-applications`, `GET /api/me/point-applications/:id`
- `GET /api/me/points`（余额+流水）
- Admin: list/detail/approve/reject；approve 写 `point_ledger`；reject 必填原因；可改 `pointsGranted`
- 驳回后再提：新 POST，新 id

- [ ] **Step 1: 集成测试 — 线上 99% 可申请并通过入账**
- [ ] **Step 2: 集成测试 — 进度 98 被拒**
- [ ] **Step 3: 全绿**

---

### Task 7: 管理端其余 API（CMS/加入/活动/用户/权限/看板）

**Files:**
- Create: `server/src/routes/admin/*.ts` + `requirePermission(code)`
- Test: `server/tests/admin.perm.test.ts`

**Interfaces:**
- 无权限 → 403；无 `permission` 包不可授 `permission` 给普通 admin
- CRUD 对齐 PRD A02–A13 意图路径（见各后台 PRD 接口节）

**Parallelism:** `content` / `join` / `activities` / `users` 路由可并行实现，最后补权限单测。

- [ ] **Step 1: 权限否定测试（eagle 调 admin → 403；admin 无 content → 403）**
- [ ] **Step 2: 实现至 PASS**

---

### Task 8: 客户端 Token、API 封装、Auth、双 Layout

**Files:**
- Create: `client/src/styles/tokens.css`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/api/client.ts`, `client/src/auth/AuthContext.tsx`, `client/src/layouts/PortalLayout.tsx`, `client/src/layouts/AdminLayout.tsx`
- Modify: `client/index.html`（引入 Noto Sans SC）

**Interfaces:**
- Consumes: `/api/auth/*`
- Produces: `useAuth()`, `<PortalLayout>`, `<AdminLayout data-density="admin">`

- [ ] **Step 1: 写入方案 A 的 `:root` CSS 变量（从设计系统 PRD §14 复制）**
- [ ] **Step 2: Vite 代理 `/api` → `http://localhost:5179`（或 3001，与 server 一致）**
- [ ] **Step 3: 手动冒烟 — `npm run dev -w client` 显示顶栏壳**

**Parallelism:** `tokens.css` 与 `AuthContext` 可并行。

---

### Task 9: 前台公开页（F01–F08）

**Files:**
- Create: `client/src/pages/HomePage.tsx`, `AboutPage.tsx`, `ActivitiesPage.tsx`, `ActivityDetailPage.tsx`, `CoursesPage.tsx`, `CourseDetailPage.tsx`, `JoinPage.tsx`, `LoginPage.tsx`
- 对照 PRD：`globaluser-首页-首页.md` 等

**Parallelism:** 首页 / 活动·课程 / 加入·登录 三组可并行（不同文件）。

- [ ] **Step 1: 路由挂载 F01–F08**
- [ ] **Step 2: Home 含计划宣传 + 公司宣传 + 精选各 ≤3；素材占位**
- [ ] **Step 3: Login 三角色一键；eagle→`/me`，admin/super→`/admin`**
- [ ] **Step 4: 浏览器冒烟关键路径（或 Playwright 可选）**

---

### Task 10: 雏鹰个人中心与积分申请（F09–F14）

**Files:**
- Create: `client/src/pages/me/*.tsx`（Overview, Enrollments, Applications, Points, NewApplication, ApplicationDetail）

**Parallelism:** 列表页与申请表单可并行，共享 me 子导航组件先写好。

- [ ] **Step 1: 未登录访问 `/me` → `/login?redirect=`**
- [ ] **Step 2: 类型一/二表单校验与只读分值**
- [ ] **Step 3: 与 Task 6 API 联调：报名→进度 99→申请→详情**

---

### Task 11: 管理后台页面（A01–A13）

**Files:**
- Create: `client/src/pages/admin/*.tsx` + 侧栏按 `permissions` 显隐

**Parallelism:** 按权限包拆 4 组并行：内容+加入 | 活动 | 积分 | 用户+看板+权限。

- [ ] **Step 1: AdminLayout 菜单过滤**
- [ ] **Step 2: 无权限直链显示无权限页**
- [ ] **Step 3: 走通：加入审核 / 活动编辑 / 积分审批入账 / 超管授权**

---

### Task 12: 端到端冒烟与 README

**Files:**
- Create: `README.md`（启动端口、演示账号、常量说明）
- Modify: 根 `package.json` scripts `dev:all`

- [ ] **Step 1: 脚本一键起 server+client**
- [ ] **Step 2: 清单验收（对照设计规格 §9）**

| # | 路径 | 期望 |
| --- | --- | --- |
| 1 | `/` | 计划+公司宣传结构 + 精选 |
| 2 | 演示雏鹰登录 | 进入 `/me` |
| 3 | 报名线上活动并 progress=99 | 可交心得 |
| 4 | 管理员审批通过 | 流水+余额增加 |
| 5 | 超管打开权限页 | 不可把 permission 授给普通管理员 |
| 6 | 视觉 | CTA Accent、主色青绿 |

- [ ] **Step 3: `npm run build` 全绿**

---

## Spec Coverage Checklist（自检）

| 规格项 | Task |
| --- | --- |
| 角色与演示登录 | 3, 8, 9 |
| 首页计划+公司宣传+精选 | 5, 9 |
| 报名线上/线下规则 | 5, 10 |
| 进度≥99 / +24h / 心得字数 | 4, 6, 10 |
| 类型二五模板 | 2, 6, 10 |
| 审批入账/驳回新单 | 6, 11 |
| 八权限包+超管 permission | 2, 7, 11 |
| 方案 A 视觉 Token | 8 |
| CMS 区块 key | 2, 5, 7, 9 |
| Out of scope 移动端/商城/SSO | 不实现 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-02-chuying-portal.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每 Task 新开子代理，Task 间 review；Task 内可按 `Parallelism` 并行  
2. **Inline Execution** — 本会话按 `executing-plans` 批量推进并设检查点  

回复 **1** 或 **2** 即可开始实现（实现前默认不建 git commit，除非你要求提交）。
