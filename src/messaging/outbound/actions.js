/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * ChannelMessageActionAdapter for the Feishu/Lark channel plugin.
 *
 * Implements the standard message-action interface so the framework's
 * built-in `message` tool can route react, delete, reply and other
 * actions to Feishu.
 *
 * Each action delegates to a dedicated handler function that calls
 * existing API wrappers (reactions.ts, send.ts, etc.) or invokes the
 * Lark SDK directly for lightweight operations.
 */
import { extractToolSend, jsonResult, readStringParam, readReactionParams, } from "openclaw/plugin-sdk";
import { addReactionFeishu, removeReactionFeishu, listReactionsFeishu, } from "./reactions.js";
import { sendMessageFeishu } from "./send.js";
import { sendMediaFeishu } from "./media.js";
import { listChatMembersFeishu } from "./chat-manage.js";
import { LarkClient } from "../../core/lark-client.js";
import { getEnabledLarkAccounts } from "../../core/accounts.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Assert that a Lark SDK response has code === 0 (or no code field). */
function assertLarkOk(res, context) {
    const code = res?.code;
    if (code !== undefined && code !== 0) {
        const msg = res?.msg ?? "unknown error";
        throw new Error(`[feishu-actions] ${context}: code=${code}, msg=${msg}`);
    }
}
// ---------------------------------------------------------------------------
// Supported actions
// ---------------------------------------------------------------------------
const SUPPORTED_ACTIONS = new Set([
    "react",
    "reactions",
    "delete",
    "unsend",
    "reply",
    "sendAttachment",
    // "member-info",
]);
// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
export const feishuMessageActions = {
    listActions: ({ cfg }) => {
        const accounts = getEnabledLarkAccounts(cfg);
        if (accounts.length === 0) {
            return [];
        }
        return Array.from(SUPPORTED_ACTIONS);
    },
    supportsAction: ({ action }) => SUPPORTED_ACTIONS.has(action),
    supportsButtons: ({ cfg }) => getEnabledLarkAccounts(cfg).length > 0,
    supportsCards: ({ cfg }) => getEnabledLarkAccounts(cfg).length > 0,
    extractToolSend: ({ args }) => extractToolSend(args, "sendMessage"),
    handleAction: async (ctx) => {
        const { action, params, cfg, accountId, toolContext } = ctx;
        const aid = accountId ?? undefined;
        switch (action) {
            case "react":
                return handleReact(cfg, params, aid);
            case "reactions":
                return handleReactions(cfg, params, aid);
            case "delete":
            case "unsend":
                return handleDelete(cfg, params, aid);
            case "reply":
                return handleReply(cfg, params, aid);
            case "sendAttachment":
                return handleSendAttachment(cfg, params, aid);
            case "member-info":
                return handleMemberInfo(cfg, params, aid, toolContext);
            default:
                throw new Error(`Action "${action}" is not supported for Feishu. ` +
                    `Supported actions: ${Array.from(SUPPORTED_ACTIONS).join(", ")}.`);
        }
    },
};
// ---------------------------------------------------------------------------
// Reaction handlers
// ---------------------------------------------------------------------------
async function handleReact(cfg, params, accountId) {
    const messageId = readStringParam(params, "messageId", { required: true });
    const { emoji, remove, isEmpty } = readReactionParams(params, {
        removeErrorMessage: "Emoji is required to remove a Feishu reaction.",
    });
    if (remove || isEmpty) {
        const reactions = await listReactionsFeishu({
            cfg,
            messageId,
            emojiType: emoji || undefined,
            accountId,
        });
        const botReactions = reactions.filter((r) => r.operatorType === "app");
        for (const r of botReactions) {
            await removeReactionFeishu({
                cfg,
                messageId,
                reactionId: r.reactionId,
                accountId,
            });
        }
        return jsonResult({ ok: true, removed: botReactions.length });
    }
    const { reactionId } = await addReactionFeishu({
        cfg,
        messageId,
        emojiType: emoji,
        accountId,
    });
    return jsonResult({ ok: true, reactionId });
}
async function handleReactions(cfg, params, accountId) {
    const messageId = readStringParam(params, "messageId", { required: true });
    const emojiType = readStringParam(params, "emoji");
    const reactions = await listReactionsFeishu({
        cfg,
        messageId,
        emojiType: emojiType || undefined,
        accountId,
    });
    return jsonResult({
        ok: true,
        reactions: reactions.map((r) => ({
            reactionId: r.reactionId,
            emoji: r.emojiType,
            operatorType: r.operatorType,
            operatorId: r.operatorId,
        })),
    });
}
// ---------------------------------------------------------------------------
// Delete / Reply
// ---------------------------------------------------------------------------
async function handleDelete(cfg, params, accountId) {
    const messageId = readStringParam(params, "messageId", { required: true });
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    const res = await client.im.message.delete({
        path: { message_id: messageId },
    });
    assertLarkOk(res, `delete message ${messageId}`);
    return jsonResult({ ok: true, messageId, deleted: true });
}
async function handleReply(cfg, params, accountId) {
    const messageId = readStringParam(params, "messageId", { required: true });
    const text = readStringParam(params, "message") ?? readStringParam(params, "text");
    if (!text) {
        throw new Error("Feishu reply requires a 'message' or 'text' parameter with the reply content.");
    }
    // `to` is unused when `replyToMessageId` is set — reply API routes by message_id.
    const result = await sendMessageFeishu({
        cfg,
        to: "",
        text,
        replyToMessageId: messageId,
        accountId,
    });
    return jsonResult({ ok: true, messageId: result.messageId, chatId: result.chatId });
}
// ---------------------------------------------------------------------------
// Send Attachment
// ---------------------------------------------------------------------------
async function handleSendAttachment(cfg, params, accountId) {
    const to = readStringParam(params, "to", { required: true });
    const mediaUrl = readStringParam(params, "media") ?? readStringParam(params, "url");
    const fileName = readStringParam(params, "fileName") ?? readStringParam(params, "name");
    const replyTo = readStringParam(params, "messageId") ?? readStringParam(params, "replyTo");
    if (!mediaUrl) {
        throw new Error("Feishu sendAttachment requires a 'media' or 'url' parameter with the file URL or path.");
    }
    const result = await sendMediaFeishu({
        cfg,
        to,
        mediaUrl,
        fileName: fileName ?? undefined,
        replyToMessageId: replyTo ?? undefined,
        accountId,
    });
    return jsonResult({ ok: true, messageId: result.messageId, chatId: result.chatId });
}
// ---------------------------------------------------------------------------
// Member Info
// ---------------------------------------------------------------------------
async function handleMemberInfo(cfg, params, accountId, toolContext) {
    const chatId = readStringParam(params, "chatId")
        ?? readStringParam(params, "chat")
        ?? toolContext?.currentChannelId;
    if (!chatId) {
        throw new Error("Feishu member-info requires a 'chatId' parameter or must be called within a chat context.");
    }
    const { members, hasMore } = await listChatMembersFeishu({ cfg, chatId, accountId });
    return jsonResult({
        ok: true,
        chatId,
        hasMore,
        members: members.map((m) => ({
            memberId: m.memberId,
            name: m.name,
            memberIdType: m.memberIdType,
        })),
    });
}
//# sourceMappingURL=actions.js.map