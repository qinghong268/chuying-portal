# 雏英计划 — PRD 实测验收、修 bug 与正名改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 PRD 对 F01–F14 / A01–A13 做浏览器+SQLite 实测并修缺陷，随后完成「雏英」正名、邮箱密码演示账号与 `known-gaps.md`。

**Architecture:** 阶段 A 以运行中的 Vite(`:5173`)+Express(`:5179`)+`server/data/chuying.db` 为验收环境；每条可测 AC 必须同时留下浏览器结果与（写操作时的）SQL 核对。阶段 B 再改产品名/目录、实现 `POST /api/auth/login`、输出缺口文档。API/Vitest 仅作辅助回归，不得单独判 PASS。

**Tech Stack:** 现有 monorepo（Vite React、Express、better-sqlite3、vitest）；浏览器手工/MCP；SQLite 只读查询（`sqlite3` CLI 或 `node -e` + better-sqlite3）。

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-03-chuying-prd-qa-and-rebrand-design.md`
- 正式名：**雏英计划**；阶段 A **不**批量改「雏鹰→雏英」
- 主证据：**浏览器 + 数据库**；API 不得单独 PASS
- 修 bug 闸门 **B**：小问题直修；规则/模型/权限语义先问产品方（2～3 方案）
- `[待补充]` / `[待运营提供]` / Out of scope → 记缺口，不修、不算失败
- 演示密码阶段 B：`Demo1234!`；邮箱 `eagle@demo` / `admin@demo` / `super@demo`
- 保留 `@chuying/*` 与罗马字 `chuying`；目录最终 `雏鹰官网` → `雏英官网`
- PC only；`npm test` + `npm run build` 阶段末须绿
- Commit：计划中的 commit 步骤在**用户授权后**执行（默认先做改动与报告，集中提交或按用户指示提交）

**Parallelism 总则（SDD）：** Task 之间顺序执行并 review。Task 2–4 内部可按页面并行探查，但写入同一验收矩阵文件时须串行合并，避免冲突。

---

## File Structure（本工作将创建/修改）

```
雏鹰官网/   →（Task 9 末）雏英官网/
├── .agent-scratch/qa/
│   ├── matrix.md              # AC 验收矩阵（阶段 A 主账本）
│   ├── defects.md             # 已修/待确认缺陷
│   ├── sql-notes.md           # 常用 SQL 与核对记录
│   └── pages/                 # 可选：分页笔记 Fxx.md / Axx.md
├── docs/prd/known-gaps.md     # 阶段 B 交付
├── docs/prd/globaluser*.md    # 阶段 B 正名
├── docs/superpowers/specs/*.md
├── README.md
├── server/src/routes/auth.ts  # + POST /login
├── server/src/seed.ts         # Demo1234! 哈希
├── server/tests/auth.test.ts  # 密码登录用例
├── client/src/pages/LoginPage.tsx
└── client/src/auth/AuthContext.tsx
```

---

### Task 1: QA 脚手架与 AC 矩阵骨架

**Files:**
- Create: `.agent-scratch/qa/matrix.md`, `.agent-scratch/qa/defects.md`, `.agent-scratch/qa/sql-notes.md`
- Read: `docs/prd/globaluser.md`, 各 `docs/prd/globaluser-*.md` 的「验收要点（AC）」节

**Interfaces:**
- Produces: 矩阵表头与全部 AC 行（初始 `RESULT=PENDING`）；缺口候选行单独标记 `GAP_CANDIDATE`

- [ ] **Step 1: 创建目录与缺陷账本**

写入 `.agent-scratch/qa/defects.md`：

```markdown
# Defects (Phase A)

| ID | Page | Severity | Gate | Summary | Status | Commit/Note |
| --- | --- | --- | --- | --- | --- | --- |
```

写入 `.agent-scratch/qa/sql-notes.md` 开头（库路径与连接方式）：

```markdown
# SQL notes
DB: `server/data/chuying.db` (WAL may exist)
Read-only prefer. Example:

```bash
node -e "const Database=require('better-sqlite3'); const db=new Database('server/data/chuying.db',{readonly:true}); console.log(db.prepare('select count(*) c from users').get());"
```
```

- [ ] **Step 2: 从 PRD 抽出全部 AC 行进 matrix.md**

矩阵列必须包含：

`| AC | PRD file | Role | Browser steps (summary) | DB check | Result | Evidence |`

对每条 `AC-Fxx-##` / `AC-Axx-##` 建一行；正文含 `[待补充]`/`[待运营提供]` 的 AC 标 `GAP_CANDIDATE`（Result 预填 `GAP`，不测失败）。  
UIUX 方案 A 的 `AC-UI-*`：抽查 Token/Accent/Dense 关键条写入矩阵附录，不逐条阻塞功能 PASS。

- [ ] **Step 3: 确认环境**

Run:

```bash
# 若未在跑：
npm run dev
```

Expected: Vite `http://localhost:5173/`；API `http://localhost:5179`；`server/data/chuying.db` 存在。

探针：

```bash
node -e "const Database=require('better-sqlite3'); const db=new Database('server/data/chuying.db',{readonly:true}); console.log(db.prepare(\"select email,role,status from users\").all());"
```

Expected: 至少三行 demo 用户 `active`。

- [ ] **Step 4: 记录脚手架完成（无强制 commit；`.agent-scratch` 通常 gitignore）**

若 `qa/` 被 ignore：保持本地即可。若需入库，仅在用户要求时把非敏感报告拷到 `docs/`。

---

### Task 2: 前台公开页验收 F01–F08

**Files:**
- Modify: `.agent-scratch/qa/matrix.md`, `.agent-scratch/qa/defects.md`
- Read PRDs: `globaluser-首页-首页.md`, `计划介绍`, `活动-*`, `课程-*`, `加入我们`, `账号-登录页`
- Fix (as found): `client/src/pages/*` 对应页；小问题直修

**Interfaces:**
- Consumes: Task 1 矩阵行
- Produces: F01–F08 行 Result 更新；直修 commit（用户授权后）

- [ ] **Step 1: F01 首页 — 浏览器**

打开 `http://localhost:5173/`：确认计划宣传块、公司宣传块、活动/课程精选（各 ≤3）、加入 CTA 为 Accent。无编造业绩数字。

- [ ] **Step 2: F01 — DB**

```js
// node -e with better-sqlite3 readonly
db.prepare(`SELECT block_key,title,status FROM content_blocks WHERE block_key LIKE 'home_%'`).all();
db.prepare(`SELECT id,title,featured,status FROM activities WHERE featured=1 AND status='published'`).all();
db.prepare(`SELECT id,title,featured,status FROM courses WHERE featured=1 AND status='published'`).all();
```

对照页面展示的标题与 `published` 块一致；草稿不可见。

- [ ] **Step 3: F02–F07 逐页浏览器 + 写操作时 DB**

- `/about`：仅已发布内容；FAQ 行为符合 PRD 已写清部分  
- `/activities`、`/activities/:id`：列表/详情；未登录报名引导登录  
- `/courses`、`/courses/:id`  
- `/join`：提交后查 `join_applications` 新行 `status='pending'`

加入提交后 SQL：

```sql
SELECT id,name,contact,status FROM join_applications ORDER BY id DESC LIMIT 3;
```

- [ ] **Step 4: F08 登录页**

一键三角色：雏鹰→`/me`；admin/super→`/admin`。核对 cookie 后 `users` 会话侧以 `/api/auth/me` 为辅，**以浏览器跳转+顶栏身份为准**。

- [ ] **Step 5: 缺陷处理**

直修 → 回归该 AC → `defects.md` 记 `FIXED`。  
规则类 → `defects.md` 记 `NEED_DECISION`，**停止改代码**，向用户给出 2～3 方案。

- [ ] **Step 6: 更新 matrix F01–F08；用户授权后提交修复**

```bash
git add client/src/pages ...
git commit -m "fix(client): portal QA findings F01-F08"
```

---

### Task 3: 个人中心与积分申请 F09–F14

**Files:**
- Modify: `.agent-scratch/qa/matrix.md`, `.agent-scratch/qa/defects.md`
- Read: `globaluser-个人中心-*.md`, `globaluser-积分申请-*.md`
- Fix: `client/src/pages/me/*`, 必要时 `server/src/routes/pointApps.ts`（规则类先问）

**Interfaces:**
- Consumes: 演示雏鹰账号；线上活动 seed
- Produces: F09–F14 矩阵结果；主链路 DB 证据

- [ ] **Step 1: 未登录守卫**

访问 `/me`、`/me/applications/new` → 应到 `/login?redirect=...`。记 AC。

- [ ] **Step 2: 报名 + 进度（浏览器）**

以雏鹰登录 → 活动详情报名 →（线上）把进度调到 ≥99 → 出现可申请入口。

- [ ] **Step 3: DB 核对报名与进度**

```sql
SELECT e.id,e.user_id,e.activity_id,e.status,p.progress_percent
FROM enrollments e
LEFT JOIN watch_progress p ON p.user_id=e.user_id AND p.activity_id=e.activity_id
ORDER BY e.id DESC LIMIT 5;
```

（若表名以 migrate.sql 为准：确认实际表名 `watch_progress` / `activity_progress` 等，以 `migrate.sql` 为准写入 sql-notes。）

- [ ] **Step 4: 类型一申请 300–400 字**

F13 提交心得 → 详情 F14 只读。DB：

```sql
SELECT id,user_id,type,status,activity_id,length(reflection_body) AS n
FROM point_applications ORDER BY id DESC LIMIT 3;
```

确认 `pending`、字数落在 300–400；分值字段申请人不可改。

- [ ] **Step 5: F09–F12 只读页**

概览余额、我的报名、我的申请、积分明细与 DB `point_ledger` / balance 一致。

- [ ] **Step 6: 缺陷闸门 + 回归 +（授权后）commit**

```bash
git commit -m "fix: me center QA findings F09-F14"
```

---

### Task 4: 管理后台 A01–A13

**Files:**
- Modify: `.agent-scratch/qa/*`
- Read: `docs/prd/globaluser-后台-*.md`
- Fix: `client/src/pages/admin/*`, 必要时 `server/src/routes/admin/*`

**Interfaces:**
- Consumes: demo admin / super_admin
- Produces: 后台矩阵结果；权限负例证据

- [ ] **Step 1: 权限壳**

管理员登录：侧栏无「权限管理」。超管可见。管理员直链 `/admin/permissions` → 无权限页。

DB 辅证：

```sql
SELECT u.email,g.permission_code FROM users u
LEFT JOIN admin_grants g ON g.user_id=u.id
WHERE u.email IN ('admin@demo','super@demo');
```

- [ ] **Step 2: 加入审核 A03–A04**

列表 → 详情通过/驳回。DB：`join_applications.status` 变为 `approved`/`rejected`（开户若 PRD 待补充 → GAP，不修）。

- [ ] **Step 3: 内容运营 A02**

对已发布块「存草稿」改文案 → **前台首页旧文仍在**；DB：`title/body` 不变，`draft_title/draft_body` 变。再「发布」→ 前台更新。

- [ ] **Step 4: 活动 A05–A07**

创建/编辑/发布；已发布活动普通保存不得降为 draft。报名名单只读列表与 `enrollments` 一致。

- [ ] **Step 5: 积分类型 / 审批 A08–A10**

审批通过 Task 3 的 pending 单：可改最终分值；DB `point_ledger` 一行、`application_id` 唯一；余额增加。驳回后再提须新 `point_applications.id`。

- [ ] **Step 6: 用户停用 A11**

停用雏鹰后，其旧会话访问受保护操作应失败（浏览器表现 + 再操作无新库写入）。

- [ ] **Step 7: 控制台/看板/权限 A01 A12 A13**

看板数字与 SQL `COUNT` 抽查数量级一致（允许延迟，不允许明显张冠李戴）。超管不可把 `permission` 授给普通管理员（UI 禁用 + 尝试应失败）。

- [ ] **Step 8: 缺陷闸门 +（授权后）commit**

```bash
git commit -m "fix: admin QA findings A01-A13"
```

---

### Task 5: 主链路串测与阶段 A 收口

**Files:**
- Modify: `.agent-scratch/qa/matrix.md`（全部非 GAP 行无 PENDING）
- Optional test add: only if 阶段 A 发现可稳定复现的服务端回归（不替代浏览器证据）

- [ ] **Step 1: 端到端故事（浏览器）**

访客浏览首页 → 加入申请 → 雏鹰登录报名线上活动 → 进度 99 → 交心得 → 管理员审批通过 → 雏鹰积分明细可见入账。

- [ ] **Step 2: 端到端 DB 证据包**

将关键 `id` 写入 `sql-notes.md`：`join_applications`、`enrollments`、`point_applications`、`point_ledger`、用户余额字段（以实际 schema 为准）。

- [ ] **Step 3: 跑回归**

```bash
npm test
npm run build
```

Expected: 全部 PASS。

- [ ] **Step 4: 阶段 A 签字清单**

`matrix.md` 顶部写：`Phase A complete: YYYY-MM-DD`；`NEED_DECISION` 必须为 0（或已获用户决议并修完）。

---

### Task 6: 邮箱密码登录（阶段 B 起）

**Files:**
- Modify: `server/src/seed.ts`（`DEMO_PASSWORD = "Demo1234!"`）
- Modify: `server/src/routes/auth.ts` — 新增 `POST /login`
- Modify: `server/tests/auth.test.ts`
- Modify: `client/src/auth/AuthContext.tsx`, `client/src/pages/LoginPage.tsx`
- Modify: `README.md`（可与 Task 8 合并更新，本 Task 至少写清三账号）

**Interfaces:**
- Produces: `POST /api/auth/login` body `{ email, password }` → Set-Cookie + `{ user }`；失败 401
- Consumes: `users.password_hash`（sha256，与现 `hashPassword` 一致）

- [ ] **Step 1: 写失败测试（密码登录成功/失败）**

在 `server/tests/auth.test.ts` 增加：

```ts
it("logs in with email and password", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "eagle@demo", password: "Demo1234!" });
  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe("eagle");
  expect(res.headers["set-cookie"]).toBeTruthy();
});

it("rejects bad password", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "eagle@demo", password: "wrong" });
  expect(res.status).toBe(401);
});
```

（`request`/`app` 用法与现有 auth 测试文件保持一致。）

- [ ] **Step 2: 跑测试确认失败（无路由或密码仍为旧 demo123）**

```bash
npm run test -w server -- auth.test.ts
```

Expected: 新用例 FAIL。

- [ ] **Step 3: 实现 login 路由与 seed 密码**

`seed.ts`：`const DEMO_PASSWORD = "Demo1234!";`  
`auth.ts`：校验 email+password_hash，status must be `active`，然后 `signAuthToken` + cookie，响应 `toPublicUser`。

- [ ] **Step 4: 测试通过**

```bash
npm run test -w server -- auth.test.ts
```

Expected: PASS（需测试库使用新 seed；若测试自建 DB，确保 seed 密码同步）。

- [ ] **Step 5: 登录页 UI**

保留一键演示；增加邮箱、密码输入与提交；展示三组演示账号提示（仅演示）。成功后路由逻辑复用现有 `authRedirect`。

- [ ] **Step 6: 浏览器验收密码登录三角色 +（授权后）commit**

```bash
git commit -m "feat(auth): email password demo login"
```

---

### Task 7: 全量正名「雏鹰 → 雏英」

**Files:**
- Modify: 全仓用户可见文案与文档（`client/**`, `server/src/seed.ts`, `README.md`, `docs/prd/**`, `docs/superpowers/**`）
- Do **not** rename npm scope `@chuying/*` 或纯罗马字路径，除非含汉字「雏鹰」

- [ ] **Step 1: 检索残留**

```bash
rg -n "雏鹰" --glob '!node_modules' --glob '!.git'
```

列出命中，排除历史 commit 说明若无需改。

- [ ] **Step 2: 批量替换用户可见与文档中的「雏鹰」→「雏英」**

含：顶栏品牌、登录文案、CMS seed 默认标题、PRD 标题中的产品名、本 QA spec 状态改为已执行中的表述等。角色名「雏鹰」用户若 PRD 称参与者，改为「雏英」计划下的雏英学员/用户（与 PRD 用语对齐：产品名雏英；角色可仍用 eagle 代码）。

- [ ] **Step 3: build/test + 浏览器抽查标题/顶栏**

```bash
npm test
npm run build
```

- [ ] **Step 4:（授权后）commit**

```bash
git commit -m "docs/chore: rebrand 雏鹰 to 雏英"
```

---

### Task 8: known-gaps.md + README 收口

**Files:**
- Create: `docs/prd/known-gaps.md`
- Modify: `README.md`（安装、端口、一键演示、**邮箱密码三账号**、常量）

- [ ] **Step 1: 从 PRD 与 matrix 的 GAP 行生成 known-gaps.md**

每条包含：`来源`、`简述`、`为何不算失败`、`后续建议`。  
收录 Out of scope：移动端、SSO、商城；加入通过后自动开户等。

- [ ] **Step 2: README 与登录页账号表一致**

| 角色 | 邮箱 | 密码 |
| 雏英 | eagle@demo | Demo1234! |
| 管理员 | admin@demo | Demo1234! |
| 超管 | super@demo | Demo1234! |

- [ ] **Step 3:（授权后）commit**

```bash
git commit -m "docs: known-gaps and demo password accounts"
```

---

### Task 9: 工作区目录改名

**Files:**
- Rename folder: `D:\仓库\FunnyProjects\雏鹰官网` → `D:\仓库\FunnyProjects\雏英官网`

- [ ] **Step 1: 停止 `npm run dev` 占用进程**

- [ ] **Step 2: 关闭或迁出 Cursor 对该文件夹的占用后重命名**

```powershell
Rename-Item -Path "D:\仓库\FunnyProjects\雏鹰官网" -NewName "雏英官网"
```

- [ ] **Step 3: 用户用新路径重新打开工作区；确认 `npm run dev` / `npm test` 仍可用**

- [ ] **Step 4: 在新路径抽查浏览器品牌为「雏英」**

（目录改名本身通常无 git commit；若 git 感知为删除+新增，按用户指示处理。）

---

## Spec Coverage Checklist

| Spec 项 | Task |
| --- | --- |
| 浏览器+DB 主证据验收 F/A 页 | 2, 3, 4, 5 |
| 修 bug 闸门 B | 2–5 |
| 待补充记缺口不算失败 | 1, 8 |
| 阶段 A 后再改名 | 7, 9（在 5 之后） |
| 密码演示账号 Demo1234! | 6, 8 |
| known-gaps.md | 8 |
| 目录 雏英官网 | 9 |
| test/build 绿 | 5, 6, 7 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-03-chuying-prd-qa-and-rebrand.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每 Task 新开子代理，Task 间 review；浏览器+DB 实测由执行代理完成，规则类缺陷停下来问你  
2. **Inline Execution** — 本会话按 executing-plans 推进并设检查点  

回复 **1** 或 **2** 即可开始。
