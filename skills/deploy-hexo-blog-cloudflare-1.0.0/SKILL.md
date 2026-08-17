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
