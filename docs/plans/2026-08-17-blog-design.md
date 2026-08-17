# 方木雁个人博客 — 设计文档

- 日期：2026-08-17
- 状态：已实现并验证

## 目标

为用户搭建一个零成本的个人技术博客，视觉上复刻 [coderliang.com](https://coderliang.com) 的深色霓虹终端风格，部署于 Cloudflare Pages（主）/ GitHub Pages（备）。

## 技术选型

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 静态生成器 | Hexo 7 | 用户选定；Node 生态、中文资料多、Markdown 写作 |
| 主题 | 自研 `coderliang` 主题 | 现成主题无法复刻目标风格；EJS + 原生 CSS/JS，零框架依赖 |
| 部署 | Cloudflare Pages | 免费、全球 CDN、连接 GitHub 自动构建 |
| 评论 | Giscus | 评论挂 GitHub Discussions，静态站零成本实现评论区 |
| 搜索 | hexo-generator-search → search.json | 前端 fetch 过滤，无需后端 |
| RSS | hexo-generator-feed → atom.xml | 标准订阅 |
| 阅读量 | 不蒜子（busuanzi） | 免费、静态站可用、零配置 |
| 字体 | Geist / Geist Mono（Google Fonts） | 与原站一致，离线回退系统字体 |

## 设计系统（复刻自 coderliang.com）

从原站 CSS 提取的 token（oklch 色彩）：

- 深色：背景 `oklch(10% .02 260)`、卡片 `oklch(14% .02 260)`、边框 `oklch(30% .03 260)`、文字 `oklch(93% .01 260)`
- 主色（霓虹青）：`oklch(75% .2 180)`，发光 `--glow-text / --glow-box`
- 浅色：背景 `oklch(98.5% .005 250)`、主色 `oklch(55% .12 185)`
- 终端交通灯：红 `oklch(65% .2 25)` / 黄 `oklch(80% .16 90)` / 绿 `oklch(70% .17 150)`
- 字体：Geist（正文）/ Geist Mono（终端与元信息）
- 兼容性：所有变量带 hex 兜底，oklch/color-mix 不支持的浏览器自动降级

## 页面结构

- **首页**：终端 hero（`~/方木雁 $ whoami` 打字动画）→ 分类标签页（前端过滤）→ 文章卡片列表（`[分类]` 药丸 + 两行标题 + 日期/阅读/评论 mono 元信息）→ 侧栏（`tail -f blog.log` 最新动态、`gh trending` 开源项目、标签云）
- **文章页**：`~/posts/YYYY/MM/DD/slug.md` 面包屑 → 标题/元信息 → 目录（滚动高亮）→ 正文（霓虹风代码高亮）→ 上一篇/下一篇 → Giscus 评论区
- **归档/分类/标签页**：终端窗口式列表（`ls archives/`、`ls categories/xxx/`、`grep -r tags/xxx`）
- **关于页**：`$ whoami` 风格自我介绍
- **页脚**：`$ echo "Thanks for reading. Happy hacking."` 终端 + 导航列 + `Built with Hexo & Cloudflare Pages`

## 组件清单

| 组件 | 实现 |
| --- | --- |
| 深色/浅色切换 | `data-theme` 属性 + localStorage，同步 Giscus |
| 站内搜索 | `/` 快捷键唤起弹层，`search.json` 全文过滤，键盘上下选择 |
| 终端打字动画 | JS 逐字输入 `whoami` 后显示输出 |
| 标签页过滤 | 按 `data-cats` 客户端过滤卡片 |
| 安全响应头 | `_headers`（构建时复制进 public/） |
| GitHub Pages | `.github/workflows/pages.yml`（Node 20 + Actions） |

## 验证结果

- `npm run build` 生成 34 个文件，全部路由 200
- CDP 计算样式验证：深/浅主题 token、霓虹主色、Geist 字体、卡片/药丸/标签圆角全部生效
- 交互测试：主题切换（含 localStorage）、搜索（"3090"→1 篇命中）、标签过滤（全栈开发→1 篇）、打字动画全部通过
- 截图存档：`docs/screenshots/homepage-dark.png`、`post-page-dark.png`

## 上线前必改（见 README）

`_config.yml` 的 `url`、主题 `_config.yml` 的品牌/社交/Giscus 配置、关于页、示例文章。
