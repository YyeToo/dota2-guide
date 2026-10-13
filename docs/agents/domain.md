# 领域文档

规定各工程技能在探索本仓库代码时，应如何消费这里的领域文档。

## 探索之前，先读这些

- 根目录的 **`CONTEXT.md`**；或
- 若根目录存在 **`CONTEXT-MAP.md`**：它指向每个上下文各一份 `CONTEXT.md`，读与当前话题相关的那些。
- **`docs/adr/`**：读与你即将改动的区域相关的 ADR。多上下文仓库还要看 `src/<context>/docs/adr/` 里的上下文级决策。

若上述文件不存在，**静默继续**。不要指出它们缺失，也不要主动提议创建。`/domain-modeling` 技能（经 `/grill-with-docs` 和 `/improve-codebase-architecture` 触达）会在术语或决策真正定下来时按需创建。

## 文件结构

单上下文仓库（绝大多数仓库）：

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录存在 `CONTEXT-MAP.md`）：

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← 上下文专属决策
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## 使用术语表里的词汇

当你的产出提到某个领域概念时（issue 标题、重构提案、假设、测试名），使用 `CONTEXT.md` 里定义的术语，不要漂移到术语表明确回避的同义词。

若你需要的概念还不在术语表里，这本身是个信号：要么你在发明项目并不使用的语言（重新考虑），要么存在真实空白（记下来交给 `/domain-modeling`）。

## 发现 ADR 冲突时要指出

若你的产出与既有 ADR 矛盾，明确摆出来，而不是悄悄覆盖：

> _与 ADR-0007（事件溯源订单）冲突，但值得重开讨论，因为……_
