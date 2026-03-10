---
name: feishu-fetch-doc
description: |
  获取飞书云文档内容。返回文档的 Markdown 内容，支持处理文档中的图片、文件和画板（需配合 fetch-media 工具）。
---

# feishu_mcp_fetch_doc

获取飞书云文档的 Markdown 内容（Lark-flavored 格式）。

## 重要：图片、文件、画板的处理

**文档中的图片、文件、画板需要通过 `feishu_drive_fetch_media` 工具单独获取！**

### 识别格式

返回的 Markdown 中，媒体文件以 HTML 标签形式出现：

- **图片**：
  ```html
  <image token="Z1FjxxxxxxxxxxxxxxxxxxxtnAc" width="1833" height="2491" align="center"/>
  ```

- **文件**：
  ```html
  <view type="1">
    <file token="Z1FjxxxxxxxxxxxxxxxxxxxtnAc" name="skills.zip"/>
  </view>
  ```

- **画板**：
  ```html
  <whiteboard token="Z1FjxxxxxxxxxxxxxxxxxxxtnAc"/>
  ```

### 获取步骤

1. 从 HTML 标签中提取 `token` 属性值
2. 调用 `feishu_drive_fetch_media` 下载：
   ```json
   {
     "action": "fetch",
     "file_token": "提取的token",
     "output_path": "/path/to/save/file"
   }
   ```

## 参数

- **`doc_id`**（必填）：文档 token，从 URL 中获取
  - 云文档：`https://xxx.feishu.cn/docx/doxcnXXXX` → `doxcnXXXX`
  - 知识库：`https://xxx.feishu.cn/wiki/YKx9bRgm9` → `YKx9bRgm9`

## 工具组合

| 需求 | 工具 |
|------|------|
| 获取文档文本 | `feishu_mcp_fetch_doc` |
| 下载图片/文件/画板 | `feishu_drive_fetch_media` |
