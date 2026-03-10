/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
export function normalizeMediaUrlInput(value) {
    let raw = value.trim();
    // Common wrappers from markdown/chat payloads.
    if (raw.startsWith("<") && raw.endsWith(">") && raw.length >= 2) {
        raw = raw.slice(1, -1).trim();
    }
    // Strip matching surrounding quotes/backticks.
    const first = raw[0];
    const last = raw[raw.length - 1];
    if (raw.length >= 2 &&
        ((first === '"' && last === '"') ||
            (first === "'" && last === "'") ||
            (first === "`" && last === "`"))) {
        raw = raw.slice(1, -1).trim();
    }
    return raw;
}
function stripQueryAndHash(value) {
    return value.split(/[?#]/, 1)[0] ?? value;
}
export function isWindowsAbsolutePath(value) {
    return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}
export function isLocalMediaPath(value) {
    const raw = normalizeMediaUrlInput(value);
    return (raw.startsWith("file://") ||
        path.isAbsolute(raw) ||
        isWindowsAbsolutePath(raw));
}
export function safeFileUrlToPath(fileUrl) {
    const raw = normalizeMediaUrlInput(fileUrl);
    try {
        return fileURLToPath(raw);
    }
    catch {
        return new URL(raw).pathname;
    }
}
export function resolveBaseNameFromPath(value) {
    const raw = normalizeMediaUrlInput(value);
    const cleanPath = stripQueryAndHash(raw);
    const fileName = isWindowsAbsolutePath(cleanPath)
        ? path.win32.basename(cleanPath)
        : path.basename(cleanPath);
    if (fileName && fileName !== "/" && fileName !== "." && fileName !== "\\") {
        return fileName;
    }
    return undefined;
}
export function resolveFileNameFromMediaUrl(mediaUrl) {
    const raw = normalizeMediaUrlInput(mediaUrl);
    if (!raw)
        return undefined;
    if (isLocalMediaPath(raw)) {
        if (raw.startsWith("file://")) {
            const fromFileUrlPath = safeFileUrlToPath(raw);
            const fromFileUrlName = resolveBaseNameFromPath(fromFileUrlPath);
            if (fromFileUrlName)
                return fromFileUrlName;
        }
        return resolveBaseNameFromPath(raw);
    }
    try {
        const parsed = new URL(raw);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            const fromUrlPath = path.posix.basename(parsed.pathname);
            if (fromUrlPath && fromUrlPath !== "/")
                return fromUrlPath;
        }
    }
    catch {
        // Not a valid URL. Continue with file path fallback.
    }
    return resolveBaseNameFromPath(raw);
}
//# sourceMappingURL=media-url-utils.js.map