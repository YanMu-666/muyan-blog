---
title: "视频课 2 小时，笔记 15 章：公开课笔记工作流 + 可复用的 skill"
date: 2026-08-18 21:28:54
updated: 2026-08-18 21:28:54
categories:
  - skill 工具箱
tags:
  - Agent
  - skill
  - 公开课
  - 学习笔记
  - LLM
  - Karpathy
  - 工作流
excerpt: 把 Andrej Karpathy 的《Let's build the GPT Tokenizer》（2h13m）变成 15 章中文笔记只花了半小时——这篇复盘"检索 → 交叉验证 → 结构化输出"的公开课笔记工作流，并把整套流程固化成可直接复用的 skill。
toc: true
---

> 学习最好的姿势不是"看视频"，而是"让 agent 把视频变成笔记，你再去看笔记"。

## 起因：一句"帮我做份笔记"

我在学 Andrej Karpathy 的《Let's build the GPT Tokenizer》——2 小时 13 分钟的视频课，讲 LLM 分词器的方方面面。我跟 agent 说：

> 帮我在网上检索一下这门课相关知识，整理成一份笔记给我。

半小时后，我拿到一份 **15 章、带代码块和全部参考链接的中文笔记**，随后又花了几分钟把它发布成了博客文章（就是上一篇《[Let's build the GPT Tokenizer —— Karpathy 课程学习笔记](/2026/08/18/karpathy-gpt-tokenizer-notes/)》）。全程我做的只有：说一句话、扫一眼笔记、点确认发布。

## 时间线：半小时发生了什么

```
21:00  需求：学 Karpathy Tokenizer 课程，检索资料 + 整理笔记
21:03  第一轮检索：定位视频、minbpe 仓库、fast.ai 书本章节、社区笔记
21:05  第二轮检索：BPE 核心细节、正则模式、特殊 token、字节回退
21:08  第三轮检索：中文资料、GPT-4 复现细节、Karpathy 公开课解读
21:10  抓取一手资料：minbpe README + lecture.md（视频文字版）+ 社区笔记
21:15  深挖 fast.ai 书本章节：分 6 段拉全文，提取概念/代码/坑点
21:23  交叉验证 → 输出 15 章结构化笔记
21:30  上传博客，新建「大模型知识」分类栏目
```

## 这套工作流的三个关键

### 1. 多轮定向搜索，而不是一锤子买卖

第一轮搜索只负责**定位**：找到视频、仓库、书本章节、社区笔记这些"锚点"。

第二轮开始**抠细节**：`minbpe README`、`GPT-4 regex pattern special tokens`、`byte fallback`……每个检索词都带着明确意图。搜到仓库后，直接用 CDN 镜像抓仓库内的 `lecture.md`（视频逐字稿）、`exercise.md`（进阶练习）——这些文字版资料的信息密度远高于视频本身。

### 2. 一手资料优先，二手资料交叉验证

Karpathy 课程的配套资源非常完整：`karpathy/minbpe` 仓库、`lecture.md` 讲义、fast.ai 的《Complete Guide to Tokenization》（把视频重述成了书本章节）、Simon Willison 等社区笔记。

原则：**代码行为以官方为准，概念解释参考二手**。比如"minbpe 复现 GPT-4 分词器"这件事，最终是用 `GPT4Tokenizer` 与官方 `tiktoken` 库逐 token 对拍验证的——输出完全一致才算数。

### 3. 结构化输出，笔记自带骨架

不是"摘录视频讲了什么"，而是按固定骨架组织：

```
课程概况与资源（表格）→ 为什么重要 → 主线章节（概念→代码→坑点）
→ 常见问题与怪癖解释 → 要点总结 → 参考链接汇总
```

每个论断都能回溯到来源链接，读者可以顺着链接自查。这份笔记后来直接转成了博客文章，只补了个 front matter 就发布了——**笔记和博客文章共用同一份产出**。

## 踩过的坑（给后来者）

1. **GitHub raw 会 429**：直接抓 `raw.githubusercontent.com` 的 `lecture.md` 被限流，换 `cdn.jsdelivr.net/gh/<user>/<repo>@master/<file>` 就通了；
2. **长文要分段抓**：fast.ai 那篇书本章节全文很长，按字节 offset 分 6 段拉取，避免截断丢失内容；
3. **复现细节藏在暗处**：GPT-4 分词器有字节置换（`byte_shuffle`）和 merges 恢复两个隐蔽问题（`recover_merges`），不看 exercise.md 根本发现不了——这就是为什么要深挖仓库里的所有 md 文件。

## agent 时代的正确姿势：把流程固化成 skill

上次搭博客，我把部署经验固化成了 [deploy-hexo-blog-cloudflare](/2026/08/17/agent-era-personal-blog/) 这个 skill；这次也一样——**"视频公开课 → 检索 → 结构化笔记"这套流程，下次还会用到**（Karpathy 还有 build GPT、build nanoGPT、build GPT-2 等一整个系列）。

于是我把整个工作流固化成了一个 **skill**：

```text
skills/course-notes-from-video-1.0.0/
└── SKILL.md    # 五步工作流 + 检索技巧 + 交叉验证 + 交付清单
```

遵循 DeepSeek Harness / Claude 系的 skill 格式（`SKILL.md` + YAML frontmatter，description 里写明触发场景），任何 agent 加载后都能直接按图施工。完整内容贴在文末。

**这就是 agent 时代的迭代方式**：让 agent 干活 → 把过程沉淀成 skill → 下次 agent 带着 skill 干得更快。写博客记录的不只是结果，还有让结果可复现的资产。

## 附：可直接使用的 skill

以下内容保存为 `SKILL.md`（放在 `skills/course-notes-from-video-1.0.0/` 目录下），即可被 DeepSeek Harness 或兼容 Claude skill 格式的 agent 环境加载使用：

````markdown
---
name: course-notes-from-video
description: "检索并整理视频公开课（如 Andrej Karpathy 系列）的结构化学习笔记：先定向检索课程配套资源（仓库/讲义/书本章节/社区笔记），再深度抓取正文交叉验证，最后输出按章节组织的 Markdown 笔记（含核心概念、代码、坑点与参考链接）。当用户要求为某个视频课程/公开课做学习笔记、整理课程资料、把视频内容转成笔记、检索课程相关知识时使用。触发词：公开课笔记、课程笔记、学习笔记、视频课整理、Let's build、Karpathy、做笔记、整理成笔记。"
---

# 视频公开课结构化笔记工作流

把一门视频公开课（2 小时量级）变成一份可复用的结构化 Markdown 学习笔记。基于 2026-08 实战（Andrej Karpathy《Let's build the GPT Tokenizer》）验证：2h13m 视频 → 15 章中文笔记，全程 agent 检索整理。

## 适用场景

- 用户在学习某个视频公开课/教程，要求"检索相关资料"并"整理成笔记"
- 课程通常有配套代码仓库、讲义、社区解读（Karpathy 系课程几乎都有）
- 输出要求：结构化、带参考链接、可上传博客/知识库沉淀

## 一、工作流程（五步）

### Step 1：锁定课程信息

先确认五要素，后续所有检索都围绕它们展开：

```
视频标题 / 主讲人 / 时长 / 配套仓库（GitHub）/ 配套讲义或文字版
```

例：`Let's build the GPT Tokenizer` / Andrej Karpathy / 2h13m / `karpathy/minbpe` / `lecture.md`。

### Step 2：资源侦察（多轮定向搜索）

按"一手 → 二手"优先级组织检索，每轮一个明确意图：

1. **官方/一手**：视频本身、GitHub 仓库、仓库内 `README.md`/`lecture.md`/`exercise.md`、配套 Colab
2. **高质量文字版**：书本章节化重述（如 fast.ai 的 Complete Guide）、主讲人讲义
3. **社区笔记**：知名博主笔记（如 Simon Willison）、笔记聚合站（Glasp/Summify/Class Central）、中文解读

搜索技巧：
- 用 `课程名 + 关键词` 组合：`Karpathy tokenizer video notes`、`minbpe README`、`video "tokenization is a dark secret" special tokens byte fallback`
- 抓到仓库 README 后，用 CDN 镜像抓仓库内其他 md（`https://cdn.jsdelivr.net/gh/<user>/<repo>@master/<file>.md`），避免 raw.githubusercontent 429
- 网页正文抓取用 curl + 正则去标签（`re.sub(r'<[^>]+>',' ',t)` + `html.unescape`），长文分段拉取（按字节 offset 分块）

### Step 3：深度阅读提取（交叉验证）

- 多来源**交叉验证**：代码行为以官方仓库/官方库为准（如 `minbpe` 与 `tiktoken` 对拍输出一致）；概念解释可参考二手来源
- 提取五类素材：**核心概念**（定义+为什么）、**代码**（关键函数/训练循环）、**坑点**（易错细节，如 `errors="replace"`）、**数据/数字**（词表大小、token id）、**链接**（论文/博客/工具）
- 注意抓取 lecture.md / 书本章节这类**文字版**，信息密度远高于视频本身，可大幅减少无效检索

### Step 4：结构化输出

按固定骨架组织笔记（中文读者视角，可直接发博客）：

```markdown
# <课程名> —— <主讲人> 课程学习笔记
> 来源：视频链接 / 仓库 / 讲义（注明综合了哪些资料）
一、课程概况与资源（表格：视频/仓库/文字版/练习/工具）
二、为什么这门课重要（核心动机）
三~N、按课程主线分章节（概念 → 代码 → 坑点）
N+1、常见问题与怪癖解释（如适用）
N+2、要点总结（Key Takeaways，5~7 条）
N+3、推荐阅读链接汇总（全部带 URL）
```

要求：
- 保留关键代码块（语言标注）、表格、Markdown 链接
- 中文术语首次出现标注英文原名
- 所有引用来源附 URL；信息不确定处标注来源

### Step 5：沉淀与发布

- 笔记保存为独立 `.md` 文件；用户博客是 Hexo 时，转成文章（front matter：title/date/categories/tags/excerpt/toc）
- 需要时把流程本身固化为新 skill（见下），并同步发布到博客

## 二、实战要点（本次踩过的）

1. **对拍验证是金字标准**：`GPT4Tokenizer` 输出要与 `tiktoken` 的 `cl100k_base` 逐 token 一致，才算复现成功（对应 minbpe 的 inference 测试）
2. **两个隐蔽细节**：GPT-4 分词器有字节置换（`byte_shuffle`）与 merges 恢复问题（`recover_merges`），复现时必须处理，否则对不上
3. **别只搜一轮**：第一轮给方向（找到仓库/笔记），第二轮给细节（正则模式、特殊 token id），第三轮给边缘知识（SentencePiece 配置、SolidGoldMagikarp）
4. **引用留痕**：笔记里的每个论断尽量能回溯到来源链接，方便读者自查

## 三、交付清单

- 结构化 Markdown 笔记（15 章量级）：课程概况表 + 主线章节 + 怪癖/问题解释 + 要点总结 + 链接汇总
- 已上传博客（如适用）：Hexo 文章带 front matter，新建分类栏目
- skill 沉淀（本次流程本身）：`skills/course-notes-from-video-1.0.0/SKILL.md`
````

把上面这份 skill 丢给任何 agent，它就能独立复刻整个"视频课 → 结构化笔记"流程。而我写下这篇文章本身，就是让它传播的方式——**agent 时代，经验不是写给自己看的，是写给 agent 看的**。
