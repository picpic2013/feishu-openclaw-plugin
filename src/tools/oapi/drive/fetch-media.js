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
import { Type } from "@sinclair/typebox";
import { json, createToolContext, handleInvokeErrorWithAutoAuth, } from "../helpers.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
// ---------------------------------------------------------------------------
// Helper: MIME type to extension mapping
// ---------------------------------------------------------------------------
const MIME_TO_EXT = {
    // Images
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    // Videos
    "video/mp4": ".mp4",
    "video/mpeg": ".mpeg",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/webm": ".webm",
    // Documents
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    // Others
    "application/zip": ".zip",
    "application/x-rar-compressed": ".rar",
    "text/plain": ".txt",
    "application/json": ".json",
};
// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const FetchMediaSchema = Type.Object({
    resource_token: Type.String({
        description: "资源的唯一标识 (file_token 用于文档素材，whiteboard_id 用于画板)",
    }),
    type: Type.Union([Type.Literal("media"), Type.Literal("whiteboard")], {
        description: "资源类型：media（文档素材：图片、视频、文件等，默认）或 whiteboard（画板缩略图）",
    }),
    output_path: Type.String({
        description: "保存文件的完整本地路径。可以包含扩展名（如 /tmp/image.png），" +
            "也可以不带扩展名（如 /tmp/image），系统会根据文件的 Content-Type 自动添加合适的扩展名",
    }),
});
// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
export function registerFetchMediaTool(api) {
    if (!api.config)
        return;
    const cfg = api.config;
    const { toolClient, log } = createToolContext(api, "feishu_drive_fetch_media");
    api.registerTool({
        name: "feishu_drive_fetch_media",
        label: "Feishu: Fetch Media",
        description: "【以用户身份】下载文档素材或画板缩略图到本地文件。" +
            "支持: (1) media - 下载云文档中的素材（图片、视频、文件等）; " +
            "(2) whiteboard - 下载画板缩略图。" +
            "文件会保存到指定的 output_path。建议文件限制为 5MB 以内。",
        parameters: FetchMediaSchema,
        async execute(_toolCallId, params) {
            const p = params;
            try {
                const client = toolClient();
                // Action: download media (doc/image)
                if (p.type === "media") {
                    log.info(`fetch_media.media: downloading file_token="${p.resource_token}"`);
                    const res = await client.invoke("feishu_drive_fetch_media.default", (sdk, opts) => sdk.drive.v1.media.download({
                        path: { file_token: p.resource_token },
                    }, opts), { as: "user" });
                    // 响应是二进制流，使用 getReadableStream() 读取
                    const stream = res.getReadableStream();
                    const chunks = [];
                    for await (const chunk of stream) {
                        chunks.push(chunk);
                    }
                    const buffer = Buffer.concat(chunks);
                    log.info(`fetch_media.media: downloaded ${buffer.length} bytes`);
                    // 从响应头获取 Content-Type，并确定文件扩展名
                    const contentType = res.headers?.["content-type"] || "";
                    log.info(`fetch_media.media: content-type=${contentType}`);
                    let finalPath = p.output_path;
                    const currentExt = path.extname(p.output_path);
                    // 如果用户提供的路径没有扩展名，尝试从 Content-Type 推断
                    if (!currentExt && contentType) {
                        const mimeType = contentType.split(";")[0].trim();
                        const suggestedExt = MIME_TO_EXT[mimeType];
                        if (suggestedExt) {
                            finalPath = p.output_path + suggestedExt;
                            log.info(`fetch_media.media: auto-detected extension ${suggestedExt} from content-type`);
                        }
                    }
                    // 确保父目录存在
                    await fs.mkdir(path.dirname(finalPath), { recursive: true });
                    // 保存文件
                    try {
                        await fs.writeFile(finalPath, buffer);
                        log.info(`fetch_media.media: saved to ${finalPath}`);
                        return json({
                            type: "media",
                            file_token: p.resource_token,
                            size_bytes: buffer.length,
                            content_type: contentType,
                            saved_path: finalPath,
                        });
                    }
                    catch (err) {
                        log.error(`fetch_media.media: failed to save file: ${err}`);
                        return json({
                            error: `保存文件失败: ${err instanceof Error ? err.message : String(err)}`,
                        });
                    }
                }
                // Action: download whiteboard
                if (p.type === "whiteboard") {
                    log.info(`fetch_media.whiteboard: downloading whiteboard_id="${p.resource_token}"`);
                    const res = await client.invoke("feishu_drive_fetch_media.default", (sdk, opts) => sdk.board.v1.whiteboard.downloadAsImage({
                        path: { whiteboard_id: p.resource_token },
                    }, opts), { as: "user" });
                    // 响应是二进制流，使用 getReadableStream() 读取
                    const stream = res.getReadableStream();
                    const chunks = [];
                    for await (const chunk of stream) {
                        chunks.push(chunk);
                    }
                    const buffer = Buffer.concat(chunks);
                    log.info(`fetch_media.whiteboard: downloaded ${buffer.length} bytes`);
                    // 从响应头获取 Content-Type，并确定文件扩展名
                    const contentType = res.headers?.["content-type"] || "";
                    log.info(`fetch_media.whiteboard: content-type=${contentType}`);
                    let finalPath = p.output_path;
                    const currentExt = path.extname(p.output_path);
                    // 如果用户提供的路径没有扩展名，尝试从 Content-Type 推断
                    if (!currentExt && contentType) {
                        const mimeType = contentType.split(";")[0].trim();
                        const suggestedExt = MIME_TO_EXT[mimeType] || ".png"; // 画板默认为 PNG
                        finalPath = p.output_path + suggestedExt;
                        log.info(`fetch_media.whiteboard: auto-detected extension ${suggestedExt} from content-type`);
                    }
                    // 确保父目录存在
                    await fs.mkdir(path.dirname(finalPath), { recursive: true });
                    // 保存文件
                    try {
                        await fs.writeFile(finalPath, buffer);
                        log.info(`fetch_media.whiteboard: saved to ${finalPath}`);
                        return json({
                            type: "whiteboard",
                            whiteboard_id: p.resource_token,
                            size_bytes: buffer.length,
                            content_type: contentType,
                            saved_path: finalPath,
                        });
                    }
                    catch (err) {
                        log.error(`fetch_media.whiteboard: failed to save file: ${err}`);
                        return json({
                            error: `保存文件失败: ${err instanceof Error ? err.message : String(err)}`,
                        });
                    }
                }
                return json({
                    error: `未知的 type: ${p.type}`,
                });
            }
            catch (err) {
                return await handleInvokeErrorWithAutoAuth(err, cfg);
            }
        },
    }, { name: "feishu_drive_fetch_media" });
    api.logger.info?.("feishu_drive_fetch_media: Registered feishu_drive_fetch_media tool");
}
//# sourceMappingURL=fetch-media.js.map