---
title: agent 时代如何搭建个人博客
date: 2026-08-17 23:20:00
updated: 2026-08-17 23:20:00
categories:
  - 全栈开发
tags:
  - Agent
  - Hexo
  - Cloudflare
  - 博客搭建
  - 部署
excerpt: 从零到上线只花了一个下午——这篇记录 agent 帮我搭博客的全过程：设计复刻、三个经典坑、GitHub 故障日的破局，以及我把整套经验固化成 skill 的姿势。
toc: true
---

> 2026 年了，还有人搭博客吗？有——但方式变了：需求说清楚，剩下的交给 agent。

## 起因：一句话需求

我想搭一个个人博客，要求很具体：

> 深色终端风、模仿 coderliang.com、Hexo 生成、GitHub 存代码、Cloudflare Pages 免费托管、要评论区/搜索/RSS/深浅色切换。

然后我把它丢给了 DeepSeek Harness（一个 agent 开发环境），接下来的一个下午是这样的：

```
14:00  需求确认：Hexo + 复刻 coderliang 风格 + 四件套功能
14:30  抓取 coderliang.com 源码，提取设计 token（oklch 配色/字体/glow）
15:00  自研主题：8 个 EJS 模板 + 900 行 CSS + 交互 JS
16:00  构建报错 → 排查 → 修好 → 本地预览通过
17:00  推代码到 GitHub
18:00  开始踩坑（详见下文）
20:30  GitHub 故障日 → 改用 wrangler 直接上传 → 上线成功
```

全程我做的只有：回答几个选择题（技术栈、风格、功能）、点几次浏览器授权。其余全是 agent 干的。

## 三个经典坑（给后来者省时间）

### 坑 1：hexo-cli 不认你的项目

手动搭建 Hexo 项目时，如果 `package.json` 里没有这段：

```json
"hexo": { "version": "7.3.0" }
```

那么 `hexo generate` 会**静默打印帮助信息而不是报错**。排查了半小时才发现是 hexo-cli 用 `find_pkg` 检查 `json.hexo === 'object'` 来判断目录是不是 Hexo 站点——字段缺失就直接当"不是 Hexo 项目"处理。

### 坑 2：Hexo 7 的生成器是独立包

`hexo-generator-index / archive / category / tag` 这 4 个包在 Hexo 7 里需要单独安装。漏装的表现是：构建日志里没有 `index.html`，首页直接不生成。

### 坑 3：npm 官方源在国内会挂起

安装 wrangler 时 npm 进程挂起数分钟无输出。杀掉换镜像源，27 秒装完：

```bash
npm install -D wrangler --registry=https://registry.npmmirror.com
```

## 最刺激的部分：GitHub 故障日

部署最顺利的路径本来是 **Cloudflare → Connect to Git**（授权 GitHub 后自动构建）。但那天运气不好——**GitHub 正处于 Partial System Outage（部分系统故障）**：

- Connect to Git 反复报错：`No server is currently available to service your request.`
- GitHub App 授权链接同样打不开
- 状态页显示 Cloudflare 的 Pages/Workers 组件都 operational，但流程就是走不通

关键判断：**"No server is currently available" 出现在 github.com 域名的授权流程里，优先怀疑 GitHub 侧故障**。用状态 API 一查：

```bash
curl -s https://www.githubstatus.com/api/v2/status.json
# → "status": { "description": "Partial System Outage" }
```

curl 测试授权链接本身返回 200（说明链接有效），但 GitHub 官方确认全站约 20% 请求报错——**curl 成功和浏览器报错可以同时成立**，这就是 OAuth/App 安装多跳流程的脆弱之处。

## 破局：wrangler 直接上传

既然 Git 集成被故障卡死，就绕开它——用 Cloudflare 官方 CLI **wrangler** 直接把构建好的 `public/` 传上去，这条路完全不经过 GitHub：

```bash
npx wrangler login    # 浏览器授权一次
npm run build
npx wrangler pages project create muyan-blog-temp --production-branch=main
npx wrangler pages deploy public --project-name=muyan-blog-temp --branch=main
```

第一次部署还赶上瞬时网络抖动（`fetch failed`），重试一次就通了：

```
✨ Uploaded 34 files (4.65 sec)
✨ Deployment complete! https://muyan-blog-temp.pages.dev
```

博客上线了。**这个临时方案的核心约束**：Direct Upload 项目以后不能直接切换成 Git 集成项目，所以临时项目必须用独立名字（`-temp` 后缀），等 GitHub 恢复后再建正式的 Git 集成项目并迁移域名。

## agent 时代的正确姿势：把经验固化成 skill

这次部署踩的坑——hexo 字段、独立生成器、npm 镜像、故障诊断顺序、wrangler 备份方案、临时项目命名策略——如果下次再搭一个博客，难道要重新踩一遍吗？

