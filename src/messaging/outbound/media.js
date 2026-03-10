/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Media handling for the Feishu/Lark channel plugin.
 *
 * Provides functions for downloading images and file resources from
 * Feishu messages, uploading media to the Feishu IM storage, and
 * sending image / file messages to chats.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { LarkClient } from "../../core/lark-client.js";
import { normalizeFeishuTarget, resolveReceiveIdType, } from "../../core/targets.js";
import { isLocalMediaPath, normalizeMediaUrlInput, resolveFileNameFromMediaUrl, safeFileUrlToPath, } from "./media-url-utils.js";
import { runWithMessageUnavailableGuard } from "../message-unavailable.js";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
/**
 * 规范化 message_id，处理合成的 ID（如 "om_xxx:auth-complete"）
 */
function normalizeMessageId(messageId) {
    if (!messageId)
        return messageId;
    if (messageId.includes(":")) {
        return messageId.split(":")[0];
    }
    return messageId;
}
// ---------------------------------------------------------------------------
// Response extraction helpers
// ---------------------------------------------------------------------------
/**
 * Extract a Buffer from various SDK response formats.
 *
 * The Feishu Node SDK can return binary data in several shapes depending
 * on the runtime environment and SDK version:
 *   - A Buffer directly
 *   - An ArrayBuffer
 *   - A response object with a `.data` property
 *   - A response object with `.getReadableStream()`
 *   - A response object with `.writeFile(path)`
 *   - An async iterable / iterator
 *   - A Node.js Readable stream
 *
 * This helper normalises all of those into a single Buffer.
 */
async function extractBufferFromResponse(response) {
    // Direct Buffer
    if (Buffer.isBuffer(response)) {
        return { buffer: response };
    }
    // ArrayBuffer
    if (response instanceof ArrayBuffer) {
        return { buffer: Buffer.from(response) };
    }
    // Null / undefined guard
    if (response == null) {
        throw new Error("[feishu-media] Received null/undefined response");
    }
    const resp = response;
    const contentType = resp.headers?.["content-type"] ?? resp.contentType ?? undefined;
    // Response with .data as Buffer or ArrayBuffer
    if (resp.data != null) {
        if (Buffer.isBuffer(resp.data)) {
            return { buffer: resp.data, contentType };
        }
        if (resp.data instanceof ArrayBuffer) {
            return { buffer: Buffer.from(resp.data), contentType };
        }
        // .data might itself be a readable stream
        if (typeof resp.data.pipe === "function") {
            const buf = await streamToBuffer(resp.data);
            return { buffer: buf, contentType };
        }
    }
    // Response with .getReadableStream()
    if (typeof resp.getReadableStream === "function") {
        const stream = await resp.getReadableStream();
        const buf = await streamToBuffer(stream);
        return { buffer: buf, contentType };
    }
    // Response with .writeFile(path) -- write to a temp file and read back.
    if (typeof resp.writeFile === "function") {
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `feishu-media-${Date.now()}`);
        try {
            await resp.writeFile(tmpFile);
            const buf = fs.readFileSync(tmpFile);
            return { buffer: buf, contentType };
        }
        finally {
            // Clean up the temp file.
            try {
                fs.unlinkSync(tmpFile);
            }
            catch {
                // Ignore cleanup errors.
            }
        }
    }
    // Async iterable / iterator (e.g. response body chunks)
    if (typeof resp[Symbol.asyncIterator] === "function" ||
        typeof resp.next === "function") {
        const chunks = [];
        const iterable = typeof resp[Symbol.asyncIterator] === "function"
            ? resp
            : asyncIteratorToIterable(resp);
        for await (const chunk of iterable) {
            chunks.push(Buffer.from(chunk));
        }
        return { buffer: Buffer.concat(chunks), contentType };
    }
    // Node.js Readable stream
    if (typeof resp.pipe === "function") {
        const buf = await streamToBuffer(resp);
        return { buffer: buf, contentType };
    }
    throw new Error("[feishu-media] Unable to extract binary data from response: unrecognised format");
}
/**
 * Consume a Readable stream into a Buffer.
 */
