# 方木雁的博客

深色霓虹终端风格的静态博客，复刻 [coderliang.com](https://coderliang.com) 的设计语言。

- **生成器**：[Hexo](https://hexo.io)（Markdown 写作，零服务器）
- **主题**：自研 `coderliang` 风主题（EJS + 原生 CSS/JS，无框架依赖）
- **部署**：Cloudflare Pages（主推，全球 CDN）或 GitHub Pages（备选）
- **功能**：站内搜索、RSS 订阅、标签/分类/归档、深色/浅色切换、Giscus 评论区、不蒜子阅读量

## 目录结构

```
blog/
├── _config.yml               # 站点配置（部署后改 url）
├── _headers                  # 安全响应头（构建时复制到 public/）
├── scaffolds/                # 新建文章模板
├── source/
│   ├── _posts/               # ← 你的文章都放这里（Markdown）
│   └── about/index.md        # 关于页
├── themes/coderliang/        # 主题
│   ├── _config.yml           # ← 主题配置（导航/侧栏/Giscus 都在这里改）
│   └── layout/ source/       # 模板 + CSS/JS
└── .github/workflows/pages.yml  # GitHub Pages 自动部署
```

## 一、本地开发

```bash
cd blog
npm install
npm run server        # 启动本地服务 http://localhost:4000
```

写文章：

```bash
npm run new "文章标题"   # 生成 source/_posts/文章标题.md
npm run build          # 生成静态文件到 public/
```

文章头部（front matter）示例：

```yaml
---
title: 文章标题
date: 2026-08-18 12:00:00
categories:
  - 全栈开发          # 分类：全栈开发 / AI 工程 / 安全研究 / 开源
tags:
  - Hexo
excerpt: 一句话摘要，显示在首页卡片上
toc: true             # 显示目录
---
```

## 二、部署到 Cloudflare Pages（推荐，主方案）

1. **建 GitHub 仓库**：在 [github.com](https://github.com) 新建仓库（如 `my-blog`），把本目录推上去：

   ```bash
   git init
   git add .
   git commit -m "init: 方木雁的博客"
   git branch -M main
   git remote add origin https://github.com/你的用户名/my-blog.git
   git push -u origin main
   ```

2. **注册/登录 Cloudflare**：[dash.cloudflare.com](https://dash.cloudflare.com) → 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。

3. 授权 GitHub，选择 `my-blog` 仓库，构建设置：

   | 配置项 | 值 |
   | --- | --- |
   | Framework preset | **Hexo** |
   | Build command | `npm run build` |
   | Build output directory | `public` |
   | Node.js version | 20 |

4. 点 **Save and Deploy**，约 1 分钟后你就拥有一个 `xxx.pages.dev` 的博客地址。

5. **绑定自定义域名**（可选）：Pages 项目 → **Custom domains** → 按提示添加你的域名（可以是免费的 `.tk` / `.ml` / `.top` 域名，在 Freenom 等注册商申请），Cloudflare 会自动配 DNS 和免费 HTTPS。

以后每次 `git push`，Cloudflare 自动重新构建发布，全程零费用。

## 三、部署到 GitHub Pages（备选）

方式 A（推荐）：本仓库已带 `.github/workflows/pages.yml`，只需：

1. GitHub 仓库 → **Settings** → **Pages** → **Source: GitHub Actions**
2. 推送代码后 Actions 自动构建发布，地址为 `https://你的用户名.github.io`

方式 B：手动推送静态文件

```bash
npm run build
cd public
git init && git add . && git commit -m "deploy"
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -f origin main
```

## 四、配置评论区（Giscus，免费）

静态站也能有评论区——Giscus 把评论存进 GitHub Discussions：

1. 按 [giscus.app](https://giscus.app) 指引安装 **Giscus app** 到你的仓库，并开启 Discussions
2. 在 giscus.app 上填好仓库，复制 `data-repo-id` 和 `data-category-id`
3. 打开 `themes/coderliang/_config.yml`：

   ```yaml
   giscus:
     enable: true
     repo: 你的用户名/my-blog
     repo_id: R_xxx          # 从 giscus.app 复制
     category_id: DIC_xxx    # 从 giscus.app 复制
   ```

4. `npm run build` 重新部署即可，评论会同步到 GitHub Discussions。

## 五、阅读量统计（不蒜子）

主题默认开启了 [不蒜子](https://busuanzi.ibruce.info) 统计，免费无需注册，直接显示在文章卡片和详情页。不想用就在 `themes/coderliang/_config.yml` 里把 `busuanzi.enable` 改为 `false`。

## 六、上线前必改清单

| 位置 | 改什么 |
| --- | --- |
| `_config.yml` | `url` 改成你的真实域名/Pages 地址 |
| `themes/coderliang/_config.yml` | `site.name`、`footer.github`、`footer.email`、`sidebar.github.username` |
| `source/about/index.md` | 换成你的真实介绍 |
| `source/_posts/*.md` | 删掉示例文章，写你自己的 |

## 常见问题

**Q：改了主题配置不生效？**
A：`hexo clean && npm run build` 再重新部署。

**Q：代码块不换行/样式不对？**
A：根目录 `_config.yml` 里 `highlight.line_number: false`，主题 CSS 已适配；如用了自定义高亮插件请保持 `hljs: true`。

**Q：想换别的主题？**
A：`themes/coderliang/_config.yml` 里 `menu`/`tabs`/`sidebar.projects` 都是配置驱动的，先试着改配置；实在要换主题，下载后改根 `_config.yml` 的 `theme` 字段即可。

**Q：怎么在文章里插图？**
A：把图片放到 `source/images/`，正文里用 `![](/images/xxx.png)`。

---

Happy hacking! 🚀
