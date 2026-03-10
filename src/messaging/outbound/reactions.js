/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Reaction management for the Feishu/Lark channel plugin.
 *
 * Provides functions to add, remove, and list emoji reactions on Feishu
 * messages using the IM Message Reaction API.
 */
import { LarkClient } from "../../core/lark-client.js";
// ---------------------------------------------------------------------------
// Feishu emoji constants
// ---------------------------------------------------------------------------
/**
 * Well-known Feishu emoji type strings.
 *
 * This is a convenience map so consumers do not need to memorise the
 * exact string identifiers. It is intentionally non-exhaustive --
 * Feishu supports many more emoji types. Any valid emoji type string
 * can be passed directly to the API functions.
 */
export const FeishuEmoji = {
    THUMBSUP: "THUMBSUP",
    THUMBSDOWN: "THUMBSDOWN",
    HEART: "HEART",
    SMILE: "SMILE",
    JOYFUL: "JOYFUL",
    FROWN: "FROWN",
    BLUSH: "BLUSH",
    OK: "OK",
    CLAP: "CLAP",
    FIREWORKS: "FIREWORKS",
    PARTY: "PARTY",
    MUSCLE: "MUSCLE",
    FIRE: "FIRE",
    EYES: "EYES",
    THINKING: "THINKING",
    PRAISE: "PRAISE",
    PRAY: "PRAY",
    ROCKET: "ROCKET",
    DONE: "DONE",
    SKULL: "SKULL",
    HUNDREDPOINTS: "HUNDREDPOINTS",
    FACEPALM: "FACEPALM",
    CHECK: "CHECK",
    CROSSMARK: "CrossMark",
    COOL: "COOL",
    TYPING: "Typing",
    SPEECHLESS: "SPEECHLESS",
};
// ---------------------------------------------------------------------------
// addReactionFeishu
// ---------------------------------------------------------------------------
/**
 * Add an emoji reaction to a Feishu message.
 *
 * @param params.cfg       - Plugin configuration with Feishu credentials.
 * @param params.messageId - The message to react to.
 * @param params.emojiType - The emoji type string (e.g. "THUMBSUP").
 * @param params.accountId - Optional account identifier for multi-account setups.
 * @returns An object containing the platform-assigned reaction ID.
 */
export async function addReactionFeishu(params) {
    const { cfg, messageId, emojiType, accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    const response = await client.im.messageReaction.create({
        path: {
            message_id: messageId,
        },
        data: {
            reaction_type: {
                emoji_type: emojiType,
            },
        },
    });
    const reactionId = response?.data?.reaction_id;
    if (!reactionId) {
        throw new Error(`[feishu-reactions] Failed to add reaction "${emojiType}" to message ${messageId}: no reaction_id returned`);
    }
    return { reactionId };
}
// ---------------------------------------------------------------------------
// removeReactionFeishu
// ---------------------------------------------------------------------------
/**
 * Remove a specific reaction from a Feishu message by its reaction ID.
 *
 * Unlike the outbound module's `removeReaction` (which looks up the
 * reaction by emoji type), this function takes the exact reaction ID
 * for direct deletion.
 *
 * @param params.cfg        - Plugin configuration with Feishu credentials.
 * @param params.messageId  - The message the reaction belongs to.
 * @param params.reactionId - The platform-assigned reaction ID to delete.
 * @param params.accountId  - Optional account identifier for multi-account setups.
 */
export async function removeReactionFeishu(params) {
    const { cfg, messageId, reactionId, accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    await client.im.messageReaction.delete({
        path: {
            message_id: messageId,
            reaction_id: reactionId,
        },
    });
}
// ---------------------------------------------------------------------------
// listReactionsFeishu
// ---------------------------------------------------------------------------
/**
 * List reactions on a Feishu message, optionally filtered by emoji type.
 *
 * Paginates through all results and returns a flat array of
 * {@link FeishuReaction} objects.
 *
 * @param params.cfg       - Plugin configuration with Feishu credentials.
 * @param params.messageId - The message whose reactions to list.
 * @param params.emojiType - Optional emoji type filter (e.g. "THUMBSUP").
 *                           When omitted, all reaction types are returned.
 * @param params.accountId - Optional account identifier for multi-account setups.
 * @returns An array of reactions matching the criteria.
 */
export async function listReactionsFeishu(params) {
    const { cfg, messageId, emojiType, accountId } = params;
    const client = LarkClient.fromCfg(cfg, accountId).sdk;
    const reactions = [];
    let pageToken;
    let hasMore = true;
    while (hasMore) {
        const requestParams = {
            page_size: 50,
        };
        if (emojiType) {
            requestParams.reaction_type = emojiType;
        }
        if (pageToken) {
            requestParams.page_token = pageToken;
        }
        const response = await client.im.messageReaction.list({
            path: {
                message_id: messageId,
            },
            params: requestParams,
        });
        const items = response?.data?.items;
        if (items && items.length > 0) {
            for (const item of items) {
                reactions.push({
                    reactionId: item.reaction_id ?? "",
                    emojiType: item.reaction_type?.emoji_type ?? "",
                    operatorType: item.operator?.operator_type === "app" ? "app" : "user",
                    operatorId: item.operator?.operator_id ?? "",
                });
            }
        }
        pageToken = response?.data?.page_token ?? undefined;
        hasMore = response?.data?.has_more === true && !!pageToken;
    }
    return reactions;
}
//# sourceMappingURL=reactions.js.map