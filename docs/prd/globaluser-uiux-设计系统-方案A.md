# 雏英计划宣传官网 — UI/UX 设计系统 PRD（方案 A）

> 版本：V1.0 | 日期：2026-08-02 | 状态：**已选定**  
> 风格定案：Soft UI Evolution × LMS Education Teal（`ui-ux-pro-max`）  
> 选型依据：`docs/prd/globaluser-uiux-风格推荐.md`（用户确认方案 A）  
> 终端：PC Web，1366×768+；V1 **不做**移动端适配  
> 语言：简体中文为主  
> 关联：`docs/prd/globaluser.md` · 各 `globaluser-*.md` 页面 PRD · 设计规格  

本文为**全局视觉与交互设计系统**交付 PRD，供 UED / 前端 / 后台实现统一遵循；页面级布局仍以各页面 PRD 线框为准，**冲突时以本文 Token 与组件规范为准、以页面 PRD 业务结构为准**。

---

## 1. 产品概述（视觉视角）

### 1.1 设计定位

面向 SoftTong「雏英计划」的宣传运营站：前台传递**成长、培养、可信赖**；后台保证**高效审批与表格操作**。方案 A 用青绿主色表达培养气质，琥珀强调关键转化（加入、提交），避免金融冷硬与 AI 紫粉潮。

### 1.2 目标用户与视觉诉求

| 角色 | 视觉诉求 |
| --- | --- |
| 访客 | 首屏即识别「雏英计划」；能感知软通智慧背书；路径清晰 |
| 雏英 | 个人中心信息清楚；报名/申请状态色可读 |
| 管理员 / 超管 | 侧栏与表格高密度、低装饰；状态与危险操作醒目 |

### 1.3 设计目标（可验收）

| 优先级 | 目标 | 指标口径 |
| --- | --- | --- |
| P0 | 品牌一致 | 全站 Primary/Accent Token 一致；Logo 与「雏英计划」字标不变形 |
| P0 | 对比度 | 正文与背景对比度 ≥ 4.5:1（WCAG AA） |
| P0 | 转化可见 | 主 CTA（加入我们 / 提交 / 通过）使用 Accent 或 Primary， saturating 一眼可辨 |
| P1 | 前后台同源 | 同一 CSS 变量集；后台仅调密度与阴影强度 |
| P1 | 动效克制 | 交互 150–300ms；尊重 `prefers-reduced-motion` |

### 1.4 边界

**支持：** 颜色、字体、间距、圆角、阴影、组件态、前台/后台壳、状态色、动效基线、无障碍基线、禁止项。  

**不支持（本文不展开）：** 运营终稿摄影/插画像素稿（`[待运营提供]`）；移动端断点体系；暗色模式完整换肤（Token 预留，V1 只交付浅色）。

---

## 2. 术语定义

| 术语 | 定义 |
| --- | --- |
| Soft UI Evolution | 柔和层次、改进对比度与阴影的现代软 UI，非旧拟物、非重玻璃 |
| Token | CSS 变量级设计常量（色、间距、圆角、阴影等） |
| 主 CTA | 页面最重要行动按钮（如前台「加入我们」、表单「提交」） |
| 次 CTA | 次要行动（如「查看活动」、取消、返回） |
| Dense 变体 | 后台用：更小间距与圆角、更弱阴影，提高表格信息密度 |

---

## 3. 风格总则（方案 A）

### 3.1 风格特征

| 特性 | 描述 |
| --- | --- |
| 核心理念 | 柔和层次 + 清晰可读 + 培养/成长气质 |
| 色彩策略 | 青绿主色 + 琥珀 CTA + 浅青绿全局底 |
| 视觉语言 | 微圆角、轻阴影、SVG 图标、克制渐变（仅 Hero 可用极淡叠加） |
| 前台 | 大气留白；Hero 全宽；宣传专区优先于列表 |
| 后台 | 同色板 Dense；侧栏+表格；阴影弱化 |

