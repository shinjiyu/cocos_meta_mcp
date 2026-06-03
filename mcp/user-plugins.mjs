import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Shipped with npm; never copied to user store by plugin install. */
export const DEFAULT_BUNDLED_PLUGINS = ["asset-meta", "asset-sync"];

/** User plugin + load.json root (survives npm update -g). Override with COCOSMCP_USER_PLUGINS_HOME. */
export function userPluginsHome() {
    return process.env.COCOSMCP_USER_PLUGINS_HOME ?? path.join(os.tmpdir(), "cocos-meta-mcp");
}

export function userPluginsDir() {
    return path.join(userPluginsHome(), "plugins");
}

export function userLoadConfigPath() {
    return path.join(userPluginsHome(), "load.json");
}

export function ensureUserPluginsHome() {
    fs.mkdirSync(userPluginsDir(), { recursive: true });
}

export function readUserLoadConfig() {
    const configPath = userLoadConfigPath();
    if (!fs.existsSync(configPath)) {
        return { version: 1, enabled: [...DEFAULT_BUNDLED_PLUGINS], configPath };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (Array.isArray(raw.enabled)) {
            return { version: raw.version ?? 1, enabled: raw.enabled.filter(Boolean), configPath };
        }
        return {
            version: 1,
            enabled: [...DEFAULT_BUNDLED_PLUGINS],
            configPath,
            error: "load.json missing enabled[]",
        };
    } catch {
        return { version: 1, enabled: [...DEFAULT_BUNDLED_PLUGINS], configPath, error: "invalid load.json" };
    }
}

export function writeUserLoadConfig(enabled, { dryRun = false } = {}) {
    const configPath = userLoadConfigPath();
    const next = {
        version: 1,
        enabled: [...enabled],
        updatedAt: new Date().toISOString(),
    };
    if (!dryRun) {
        ensureUserPluginsHome();
        fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    }
    return { configPath, enabled: next.enabled, changed: true };
}

export function mergeUserLoadConfig(pluginIds, { dryRun = false } = {}) {
    const current = readUserLoadConfig();
    const enabled = new Set(current.enabled ?? []);
    for (const id of DEFAULT_BUNDLED_PLUGINS) {
        enabled.add(id);
    }
    for (const id of pluginIds) {
        enabled.add(id);
    }
    return writeUserLoadConfig([...enabled], { dryRun });
}

/** Only migrate when mcpRoot is inside a published npm install (not a git dev tree). */
export function isNpmInstalledMcpRoot(mcpRoot) {
    const normalized = path.resolve(mcpRoot).replace(/\\/g, "/").toLowerCase();
    return normalized.includes("/node_modules/cocos-meta-mcp/mcp");
}

/** Move non-bundled plugins from npm package dir into user store (legacy layout). */
export function migrateLegacyPluginsFromPackage(mcpRoot) {
    if (!isNpmInstalledMcpRoot(mcpRoot)) {
        return { migrated: [] };
    }
    const pkgPluginsDir = path.join(mcpRoot, "plugins");
    if (!fs.existsSync(pkgPluginsDir)) {
        return { migrated: [] };
    }
    ensureUserPluginsHome();
    const migrated = [];
    for (const ent of fs.readdirSync(pkgPluginsDir, { withFileTypes: true })) {
        if (!ent.isDirectory() || DEFAULT_BUNDLED_PLUGINS.includes(ent.name)) {
            continue;
        }
        const src = path.join(pkgPluginsDir, ent.name);
        if (!fs.existsSync(path.join(src, "manifest.json"))) {
            continue;
        }
        const dest = path.join(userPluginsDir(), ent.name);
        if (!fs.existsSync(dest)) {
            fs.cpSync(src, dest, { recursive: true });
            migrated.push(ent.name);
        }
        if (fs.existsSync(src)) {
            fs.rmSync(src, { recursive: true, force: true });
        }
    }

    const legacyLoad = path.join(pkgPluginsDir, "load.json");
    if (fs.existsSync(legacyLoad)) {
        try {
            const raw = JSON.parse(fs.readFileSync(legacyLoad, "utf8"));
            if (Array.isArray(raw.enabled)) {
                mergeUserLoadConfig(raw.enabled.filter((id) => !DEFAULT_BUNDLED_PLUGINS.includes(id)));
            }
        } catch {
            /* ignore */
        }
        fs.rmSync(legacyLoad, { force: true });
    }

    return { migrated };
}

export function resolveCatalogPluginDir(pluginId, mcpRoot) {
    const userDir = path.join(userPluginsDir(), pluginId);
    if (fs.existsSync(path.join(userDir, "manifest.json"))) {
        return userDir;
    }
    const pkgDir = path.join(mcpRoot, "plugins", pluginId);
    if (fs.existsSync(path.join(pkgDir, "manifest.json"))) {
        return pkgDir;
    }
    return null;
}
