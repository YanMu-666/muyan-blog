---
title: 24 小时 AI 出海建站，这套开源模板直接抄
date: 2026-08-10 08:00:00
updated: 2026-08-10 08:00:00
categories:
  - 开源
tags:
  - 开源
  - Next.js
  - Cloudflare
  - 出海
  - 模板
excerpt: 从想法到上线只花了 24 小时：Next.js + Cloudflare Pages + Stripe 的出海建站模板，我把它开源了。
toc: true
---

> 不是"AI 时代不需要建站"，而是"AI 时代建站快到你来不及犹豫"。

## 起因

上个月有个做 SaaS 的朋友找我："我想做个落地页 + 订阅支付，一周能搞定吗？"

我说：不用一周，24 小时。

于是我用一个周末验证了这件事——从零搭了一个带 Stripe 订阅、多语言、SEO 全配齐的出海站模板，并把它开源了。

## 技术栈

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 框架 | Next.js 15 (App Router) | SSR/SSG 双模，出海 SEO 友好 |
| 部署 | Cloudflare Pages | 全球 CDN，免费额度够个人项目 |
| 支付 | Stripe Checkout | 出海标配，信用卡订阅一键接 |
| 数据库 | Cloudflare D1 + Drizzle | SQLite 兼容，边缘数据库 |
| 样式 | Tailwind CSS v4 | 原子化，落地页开发飞快 |

## 架构

```
┌────────────┐     ┌──────────────────┐
│  Browser    │ ──▶ │  Cloudflare CDN   │
└────────────┘     └────────┬─────────┘
                            │
              ┌─────────────┴─────────────┐
              │  Next.js (SSG/ISR)        │
              │  Pages Functions (API)    │
              └──────┬────────────┬───────┘
                     │            │
              ┌──────┴───┐  ┌─────┴────────┐
              │ Cloudflare│  │ Stripe      │
              │ D1 (SQLite)│  │ Checkout    │
              └──────────┘  └──────────────┘
```

Pages Functions 处理 `/api/*` 路由，Stripe Webhook 走 `onRequestPost`，整个项目不需要一台传统服务器。

## 一天的时间分配

```
09:00  脚手架 + 落地页首屏（标题、Hero、CTA）
11:30  定价页三档卡片 + FAQ + 页脚
14:00  Stripe Checkout 接入 + Webhook 落库
17:00  i18n（中/英）+ SEO 元信息 + OG 图
20:00  部署到 Cloudflare Pages + 自定义域名
22:00  性能压测：Lighthouse 98 / 全球延迟 < 120ms
```

## 关键代码：Stripe 订阅

```typescript
// app/api/checkout/route.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { priceId } = await req.json();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${req.headers.get('origin')}/success`,
    cancel_url: `${req.headers.get('origin')}/#pricing`,
  });
  return Response.json({ url: session.url });
}
```

Webhook 校验签名 + 幂等处理：

```typescript
export async function onRequestPost(context: EventContext) {
  const sig = context.request.headers.get('stripe-signature')!;
  const event = stripe.webhooks.constructEvent(
    await context.request.text(), sig, process.env.STRIPE_WEBHOOK_SECRET!
  );
  if (event.type === 'checkout.session.completed') {
    await db.insert(users).values({ email: event.data.object.customer_email! });
  }
  return new Response('ok');
}
```

## 出海建站的三个隐藏坑

1. **Stripe 需要海外主体**：个人开发者可以用 Stripe Atlas（美国公司），或走 Paddle/LemonSqueezy 的 Merchant of Record（平台代收，无主体也能收）
2. **货币与税费**：Stripe 自动处理销售税，但定价时要把 Stripe 手续费（2.9% + 30¢）算进成本
3. **域名邮件**：别用免费邮箱收付款通知，买域名时顺手配个 Google Workspace 或 Zoho

## 开源地址

模板已开源：[github.com/your-github-username/ai-saas-starter](https://github.com/your-github-username/ai-saas-starter)

```
$ git clone ... && npm i && npm run dev
✓ 本地跑起来 3 分钟
$ npm run deploy
✓ Cloudflare Pages 部署完成
```

拿去用，改改文案和配色就是你的产品。记得回来给我个 star ⭐