### 3.2 技能原始命中（溯源）

| 项 | 值 |
| --- | --- |
| Style | Soft UI Evolution |
| Color product type | LMS（Education teal） |
| Typography mood | Corporate Trust + Chinese Simplified |
| Landing 裁剪 | Hero → 计划宣传 → 公司宣传 → 精选业务 → Footer |
| Avoid | Playful、AI purple/pink gradients、emoji icons |

---

## 4. 颜色系统

### 4.1 核心 Token

| 角色 | Hex | CSS 变量 | 使用场景 |
| --- | --- | --- | --- |
| Primary | `#0D9488` | `--color-primary` | 顶栏强调、主按钮（非转化场景）、链接、选中态、进度条 |
| On Primary | `#FFFFFF` | `--color-on-primary` | Primary 上的文字/图标 |
| Primary Hover | `#0F766E` | `--color-primary-hover` | Primary 按钮悬停 |
| Secondary | `#2DD4BF` | `--color-secondary` | 次级标签、插图点缀、进度达标高亮 |
| On Secondary | `#134E4A` | `--color-on-secondary` | Secondary 浅底上的深字 |
| Accent | `#D97706` | `--color-accent` | **主转化 CTA**（加入我们、提交申请）、关键强调 |
| Accent Hover | `#B45309` | `--color-accent-hover` | Accent 悬停 |
| On Accent | `#FFFFFF` | `--color-on-accent` | Accent 上文字 |
| Background | `#F0FDFA` | `--color-background` | 前台页面全局底 |
| Foreground | `#134E4A` | `--color-foreground` | 主正文 |
| Card | `#FFFFFF` | `--color-card` | 卡片、弹窗、表格容器 |
| Card Foreground | `#134E4A` | `--color-card-foreground` | 卡片内文字 |
| Muted | `#E8F1F4` | `--color-muted` | 表头底、禁用底、骨架底 |
| Muted Foreground | `#64748B` | `--color-muted-foreground` | 辅助说明、占位符 |
| Border | `#99F6E4` | `--color-border` | 分割线、输入框默认边（实现可对表格改用更中性 `#D1E5E3`） |
| Border Strong | `#5EEAD4` | `--color-border-strong` | 聚焦环外圈、选中描边 |
| Destructive | `#DC2626` | `--color-destructive` | 驳回、删除、错误 |
| On Destructive | `#FFFFFF` | `--color-on-destructive` | 危险按钮文字 |
| Success | `#16A34A` | `--color-success` | 已通过、报名成功 |
| Warning | `#F59E0B` | `--color-warning` | 待审批、窗口将截止 |
| Info | `#0284C7` | `--color-info` | 一般提示、进行中 |
| Ring | `#0D9488` | `--color-ring` | `:focus-visible` 描边 |
| Overlay | `rgba(15, 23, 42, 0.45)` | `--color-overlay` | 弹窗遮罩 |

### 4.2 后台表面微调

| Token | 后台建议值 | 说明 |
| --- | --- | --- |
| `--color-background` | `#F5FAF9` 或保持 `#F0FDFA` | 略降饱和以免长时间刺眼 |
| `--color-border` | `#D1E5E3` | 表格线更中性 |
| 顶栏背景 | `#0F766E`（Primary Hover）或 `#134E4A` | 与前台区分管理域 |

### 4.3 状态色（标签 / Badge）

| 状态 | 文字色 | 背景 | 使用 |
| --- | --- | --- | --- |
| 待审批 / 待审核 | `#B45309` | `#FFFBEB` | 申请、加入 |
| 已通过 / 已发布 | `#15803D` | `#F0FDF4` | 审核通过、CMS 已发布 |
| 已驳回 / 失败 | `#B91C1C` | `#FEF2F2` | 驳回、校验失败 |
| 进行中 | `#0369A1` | `#EFF6FF` | 活动进行中 |
| 已结束 / 停用 | `#64748B` | `#F1F5F9` | 结束活动、停用账号 |
| 草稿 | `#0F766E` | `#CCFBF1` | CMS 草稿 |

