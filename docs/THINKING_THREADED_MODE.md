# Thinking 单卡累积模式

## 目标

在同一张主卡中持续展示完整 thinking 历史：
- 不再创建 thinking 子话题或子卡片；
- 每次 thinking 更新都回填完整历史文本；
- 由飞书卡片更新机制自行处理 diff 和渲染；
- 最终答复仍在主卡内收口。

---

## 当前实现

核心文件：`src/card/reply-dispatcher.js`

实现要点：
1. 所有 thinking 内容都写回同一张主卡。
2. `onReasoningStream` 每次收到新文本，都用完整累计文本更新主卡。
3. 不再按字符阈值分片，不再创建 thread 子卡。
4. 最终完成时，主卡进入 complete 状态并保留 thinking 记录。

---

## 配置说明

当前不需要 thinking 分卡相关配置。

以下配置已弃用，不再影响运行行为：
- `thinkingThreadedMode`
- `thinkingPhaseThresholdMs`
- `thinkingThreadMode`
- `thinkingRolloverChars`
- `thinkingFinalReplyOutsideThread`

检测到这些字段时，代码只会输出 deprecated 日志，并继续使用单卡累积模式。

---

## 使用建议

1. 不再配置 thinking thread / rollover 相关字段。
2. 保持现有 streaming 卡片配置即可。
3. 修改配置后重启 OpenClaw。
