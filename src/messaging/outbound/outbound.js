/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Outbound message adapter for the Feishu/Lark channel plugin.
 *
 * Exposes a `ChannelOutboundAdapter` that the OpenClaw core uses to deliver
 * agent-generated replies back to Feishu chats. Supports text chunking with
 * markdown awareness, direct text delivery, and media uploads with automatic
 * fallback to URL links when the upload fails.
 */
import { sendMediaFeishu } from "./media.js";
import { LarkClient } from "../../core/lark-client.js";
import { sendMessageFeishu } from "./send.js";
import { trace } from "../../core/trace.js";
export const feishuOutbound = {
    deliveryMode: "direct",
    chunker: (text, limit) => LarkClient.runtime.channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4000,
    sendText: async ({ cfg, to, text, accountId, replyToId, threadId }) => {
        const replyToMessageId = replyToId ?? undefined;
        const replyInThread = Boolean(threadId);
        const result = await sendMessageFeishu({
            cfg,
            to,
            text,
            replyToMessageId,
            replyInThread,
            accountId: accountId ?? undefined,
        });
        return { channel: "feishu", ...result };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId, replyToId, threadId }) => {
        const replyToMessageId = replyToId ?? undefined;
        const replyInThread = Boolean(threadId);
        // Send accompanying text first if provided
        if (text?.trim()) {
            await sendMessageFeishu({
                cfg,
                to,
                text,
                replyToMessageId,
                replyInThread,
                accountId: accountId ?? undefined,
            });
        }
        // Upload and send media if a URL was provided
        if (mediaUrl) {
            try {
                trace.info(`Attempting to upload media to Feishu: ${mediaUrl}`);
                const result = await sendMediaFeishu({
                    cfg,
                    to,
                    mediaUrl,
                    replyToMessageId,
                    replyInThread,
                    accountId: accountId ?? undefined,
                });
                return { channel: "feishu", ...result };
            }
            catch (err) {
                trace.error(`sendMedia upload failed (${mediaUrl}): ${err instanceof Error ? err.message : String(err)}`);
                // Fallback: send the media URL as a clickable link
                const result = await sendMessageFeishu({
                    cfg,
                    to,
                    text: `\u{1F4CE} ${mediaUrl}`,
                    replyToMessageId,
                    replyInThread,
                    accountId: accountId ?? undefined,
                });
                return { channel: "feishu", ...result };
            }
        }
        // No media URL -- just return the text send result
        const result = await sendMessageFeishu({
            cfg,
            to,
            text: text ?? "",
            replyToMessageId,
            replyInThread,
            accountId: accountId ?? undefined,
        });
        return { channel: "feishu", ...result };
    },
};
//# sourceMappingURL=outbound.js.map