### 4.4 图表色（数据看板 A12）

| 系列 | Hex | 用途 |
| --- | --- | --- |
| Series 1 | `#0D9488` | 加入量、主指标 |
| Series 2 | `#D97706` | 活动报名 |
| Series 3 | `#0284C7` | 积分申请 |
| Series 4 | `#16A34A` | 通过量 |
| Series 5 | `#64748B` | 对比/基线 |

禁止仅靠颜色区分系列：图表需图例 + 图案/直接标注。

---

## 5. 字体系统

### 5.1 字体族

| 角色 | 字体栈 | 说明 |
| --- | --- | --- |
| 中文 UI / 正文 | `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` | 全站默认 |
| 英文标题（可选） | `"Lexend", "Noto Sans SC", sans-serif` | 英文品牌句、数字大标题 |
| 英文正文（可选） | `"Source Sans 3", "Noto Sans SC", sans-serif` | 少用；中英混排以 Noto 为主亦可 |

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Lexend:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap');

:root {
  --font-sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-display: "Lexend", "Noto Sans SC", sans-serif;
}
```

### 5.2 字号层级（PC）

| 层级 | 字号 | 字重 | 行高 | 使用场景 |
| --- | --- | --- | --- | --- |
| Display | 40–48px | 700 | 1.2 | 首页 Hero 主标题（可 CMS） |
| H1 | 28–32px | 700 | 1.3 | 页面标题 |
| H2 | 22–24px | 600 | 1.35 | 宣传专区标题、区块标题 |
| H3 | 18px | 600 | 1.4 | 卡片标题、弹窗标题 |
| Body L | 16px | 400–500 | 1.6 | 正文、表单标签 |
| Body S | 14px | 400 | 1.6 | 表格正文、辅助说明 |
| Caption | 12px | 400–500 | 1.5 | 时间戳、校验提示、角标 |
| Numeric L | 28–32px | 700 | 1.2 | 积分余额、看板 KPI |

数字密集处：`font-variant-numeric: tabular-nums`。

### 5.3 中文排版

- 段落最大宽度建议 720–800px（长文介绍页），避免通栏过长行。  
- 中文字重 400/500/700 为主；少用 300 作正文。  
- 英文专名 SoftTong / SoftTong 智慧：不强制大写变换。  

---

## 6. 布局与间距

### 6.1 前台壳（F 系列）

```
┌──────────────────────────────────────────────────────────────┐
│ 顶栏 64px  bg: Card/#FFF  border-b: Border                   │
│ Logo(青绿字标) | 导航文字 | [加入我们·Accent小钮] [登录]       │
├──────────────────────────────────────────────────────────────┤
│ Hero / 主内容：背景 Background；内容 max 1200px 居中           │
│ 区块纵向间距：48–72px（--space-2xl ~ 3xl）                    │
├──────────────────────────────────────────────────────────────┤
│ 页脚：bg #134E4A 或 Primary Hover；文字 On Primary / 浅青     │
└──────────────────────────────────────────────────────────────┘
```

| 项 | 规格 |
| --- | --- |
| 顶栏高 | 64px |
| 内容最大宽 | 1200px（后台表格区 1280px） |
| Hero | 全宽视觉平面；首屏内完成品牌+双 CTA |
| 导航高亮 | 文字 Primary；底边 2px Primary |

### 6.2 后台壳（A 系列）

```
┌──────────────────────────────────────────────────────────────┐
│ 顶栏 56px  bg: #0F766E  text: #FFF                           │
├────────────┬─────────────────────────────────────────────────┤
│ 侧栏 220px │ 面包屑 Caption + 标题 H1 + 主操作               │
│ bg: Card   │ 内容区 bg: Background                           │
│ 激活项：左 │ 表格/表单 max 1280px                            │
│ 条 Primary │                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

