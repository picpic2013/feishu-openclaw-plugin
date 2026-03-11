/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Feishu config alias helpers.
 *
 * Runtime code in this plugin still expects `channels.feishu`, but users may
 * choose to store configuration under `channels.feishu-streamable`. These
 * helpers centralize the alias resolution so callers can prefer the streamable
 * section without rewriting every existing `feishu` code path.
 */
export const FEISHU_CHANNEL_KEY = "feishu";
export const FEISHU_STREAMABLE_CHANNEL_KEY = "feishu-streamable";
export function getEffectiveFeishuChannelKey(cfg) {
    if (cfg?.channels?.[FEISHU_STREAMABLE_CHANNEL_KEY]) {
        return FEISHU_STREAMABLE_CHANNEL_KEY;
    }
    if (cfg?.channels?.[FEISHU_CHANNEL_KEY]) {
        return FEISHU_CHANNEL_KEY;
    }
    return FEISHU_STREAMABLE_CHANNEL_KEY;
}
export function getEffectiveFeishuSection(cfg) {
    const key = getEffectiveFeishuChannelKey(cfg);
    return cfg?.channels?.[key];
}
export function normalizeFeishuRuntimeConfig(cfg) {
    const effectiveSection = getEffectiveFeishuSection(cfg);
    if (!cfg || !effectiveSection) {
        return cfg;
    }
    if (cfg.channels?.[FEISHU_CHANNEL_KEY] === effectiveSection &&
        getEffectiveFeishuChannelKey(cfg) === FEISHU_CHANNEL_KEY) {
        return cfg;
    }
    return {
        ...cfg,
        channels: {
            ...cfg.channels,
            [FEISHU_CHANNEL_KEY]: effectiveSection,
        },
    };
}
export function updateEffectiveFeishuSection(cfg, updater) {
    const current = getEffectiveFeishuSection(cfg) ?? {};
    return {
        ...cfg,
        channels: {
            ...cfg?.channels,
            [FEISHU_STREAMABLE_CHANNEL_KEY]: updater(current),
        },
    };
}
export function deleteFeishuConfigSections(cfg) {
    const next = {
        ...cfg,
    };
    const nextChannels = {
        ...cfg?.channels,
    };
    delete nextChannels[FEISHU_CHANNEL_KEY];
    delete nextChannels[FEISHU_STREAMABLE_CHANNEL_KEY];
    if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
    }
    else {
        delete next.channels;
    }
    return next;
}