所以我把整套经验固化成了一个 **skill**：遵循 DeepSeek Harness / Claude 系的 skill 格式（`SKILL.md` + YAML frontmatter），任何 agent 加载后都能直接按图施工。

```text
skills/deploy-hexo-blog-cloudflare-1.0.0/
└── SKILL.md    # 完整操作手册 + 故障排查 + 网络适配
```

完整内容贴在文末。**这就是 agent 时代的迭代方式**：让 agent 干活 → 把过程沉淀成 skill → 下次 agent 带着 skill 干得更快。写博客记录的不只是结果，还有让结果可复现的资产。

## 附：可直接使用的 skill

以下内容保存为 `SKILL.md`（放在 `skills/deploy-hexo-blog-cloudflare-1.0.0/` 目录下），即可被 DeepSeek Harness 或兼容 Claude skill 格式的 agent 环境加载使用：

````markdown
---
name: deploy-hexo-blog-cloudflare
description: "搭建并部署 Hexo 静态博客到 Cloudflare Pages / GitHub Pages，含故障排查与备用方案。当用户要求搭建个人博客、部署 Hexo 站点、复刻深色终端风博客主题、处理 Cloudflare Pages 部署失败（如 GitHub 故障导致 Connect to Git 报错）、或用 wrangler 直接上传部署时使用。触发词：搭建博客、部署博客、Hexo、Cloudflare Pages、GitHub Pages、wrangler、静态博客、Pages 部署报错。"
---

# 搭建并部署 Hexo 博客到 Cloudflare Pages

把一套完整的 Hexo 静态博客从零搭建到 Cloudflare Pages 上线（含 GitHub Pages 备选、故障排查、中国大陆网络适配）。基于 2026-08 实战经验，踩过的坑全部记录在内。

## 适用场景

- 用户要搭个人博客，已选定或接受 Hexo（Node 生态、中文资料多）
- 部署目标：Cloudflare Pages（主）或 GitHub Pages（备）
- 需要复刻深色终端/霓虹风设计（类似 coderliang.com）时，自研主题而非套现成主题

## 一、项目骨架（关键坑点）

### 1. package.json 必须包含 `hexo` 字段

hexo-cli 通过 `find_pkg` 判断目录是不是 Hexo 站点：读取 package.json 并检查 `typeof json.hexo === 'object'`。**缺少该字段时，`hexo generate` 会静默打印 usage 帮助而不是报错**，极易误判。

```json
{
  "name": "my-blog",
  "scripts": {
    "build": "hexo generate && cp _headers public/_headers",
    "server": "hexo server",
    "deploy:pages": "wrangler pages deploy public --project-name=my-blog-temp --branch=main"
  },
  "hexo": { "version": "7.3.0" },
  "dependencies": {
    "hexo": "^7.3.0",
    "hexo-generator-archive": "^2.0.0",
    "hexo-generator-category": "^2.0.0",
    "hexo-generator-feed": "^3.0.0",
    "hexo-generator-index": "^4.0.0",
    "hexo-generator-search": "^2.4.3",
    "hexo-generator-tag": "^2.0.0",
    "hexo-renderer-ejs": "^2.0.0",
    "hexo-renderer-marked": "^6.3.0",
    "hexo-server": "^3.0.0"
  },
  "devDependencies": { "wrangler": "^4.123.0" }
}
```

### 2. Hexo 7 的 index/archive/category/tag 生成器是独立包

`hexo init` 默认模板会装这 4 个包。手动搭建时**漏装则首页 index.html 不会生成**（只有 search.json、文章页等），生成文件清单里没有 index.html 就是这个问题。

### 3. 中国大陆网络：npm 用镜像源

npm 官方源在本场景多次卡死（进程挂起数分钟无输出）。遇到就杀进程换镜像：

```bash
npm install -D wrangler --registry=https://registry.npmmirror.com
```

### 4. 主题结构（自研主题）

```
themes/<name>/_config.yml        # 主题配置（品牌/导航/侧栏/Giscus）
themes/<name>/layout/            # EJS 模板：layout/index/post/archive/category/tag/page + _partial/
themes/<name>/source/css|js      # 原生 CSS/JS，无需 stylus 渲染器
```

- 首页 hero 判断用 `is_home()` 辅助函数（`page.layout === 'index'` 不可靠）
- 目录辅助函数用法：`<% if (typeof toc === 'function') { %><%- toc(page.content, {list_number: false}) %><% } %>`
- 搜索：`hexo-generator-search` 生成 `search.json`，前端 fetch 过滤
- RSS：`hexo-generator-feed` 生成 `atom.xml`
- 阅读量：不蒜子 `<script async src="//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js">`，页面元素 `id="busuanzi_value_page_pv"`
- 深浅色切换：`data-theme` 属性 + localStorage + `color-scheme`，CSS 变量双套 token
- `_headers`（安全响应头）放仓库根，构建脚本 `cp _headers public/_headers` 复制进去（Hexo 会忽略 source/ 下划线开头文件）