| 项 | 规格 |
| --- | --- |
| 侧栏宽 | 220px |
| 顶栏高 | 56px |
| 行高（表格） | 44–48px |
| 内容区内边距 | 24px |

### 6.3 间距 Token（8px 基准）

| Token | 值 | 使用 |
| --- | --- | --- |
| `--space-xs` | 4px | 图标与文字间隙 |
| `--space-sm` | 8px | 标签内边距、紧凑列表 |
| `--space-md` | 16px | 表单字段间距、卡片内边距（后台） |
| `--space-lg` | 24px | 卡片间距、前台卡片内边距 |
| `--space-xl` | 32px | 区块内分组 |
| `--space-2xl` | 48px | 前台区块间距 |
| `--space-3xl` | 64–72px | 首页大区块间距 |

### 6.4 圆角 Token

| Token | 前台 | 后台 Dense | 使用 |
| --- | --- | --- | --- |
| `--radius-sm` | 6px | 4px | 输入框、Tag |
| `--radius-md` | 10px | 6px | 按钮、小卡片 |
| `--radius-lg` | 16px | 8px | 大卡片、宣传图容器 |
| `--radius-full` | 9999px | 9999px | 头像、进度圆点（**避免**大面积 Pill 堆砌） |

---

## 7. 阴影与层级

```css
:root {
  --shadow-soft: 0 2px 8px rgba(13, 148, 136, 0.08);
  --shadow-card: 0 4px 16px rgba(15, 23, 42, 0.06);
  --shadow-dropdown: 0 8px 24px rgba(15, 23, 42, 0.10);
  --shadow-modal: 0 16px 48px rgba(15, 23, 42, 0.16);
}

/* 后台 Dense：默认接近无阴影，仅弹层使用 dropdown/modal */
```

| 层级 | z-index 建议 |
| --- | --- |
| 顶栏 | 100 |
| 下拉 | 200 |
| 抽屉 | 300 |
| Modal | 400 |
| Toast | 500 |

---

## 8. 组件规范

### 8.1 按钮

| 类型 | 样式 | 使用 |
| --- | --- | --- |
| Primary | bg Primary，文字白，高 40–44px | 一般主操作（保存、报名） |
| Accent | bg Accent，文字白 | **转化**：加入我们、提交申请 |
| Secondary | 白底 + Border Strong + Primary 字 | 次要（查看活动、取消） |
| Ghost | 透明 + Primary 字 | 文字链级操作 |
| Destructive | bg Destructive | 驳回确认主按钮（二次确认后） |
| Disabled | bg Muted，字 Muted Foreground，`not-allowed` | 不可用 |

交互：Hover 150ms；Press scale `0.98` 100ms；Focus-visible Ring 2px。

### 8.2 输入与表单

| 项 | 规范 |
| --- | --- |
| 高度 | 40–44px |
| 边框 | 1px Border；Focus：2px Ring |
| 标签 | 在字段上方，Body S/L，不可仅靠 placeholder |
| 错误 | 字段下 Caption + Destructive；边框改 Destructive |
| 必填 | 标签旁红色 `*` |
| 字数 | 心得等显示 `当前/上限`，超限 Destructive |

### 8.3 卡片（前台）

- 背景 Card，圆角 `--radius-lg`，阴影 `--shadow-card`。  
- **Hero 与宣传主平面禁止套「信息统计卡」**；活动/课程精选可用内容卡。  
- 卡片悬停：阴影略升或边框转 Border Strong，不可跳动位移 >2px。  

### 8.4 表格（后台）

| 项 | 规范 |
| --- | --- |
| 表头 | bg Muted，Caption/Body S，字重 600 |
| 行高 | 44–48px |
| 斑马纹 | 可选极淡 `#FAFFFE` |
| 操作列 | 右对齐链接按钮 |
| 空态 | 文案 + 可选 CTA，非大插画喧宾 |

