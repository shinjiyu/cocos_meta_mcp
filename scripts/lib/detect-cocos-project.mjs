import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cursorGlobalMcpConfigPath, readJsonFile } from "./paths.mjs";

/** Creator 3.x 工程根目录特征 */
export function isCocosProjectDir(dir) {
    const root = path.resolve(dir);
    const assetsDir = path.join(root, "assets");
    if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
        return false;
    }
    if (fs.existsSync(path.join(root, "project.json"))) {
        return true;
    }
    if (fs.existsSync(path.join(root, "settings"))) {
        return true;
    }
    if (fs.existsSync(path.join(root, "profiles", "v2", "packages", "project.json"))) {
        return true;
    }
    return false;
}

/** 从 startDir 向上查找 Cocos 工程根 */
export function findCocosProjectUpward(startDir = process.cwd()) {
    let dir = path.resolve(startDir);
    while (true) {
        if (isCocosProjectDir(dir)) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}

function collectPathStrings(value, out = []) {
    if (typeof value === "string") {
        if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith("/")) {
            out.push(value);
        }
        return out;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectPathStrings(item, out);
        }
        return out;
    }
    if (value && typeof value === "object") {
        for (const [key, v] of Object.entries(value)) {
            if (/project|recent|open|cwd|path|root|folder/i.test(key)) {
                collectPathStrings(v, out);
            }
        }
    }
    return out;
}

function uniqueExistingProjects(paths) {
    const seen = new Set();
    const result = [];
    for (const p of paths) {
        const resolved = path.resolve(p.replace(/\//g, path.sep));
        if (seen.has(resolved) || !isCocosProjectDir(resolved)) {
            continue;
        }
        seen.add(resolved);
        result.push(resolved);
    }
    return result;
}

/** 扫描 ~/.CocosCreator 下 JSON 中的工程路径 */
export function findProjectsFromCreatorConfig() {
    const roots = [
        path.join(os.homedir(), ".CocosCreator"),
        path.join(os.homedir(), "AppData", "Local", "CocosCreator"),
        path.join(os.homedir(), "Library", "Application Support", "CocosCreator"),
    ];
    const paths = [];
    for (const root of roots) {
        if (!fs.existsSync(root)) {
            continue;
        }
        walkJsonFiles(root, 0, 5, (file) => {
            try {
                const data = JSON.parse(fs.readFileSync(file, "utf8"));
                collectPathStrings(data, paths);
            } catch {
                /* ignore */
            }
        });
    }
    return uniqueExistingProjects(paths);
}

function walkJsonFiles(dir, depth, maxDepth, onFile) {
    if (depth > maxDepth) {
        return;
    }
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name === "node_modules" || ent.name.startsWith(".")) {
                continue;
            }
            walkJsonFiles(full, depth + 1, maxDepth, onFile);
        } else if (ent.isFile() && ent.name.endsWith(".json")) {
            onFile(full);
        }
    }
}

/** 从 Cursor mcp.json 已有 cocos 相关 server 的 cwd 推断 */
export function findProjectFromCursorMcp() {
    const cfg = readJsonFile(cursorGlobalMcpConfigPath(), {});
    const paths = [];
    for (const [name, server] of Object.entries(cfg.mcpServers ?? {})) {
        if (!server || typeof server !== "object") {
            continue;
        }
        if (server.cwd) {
            paths.push(server.cwd);
        }
        if (/cocos/i.test(name) && server.env?.COCOSMCP_PROJECT_ROOT) {
            paths.push(server.env.COCOSMCP_PROJECT_ROOT);
        }
    }
    return uniqueExistingProjects(paths)[0] ?? null;
}

/**
 * 自动解析 Cocos 工程根目录
 * @returns {{ path: string, source: string } | null}
 */
export function resolveCocosProjectRoot({ explicit, searchFrom = process.cwd() } = {}) {
    if (explicit) {
        const resolved = path.resolve(explicit);
        if (!isCocosProjectDir(resolved)) {
            throw new Error(`Not a Cocos project (missing assets/ + project markers): ${resolved}`);
        }
        return { path: resolved, source: "argument" };
    }

    for (const key of ["COCOSMCP_PROJECT_ROOT", "COCOS_PROJECT_ROOT", "CANDYSTORM_PROJECT_ROOT"]) {
        const envPath = process.env[key];
        if (envPath && isCocosProjectDir(envPath)) {
            return { path: path.resolve(envPath), source: `env:${key}` };
        }
    }

    const fromCwd = findCocosProjectUpward(searchFrom);
    if (fromCwd) {
        return { path: fromCwd, source: "cwd" };
    }

    const fromCursor = findProjectFromCursorMcp();
    if (fromCursor) {
        return { path: fromCursor, source: "cursor-mcp.json" };
    }

    const fromCreator = findProjectsFromCreatorConfig();
    if (fromCreator.length === 1) {
        return { path: fromCreator[0], source: "cocos-creator-config" };
    }
    if (fromCreator.length > 1) {
        return { path: fromCreator[0], source: `cocos-creator-config (picked 1/${fromCreator.length})` };
    }

    return null;
}

export function formatProjectCandidates() {
    const parts = [];
    const fromCreator = findProjectsFromCreatorConfig();
    if (fromCreator.length) {
        parts.push("Creator config:\n  " + fromCreator.join("\n  "));
    }
    const fromCursor = findProjectFromCursorMcp();
    if (fromCursor) {
        parts.push(`Cursor mcp.json: ${fromCursor}`);
    }
    const fromCwd = findCocosProjectUpward();
    if (fromCwd) {
        parts.push(`Current directory: ${fromCwd}`);
    }
    return parts.join("\n");
}