## 二、部署到 Cloudflare Pages（Git 集成，主方案）

1. 建 GitHub 仓库并推送（注意 git 需先 `git config user.name/email`）
2. Cloudflare 控制台 → Workers & Pages → Create → Connect to Git → 授权时 **Only select repositories**，只勾博客仓库
3. 构建配置：
   - Framework preset: `Hexo`
   - Build command: `npm run build`（带 _headers 复制）
   - Build output directory: `public`
4. Save and Deploy → 得到 `https://<project>.pages.dev`

## 三、故障排查（本次实战核心）

### 现象：Connect to Git 报 "No server is currently available to service your request."

**优先怀疑 GitHub 侧故障，而不是 Cloudflare**。诊断顺序：

1. 查官方状态 API（比状态页快、可脚本化）：
   - `https://www.githubstatus.com/api/v2/status.json` → `status.description`
   - `https://www.cloudflarestatus.com/api/v2/status.json` → `status.description`
   - 细粒度组件：`.../api/v2/components.json`，注意 Cloudflare 的 Pages/Workers 组件即使全局 Minor Outage 也可能显示 operational
2. 该错误页出现在 github.com 域名时，用 curl 验证链接本身：`curl -sI https://github.com/apps/cloudflare-workers-and-pages` 返回 200/302 说明链接有效
3. 关键结论（2026-08-17 实测）：GitHub Partial System Outage 时，App 安装/OAuth 流程报错率显著高于首页访问；curl 200 与浏览器报错可同时成立（~20% 错误率）

### 现象：npm install 挂起

杀进程 → 换 `--registry=https://registry.npmmirror.com` 重装。若包已下载完整但 `.bin` 链接未生成（npm 收尾卡住），可临时用 `node node_modules/wrangler/bin/wrangler.js` 直接执行。

### 现象：wrangler pages deploy 报 "fetch failed"

多为瞬时网络抖动，直接重试（首次 522 是部署传播，重试后 200）。

### 验证清单（上线后必查）

```bash
UA="Mozilla/5.0 ... Chrome/125.0"
for p in "" "css/style.css" "js/main.js" "search.json" "atom.xml"; do
  curl -s -o /dev/null -w "/$p -> %{http_code}\n" "https://<project>.pages.dev/$p"
done
curl -sI -A "$UA" https://<project>.pages.dev/css/style.css | grep -iE "x-content-type|x-frame|referrer"  # 验证 _headers 生效
```

注意：Cloudflare 边缘会拦截裸 curl UA（403），必须带浏览器 UA；python urllib 默认 UA 也会 403。

## 四、备用方案：wrangler 直接上传（绕开 GitHub）

适用于 GitHub 故障期间或不想用 Git 集成的场景：

```bash
npx wrangler login                              # 浏览器 OAuth 授权
npx wrangler pages project create <temp-name> --production-branch=main
npx wrangler pages deploy public --project-name=<temp-name> --branch=main
# 之后每次更新：
npm run build && npx wrangler pages deploy public --project-name=<temp-name> --branch=main
```

**硬性约束：Direct Upload 项目之后不能切换成 Git 集成项目。** 因此：
- 临时上线用独立项目名（如 `muyan-blog-temp`），避免占用正式项目名
- GitHub 恢复后：新建正式 Git 集成项目（正式名）→ 迁移自定义域名 → 删除临时项目

## 五、GitHub 侧就绪检查

- `gh auth login`（设备码流程：复制一次性代码 → 浏览器打开 github.com/login/device → 输入代码授权；"按了两次"是正常流程，不是重复登录）
- 验证：`gh auth status` 显示 Logged in；`git ls-remote origin` 成功
- 升级 Git 集成的时机：githubstatus.com 恢复 All Systems Operational 后，再等 15~30 分钟，用无痕窗口重新从 Cloudflare 控制台走 Connect to Git（**不要复用旧的 ?state=xxx 链接，state 一次性且有时效**）

## 六、交付清单

- Hexo 站点：`_config.yml`（url 上线前必改）、主题、scaffolds、示例文章
- 部署配置：`.github/workflows/pages.yml`（GitHub Pages 备选）、`_headers`
- README：部署指南（Git 集成 + wrangler + Giscus 评论区配置）
- 文档：`docs/plans/YYYY-MM-DD-blog-design.md` 设计文档
- 验证：`npm run build` 全绿 + 线上 curl 清单通过 + 截图存档
````

## 结尾

把上面这份 skill 丢给任何 agent，它就能独立复刻整个流程。而我写下这篇文章本身，就是让它传播的方式——**agent 时代，经验不是写给自己看的，是写给 agent 看的**。

Happy hacking! 🚀