### 8.5 导航

| 端 | 规范 |
| --- | --- |
| 前台顶栏 | 文字导航；当前项 Primary + 底边 |
| 后台侧栏 | 图标(可选)+文字；激活：左侧 3px Primary + 浅青绿底 `#CCFBF1` |
| 面包屑 | Caption，分隔 `/` |

### 8.6 反馈

| 类型 | 规范 |
| --- | --- |
| Toast | 右上；成功/失败/警告色条；约 3s |
| Modal | 遮罩 Overlay；宽 480–640px；必有关闭与主操作 |
| 骨架屏 | Muted 底 + shimmer；禁止空白闪烁 |
| 进度条 | 轨道 Muted；填充 Primary；≥99% 可用 Success 点缀 |

### 8.7 图标

- 库：Lucide 或 Heroicons（全站统一一种）。  
- 默认描边 1.5–2px；尺寸 16/20/24。  
- **禁止** emoji 充当功能图标。  

---

## 9. 动效规范

| 场景 | 时长 | 缓动 | 说明 |
| --- | --- | --- | --- |
| Hover / 颜色 | 150–200ms | ease | 按钮、链接 |
| 页面淡入 | 200ms | ease-out | 路由切换可选 |
| 列表 Stagger | 300–450ms，项间隔 ~60ms | back.out(1.4) 或 ease-out | 精选卡片入场；可降级 |
| Toast | 300ms | ease-out | 滑入 |
| Modal | 200ms | ease | 缩放+淡入 |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

禁止：无限闪烁促销、视差过重导致眩晕、动画 width/height 引起回流。

---

## 10. 前台关键页面视觉要点

| 页面 | 视觉要求 |
| --- | --- |
| F01 首页 | Hero 品牌「雏英计划」最大字级；Accent「加入我们」+ Secondary「查看活动」；计划/公司宣传区 H2+图文；精选卡 ≤3 |
| F02 计划介绍 | 长文 Body L；章节 H2；页内 CTA Accent |
| F03–F06 | 筛选条轻量；卡片封面 16:9 或 4:3；标签用状态色 |
| F07 加入 | 单列表单 max 560–640px；提交 Accent |
| F08 登录 | 品牌区可用 Primary 浅渐变底；演示角色卡弱阴影，不抢主按钮 |
| F09–F14 | 子导航下划线 Primary；积分数字 Numeric L；状态 Badge 见表 4.3 |

公司宣传区锚点 `#company`：滚动偏移减去顶栏 64px。

---

## 11. 后台关键页面视觉要点

| 页面 | 视觉要求 |
| --- | --- |
| A01 控制台 | KPI 四宫格；待办列表；无大 Hero |
| A02 内容运营 | Tab + 表格；编辑区白卡片 |
| A03–A04 加入审核 | 列表密；详情操作 Primary/Destructive 分离 |
| A05–A07 活动 | 形态 Tag；进度列可用条形 |
| A08–A10 积分 | 类型一/二分区标题；通过 Accent 或 Primary，驳回 Destructive |
| A11–A13 | 权限勾选组；超管标识 Warning/Info 小标 |

---

## 12. 无障碍与可用性

| 规则 | 要求 |
| --- | --- |
| 对比度 | 正文 ≥4.5:1；大号标题 ≥3:1 |
| 焦点 | 所有可聚焦控件有可见 Ring |
| 键盘 | Tab 顺序合理；Esc 关弹窗；Enter 提交主表单 |
| 点击热区 | 按钮高度 ≥40px（PC） |
| 表单 | 可见 label；错误与字段关联（`aria-describedby`） |
| 减动效 | 见 §9 |

---

## 13. 禁止事项（Anti-Patterns）

