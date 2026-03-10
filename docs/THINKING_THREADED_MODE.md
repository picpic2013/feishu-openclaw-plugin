# Thinking 累积模式

## 目标

1. **一张卡片累积所有 thinking**：持续往同一张卡里塞内容，不覆盖
2. **超阈值换新卡**：超过阈值（如 8000 字符），关闭旧卡，创建新卡继续
3. **stop 后关闭卡片**：强制终态，不再 loading
4. **最终答案不含 thinking**：thinking 结束后，单独发一张不含 thinking 的卡片

---

## 配置

```json
{
  "feishu": {
    "default": {
      "thinkingAccumulateEnabled": true,
      "thinkingRolloverChars": 8000
    }
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `thinkingAccumulateEnabled` | boolean | `false` | 是否启用累积模式 |
| `thinkingRolloverChars` | number | `8000` | 单张卡片累积阈值，超出后创建新卡 |

---

## 实现逻辑

### 1. 累积模式
- 每次 `onReasoningStream` 收到新内容时，追加到 `accumulatedReasoningText`
- 不覆盖，持续累积

### 2. 超阈值换卡
- 当累积长度 > `thinkingRolloverChars`：
  - 调用 `finalizeActiveCard()` 关闭当前卡
  - 创建新卡，继续累积

### 3. stop 关闭卡片
- abort 时确保调用 `finalizeActiveCard({ isAborted: true })`

### 4. 最终答案
- thinking 结束后，单独发一张不含 thinking 的卡片

---

## Git 里程碑

- `v1.0.0-original`：原始版本
- `v1.1.0-before-rebuild`：累积模式重构前版本
- **最新**：累积模式实现

---

## 使用

1. 在配置中开启：`thinkingAccumulateEnabled: true`
2. 可选调整阈值：`thinkingRolloverChars`
3. 重启 OpenClaw
