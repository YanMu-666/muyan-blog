---
title: 闲置的 3090 不要丢，本地部署获取无限 token！
date: 2026-08-17 21:03:00
updated: 2026-08-17 21:03:00
categories:
  - 全栈开发
tags:
  - GPU
  - 本地部署
  - LLM
  - vLLM
excerpt: 把吃灰的 3090 变成私有 LLM 服务：vLLM + OpenWebUI 一条龙，告别 API 限流，token 想用多少用多少。
toc: true
---

> 2026 年了，谁家抽屉里还没块吃灰的 3090？与其让它在矿场发光发热，不如拿回来当你的私人 token 印钞机。

## 为什么是 3090

3090 是二手市场性价比最高的卡之一：24GB 显存、350W 功耗、无 NVLink 桥接的烦恼，关键是**便宜**。现在一张二手 3090 的价格大概能换 30 万 token 的 API 调用——听起来不少，但 API 是租的，卡是**自己的**。

本地部署的核心收益不是省钱，而是三件事：

1. **无限 token**：没有限流、没有额度、没有"高峰期排队"
2. **数据不出门**：代码、文档、私有知识全留在自己机器上
3. **完全可控**：量化精度、上下文长度、并发策略全部自己说了算

## 部署方案：vLLM + OpenWebUI

选型思路：推理引擎用 vLLM（吞吐高、显存管理好），前端用 OpenWebUI（类 ChatGPT 的界面，支持多模型切换、RAG、函数调用）。

### 第一步：拉镜像

```bash
# 推理引擎
docker pull vllm/vllm-openai:latest

# 前端
docker pull ghcr.io/open-webui/open-webui:main
```

### 第二步：启动 vLLM

以 Qwen3-8B 为例（4bit 量化，24GB 显存绰绰有余）：

```bash
docker run --gpus all --shm-size=8g \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model Qwen/Qwen3-8B \
  --quantization gptq \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9
```

启动后即获得一个 OpenAI 兼容接口：`http://localhost:8000/v1`，任何 OpenAI SDK 都能直接对接。

### 第三步：启动 OpenWebUI

```bash
docker run -d -p 3000:8080 \
  -v open-webui:/app/backend/data \
  -e OPENAI_API_BASE_URL=http://host.docker.internal:8000/v1 \
  ghcr.io/open-webui/open-webui:main
```

打开 `http://localhost:3000` 注册账号，就能在浏览器里和你的私有模型聊天了。

## 性能实测

| 配置 | 输入吞吐 | 输出吞吐 | 首 token 延迟 |
| --- | --- | --- | --- |
| Qwen3-8B GPTQ 4bit | 2450 tok/s | 1350 tok/s | ~180ms |
| Llama-3.1-8B AWQ 4bit | 2210 tok/s | 1280 tok/s | ~210ms |
| DeepSeek-R1-Distill-7B | 1980 tok/s | 890 tok/s | ~240ms |

> 数据基于单卡 3090 + vLLM 0.8.x，具体数值因显存、温度、功耗墙而异。

## 几个坑

1. **供电**：3090 峰值 350W，别拿 450W 的老电源硬扛，会黑屏重启
2. **散热**：机箱风道不好的话，半小时后开始降频，建议 80% 功耗墙
3. **`--gpu-memory-utilization`**：设太高会 OOM，0.85~0.92 是安全区
4. **macOS 用户**：别想了，Apple Silicon 跑量化小模型可以，跑 8B 就别指望了

## 小结

```
$ ./start.sh
✓ vLLM 已启动 (0.8.2)  port 8000
✓ OpenWebUI 已启动   port 3000
$ curl localhost:8000/v1/chat/completions ...
✓ 返回 200, token 余额: ∞
```

本地部署没有想象中那么难——一条 docker 命令的事。真正难的是**开始**：把卡从抽屉里拿出来。
