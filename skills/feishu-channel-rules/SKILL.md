---
name: feishu-channel-rules
description: |
  飞书渠道输出规则。所有飞书对话中始终激活。约束 AI 输出格式，防止输出原始卡片 JSON。
alwaysActive: true
---

# 飞书输出格式规则（强制）

## 你的回复如何呈现给用户

系统会根据对话场景自动选择最佳的消息格式，你只需要输出 Markdown 文本即可。

- **私聊**：你的文本会实时流式渲染在消息卡片中（打字机效果）
- **群聊**：你的文本会在生成完毕后一次性发送（含代码块或表格时自动用卡片格式，否则用普通消息）
- 支持标准 Markdown 语法：标题、列表、粗体、代码块、表格等
- 你不需要、也不应该自己构造卡片，系统会自动处理格式和样式

## 严格禁止

- **禁止输出飞书卡片 JSON**（包括含 `"tag"`, `"elements"`, `"header"`, `"config"` 的 JSON 结构）
- **禁止输出任何消息卡片模板代码**（无论 v1 还是 v2 格式）
- **禁止用 JSON 来"美化"回复** — 直接用 Markdown 写内容

## 正确做法

直接用 Markdown 写内容：

```
### 操作确认

调试模式已成功关闭。

- 插件运行状态：正常
- debug 信息：已过滤

从现在开始，所有回复将只包含用户可见的有效信息。
```

## 格式技巧

- 用 `####` 标题分层
- 用 `**粗体**` 突出重点
- 用 `-` 列表整理信息
- 用表格呈现结构化数据
- 用 `>` 引用强调关键句


## Markdown 语法参考（必须严格遵守）

> **重要**：以下语法必须严格遵守，不能使用语法以外的写法。

### 1. 标题

```
#### 四级标题
##### 五级标题
```

- **不支持**一二三级标题（如 `#`、`##`、`###`），会导致卡片显示很丑
- 可用加粗替代标题效果

### 2. 换行

```
第一行\n第二行
```

### 3. 文本样式

| 语法 | 效果 |
|------|------|
| `**加粗**` | **加粗** |
| `*斜体*` | *斜体* |
| `~~删除线~~` | ~~删除线~~ |

> **注意**：加粗中间的内容只能是中文或英文，不能有中文符号或表情符号

### 4. 链接

```
[链接](https://www.baidu.com)
```

### 5. @指定人

```
<at id=id_01></at>
<at ids=id_01,id_02,xxx></at>
```

- 用户的 id 必须是用户给你的，不能瞎编
- 可能是：以 `ou_` 开头的字符串、不超过 10 位的字符串、邮箱

### 6. 超链接

```
<a href='https://open.feishu.cn'></a>
```

### 7. 彩色文本

```
<font color='green'>绿色文本</font>
```

> 颜色枚举：`neutral`, `blue`, `turquoise`, `lime`, `orange`, `violet`, `wathet`, `green`, `yellow`, `red`, `purple`, `carmine`

### 8. 文字链接

```
<a href='https://open.feishu.cn'>这是文字链接</a>
```

### 9. 图片

```
![hover_text](image_key)
```

> image_key 不支持 http 链接

### 10. 分割线

```
---
```

### 11. 标签

```
<text_tag color='red'>标签文本</text_tag>
```

颜色枚举：`neutral`, `blue`, `turquoise`, `lime`, `orange`, `violet`, `wathet`, `green`, `yellow`, `red`, `purple`, `carmine`

### 12. 有序列表

```
1. 一级列表①
    1.1 二级列表
    1.2 二级列表
2. 一级列表②
```

- 序号需在行首使用，序号后要跟空格
- 4 个空格代表一层缩进

### 13. 无序列表

```
- 一级列表①
    - 二级列表
- 一级列表②
```

- 4 个空格代表一层缩进
- `-` 后面要跟空格

### 14. 代码块

````
```JSON
{"This is": "JSON demo"}
```
````

- 支持指定编程语言解析
- 未指定默认为 Plain Text

### 15. 人员组件

```
<person id='user_id' show_name=true show_avatar=true style='normal'></person>
```

- `show_name`：是否展示用户名（默认 true）
- `show_avatar`：是否展示用户头像（默认 true）
- `style`：展示样式（`normal`：普通样式，`capsule`：胶囊样式）
- **注意**：person 标签不能嵌套在 font 中

### 16. 数字角标

```
<number_tag background_color='grey' font_color='white' url='https://open.feishu.cn' pc_url='https://open.feishu.cn' android_url='https://open.feishu.cn' ios_url='https://open.feishu.cn'>1</number_tag>
```

---

> 直接给出排版好的 Markdown 内容即可，不要告诉用户"我无法发卡片"。
