/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Configuration merge helpers for Feishu account management.
 *
 * Centralises the pattern of merging a partial configuration patch
 * into the Feishu section of the top-level ClawdbotConfig, handling
 * both the default account (top-level fields) and named accounts
 * (nested under `accounts`).
 */
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import { deleteFeishuConfigSections, updateEffectiveFeishuSection, } from "../core/feishu-config.js";
/** Generic Feishu account config merge. */
function mergeFeishuAccountConfig(cfg, accountId, patch) {
    const isDefault = !accountId || accountId === DEFAULT_ACCOUNT_ID;
    if (isDefault) {
        return updateEffectiveFeishuSection(cfg, (section) => ({ ...section, ...patch }));
    }
    return updateEffectiveFeishuSection(cfg, (section) => ({
        ...section,
        accounts: {
            ...section?.accounts,
            [accountId]: { ...section?.accounts?.[accountId], ...patch },
        },
    }));
}
/** Set the `enabled` flag on a Feishu account. */
export function setAccountEnabled(cfg, accountId, enabled) {
    return mergeFeishuAccountConfig(cfg, accountId, { enabled });
}
/** Apply an arbitrary config patch to a Feishu account. */
export function applyAccountConfig(cfg, accountId, patch) {
    return mergeFeishuAccountConfig(cfg, accountId, patch);
}
/** Delete a Feishu account entry from the config. */
export function deleteAccount(cfg, accountId) {
    const isDefault = !accountId || accountId === DEFAULT_ACCOUNT_ID;
    if (isDefault) {
        return deleteFeishuConfigSections(cfg);
    }
    return updateEffectiveFeishuSection(cfg, (section) => {
        const accounts = { ...section?.accounts };
        delete accounts[accountId];
        return {
            ...section,
            accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
        };
    });
}
//# sourceMappingURL=config-adapter.js.map