| 禁止 | 原因 |
| --- | --- |
| AI 紫/粉渐变主题 | 技能与项目明确 Avoid；降信任 |
| 奶油底 + 赤陶衬线旧报纸风 | 与方案 A 冲突，且属通用 AI 审美簇 |
| Emoji 功能图标 | 不专业、跨平台不一致 |
| 首屏堆统计卡/完整活动列表 | 违反 F01 |
| 前后台两套无关色板 | 破坏品牌一致性 |
| 大面积 rounded-full 营销胶囊堆砌 | 喧宾夺主 |
| 重 Glassmorphism 做表格 | 可读性与性能差 |
| 未核实业绩数字装饰条 | 合规与真实性 |

---

## 14. CSS 变量汇总（实现清单）

```css
:root {
  /* Color */
  --color-primary: #0D9488;
  --color-primary-hover: #0F766E;
  --color-on-primary: #FFFFFF;
  --color-secondary: #2DD4BF;
  --color-on-secondary: #134E4A;
  --color-accent: #D97706;
  --color-accent-hover: #B45309;
  --color-on-accent: #FFFFFF;
  --color-background: #F0FDFA;
  --color-foreground: #134E4A;
  --color-card: #FFFFFF;
  --color-card-foreground: #134E4A;
  --color-muted: #E8F1F4;
  --color-muted-foreground: #64748B;
  --color-border: #99F6E4;
  --color-border-neutral: #D1E5E3;
  --color-border-strong: #5EEAD4;
  --color-destructive: #DC2626;
  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-info: #0284C7;
  --color-ring: #0D9488;
  --color-overlay: rgba(15, 23, 42, 0.45);

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Space */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* Shadow */
  --shadow-soft: 0 2px 8px rgba(13, 148, 136, 0.08);
  --shadow-card: 0 4px 16px rgba(15, 23, 42, 0.06);
  --shadow-dropdown: 0 8px 24px rgba(15, 23, 42, 0.10);
  --shadow-modal: 0 16px 48px rgba(15, 23, 42, 0.16);

  /* Font */
  --font-sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-display: "Lexend", "Noto Sans SC", sans-serif;
}

[data-density="admin"] {
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --shadow-card: none;
}
```

---

## 15. 验收要点（AC）

1. **AC-UI-01** 全站可追溯到 §4 Token；组件不写游离魔法色（状态色除外且须来自表）。  
2. **AC-UI-02** 前台顶栏 64px、内容 max 1200px；后台侧栏 220px、顶栏 56px。  
3. **AC-UI-03** 「加入我们 / 提交申请」类主转化使用 Accent `#D97706`。  
4. **AC-UI-04** 中文界面默认 Noto Sans SC；无 Comic/装饰艺术字作 UI 字体。  
5. **AC-UI-05** 待审/通过/驳回 Badge 符合 §4.3。  
6. **AC-UI-06** 可聚焦控件有可见 focus-visible；正文对比度抽检 ≥4.5:1。  
7. **AC-UI-07** `prefers-reduced-motion: reduce` 时无大段入场动画。  
8. **AC-UI-08** 无 emoji 功能图标；无 AI 紫粉主题。  
9. **AC-UI-09** F01 含计划宣传与公司宣传结构位；首屏无完整活动列表。  
10. **AC-UI-10** 后台 Dense 下表格行高 ≥44px，操作列可点击。  

---

## 16. 相关文档

| 文档 | 关系 |
| --- | --- |
| `globaluser-uiux-风格推荐.md` | 三方案比选；A 已采纳 |
| `globaluser.md` | 信息架构与全局交互；引用本文为视觉真源 |
| `globaluser-首页-首页.md` 等 | 页面结构；视觉服从本文 |
| `docs/superpowers/specs/2026-08-02-chuying-portal-design.md` | 产品规格；应同步「视觉定案 A」 |

---

## 17. 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-08-02 | V1.0：用户选定方案 A，输出完整设计系统 PRD（Token/组件/壳/AC） |
