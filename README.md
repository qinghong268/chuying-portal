# 雏鹰计划宣传官网

PC Web 全栈 monorepo：前台宣传 + 雏鹰报名/积分申请 + 管理后台。

## Workspace 布局

| 包 | 路径 | 说明 |
|----|------|------|
| `@chuying/shared` | `shared/` | 共享类型与业务常量 |
| `@chuying/server` | `server/` | Express REST + SQLite |
| `@chuying/client` | `client/` | Vite + React 前台与后台 |

## 常用命令

```bash
npm install
npm run build -w shared
npm run dev          # 同时启动 server 与 client（后续 Task）
npm test             # server 测试（后续 Task）
```

文档与 PRD 见 `docs/`。
