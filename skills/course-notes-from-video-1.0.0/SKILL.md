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