function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => {
            chunks.push(Buffer.from(chunk));
        });
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}
/**
 * Wrap an AsyncIterator into an AsyncIterable.
 */
async function* asyncIteratorToIterable(iterator) {
    while (true) {
        const { value, done } = await iterator.next();
        if (done)
            break;
        yield value;
    }
}
// ---------------------------------------------------------------------------
// downloadMessageResourceFeishu
// ---------------------------------------------------------------------------
/**
 * Download a resource (image or file) attached to a specific message.
 *
 * @param params.cfg       - Plugin configuration.
 * @param params.messageId - The message the resource belongs to.
 * @param params.fileKey   - The file_key or image_key of the resource.
 * @param params.type      - Whether the resource is an "image" or "file".
 * @param params.accountId - Optional account identifier.
 * @returns The resource buffer, content type, and file name.
 */
export async function downloadMessageResourceFeishu(params) {
    const { cfg, messageId, fileKey, type, accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    const response = await client.im.messageResource.get({
        path: {
            message_id: messageId,
            file_key: fileKey,
        },
        params: {
            type,
        },
    });
    const { buffer, contentType } = await extractBufferFromResponse(response);
    // Attempt to extract file name from response headers.
    let fileName;
    if (response && typeof response === "object") {
        const resp = response;
        const disposition = resp.headers?.["content-disposition"] ??
            resp.headers?.["Content-Disposition"];
        if (typeof disposition === "string") {
            const match = disposition.match(/filename[*]?=(?:UTF-8'')?["']?([^"';\n]+)/i);
            if (match) {
                fileName = decodeURIComponent(match[1].trim());
            }
        }
    }
    return { buffer, contentType, fileName };
}
// ---------------------------------------------------------------------------
// uploadImageFeishu
// ---------------------------------------------------------------------------
/**
 * Upload an image to Feishu IM storage.
 *
 * Accepts either a Buffer containing the raw image bytes or a file
 * system path to read from.
 *
 * @param params.cfg       - Plugin configuration.
 * @param params.image     - A Buffer or local file path for the image.
 * @param params.imageType - The image usage type: "message" (default) or "avatar".
 * @param params.accountId - Optional account identifier.
 * @returns The assigned image_key.
 */
export async function uploadImageFeishu(params) {
    const { cfg, image, imageType = "message", accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    let imageStream;
    if (Buffer.isBuffer(image)) {
        imageStream = Readable.from(image);
    }
    else {
        // Treat as a file path.
        imageStream = fs.createReadStream(image);
    }
    const response = await client.im.image.create({
        data: {
            image_type: imageType,
            image: imageStream,
        },
    });
    const imageKey = response?.data?.image_key ?? response?.image_key;
    if (!imageKey) {
        throw new Error(`[feishu-media] Image upload failed: no image_key returned. Response: ${JSON.stringify(response).slice(0, 300)}`);
    }
    return { imageKey };
}
// ---------------------------------------------------------------------------
// uploadFileFeishu
// ---------------------------------------------------------------------------
/**
 * Upload a file to Feishu IM storage.
 *
 * @param params.cfg       - Plugin configuration.
 * @param params.file      - A Buffer or local file path.
 * @param params.fileName  - The display name of the file.
 * @param params.fileType  - Feishu file type: "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream".
 * @param params.duration  - Duration in milliseconds (for audio/video files).
 * @param params.accountId - Optional account identifier.
 * @returns The assigned file_key.
 */
export async function uploadFileFeishu(params) {
    const { cfg, file, fileName, fileType, duration, accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    let fileStream;
    if (Buffer.isBuffer(file)) {
        fileStream = Readable.from(file);
    }
    else {
        fileStream = fs.createReadStream(file);
    }
    const data = {
        file_type: fileType,
        file_name: fileName,
        file: fileStream,
    };
    if (duration !== undefined) {
        data.duration = String(duration);
    }
    const response = await client.im.file.create({
        data: data,
    });
    const fileKey = response?.file_key;
    if (!fileKey) {
        throw new Error("[feishu-media] File upload failed: no file_key returned");
    }
    return { fileKey };
}
// ---------------------------------------------------------------------------
// sendImageFeishu
// ---------------------------------------------------------------------------
/**
 * Send an image message to a chat or user.
 *
 * @param params.cfg              - Plugin configuration.
 * @param params.to               - Target identifier.
 * @param params.imageKey         - The image_key from a previous upload.
 * @param params.replyToMessageId - Optional message ID for threaded reply.
 * @param params.accountId        - Optional account identifier.
 * @returns The send result.
 */
export async function sendImageFeishu(params) {
    const { cfg, to, imageKey, replyToMessageId, replyInThread, accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    const contentPayload = JSON.stringify({ image_key: imageKey });
    if (replyToMessageId) {
        const normalizedId = normalizeMessageId(replyToMessageId);
        const response = await runWithMessageUnavailableGuard({
            messageId: normalizedId,
            operation: "im.message.reply(image)",
            fn: () => client.im.message.reply({
                path: {
                    message_id: normalizedId,
                },
                data: {
                    content: contentPayload,
                    msg_type: "image",
                    reply_in_thread: replyInThread,
                },
            }),
        });
        return {
            messageId: response?.data?.message_id ?? "",
            chatId: response?.data?.chat_id ?? "",
        };
    }
    const target = normalizeFeishuTarget(to);
    if (!target) {
        throw new Error(`[feishu-media] Invalid target: "${to}"`);
    }
    const receiveIdType = resolveReceiveIdType(target);
    const response = await client.im.message.create({
        params: {
            receive_id_type: receiveIdType,
        },
        data: {
            receive_id: target,
            msg_type: "image",
            content: contentPayload,
        },
    });
    return {
        messageId: response?.data?.message_id ?? "",
        chatId: response?.data?.chat_id ?? "",
    };
}
// ---------------------------------------------------------------------------
// sendFileFeishu
// ---------------------------------------------------------------------------
/**
 * Send a file message to a chat or user.
 *
 * @param params.cfg              - Plugin configuration.
 * @param params.to               - Target identifier.
 * @param params.fileKey          - The file_key from a previous upload.
 * @param params.replyToMessageId - Optional message ID for threaded reply.
 * @param params.accountId        - Optional account identifier.
 * @returns The send result.
 */
export async function sendFileFeishu(params) {
    const { cfg, to, fileKey, replyToMessageId, replyInThread, accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    const contentPayload = JSON.stringify({ file_key: fileKey });
    if (replyToMessageId) {
        const normalizedId = normalizeMessageId(replyToMessageId);
        const response = await runWithMessageUnavailableGuard({
            messageId: normalizedId,
            operation: "im.message.reply(file)",
            fn: () => client.im.message.reply({
                path: {
                    message_id: normalizedId,
                },
                data: {
                    content: contentPayload,
                    msg_type: "file",
                    reply_in_thread: replyInThread,
                },
            }),
        });
        return {
            messageId: response?.data?.message_id ?? "",
            chatId: response?.data?.chat_id ?? "",
        };
    }
    const target = normalizeFeishuTarget(to);
    if (!target) {
        throw new Error(`[feishu-media] Invalid target: "${to}"`);
    }
    const receiveIdType = resolveReceiveIdType(target);
    const response = await client.im.message.create({
        params: {
            receive_id_type: receiveIdType,
        },
        data: {
            receive_id: target,
            msg_type: "file",
            content: contentPayload,
        },
    });
    return {
        messageId: response?.data?.message_id ?? "",
        chatId: response?.data?.chat_id ?? "",
    };
}
// ---------------------------------------------------------------------------
// sendAudioFeishu
// ---------------------------------------------------------------------------
/**
 * Send an audio message to a chat or user.
 *
 * Identical to {@link sendFileFeishu} except the `msg_type` is `"audio"`,
 * which causes Feishu to render the message as a playable voice bubble
 * instead of a file attachment.
 *
 * @param params.cfg              - Plugin configuration.
 * @param params.to               - Target identifier.
 * @param params.fileKey          - The file_key from a previous upload.
 * @param params.replyToMessageId - Optional message ID for threaded reply.
 * @param params.accountId        - Optional account identifier.
 * @returns The send result.
 */
export async function sendAudioFeishu(params) {
    const { cfg, to, fileKey, replyToMessageId, replyInThread, accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    const contentPayload = JSON.stringify({ file_key: fileKey });
    if (replyToMessageId) {
        const normalizedId = normalizeMessageId(replyToMessageId);
        const response = await runWithMessageUnavailableGuard({
            messageId: normalizedId,
            operation: "im.message.reply(audio)",
            fn: () => client.im.message.reply({
                path: {
                    message_id: normalizedId,
                },
                data: {
                    content: contentPayload,
                    msg_type: "audio",
                    reply_in_thread: replyInThread,
                },
            }),
        });
        return {
            messageId: response?.data?.message_id ?? "",
            chatId: response?.data?.chat_id ?? "",
        };
    }
    const target = normalizeFeishuTarget(to);
    if (!target) {
        throw new Error(`[feishu-media] Invalid target: "${to}"`);
    }
    const receiveIdType = resolveReceiveIdType(target);
    const response = await client.im.message.create({
        params: {
            receive_id_type: receiveIdType,
        },
        data: {
            receive_id: target,
            msg_type: "audio",
            content: contentPayload,
        },
    });
    return {
        messageId: response?.data?.message_id ?? "",
        chatId: response?.data?.chat_id ?? "",
    };
}
// ---------------------------------------------------------------------------
// detectFileType
// ---------------------------------------------------------------------------
/** Known image extensions. */
const IMAGE_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".ico",
    ".tiff",
    ".tif",
    ".heic",
]);
/** Extension-to-Feishu-file-type mapping. */
const EXTENSION_TYPE_MAP = {
    ".opus": "opus",
    ".ogg": "opus",
    ".mp4": "mp4",
    ".mov": "mp4",
    ".avi": "mp4",
    ".mkv": "mp4",
    ".webm": "mp4",
    ".pdf": "pdf",
    ".doc": "doc",
    ".docx": "doc",
    ".xls": "xls",
    ".xlsx": "xls",
    ".csv": "xls",
    ".ppt": "ppt",
    ".pptx": "ppt",
};
/**
 * Detect the Feishu file type from a file name extension.
 *
 * Returns one of the Feishu-supported file type strings, or "stream"
 * as a catch-all for unrecognised extensions.
 *
 * @param fileName - The file name (with extension).
 * @returns The detected file type.
 */
export function detectFileType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return EXTENSION_TYPE_MAP[ext] ?? "stream";
}
/**
 * Parse the duration (in milliseconds) from an OGG/Opus audio buffer.
 *
 * Scans backward from the end of the buffer to find the last OggS page
 * header, reads the granule position (absolute sample count), and divides
 * by 48 000 (the Opus standard sample rate) then converts to milliseconds.
 *
 * Returns `undefined` when the buffer cannot be parsed (e.g. truncated or
 * not actually OGG).  This is intentionally lenient so callers can fall
 * back gracefully.
 */
export function parseOggOpusDuration(buffer) {
    // OggS magic bytes: 0x4f 0x67 0x67 0x53
    const OGGS = Buffer.from("OggS");
    // Scan backwards for the last OggS sync word.
    let offset = -1;
    for (let i = buffer.length - OGGS.length; i >= 0; i--) {
        if (buffer[i] === 0x4f && buffer.compare(OGGS, 0, 4, i, i + 4) === 0) {
            offset = i;
            break;
        }
    }
    if (offset < 0)
        return undefined;
    // Granule position is at bytes 6..13 of the page header (8 bytes, little-endian).
    const granuleOffset = offset + 6;
    if (granuleOffset + 8 > buffer.length)
        return undefined;
    // Read as two 32-bit LE values and combine (avoids BigInt for portability).
    const lo = buffer.readUInt32LE(granuleOffset);
    const hi = buffer.readUInt32LE(granuleOffset + 4);
    const granule = hi * 0x1_0000_0000 + lo;
    if (granule <= 0)
        return undefined;
    return Math.ceil(granule / 48_000) * 1000;
}
/**
 * Check whether a file name has an image extension.
 */
function isImageFileName(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
}
// ---------------------------------------------------------------------------
// sendMediaFeishu
// ---------------------------------------------------------------------------
/**
 * Upload and send a media file (image or general file) in one step.
 *
 * Accepts either a URL (remote or local `file://`) or a raw Buffer.
 * The function determines whether the media is an image (by extension)
 * and uses the appropriate upload/send path.
 *
 * @param params.cfg              - Plugin configuration.
 * @param params.to               - Target identifier.
 * @param params.mediaUrl         - URL of the media (http/https or local path).
 * @param params.mediaBuffer      - Raw bytes of the media (alternative to URL).
 * @param params.fileName         - File name (used for type detection and display).
 * @param params.replyToMessageId - Optional message ID for threaded reply.
 * @param params.accountId        - Optional account identifier.
 * @returns The send result.
 */
export async function sendMediaFeishu(params) {
    const { cfg, to, mediaUrl, mediaBuffer, fileName, replyToMessageId, replyInThread, accountId, } = params;
    // Resolve the media to a Buffer.
    let buffer;
    let resolvedFileName = fileName ?? "file";
    if (mediaBuffer) {
        buffer = mediaBuffer;
    }
    else if (mediaUrl) {
        buffer = await fetchMediaBuffer(mediaUrl);
        // Derive a file name from the URL if none was provided.
        if (!fileName) {
            const derivedFileName = resolveFileNameFromMediaUrl(mediaUrl);
            if (derivedFileName) {
                resolvedFileName = derivedFileName;
            }
        }
    }
    else {
        throw new Error("[feishu-media] sendMediaFeishu requires either mediaUrl or mediaBuffer");
    }
    // Decide whether to send as image or file based on the extension.
    const isImage = isImageFileName(resolvedFileName);
    if (isImage) {
        // Upload as image, then send image message.
        const { imageKey } = await uploadImageFeishu({
            cfg,
            image: buffer,
            imageType: "message",
            accountId,
        });
        return sendImageFeishu({
            cfg,
            to,
            imageKey,
            replyToMessageId,
            replyInThread,
            accountId,
        });
    }
    // Upload as file, then send as file or audio message.
    const fileType = detectFileType(resolvedFileName);
    const isAudio = fileType === "opus";
    const duration = isAudio ? parseOggOpusDuration(buffer) : undefined;
    const { fileKey } = await uploadFileFeishu({
        cfg,
        file: buffer,
        fileName: resolvedFileName,
        fileType,
        duration,
        accountId,
    });
    if (isAudio) {
        return sendAudioFeishu({ cfg, to, fileKey, replyToMessageId, replyInThread, accountId });
    }
    return sendFileFeishu({
        cfg,
        to,
        fileKey,
        replyToMessageId,
        replyInThread,
        accountId,
    });
}
// ---------------------------------------------------------------------------
// fetchMediaBuffer
// ---------------------------------------------------------------------------
/**
 * Fetch media bytes from a URL or local file path.
 *
 * Supports:
 * - `http://` and `https://` URLs (fetched via the global `fetch` API)
 * - `file://` URLs and bare file system paths (read from disk)
 */
async function fetchMediaBuffer(urlOrPath) {
    const raw = normalizeMediaUrlInput(urlOrPath);
    // Local file path (absolute or relative, or file:// URL).
    if (isLocalMediaPath(raw)) {
        const filePath = raw.startsWith("file://") ? safeFileUrlToPath(raw) : raw;
        return fs.readFileSync(filePath);
    }
    // Remote URL.
    const response = await fetch(raw);
    if (!response.ok) {
        throw new Error(`[feishu-media] Failed to fetch media from ${raw}: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
//# sourceMappingURL=media.js.map