/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * OpenClaw Feishu/Lark plugin entry point.
 *
 * Registers the Feishu channel and all tool families:
 * doc, wiki, drive, perm, bitable, task, calendar.
 */
export { monitorFeishuProvider } from "./src/channel/monitor.js";
export { sendMessageFeishu, sendCardFeishu, updateCardFeishu, editMessageFeishu, } from "./src/messaging/outbound/send.js";
export { getMessageFeishu, } from "./src/messaging/outbound/fetch.js";
export { uploadImageFeishu, uploadFileFeishu, sendImageFeishu, sendFileFeishu, sendAudioFeishu, sendMediaFeishu, } from "./src/messaging/outbound/media.js";
export { probeFeishu } from "./src/channel/probe.js";
export { addReactionFeishu, removeReactionFeishu, listReactionsFeishu, FeishuEmoji, } from "./src/messaging/outbound/reactions.js";
export { forwardMessageFeishu } from "./src/messaging/outbound/forward.js";
export { updateChatFeishu, addChatMembersFeishu, removeChatMembersFeishu, listChatMembersFeishu, } from "./src/messaging/outbound/chat-manage.js";
export { feishuMessageActions } from "./src/messaging/outbound/actions.js";
export { mentionedBot, nonBotMentions, extractMessageBody, formatMentionForText, formatMentionForCard, formatMentionAllForText, formatMentionAllForCard, buildMentionedMessage, buildMentionedCardContent, type MentionInfo, } from "./src/messaging/inbound/mention.js";
export { feishuPlugin } from "./src/channel/plugin.js";
export type { MessageContext, RawMessage, RawSender, FeishuMessageContext, FeishuReactionCreatedEvent, } from "./src/messaging/types.js";
export { handleFeishuReaction } from "./src/messaging/inbound/reaction-handler.js";
export { parseMessageEvent } from "./src/messaging/inbound/parse.js";
export { checkMessageGate } from "./src/messaging/inbound/gate.js";
export { isMessageExpired } from "./src/messaging/inbound/dedup.js";
declare const plugin: any;
export default plugin;
//# sourceMappingURL=index.d.ts.map