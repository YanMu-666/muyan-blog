---
title: "Let's build the GPT Tokenizer —— Karpathy 课程学习笔记"
date: 2026-08-18 21:23:51
updated: 2026-08-18 21:23:51
categories:
  - 大模型知识
tags:
  - LLM
  - Tokenizer
  - BPE
  - Karpathy
  - 课程笔记
excerpt: Karpathy《Let's build the GPT Tokenizer》完整学习笔记：从字符级分词、UTF-8 与字节级 BPE 算法、正则预分词、特殊 Token，到 SentencePiece 与各种 LLM 怪癖的 tokenization 根源。
toc: true
---
> 本笔记基于 Andrej Karpathy 于 2024 年 2 月发布的视频课程《Let's build the GPT Tokenizer》（时长约 2 小时 13 分钟），并综合了官方仓库、社区文章与讲义整理而成。

---

## 一、课程概况与资源

| 项目 | 内容 |
|---|---|
| 视频 | [Let's build the GPT Tokenizer](https://www.youtube.com/watch?v=zduSFxRajkE)（YouTube，2h13m） |
| 代码仓库 | [karpathy/minbpe](https://github.com/karpathy/minbpe)（MIT 协议，纯 Python，代码极简且有详细注释） |
| 视频文字版 | [minbpe/lecture.md](https://github.com/karpathy/minbpe/blob/master/lecture.md)（视频逐字稿/讲义） |
| 进阶练习 | [minbpe/exercise.md](https://github.com/karpathy/minbpe/blob/master/exercise.md)（分步练习：从零构建 GPT-4 分词器） |
| 前置课程 | [Let's build GPT from scratch](https://www.youtube.com/watch?v=kCc8FmEb1nY)（其中用了最简单的字符级分词） |
| 在线工具 | [Tiktokenizer](https://tiktokenizer.vercel.app)（浏览器里实时可视化分词） |
| 官方库 | [openai/tiktoken](https://github.com/openai/tiktoken)（OpenAI 官方分词推理库，Rust 实现） |
| 详细文字版 | [fast.ai: Let's Build the GPT Tokenizer: A Complete Guide](https://www.fast.ai/posts/2025-10-16-karpathy-tokenizers.html)（把视频翻译成书本章节，含代码与截图） |
| 社区笔记 | [Simon Willison 的点评](https://simonwillison.net/2024/Feb/20/lets-build-the-gpt-tokenizer/)、[Glasp 笔记](https://glasp.co/youtube/zduSFxRajkE) |

**Karpathy 对 Tokenization 的评价**：tokenization 是 LLM 里"相对复杂、粗糙"（complex and gnarly）的一个组件，但它又必须理解——因为 LLM 的很多怪癖（看起来像是网络架构问题）其实都源于 tokenization。

---

## 二、为什么分词（Tokenization）如此重要

### 2.1 什么是 Tokenization

- 人类语言是**字符串**，而 Transformer 吃的是**整数序列**。
- 分词 = 把字符串 ↔ 整数序列（token）互相转换的"翻译层"，token 是 LLM 输入的基本"原子"。
- 每个 token 整数作为索引，去 embedding 表里"拔出"一行向量，喂给 Transformer。

### 2.2 课程开篇的灵魂拷问（都归因于 Tokenization）

- 为什么 LLM 拼写不好？→ **Tokenization**
- 为什么 LLM 不会反转字符串这类简单字符串处理？→ **Tokenization**
- 为什么 LLM 在非英语语言（如日语）上表现差？→ **Tokenization**
- 为什么 LLM 简单算术算不好？→ **Tokenization**
- 为什么 GPT-2 写 Python 代码格外吃力？→ **Tokenization**
- 为什么 LLM 看到 `<|endoftext|>` 会突然停止？→ **Tokenization**
- 为什么 API 会警告 "trailing whitespace"？→ **Tokenization**
- 为什么提到 "SolidGoldMagikarp" 模型就发疯？→ **Tokenization**
- 为什么给 LLM 传数据用 YAML 比 JSON 好？→ **Tokenization**
- 为什么 LLM 不是真正的端到端语言建模？→ **Tokenization**

> 结论：**遇到 LLM 的诡异行为，先怀疑 tokenization。**

### 2.3 可视化直观感受（Tiktokenizer）

- "Tokenization" 会被切成 2 个 token：`30642` + `1634`；
- `" is"`（注意**前面带空格**）是一个 token `318`，`" at"` 是 `379`，`" the"` 是 `262`——**空格是 token 的一部分**，可视化时通常被隐藏，但绝对存在；
- 数字切分非常"随意"：`127` 是 1 个 token，`677` 却是 `" 6"` + `"77"` 两个 token；模型必须自己学会这些碎片组合成数字。

---

## 三、从字符级分词说起（上一节课的朴素做法）

在《Let's build GPT from scratch》中用的是最朴素的**字符级分词**：

```python
chars = sorted(list(set(text)))          # 莎士比亚数据集中出现的所有字符
vocab_size = len(chars)                  # 只有 65 个
stoi = {ch: i for i, ch in enumerate(chars)}
itos = {i: ch for i, ch in enumerate(chars)}
encode = lambda s: [stoi[c] for c in s]  # 字符串 -> 整数列表
decode = lambda l: ''.join([itos[i] for i in l])
```

问题：这只能处理训练集里出现过的字符，词表只有 65，序列极长，无法支撑真正的 LLM。

---

## 四、Unicode 与 UTF-8 基础（为什么要用字节）

- Python 字符串是 **Unicode code point（码点）序列**。Unicode 15.1 定义了 **149,813 个字符、161 种文字**，且标准还在不断演进——直接拿码点当 token 会导致词表巨大且不稳定。
- `ord('h')=104`，`ord('🤗')=128000`，`ord('안')=50504`（不同文字字符码点差异巨大）。
- 解决方案是**编码**：Unicode 定义了 UTF-8 / UTF-16 / UTF-32 三种编码，把码点变成字节串。
  - **UTF-8**：变长 1~4 字节，兼容 ASCII，是互联网主流（[UTF-8 Everywhere Manifesto](https://utf8everywhere.org/)）；韩语 `안녕하세요 👋 hello world 🤗` 编码后是 `[236, 149, 136, ...]` 的字节列表。
  - UTF-16/UTF-32 有大量冗余零字节，浪费。
- 字节级词表只有 **256 个**，太小 → 序列太长，注意力窗口装不下 → 需要**压缩字节序列**——这就是 BPE 的动机。
- 补充：2023 年有一篇论文尝试**无分词建模**（直接喂字节 + 层级化 Transformer），作者声称"tokenization-free autoregressive sequence modeling at scale 是可行的"，但至今未被大规模验证，仍是研究热点。

---

## 五、BPE（Byte Pair Encoding）算法 —— 课程核心

### 5.1 算法思想（Wikipedia 经典例子）

对 `aaabdaaabac` 做 3 次合并：

1. 出现最多的字节对是 `aa`（2 次）→ 铸成新 token `Z=aa`：`ZabdZabac`
2. 出现最多的是 `ab` → 铸成 `Y=ab`：`ZYdZYac`
3. 出现最多的是 `ZY` → 铸成 `X=ZY`：`XdXac`

结果：11 个字符 → 5 个 token，词表从 4 扩到 7。**BPE 就是"反复找出现最多的相邻 pair，合并成新 token"的迭代压缩过程。**

### 5.2 两个核心函数

```python
def get_stats(ids, counts=None):
    """统计相邻 pair 出现次数。例：[1,2,3,1,2] -> {(1,2):2, (2,3):1, (3,1):1}"""
    counts = {} if counts is None else counts
    for pair in zip(ids, ids[1:]):        # Pythonic 的相邻遍历
        counts[pair] = counts.get(pair, 0) + 1
    return counts

def merge(ids, pair, idx):
    """把 ids 中所有连续的 pair 替换成新 token idx。例：[1,2,3,1,2], (1,2), 4 -> [4,3,4]"""
    newids = []
    i = 0
    while i < len(ids):
        if ids[i] == pair[0] and i < len(ids) - 1 and ids[i+1] == pair[1]:
            newids.append(idx); i += 2
        else:
            newids.append(ids[i]); i += 1
    return newids
```

### 5.3 训练循环（tokenizer 的"训练"= 学习 merges）

```python
vocab_size = 276            # 超参数：目标词表大小
num_merges = vocab_size - 256   # 起始有 256 个字节 token，所以合并次数 = 目标 - 256
tokens = list(text.encode("utf-8"))
for i in range(num_merges):
    stats = get_stats(tokens)
    pair = max(stats, key=stats.get)   # 出现最多的 pair
    idx = 256 + i                      # 新 token id 从 256 开始递增
    tokens = merge(tokens, pair, idx)
    merges[(pair)] = idx               # 记录合并规则
```

要点：
- **前 256 个 token 永远是原始字节**，之后每次合并"铸"一个新 token；
- merges 形成一个**二叉森林**（从叶子字节往上两两合并，有多个根），不是单棵树；
- 新铸的 token 在后续轮次中**也可以参与合并**（如第 20 轮把 256 和 259 合并成 275）；
- 训练效果：2.4 万字节 → 1.9 万 token，压缩比约 1.27；词表越大压缩比越高。

### 5.4 分词器训练是独立于 LLM 训练的阶段

```
原始文本(分词器训练集) --BPE--> 词表 + merges --(编码)--> token 序列 --(训练)--> Transformer
```

- 分词器有自己的**独立训练集**，可以和 LLM 训练集不同（比如刻意混入多种语言、代码，让日文/代码的合并更多、token 更省）；
- LLM 训练时所有数据先过一遍分词器，把原始文本丢掉，只留 token 序列。

### 5.5 Decode（token -> 文本）

```python
vocab = {idx: bytes([idx]) for idx in range(256)}   # 先放 256 个原始字节
for (p0, p1), idx in merges.items():
    vocab[idx] = vocab[p0] + vocab[p1]               # 合并 token 的字节 = 两个子 token 字节拼接

def decode(ids):
    tokens = b"".join(vocab[idx] for idx in ids)
    text = tokens.decode("utf-8", errors="replace")  # 关键：errors="replace"
    return text
```

⚠️ **坑**：不是所有 token 序列都是合法 UTF-8（比如单独解码字节 128 会抛 `UnicodeDecodeError`）。所以 decode 必须用 `errors="replace"`（OpenAI 官方代码也是这么做的）。**看到输出里的 �（替换字符），说明模型产出了非法 token 序列。**

### 5.6 Encode（文本 -> token）

```python
def encode(text):
    tokens = list(text.encode("utf-8"))
    while True:
        stats = get_stats(tokens)
        if len(tokens) < 2:      # 处理空/单 token 的边界情况
            break
        pair = min(stats, key=lambda p: merges.get(p, float("inf")))  # 取合并顺序最早的可合并 pair
        if pair not in merges:
            break
        tokens = merge(tokens, pair, idx := merges[pair])
    return tokens
```

- 必须**按 merges 的插入顺序**从小到大合并（后面的合并依赖前面铸出的 token）；
- 性质：`decode(encode(text)) == text` 恒成立；但**反过来不成立**（非法 token 序列无法解码）——所以"编码→解码"是恒等，而"解码→编码"不是。

---

## 六、GPT-2 / GPT-4 分词器：正则预分词（Regex Pre-tokenization）

### 6.1 为什么需要正则切分

朴素 BPE 会把 "dog."、"dog!"、"dog?" 等合并成不同 token，浪费词表槽位（GPT-2 论文原话："BPE includes many versions of common words like 'dog'... 为了避免，我们禁止 BPE 跨字符类别合并"）。

解决：**先用正则把文本按类别切成 chunk（字母/数字/标点/空白），只在 chunk 内部做 BPE，禁止跨类别合并。**

### 6.2 GPT-2 正则模式

```python
import regex as re   # 注意是第三方 regex 库（支持 \p{L} 等 Unicode 属性）
pat = re.compile(r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+""")
```

含义：
- `'s|'t|'re|...`：英语缩写保留为一个整体；
- ` ?\p{L}+`：可选空格 + 一个或多个任意语言的字母；
- ` ?\p{N}+`：可选空格 + 数字；
- ` ?[^\s\p{L}\p{N}]+`：可选空格 + 标点/符号；
- `\s+(?!\S)`：负向前瞻，把连续空格中"除了最后一个"都吃掉，**保证最后一个空格可以跟后面的单词合并**（如 `" world"` 成为一个 token）；
- `\s+`：兜底。

**GPT-2 模式的已知缺陷**（Karpathy 特意演示）：
1. 大写缩写会切碎：`"HOW'S"` 里撇号变成独立 token（因为没加 ignorecase）；
2. Unicode 撇号（’）与 ASCII 撇号（'）处理不一致；
3. 训练代码从未发布，OpenAI 只发布了推理代码；实际训练时还额外禁止了空格合并（在 tiktokenizer 里能看到 Python 代码的每个空格都是独立 token 220）。

### 6.3 GPT-4 正则模式（cl100k_base）

```python
pat = re.compile(r"""(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{2,}|[^\r\n\p{L}\p{N}]?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+""")
```

相对 GPT-2 的改进：
- `(?i:...)` **大小写不敏感**地匹配缩写（修复大写问题）；
- 数字改为 **`\p{N}{2,}`（至少 2 位数字）**，防止超长数字串合并成单个 token；
- 更好的换行处理 `\s*[\r\n]+`（可合并多个连续换行——GPT-4 会把 Python 代码里的连续空格合并成单个 token）；
- 词表从 ~50,257 涨到 **100,277**。

### 6.4 tiktoken 库

```python
import tiktoken
enc_gpt2 = tiktoken.get_encoding("gpt2")          # 50,257 tokens
enc_gpt4 = tiktoken.get_encoding("cl100k_base")   # 100,277 tokens（GPT-4）
ids = enc_gpt4.encode("hello world!!!? (안녕하세요!) 😉")
text = enc_gpt4.decode(ids)
```

- tiktoken 是 **推理专用**（只有 encode/decode），**没有 train**；所有定义在 `tiktoken/openai_public.py` 中，公开了 `pat_str`、`mergeable_ranks`、`special_tokens` 三要素；
- tiktoken 用 Rust 实现，内部用**线程本地正则**做性能优化。

---

## 七、特殊 Token（Special Tokens）

### 7.1 什么是特殊 token

独立于 BPE 合并过程、直接"按字符串整体替换"的 token，用于给数据流加结构：

- **GPT-2**：只有 `<|endoftext|>` = **50256**（词表 50,257 = 256 字节 + 50,000 merges + 1 个特殊 token），用于分隔训练文档；
- **GPT-4（cl100k_base）**：
  - `<|endoftext|>` = 100257
  - `<|fim_prefix|>` = 100258、`<|fim_middle|>` = 100259、`<|fim_suffix|>` = 100260（**FIM = Fill in the Middle**，代码补全用，源自论文 *Efficient Training of Language Models to Fill in the Middle*）
  - `<|endofprompt|>` = 100276
- **ChatGPT 系**：`<|im_start|>` = 100264、`<|im_end|>` = 100265（im = "imaginary monologue"），用它们包裹每一轮 user/assistant 消息来组织对话结构。

### 7.2 实现方式与安全坑

- tiktoken 内部会**额外构造一个匹配所有特殊 token 的正则**，遇到就整体替换为对应 id，完全绕过 BPE；
- **footgun**：`encode(text, allowed_special=...)` 必须显式声明是否允许特殊 token（`"all"` / `"none"` / 指定列表）。否则攻击者可控的用户输入可能被意外解析成特殊 token，破坏系统——这是**潜在攻击面**；
- 可以自定义扩展：`tiktoken.Encoding(name, pat_str, mergeable_ranks, special_tokens={...})`，fork cl100k_base 加自己的特殊 token。

### 7.3 给模型加 token = 模型手术

新增 token 时：
1. **扩展 embedding 表**：`nn.Embedding(vocab_size, n_embed)` 加一行，用小的随机数初始化；
2. **扩展 lm_head**：`nn.Linear(n_embed, vocab_size)` 加一列，为每个新 token 输出一个 logit。

常见做法是冻结基座参数、只训练新 token 的参数（ChatGPT 类微调就是这么干的）。

---

## 八、词表大小的权衡（Vocab Size）

`vocab_size` 只影响模型的两个位置：**token embedding 表**和**最后的 lm_head 线性层**。

- **计算成本**：lm_head 要对每个位置、每个词表 token 算一个点积 → 词表越大越贵；
- **欠训练风险**：词表 100 万时，每个 token 出现频率极低，embedding 向量训练不充分；
- **序列压缩 vs "思考时间"**：词表越大序列越短、能关注更多文本；但单个 token 塞太多信息（如 `.DefaultCellStyle` 整个是一个 token），Transformer 在每步前向里没有足够"思考时间"消化信息。

当前 SOTA 词表规模普遍在**几万到 ~10 万**量级，属经验超参数。

---

## 九、SentencePiece（Llama 2 系分词器）

### 9.1 与 tiktoken 的根本区别

| | tiktoken（GPT 系） | SentencePiece（Llama 系） |
|---|---|---|
| BPE 运行对象 | **UTF-8 字节**（先 encode 成字节再合并） | **Unicode 码点**（直接合并字符） |
| 罕见字符 | 天然由字节兜底 | 默认映射 `<unk>`；开启 `byte_fallback` 后按 UTF-8 字节编码为 `\<0x00\>`~`\<0xFF\>` 字节 token |
| 语言效率 | 所有语言一视同仁 | 中日韩等字符密集型语言更省 token |

Karpathy 个人评价：tiktoken 的字节方案**更干净**；SentencePiece 是历史包袱很重的库（"sentence"概念、大量配置项），但 Llama/Mistral 都用它。

### 9.2 关键配置（对齐 Llama 2 的选项）

```python
options = dict(
    input="toy.txt", model_prefix="tok400",
    model_type="bpe", vocab_size=400,
    normalization_rule_name="identity",   # 关闭归一化：LLM 时代希望保留原始数据
    remove_extra_whitespaces=False,
    character_coverage=0.99995,           # 罕见字符覆盖率；英文/欧洲语言可设 1.0
    byte_fallback=True,                   # 罕见字符回退到字节 token（关键！）
    split_digits=True,                    # 拆分数字，改善算术（Llama 2 这么做的原因之一）
    add_dummy_prefix=True,                # 文本开头加假空格，让 "world" 和 "hello world" 中 world 切分一致
    unk_id=0, bos_id=1, eos_id=2, pad_id=-1,   # unk 必须存在，pad 可关
)
spm.SentencePieceTrainer.train(**options)
```

词表结构顺序：**特殊 token（unk/bos/eos）→ 256 个字节 token（byte_fallback 时）→ BPE 合并 token → 独立码点 token**。

- 不开 byte_fallback 时，词表里没有字节 token，罕见字符（如没在训练集出现的韩文）全部变成 `<unk>`（token 0），信息全丢——**Llama 2 正确开启了 byte_fallback**；
- `add_dummy_prefix=True` 解决 "world"(14957) 与 " world"(1917) 是两个不同 token 的问题（tiktoken 里没有这个机制，模型得自己学）。

### 9.3 一个硬性约束

`vocab_size` 必须 **严格大于**（字符覆盖率决定的基础字符数 + 特殊 token 数）。否则报错 "Vocabulary size is smaller than required_chars"。解决：增大 vocab_size / 降低 character_coverage / 开 byte_fallback。Llama 2 用 vocab_size=32000 + character_coverage=0.99995 正是这个平衡。

---

## 十、minbpe 仓库结构

```
minbpe/
├── base.py    # Tokenizer 基类：train/encode/decode 桩、save/load、工具函数
├── basic.py   # BasicTokenizer：最朴素 BPE，直接跑在文本上
├── regex.py   # RegexTokenizer：GPT-4 正则预切分 + 特殊 token 支持
├── gpt4.py    # GPT4Tokenizer：RegexTokenizer 的薄封装，精确复现 tiktoken 的 cl100k_base
└── train.py   # 在 tests/taylorswift.txt 上训练并保存词表用于可视化（M1 约 25 秒）
```

快速上手：

```python
from minbpe import BasicTokenizer
tokenizer = BasicTokenizer()
tokenizer.train("aaabdaaabac", 256 + 3)   # 256 个字节 token + 3 次合并
print(tokenizer.encode("aaabdaaabac"))    # [258, 100, 258, 97, 99]
print(tokenizer.decode([258, 100, 258, 97, 99]))  # aaabdaaabac
tokenizer.save("toy")                     # 生成 toy.model（加载用）和 toy.vocab（可视化用）
```

与 tiktoken 对拍（`GPT4Tokenizer` 输出与 `cl100k_base` 完全一致，含特殊 token 场景）。

**GPT-4 复现的两个坑**（见 exercise.md Step 3）：
1. **恢复原始 merges 不容易**：tiktoken 只存了 `_mergeable_ranks`（父节点+rank），需用 `recover_merges()` 恢复（参考 [tiktoken issue #60](https://github.com/openai/tiktoken/issues/60) 与 [minbpe issue #11](https://github.com/karpathy/minbpe/issues/11)）；
2. **字节置换**：GPT-4 把原始 256 个字节做了某种置换（`byte_shuffle = {i: enc._mergeable_ranks[bytes([i])] for i in range(256)}`），encode/decode 时要相应 shuffle。

---

## 十一、进阶练习（exercise.md 五步走）

1. **Step 1**：写 `BasicTokenizer`（train/encode/decode 三函数），在任意文本上训练并可视化合并结果；
2. **Step 2**：升级为 `RegexTokenizer`，用 GPT-4 正则切分，验证没有跨类别 token；
3. **Step 3**：加载 GPT-4 merges + 处理字节置换，使输出与 tiktoken **逐 token 一致**；
4. **Step 4**（可选）：支持特殊 token 与 `allowed_special`；
5. **Step 5**（进阶）：探索 SentencePiece，把 BPE 改到码点级别，尝试对齐 Llama 2 分词器。

---

## 十二、高级话题（视频结尾部分）

1. **多模态分词**：图像/视频也可"token 化"后与文本 token 走同一套 Transformer——VQGAN 把图像量化成 codebook 里的离散 token；OpenAI Sora 报告原话：*"Whereas LLMs have text tokens, Sora has visual patches."*
2. **Gist Tokens（提示压缩）**：训练少量特殊"gist token"，把长 prompt 蒸馏压缩进这些 token 的 embedding 里（冻结其余模型），推理时用 gist token 代替长 prompt，大幅省算力（源自 *Gist Tokens* 论文，用 meta-learning 泛化到未见过的指令）。

---

## 十三、LLM 怪癖的根源解析（视频最后的高潮部分）

1. **拼写差**：词被切成长 token（如 `.DefaultCellStyle` 整个是 1 个 token 98518），"数出 4 个 l" 这种任务模型看不见字符。**技巧：让模型先按空格把字符拆开，再数/反转就能成功**；
2. **不会反转字符串**：同上，token 内字符对模型不可见；先"逐字符列出"再反转就 OK；
3. **非英语差**：词表偏向英语。`"Hello how are you?"` 是 5 个 token，韩语翻译要 15 个 token；韩语"안녕하세요"= 3 token 而 "hello" = 1 token；
4. **算术差**：数字切分任意（见博客 [Integer tokenization is insane](https://github.com/gregorybchris/integer-tokenization-is-insane)），进位加法按位操作，而模型看到的数字碎片不规则。**Llama 2 用 `split_digits=True` 强制拆数字来缓解**；
5. **GPT-2 写 Python 吃力**：空格全被切成独立 token 220，浪费大量上下文；
6. **trailing whitespace 警告**：提示词以空格结尾时，这个空格成了孤立 token 220，而训练分布里空格通常是下一个 token 的前缀（如 `" Oh"` 是 token 8840）→ 模型"超出分布"，行为不可预测；
7. **`<|endoftext|>` 打不出来**：特殊 token 处理逻辑把用户输入也解析成特殊 token（可能是 `allowed_special` 用得太宽），模型看到的是"结束符"而不是字符串；
8. **SolidGoldMagikarp 现象**：某 Reddit 用户名因在**分词器训练集**里高频出现而被铸成专用 token，但该数据**不在 LLM 训练集**里 → 该 token 的 embedding 从未被训练（相当于 C 语言里未分配的内存），推理时一触发就是"未定义行为"（胡言乱语、骂人、幻觉）——这也是把"未初始化的嵌入向量喂进模型"的**安全警示**；
9. **YAML 优于 JSON**：同样的数据，JSON 116 token vs YAML 99 token。结构化数据输出给 LLM 时**优先 YAML**，能省 token = 省上下文、省算力、省钱。

---

## 十四、核心要点总结（Key Takeaways）

1. **Tokenization 是地基**：它是人与神经网络之间的桥梁，每个分词细节都会级联影响模型行为；
2. **不同模型不同分词策略**：GPT 系偏英语与代码；Llama 系（SentencePiece）面向多语言覆盖，按需选择；
3. **Token 效率 = 钱**：生产环境按 token 计费，理解分词能帮你优化 prompt、选择数据格式（YAML > JSON）；
4. **边界情况无处不在**：trailing space、部分 token、未训练 embedding……都是能搞挂应用的尖刺；
5. **无分词模型的梦想**：直接吃字节的 tokenization-free 模型仍是活跃研究领域，"谁消除了 tokenization，谁将获得永恒的荣耀"（Karpathy 语）；
6. **排障口诀**：LLM 行为诡异时，先想 tokenization。

---

## 十五、推荐阅读链接汇总

- 视频：[Let's build the GPT Tokenizer](https://www.youtube.com/watch?v=zduSFxRajkE)
- 仓库：[karpathy/minbpe](https://github.com/karpathy/minbpe)
- 讲义：[lecture.md](https://github.com/karpathy/minbpe/blob/master/lecture.md) ｜ 练习：[exercise.md](https://github.com/karpathy/minbpe/blob/master/exercise.md)
- 文字版书本章节：[fast.ai 完整指南](https://www.fast.ai/posts/2025-10-16-karpathy-tokenizers.html)
- 可视化工具：[Tiktokenizer](https://tiktokenizer.vercel.app)
- 官方库：[tiktoken](https://github.com/openai/tiktoken)
- 论文：[GPT-2: Language Models are Unsupervised Multitask Learners](https://d4mucfpksywv.cloudfront.net/better-language-models/language_models_are_unsupervised_multitask_learners.pdf)（Section 2.2 Input Representation）｜[Sennrich et al. 2015 (BPE 原始引用)](https://arxiv.org/abs/1508.07909)｜[Llama 2](https://arxiv.org/abs/2307.09288)｜[FIM: Fill in the Middle](https://arxiv.org/abs/2307.13289)
- 博客：[Integer tokenization is insane](https://github.com/gregorybchris/integer-tokenization-is-insane)｜[SolidGoldMagikarp](https://gwern.net/solidgoldmagikarp)（LessWrong 版）｜[UTF-8 Everywhere Manifesto](https://utf8everywhere.org/)
- 社区：[Simon Willison 笔记](https://simonwillison.net/2024/Feb/20/lets-build-the-gpt-tokenizer/)｜[Glasp 摘要](https://glasp.co/youtube/zduSFxRajkE)｜[AI Wiki: Byte Pair Encoding](https://aiwiki.ai/wiki/byte_pair_encoding)
