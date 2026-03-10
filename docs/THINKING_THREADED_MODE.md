# Thinking 主卡滚动模式

## 目标

在主流中使用卡片展示 thinking，并在超过阈值后自动开新卡：
- 不创建 thinking 子话题或 thread 子卡；
- 单张卡在阈值内持续累积更新；
- 超过 `thinkingRolloverChars` 后，当前卡结束，下一张卡接续；
- `/stop` 时当前卡会被正确结束；
- 最终答复仍在当前主卡内收口。

---

## 当前实现

核心文件：`src/card/reply-dispatcher.js`

实现要点：
1. 所有 thinking 卡都发在主流，不使用 thread。
2. `onReasoningStream` 按 `thinkingRolloverChars` 控制当前卡的 thinking 长度。
3. 超过阈值时，当前卡会先终态化，再创建下一张卡继续流式更新。
4. 最终完成或 `/stop` 时，当前卡会进入 complete / aborted 状态。

---

## 配置说明

当前有效配置：

```json
{
  "feishu": {
    "default": {
      "thinkingRolloverChars": 8000
    }
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `thinkingRolloverChars` | number | `8000` | 单张主卡允许承载的 thinking 字符阈值 |

以下配置已弃用，不再影响运行行为：
- `thinkingThreadedMode`
- `thinkingPhaseThresholdMs`
- `thinkingThreadMode`
- `thinkingFinalReplyOutsideThread`

检测到这些旧字段时，代码只会输出 deprecated 日志，并继续使用主卡滚动模式。

---

## 使用建议

1. 通过 `thinkingRolloverChars` 控制单卡 thinking 上限。
2. 不再配置 thread 相关字段。
3. 修改配置后重启 OpenClaw。
