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
import type { ChannelMessageActionAdapter } from "openclaw/plugin-sdk";
export declare const feishuMessageActions: ChannelMessageActionAdapter;
//# sourceMappingURL=actions.d.ts.map