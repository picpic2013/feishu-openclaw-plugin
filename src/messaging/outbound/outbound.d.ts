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
import type { ChannelOutboundAdapter } from "openclaw/plugin-sdk";
export declare const feishuOutbound: ChannelOutboundAdapter;
//# sourceMappingURL=outbound.d.ts.map