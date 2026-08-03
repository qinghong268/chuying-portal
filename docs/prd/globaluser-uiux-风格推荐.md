# 雏英计划宣传官网 — UI/UX 风格推荐

> 分析日期：2026-08-02 | 数据来源：`ui-ux-pro-max` 技能数据库（`--design-system` + style/color/typography/landing）  
> 终端：PC Web（V1 不做移动端适配，实现仍按 PC 1366×768+）  
> 产品依据：`docs/prd/globaluser.md`、`docs/superpowers/specs/2026-08-02-chuying-portal-design.md`  
> 首页职责：雏英计划宣传 + 软通智慧公司宣传 + 活动/课程精选  
> **定案：方案 A**（2026-08-02）→ 详细设计系统见 `globaluser-uiux-设计系统-方案A.md`

---

## 1. 推荐结论（三选一）

| 方案 | 风格标签 | 气质一句话 | 状态 |
| --- | --- | --- | --- |
| **方案 A（主推）** | Soft UI Evolution + 教育青绿 | 成长感、培养计划、亲和专业 | **已选定** |
| **方案 B** | Minimalism / Flat + 企业海军蓝 | 稳重可信、对标大厂企业站 | 未采用 |
| **方案 C** | Hero-Centric + 叙事卷轴感 | 首屏冲击力强、故事驱动加入 | 未采用 |

**技能默认组合（A）摘要：** Pattern=`Enterprise Gateway`（落地页按宣传官网裁剪）· Style=`Soft UI Evolution` · Colors=`LMS Education Teal` · Type=`Corporate Trust`（中文叠 `Noto Sans SC`）。

**明确避免（技能 + 本项目约束）：** AI 紫粉渐变、玩梗娱乐风、证书墙式堆叠、emoji 当图标、奶油底+赤陶衬线旧报纸风。

---

## 2. 方案 A（主推）— Soft UI Evolution × 教育青绿

### 2.1 为什么适合雏英官网

1. 技能将「企业人才培养 / 教育类」匹配到 **Soft UI Evolution**：浅景深、柔和阴影、对比度优于旧拟物，适合「青年培养 + 企业背书」双叙事。  
2. LMS 青绿色板传达成长、课程、培养，与「雏英」隐喻一致，又区别于纯金融海军蓝。  
3. 前台宣传区需要氛围，后台表格仍可同一 token 降密度使用，全站不割裂。  

### 2.2 风格特征

| 特性 | 描述 |
| --- | --- |
| 核心理念 | 柔和层次 + 清晰可读 + 现代企业感 |
| 色彩策略 | 青绿主色 + 琥珀 CTA，浅青绿背景 |
| 视觉语言 | 微圆角、轻阴影、SVG 图标、少渐变 |
| 前台 | Hero 全宽 + 计划/公司专区大气留白 |
| 后台 | 同色系但更高信息密度、阴影更弱 |

### 2.3 颜色 Token

| 角色 | Hex | CSS 变量 |
| --- | --- | --- |
| Primary | `#0D9488` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#2DD4BF` | `--color-secondary` |
| Accent / CTA | `#D97706` | `--color-accent` |
| Background | `#F0FDFA` | `--color-background` |
| Foreground | `#134E4A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Muted | `#E8F1F4` | `--color-muted` |
| Muted Foreground | `#64748B` | `--color-muted-foreground` |
| Border | `#99F6E4`（实现建议略降饱和，原库 `#5EEAD4` 偏亮可作 focus） | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Success | `#16A34A` | `--color-success` |
| Warning | `#F59E0B` | `--color-warning` |
| Ring | `#0D9488` | `--color-ring` |

### 2.4 字体

| 用途 | 字体 | 说明 |
| --- | --- | --- |
| 中文正文/标题 | **Noto Sans SC** | 简体站点必备 |
| 英文/数字标题（可选） | Lexend | Corporate Trust，可读性高 |
| 英文正文（可选） | Source Sans 3 | 与 Lexend 配对 |

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Lexend:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap');
```

### 2.5 首页结构映射（对齐 F01）

技能 Landing 推荐裁剪为：

1. Hero（计划品牌 + 双 CTA）  
2. 雏英计划宣传专区  
3. 软通智慧公司宣传专区  
4. 精选活动 / 精选课程  
5. 页脚  

动效：列表/卡片 `stagger` 300–450ms；尊重 `prefers-reduced-motion`。

### 2.6 风险

青绿偏「教育产品」；若品牌方要求更「科技集团官网」，选方案 B。

---

## 3. 方案 B — Minimalism / Flat × 企业海军蓝

### 3.1 为什么适合

1. 技能 `B2B Service` 色板（`#0F172A` + 蓝 CTA）强化**软通智慧**企业信任。  
2. Flat/Minimal：无重阴影、高性能、WCAG 友好，后台表格最省事。  
3. 适合对标大型企业校园/人才计划官网的「正式稿」气质。  

