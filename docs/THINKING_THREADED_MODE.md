# Thinking 话题模式（累积 + 超阈值换卡）

## 目标

在同一话题（thread）下展示完整 thinking 历史：
- 同一张 thinking 卡持续累积更新；
- 超过阈值后自动新开下一张 thinking 卡；
- 所有 thinking 卡都在同一话题下；
- 最终答案在外层主流可见（不埋在话题里）。

---

## 当前实现（master）

核心文件：`src/card/reply-dispatcher.js`

实现要点：
1. **主卡作为 thread 根**：thinking 子卡统一 `reply_to` 主卡 + `reply_in_thread=true`。
2. **按字符阈值分片**：`thinkingRolloverChars` 控制每张 thinking 卡最大长度。
3. **同片更新**：只 patch 当前活动分片卡，避免重复刷屏。
4. **主卡不重复显示 thinking**：避免“外层 + 话题”双份重复。
5. **最终回复外显**：通过 `thinkingFinalReplyOutsideThread` 控制主卡是否在外层。

---

## 配置（新）

```json
{
  "feishu": {
    "default": {
      "thinkingThreadMode": true,
      "thinkingRolloverChars": 8000,
      "thinkingFinalReplyOutsideThread": true
    }
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `thinkingThreadMode` | boolean | `false` | 是否启用 thinking 话题模式 |
| `thinkingRolloverChars` | number | `8000` | 单张 thinking 卡内容上限（字符） |
| `thinkingFinalReplyOutsideThread` | boolean | `true` | 最终答案是否在外层主流显示 |

---

## master 旧配置（已失效/不建议再用）

以下是 master 早期方案字段，现已弃用：
- `thinkingThreadedMode`
- `thinkingPhaseThresholdMs`

> 代码会输出 deprecated 提示日志。请迁移到新字段：
> `thinkingThreadMode` / `thinkingRolloverChars` / `thinkingFinalReplyOutsideThread`。

---

## Git 里程碑

- `v1.0.0-original`：原始基线
- `78129af`：首次引入开关（旧方案）
- `cb459b8`：修复 card 更新链路（旧方案）
- `bbf770c`：修复 `buildCardContent` 参数错误
- `a3958f1`：文档更新（旧方案说明）
- **当前提交起**：切换为“累积 + 阈值换卡”新方案

---

## 使用建议

1. 先启用：`thinkingThreadMode=true`
2. 若卡太多：调大 `thinkingRolloverChars`（如 12000）
3. 若希望最终答复留在主流：保持 `thinkingFinalReplyOutsideThread=true`
4. 修改配置后重启 OpenClaw
