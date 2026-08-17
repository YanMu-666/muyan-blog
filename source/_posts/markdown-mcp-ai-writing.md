---
title: 我给在线 Markdown 接上了 MCP，现在 AI 能直接替我写稿了
date: 2026-08-14 20:00:00
updated: 2026-08-14 20:00:00
categories:
  - AI 工程
tags:
  - MCP
  - AI Agent
  - Markdown
  - 工具链
excerpt: MCP（Model Context Protocol）让 AI 从「聊天」进化成「干活」。这篇文章记录我把在线 Markdown 编辑器接入 MCP Server 的全过程。
toc: true
---

> 以前 AI 是替你"想"，接上 MCP 之后，AI 开始替你"做"了。

## 背景

我一直在维护一个在线 Markdown 编辑器（对，就是那个烧了一千刀后来开源的项目）。读者反馈最多的一句话是：

> "AI 能不能直接把我写的东西排版好？"

答案是可以，但绕了一圈。传统做法是让 AI 生成完整 Markdown，用户复制粘贴回编辑器——体验割裂，而且长文经常被截断。接入 MCP 之后，AI 可以**直接操作编辑器**：新建文档、写入内容、修改标题层级、插入代码块，一气呵成。

## 什么是 MCP

MCP（Model Context Protocol）是 Anthropic 2024 年底开源的协议，定位是"AI 应用的 USB-C 接口"：

- **Host**：AI 客户端（Claude Desktop、Cursor、各种 Agent）
- **Server**：暴露工具给 AI 用的服务（文件系统、数据库、浏览器……）
- **Client**：Host 内部负责和 Server 通信的组件

```mermaid
graph LR
  A[AI Model] --> B[Host]
  B --> C[MCP Client]
  C <-->|JSON-RPC 2.0| D[MCP Server]
  D --> E[你的应用/数据]
```

## 实现：Markdown 编辑器的 MCP Server

我基于官方 TypeScript SDK 写了一个极简 Server，暴露三个工具：

| 工具名 | 作用 | 参数 |
| --- | --- | --- |
| `new_doc` | 新建文档 | title, content? |
| `write_markdown` | 写入/覆盖内容 | doc_id, content |
| `patch_markdown` | 局部修改（按行号/标题定位） | doc_id, operation, target, content |

核心代码只有几十行：

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'md-editor',
  version: '1.0.0',
});

server.tool(
  'write_markdown',
  { doc_id: z.string(), content: z.string() },
  async ({ doc_id, content }) => {
    await docs.update(doc_id, content);
    return { content: [{ type: 'text', text: `✓ 已写入 ${doc_id}` }] };
  }
);

await server.connect(new StdioServerTransport());
```

## 效果

接好之后，我在 Claude 里说：

> "把我草稿箱里那篇关于 MCP 的文章，按三级标题重新组织，加一个对比表格，顺便在开头加引用块。"

AI 的响应变成了**一连串工具调用**——打开草稿、读取内容、重组标题、插入表格——最后告诉我"已全部完成，刷新看看"。整个过程不需要复制粘贴一次。

## 关键心得

1. **工具粒度要小**：`write_markdown` 一把梭很容易覆盖错误内容，`patch_markdown` 按标题定位更安全
2. **必须做撤销**：AI 写错内容后，`Ctrl+Z` 是用户最后的救命稻草，我在 Server 里加了快照机制
3. **返回要可读**：工具返回的 text 是 AI 判断下一步的依据，写清楚"做了什么、当前状态是什么"
4. **限流与配额**：本地 AI 还好，云端模型调用工具是有成本的，要做好每次调用的审计

## 下一步

MCP 的生态还在爆发期：文件系统、浏览器、数据库、GitHub 的官方 Server 都已就绪。我下一步打算给编辑器接上**浏览器 MCP**，让 AI 写完文章之后直接去查引用来源的真实性。

代码已开源，链接在 [GitHub](https://github.com/your-github-username) —— 欢迎 star，更欢迎提 PR。