### 3.2 风格特征

| 特性 | 描述 |
| --- | --- |
| 核心理念 | 功能与信任优先，装饰克制 |
| 色彩策略 | 海军主色 + 单一强调蓝，少渐变 |
| 视觉语言 | 细分割线、4px 微圆角、图标线性 |
| 阴影 | 默认无；卡片可用极淡 `0 1px 2px` |

### 3.3 颜色 Token

| 角色 | Hex | CSS 变量 |
| --- | --- | --- |
| Primary | `#0F172A` | `--color-primary` |
| Secondary | `#334155` | `--color-secondary` |
| Accent / CTA | `#0369A1` | `--color-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#020617` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Muted | `#E8ECF1` | `--color-muted` |
| Border | `#E2E8F0` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#0F172A` | `--color-ring` |

### 3.4 字体

| 用途 | 字体 |
| --- | --- |
| 中文 | Noto Sans SC |
| 英文/UI | IBM Plex Sans（Financial Trust）或 Plus Jakarta Sans |

### 3.5 风险

青年感与「雏英」活力略弱，需靠摄影/插画素材补温度（素材 `[待运营提供]`）。

---

## 4. 方案 C — Hero-Centric 叙事 × 现代专业字体

### 4.1 为什么适合

1. 技能 Landing：`Hero-Centric` / `Hero + Features + CTA` —— 首屏占视口 60–80%，适合计划专题转化。  
2. 字体 `Modern Professional`（Poppins + Open Sans）+ 中文 Noto Sans SC，友好、现代。  
3. 公司宣传可用第二屏大图叙事，活动/课程为后续证据层。  

### 4.2 风格特征

| 特性 | 描述 |
| --- | --- |
| 核心理念 | 首屏品牌冲击 + 向下滚动叙事 |
| 色彩策略 | 可在 A 或 B 色板中二选一作底；CTA 对比 ≥7:1 |
| 视觉语言 | 全 bleed 摄影、大标题、少卡片边框 |
| 动效 | 章节淡入；避免横向长卷轴（PC 运营成本高） |

### 4.3 建议配色（二选一挂载）

- 挂 A：青绿成长叙事  
- 挂 B：海军正式叙事  

### 4.4 风险

后台若强行 Hero 化会浪费空间；**前台用 C，后台仍用 A/B 的 dense 变体**。

---

## 5. 后台与前台关系（三方案共通）

| 端 | 规则 |
| --- | --- |
| 前台 | 宣传氛围优先；卡片可轻阴影；Hero 全宽 |
| 后台 | 同 Primary token；圆角更小；表格密；侧栏 220px |
| 组件 | 图标统一 Lucide/Heroicons SVG，禁用 emoji 图标 |
| 状态色 | 成功绿 / 待审蓝或琥珀 / 驳回红 — 三方案共用语义 |

---

## 6. 与 PRD 页面的落地提示

| 页面 | 风格要点 |
| --- | --- |
| F01 首页 | 方案决定 Hero 气质；计划/公司专区必须「品牌可见」 |
| F02 计划介绍 | 长文可读：行高 1.6+，标题层级清晰 |
| F03–F06 活动课程 | 列表卡片一致；筛选条克制 |
| F08 登录 | 演示三角色区视觉从属，不抢主品牌 |
| A01–A13 后台 | 方案 A/B 的 dense 变体；勿用强玻璃拟态拖累表格 |

---

## 7. 技能检索原始依据（摘要）

| 检索 | 结果要点 |
| --- | --- |
| `--design-system` | Soft UI Evolution · LMS Teal · Lexend/Source Sans 3 · Avoid AI purple |
| `--domain style` | Glassmorphism / Flat / Enterprise SaaS 等（Glass 作叠加效果可选，不作主风格） |
| `--domain color` | LMS Teal、Government Blue、B2B Navy |
| `--domain typography` | Corporate Trust、Modern Professional、**Chinese Simplified (Noto Sans SC)** |
| `--domain landing` | Hero-Centric、Hero+Features+CTA、Scroll Storytelling |

---

## 8. 决策结果

| 项 | 内容 |
| --- | --- |
| 选定 | **方案 A** |
| 详细 PRD | `docs/prd/globaluser-uiux-设计系统-方案A.md` |
| 后续 | 实现阶段以设计系统 PRD 为视觉真源；运营素材到位后替换占位媒体，不改 Token |

---

## 9. 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-08-02 | V1.0：安装并调用 `ui-ux-pro-max`，输出三套风格推荐 |
| 2026-08-02 | 用户选定方案 A；指向完整设计系统 PRD |
