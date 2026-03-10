/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
  * feishu_drive_fetch_media tool -- 获取文档素材和画板缩略图
 *
  * 支持:
  * 1. doc/image - 下载云文档素材 (图片、视频、文件等)
  * 2. whiteboard - 下载画板缩略图片
 *
  * 使用以下 SDK 接口:
  * - sdk.drive.v1.media.download - 下载素材
  * - sdk.board.v1.whiteboard.downloadAsImage - 下载画板缩略图
 */
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
export declare function registerFetchMediaTool(api: OpenClawPluginApi): void;
//# sourceMappingURL=fetch-media.d.ts.map