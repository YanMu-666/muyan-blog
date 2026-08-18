---
title: "Let's build GPT: from scratch, in code, spelled out. —— Karpathy 课程学习笔记"
date: 2026-08-18 21:40:26
updated: 2026-08-18 21:40:26
categories:
  - 大模型知识
tags:
  - LLM
  - GPT
  - Transformer
  - 自注意力
  - Karpathy
  - 课程笔记
excerpt: "Karpathy《Let's build GPT: from scratch, in code, spelled out.》完整学习笔记：从 bigram 基线到自注意力、多头注意力、Transformer Block 与完整 GPT 模型的逐行拆解。"
toc: true
---
> 本笔记基于 Andrej Karpathy 于 2023 年 1 月发布的视频课程《Let's build GPT: from scratch, in code, spelled out.》（时长约 2 小时），并综合了配套仓库 [karpathy/ng-video-lecture](https://github.com/karpathy/ng-video-lecture)、[karpathy/nanoGPT](https://github.com/karpathy/nanoGPT) 与社区笔记整理而成。

---

## 一、课程概况与资源

| 项目 | 内容 |
|---|---|
| 视频 | [Let's build GPT: from scratch, in code, spelled out.](https://www.youtube.com/watch?v=kCc8FmEb1nY)（YouTube，约 2 小时，2023-01 发布） |
| 所属系列 | [Neural Networks: Zero to Hero](https://karpathy.ai/zero-to-hero.html)（第 5 讲，紧随 micrograd / makemore） |
| 配套仓库 | [karpathy/ng-video-lecture](https://github.com/karpathy/ng-video-lecture)（`bigram.py` + `gpt.py` 两个文件，各约 300 行，严格对应视频逐步写出的代码） |
| 正式工程 | [karpathy/nanoGPT](https://github.com/karpathy/nanoGPT)（教学版的"产品化"版本，含模型初始化等工程细节） |
| 数据集 | [tiny Shakespeare](https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt)（莎士比亚作品合集，1MB 级玩具数据集） |
| 前置课程 | micrograd（反向传播）、makemore（字符级语言模型与多层感知机） |
| 后续衔接 | [Let's build the GPT Tokenizer](https://www.youtube.com/watch?v=zduSFxRajkE)（把字符级分词升级为 BPE）、[Let's build GPT-2](https://www.youtube.com/watch?v=l8pRSuU81PU)（扩展到真正规模的 GPT-2） |
| 社区笔记 | [somesh.gitbook.io: GPT from scratch](https://somesh.gitbook.io/somesh-fengade/notes-and-courses/gpt-from-scratch.md)（逐概念整理） |

---

## 二、这门课在做什么（核心动机）

- **目标**：从零、用代码、逐行拼出一个 GPT（生成式预训练 Transformer），最终能生成以假乱真的莎士比亚风格文本。
- 语言模型 = **概率系统**：对同一个 prompt 能生成多个不同但都合理的回答（如 ChatGPT）。
- 底层架构 = **Transformer**：2017 年论文 [Attention is All You Need](https://arxiv.org/abs/1706.03762) 提出的神经网络架构。
- 核心思想：**下一个 token 预测**（自监督学习）。把莎士比亚全集当训练集，模型学的是"给定前文，下一个字符是什么"的概率分布。

---

## 三、数据准备：tiny Shakespeare + 字符级分词

### 3.1 读取与字符集

```python
with open('input.txt', 'r', encoding='utf-8') as f:
    text = f.read()                      # 整个数据集就是一个大字符串

chars = sorted(list(set(text)))          # 去重排序得到所有出现的字符
vocab_size = len(chars)                  # 65 个字符（含大小写字母、标点、换行）
```

### 3.2 编码/解码映射（最朴素的分词器）

```python
stoi = {ch: i for i, ch in enumerate(chars)}   # char -> int
itos = {i: ch for i, ch in enumerate(chars)}   # int -> char
encode = lambda s: [stoi[c] for c in s]        # 字符串 -> 整数列表
decode = lambda l: ''.join([itos[i] for i in l]) # 整数列表 -> 字符串
```

- 这是**字符级分词**：每个字符一个 token。真实 GPT 用的是 BPE 子词分词（见 Tokenizer 课程），本课先用最简单版本。
- 数据划分：前 90% 训练、后 10% 验证（`n = int(0.9*len(data))`）。

---

## 四、数据加载与训练循环

### 4.1 取一个 batch

```python
def get_batch(split):
    data = train_data if split == 'train' else val_data
    ix = torch.randint(len(data) - block_size, (batch_size,))   # 随机起点
    x = torch.stack([data[i:i+block_size] for i in ix])          # 输入：block_size 个字符
    y = torch.stack([data[i+1:i+block_size+1] for i in ix])      # 目标：右移一位
    x, y = x.to(device), y.to(device)
    return x, y
```

- **block_size**（=8/256）：最大上下文长度，即"模型最多看前多少个字符"；
- **batch_size**（=32/64）：一次并行处理的独立序列数（GPU 并行友好）；
- x 与 y 是"平移一对"：给定 x 的每个位置，要预测 y 的对应位置。

### 4.2 平滑的损失估计

```python
@torch.no_grad()
def estimate_loss():
    out = {}
    model.eval()                          # 评估模式：关闭 dropout 等
    for split in ['train', 'val']:
        losses = torch.zeros(eval_iters)
        for k in range(eval_iters):
            X, Y = get_batch(split)
            logits, loss = model(X, Y)
            losses[k] = loss.item()
        out[split] = losses.mean()        # 多个 batch 平均，损失更平滑
    model.train()
    return out
```

- `@torch.no_grad()`：推理时不计算梯度，省显存；
- `model.eval() / model.train()`：切换评估/训练模式（影响 Dropout 行为）。

---

## 五、Bigram 语言模型（最简单的基线）

```python
class BigramLanguageModel(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        # 每个 token 直接从一个查找表读出"下一个 token 的 logits"
        self.token_embedding_table = nn.Embedding(vocab_size, vocab_size)

    def forward(self, idx, targets=None):
        logits = self.token_embedding_table(idx)   # (B,T,C)
        if targets is None:
            loss = None
        else:
            B, T, C = logits.shape
            logits = logits.view(B*T, C)           # 展平后算交叉熵
            targets = targets.view(B*T)
            loss = F.cross_entropy(logits, targets)
        return logits, loss

    def generate(self, idx, max_new_tokens):
        for _ in range(max_new_tokens):
            logits, loss = self(idx)               # 前向
            logits = logits[:, -1, :]              # 只看最后时间步
            probs = F.softmax(logits, dim=-1)      # 转概率
            idx_next = torch.multinomial(probs, num_samples=1)  # 采样
            idx = torch.cat((idx, idx_next), dim=1) # 拼回去
        return idx
```

关键点：
- **Bigram = 只根据上一个字符预测下一个**，完全不看更早的上下文；
- 一个 `nn.Embedding(vocab_size, vocab_size)` 就完成了全部"模型"：查表直接得 logits；
- 初始损失理论值：均匀分布下 `-ln(1/65) ≈ 4.17`（视频里实测验证）；
- 训练（AdamW，lr=1e-2，3000 步）后 val loss 降到 **≈2.5**；
- 生成时 `softmax` 后 `torch.multinomial` **采样**（不是取 argmax，保留随机性）；
- 生成的文本毫无意义（"大舅二舅"级别的乱码），但**格式上已经像莎士比亚**——这就是基线的意义。

---

## 六、自注意力机制（课程核心，占视频大半篇幅）

### 6.1 为什么需要"通信"

Bigram 的缺陷：每个字符完全独立决策，**token 之间不交流**。语言模型需要让序列中的 token 互相传递信息——例如"Harry"后面的空格应该让模型期待"Potter"。

### 6.2 三步推导（Karpathy 的经典教学路径）

**第 1 步：平均池化（太粗糙）**
对每个位置，取它之前所有 token embedding 的平均。能通信但无差别——所有历史 token 权重相同。

**第 2 步：加权和（手工权重）**
给不同位置的 token 不同的权重（如最近的重要、远的次要），但仍然不是数据驱动的。

**第 3 步：key / query / value（真正的 self-attention）**

```python
wei = q @ k.transpose(-2, -1) * k.shape[-1]**-0.5  # (B,T,T) 注意力分数
wei = wei.masked_fill(self.tril[:T, :T] == 0, float('-inf'))  # 因果掩码
wei = F.softmax(wei, dim=-1)                        # 归一化成权重
out = wei @ v                                       # 加权聚合 (B,T,hs)
```

- **Query（查询）**：我在找什么信息；
- **Key（键）**：我有什么信息可以分享；
- **Value（值）**：你找到我后，我实际告诉你的内容；
- 注意力分数 = query 与 key 的点积，softmax 归一化成权重，再对 value 加权求和；
- **这是数据驱动的加权通信**：每个 token 自己决定"关注谁、多关注"。

### 6.3 缩放因子与因果掩码

- **缩放 `* head_size**-0.5`**：点积结果随维度变大而方差变大，softmax 会饱和（梯度消失）。除以 √d 把方差拉回 1——这就是 "scaled dot-product attention" 的 "scaled"；
- **因果掩码（causal mask）**：`torch.tril` 下三角矩阵 + `masked_fill(0, -inf)`，让位置 t 只能看到 ≤t 的 token。**未来信息必须隐藏**，否则训练时模型"作弊"（答案就在输入里），生成时也无法自回归；
- 实际实现里 `tril` 注册为 `register_buffer`（不是可训练参数，随模型搬设备）。

### 6.4 多头注意力

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, num_heads, head_size):
        super().__init__()
        self.heads = nn.ModuleList([Head(head_size) for _ in range(num_heads)])
        self.proj = nn.Linear(head_size * num_heads, n_embd)   # 输出投影
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        out = torch.cat([h(x) for h in self.heads], dim=-1)    # 并行 head 拼接
        out = self.dropout(self.proj(out))
        return out
```

- 多个 head **并行**做不同的注意力（"多种关注模式"），结果拼接后经 `proj` 线性投影回原维度；
- `head_size = n_embd // n_head`（如 384/6 = 64）；
- 类比：多头像"多个视角同时开会"，每个 head 关注不同类型的关系。

---

## 七、前馈网络与 Transformer Block

### 7.1 前馈网络（计算）

```python
class FeedFoward(nn.Module):
    """ a simple linear layer followed by a non-linearity """
    def __init__(self, n_embd):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_embd, 4 * n_embd),   # 升维 4 倍
            nn.ReLU(),
            nn.Linear(4 * n_embd, n_embd),   # 降回原维度
            nn.Dropout(dropout),
        )
```

### 7.2 Transformer Block = 通信 + 计算

```python
class Block(nn.Module):
    """ Transformer block: communication followed by computation """
    def __init__(self, n_embd, n_head):
        head_size = n_embd // n_head
        self.sa = MultiHeadAttention(n_head, head_size)
        self.ffwd = FeedFoward(n_embd)
        self.ln1 = nn.LayerNorm(n_embd)      # 预归一化（pre-norm）
        self.ln2 = nn.LayerNorm(n_embd)

    def forward(self, x):
        x = x + self.sa(self.ln1(x))         # 通信：残差 + 预 LayerNorm
        x = x + self.ffwd(self.ln2(x))       # 计算：残差 + 预 LayerNorm
        return x
```

- **残差连接**（`x + ...`）：梯度可以"抄近道"流过深层网络，防止退化；
- **预 LayerNorm**（pre-norm）：归一化在注意力/前馈**之前**做（视频中讨论过 post-norm 与 pre-norm 的区别，最终采用 pre-norm，训练更稳定）；
- 一句话总结 Block：**先让 token 之间通信（注意力），再各自独立计算（前馈）**。

---

## 八、完整的 GPT 模型

```python
class GPTLanguageModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.token_embedding_table = nn.Embedding(vocab_size, n_embd)   # 字符 -> 向量
        self.position_embedding_table = nn.Embedding(block_size, n_embd) # 位置 -> 向量
        self.blocks = nn.Sequential(*[Block(n_embd, n_head=n_head) for _ in range(n_layer)])
        self.ln_f = nn.LayerNorm(n_embd)      # 最终层归一化
        self.lm_head = nn.Linear(n_embd, vocab_size)  # 输出 logits
        self.apply(self._init_weights)        # 权重初始化（视频后补）

    def forward(self, idx, targets=None):
        B, T = idx.shape
        tok_emb = self.token_embedding_table(idx)                    # (B,T,C)
        pos_emb = self.position_embedding_table(torch.arange(T, device=device))  # (T,C)
        x = tok_emb + pos_emb                # 词嵌入 + 位置嵌入
        x = self.blocks(x)
        x = self.ln_f(x)
        logits = self.lm_head(x)             # (B,T,vocab_size)
        # ... loss 计算同 bigram
```

- **Token embedding + Position embedding**：attention 本身"不知道顺序"，必须显式注入位置信息（这里是可学习的绝对位置嵌入表，长 256）；
- 小配置超参数：`n_embd=384, n_head=6, n_layer=6, block_size=256, dropout=0.2`，参数约 **10.7M**；
- **模型初始化**（视频后补的关键点）：`_init_weights` 把 Linear/Embedding 初始化为 `N(0, 0.02)`。Karpathy 在 README 里专门说明：视频里没细讲初始化，但**好的初始化对收敛速度影响很大**，正式实现见 nanoGPT 的 `model.py`；
- 生成时 `idx_cond = idx[:, -block_size:]`：**只保留最后 block_size 个 token** 作为上下文（否则序列超长会越界）。

---

## 九、训练与生成（结果）

```python
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
# 5000 步训练，每 500 步打印 train/val loss
# 生成：
context = torch.zeros((1, 1), dtype=torch.long, device=device)
print(decode(m.generate(context, max_new_tokens=500)[0].tolist()))
```

| 阶段 | val loss（视频实测） |
|---|---|
| 均匀随机初始 | ≈4.17（= ln 65） |
| Bigram 训练后 | ≈2.5 |
| GPT 训练后 | **≈1.5** |

- 从 4.17 → 2.5 → 1.5，每一步都能看到模型"变聪明"；1.5 意味着模型对下一个字符平均只有 e^1.5 ≈ 4.5 个合理候选；
- 生成的 500 字符输出是**格式正确但内容荒诞的莎士比亚**（"VIOLA: ..." 之类的角色名和台词结构）；
- 关键工程细节：`torch.manual_seed(1337)` 保证可复现。

---

## 十、关键洞见与要点总结

1. **语言模型 = 下一个 token 预测**：整个 GPT 就是"给定前文，预测下一个字符/子词"的自监督学习，训练数据无需人工标注；
2. **Self-attention 是"通信"，FFN 是"计算"**：注意力让 token 按数据驱动的方式互相交换信息，前馈网络让每个位置独立"思考"；
3. **因果性是自回归的基石**：三角掩码保证模型看不到未来，训练与生成才能一致；
4. **位置信息必须显式注入**：注意力是"集合操作"（无序），没有位置编码模型就不知道语序；
5. **缩放点积是工程细节也是理论细节**：√d 缩放防止 softmax 饱和，这是 Attention 论文的命名来源；
6. **残差 + LayerNorm + Dropout** 三件套让深层 Transformer 可训练、防过拟合；
7. **小处见大**：65 字符的玩具模型 ≈ 10.7M 参数，架构与 GPT-4 同构——把 vocab 换成 BPE、数据换成互联网，就是真 GPT；
8. **初始化很重要**：同样的架构，随机初始化位置不同，收敛速度天差地别（nanoGPT 的 `_init_weights`）。

---

## 十一、与其他课程的衔接

- **前置**：micrograd（理解反向传播）、makemore（字符级语言模型、多层感知机、BatchNorm）；
- **本课**：从 bigram 逐步进化到完整 Transformer（GPT）；
- **后续**：
  - *Let's build the GPT Tokenizer*：把字符级分词升级为 GPT 实际使用的 BPE 子词分词，并解释大量 LLM 怪癖；
  - *Let's build GPT-2*：把 nanoGPT 扩展到 GPT-2 的真实规模（124M 参数、更大的数据与上下文），讲分布式训练；
  - 完整路线见 [karpathy.ai/zero-to-hero.html](https://karpathy.ai/zero-to-hero.html)。

---

## 十二、推荐阅读链接汇总

- 视频：[Let's build GPT: from scratch, in code, spelled out.](https://www.youtube.com/watch?v=kCc8FmEb1nY)
- 配套仓库：[karpathy/ng-video-lecture](https://github.com/karpathy/ng-video-lecture)（bigram.py / gpt.py）
- 正式工程：[karpathy/nanoGPT](https://github.com/karpathy/nanoGPT)（含模型初始化等工程细节）
- 系列主页：[Neural Networks: Zero to Hero](https://karpathy.ai/zero-to-hero.html)
- 数据集：[tiny Shakespeare](https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt)
- 论文：[Attention is All You Need (2017)](https://arxiv.org/abs/1706.03762)
- 社区笔记：[somesh.gitbook.io: GPT from scratch](https://somesh.gitbook.io/somesh-fengade/notes-and-courses/gpt-from-scratch.md)
- 中文报道：[机器之心：特斯拉前 AI 总监教你手搓 GPT 大模型](https://cloud.tencent.com/developer/article/2250301)
- B 站搬运：[让我们一起构建 ChatGPT，用代码，拼出来](https://www.bilibili.com/video/BV1nT411a7gS/)
- 相关课程：[Let's build the GPT Tokenizer](https://www.youtube.com/watch?v=zduSFxRajkE)（我上一篇笔记）、[Let's build GPT-2](https://www.youtube.com/watch?v=l8pRSuU81PU)
