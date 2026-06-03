import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { resolveCocosVersion } from "./cocos-version.mjs";
import {
    getManifestVersionSpec,
    matchCocosVersion,
    resolveToolVersionSlug,
} from "./cocos-version-range.mjs";
import { cocosmcpDir, ensureDirs } from "./recipe-registry.mjs";
import { versionedToolName } from "./tool-naming.mjs";
import { MCP_ROOT } from "./context.mjs";

const BUILTIN_PLUGINS_DIR = path.join(MCP_ROOT, "plugins");
const PACKAGE_LOAD_CONFIG = path.join(BUILTIN_PLUGINS_DIR, "load.json");
const DEFAULT_BUNDLED_PLUGINS = ["asset-meta", "asset-sync"];
const loaded = new Map();

function installedRoot(projectRoot) {
    return path.join(cocosmcpDir(projectRoot), "installed");
}

function installedPluginDir(projectRoot, pluginId) {
    return path.join(installedRoot(projectRoot), pluginId);
}

function readPackageLoadConfig() {
    if (!fs.existsSync(PACKAGE_LOAD_CONFIG)) {
        return { version: 1, enabled: [...DEFAULT_BUNDLED_PLUGINS] };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(PACKAGE_LOAD_CONFIG, "utf8"));
        if (Array.isArray(raw.enabled)) {
            return { version: raw.version ?? 1, enabled: raw.enabled.filter(Boolean) };
        }
        return { version: 1, enabled: [...DEFAULT_BUNDLED_PLUGINS], error: "load.json missing enabled[]" };
    } catch {
        return { version: 1, enabled: [...DEFAULT_BUNDLED_PLUGINS], error: "invalid load.json" };
    }
}

export function packageLoadConfigPath(mcpRoot = MCP_ROOT) {
    return path.join(mcpRoot, "plugins", "load.json");
}

function pluginsConfigPath(projectRoot) {
    return path.join(cocosmcpDir(projectRoot), "plugins.json");
}

function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, ent.name);
        const to = path.join(dest, ent.name);
        if (ent.isDirectory()) {copyDirRecursive(from, to);}
        else {fs.copyFileSync(from, to);}
    }
}

function readManifestAt(dir, pluginId) {
    const file = path.join(dir, "manifest.json");
    if (!fs.existsSync(file)) {return null;}
    try {
        const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
        manifest.id = manifest.id ?? pluginId;
        return manifest;
    } catch {
        return { id: pluginId, error: "invalid manifest.json" };
    }
}

function readPluginsConfig(projectRoot) {
    ensureDirs(projectRoot);
    const file = pluginsConfigPath(projectRoot);
    if (!fs.existsSync(file)) {return { version: 2, plugins: {} };}
    try {
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));
        if (Array.isArray(raw.enabled)) {
            const plugins = {};
            for (const id of raw.enabled) {
                plugins[id] = { enabled: true, migratedFromV1: true };
            }
            return { version: 2, plugins, cocosCreatorVersion: raw.cocosCreatorVersion };
        }
        return raw;
    } catch {
        return { version: 2, plugins: {}, error: "invalid plugins.json" };
    }
}

function writePluginsConfig(projectRoot, cfg) {
    ensureDirs(projectRoot);
    cfg.version = 2;
    cfg.updatedAt = new Date().toISOString();
    fs.writeFileSync(pluginsConfigPath(projectRoot), `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
    return cfg;
}

function setPluginRecord(projectRoot, pluginId, patch) {
    const cfg = readPluginsConfig(projectRoot);
    cfg.plugins = cfg.plugins ?? {};
    cfg.plugins[pluginId] = {
        ...(cfg.plugins[pluginId] ?? {}),
        ...patch,
        id: pluginId,
    };
    return writePluginsConfig(projectRoot, cfg);
}

export function listBuiltinPlugins() {
    if (!fs.existsSync(BUILTIN_PLUGINS_DIR)) {return [];}
    return fs
        .readdirSync(BUILTIN_PLUGINS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => {
            const manifest = readManifestAt(path.join(BUILTIN_PLUGINS_DIR, d.name), d.name);
            return {
                id: d.name,
                source: "builtin",
                name: manifest?.name ?? d.name,
                description: manifest?.description,
                cocosVersion: getManifestVersionSpec(manifest ?? {}),
                cocosVersionRange: manifest?.cocosVersionRange,
                tools: manifest?.tools ?? [],
                error: manifest?.error,
            };
        });
}

export function listInstalledPlugins(projectRoot) {
    const root = installedRoot(projectRoot);
    if (!fs.existsSync(root)) {return [];}
    return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => {
            const dir = path.join(root, d.name);
            const manifest = readManifestAt(dir, d.name);
            return {
                id: d.name,
                source: manifest?.source ?? "installed",
                installPath: dir,
                name: manifest?.name ?? d.name,
                description: manifest?.description,
                tools: manifest?.toolsVersioned ?? manifest?.tools ?? [],
                cocosVersion: manifest?.cocosVersionSpec ?? getManifestVersionSpec(manifest ?? {}),
                cocosVersionRange: manifest?.cocosVersionRange,
                detectedCreatorVersion: manifest?.detectedCreatorVersion ?? manifest?.cocosCreatorVersion,
                toolVersionSlug: manifest?.toolVersionSlug ?? manifest?.cocosVersionSlug,
                cocosCreatorVersion: manifest?.detectedCreatorVersion ?? manifest?.cocosCreatorVersion,
                cocosVersionSlug: manifest?.toolVersionSlug ?? manifest?.cocosVersionSlug,
                installedAt: manifest?.installedAt,
                error: manifest?.error,
            };
        });
}

export function listAvailablePlugins(projectRoot) {
    const byId = new Map();
    for (const p of listBuiltinPlugins()) {byId.set(p.id, p);}
    for (const p of listInstalledPlugins(projectRoot)) {
        byId.set(p.id, { ...byId.get(p.id), ...p, installed: true });
    }
    return [...byId.values()];
}

export function resolveEnabledPluginIds(projectRoot) {
    if (process.env.COCOSMCP_ALL === "1" || process.env.COCOSMCP_TOOL_PROFILE === "full") {
        return listAvailablePlugins(projectRoot).map((p) => p.id);
    }

    const ids = new Set();

    for (const id of readPackageLoadConfig().enabled ?? []) {
        ids.add(id);
    }

    const cfg = readPluginsConfig(projectRoot);
    for (const [id, rec] of Object.entries(cfg.plugins ?? {})) {
        if (rec.enabled !== false) {
            ids.add(id);
        }
    }

    for (const id of (process.env.COCOSMCP_PLUGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        ids.add(id);
    }

    if (!ids.size) {
        return [...DEFAULT_BUNDLED_PLUGINS];
    }
    return [...ids];
}

export function getLoadedPluginIds() {
    return [...loaded.keys()];
}

function builtinPluginDir(pluginId) {
    return path.join(BUILTIN_PLUGINS_DIR, pluginId);
}

/** 全量复制插件到工程 .cocosmcp/installed/{id}/，写入 Cocos 版本与 versioned tool 名 */
export async function installPluginFull(projectRoot, pluginId, ctx) {
    const src = builtinPluginDir(pluginId);
    if (!fs.existsSync(src)) {
        const existing = installedPluginDir(projectRoot, pluginId);
        if (fs.existsSync(path.join(existing, "manifest.json"))) {
            return { ok: true, pluginId, installPath: existing, reinstalled: false, alreadyInstalled: true };
        }
        throw new Error(`plugin not found in builtin catalog: ${pluginId}`);
    }

    const { version } = await resolveCocosVersion(projectRoot, ctx.fetchCreatorBridge);
    const dest = installedPluginDir(projectRoot, pluginId);

    if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
    }
    copyDirRecursive(src, dest);

    const manifest = readManifestAt(dest, pluginId);
    if (!manifest || manifest.error) {
        throw new Error(`invalid plugin manifest after install: ${pluginId}`);
    }

    const versionSpec = getManifestVersionSpec(manifest);
    if (version !== "unknown" && !matchCocosVersion(version, versionSpec)) {
        throw new Error(
            `Creator ${version} does not match plugin ${pluginId} version spec: ${JSON.stringify(versionSpec)}`,
        );
    }

    const toolSlug = resolveToolVersionSlug(version, manifest);

    manifest.installedAt = new Date().toISOString();
    manifest.cocosVersionSpec = versionSpec;
    manifest.detectedCreatorVersion = version;
    manifest.toolVersionSlug = toolSlug;
    manifest.cocosCreatorVersion = version;
    manifest.cocosVersionSlug = toolSlug;
    manifest.source = manifest.source ?? "builtin";
    manifest.toolsVersioned = (manifest.tools ?? []).map((t) => versionedToolName(toolSlug, t));
    fs.writeFileSync(path.join(dest, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const cfg = setPluginRecord(projectRoot, pluginId, {
        enabled: true,
        installedAt: manifest.installedAt,
        cocosVersionSpec: versionSpec,
        detectedCreatorVersion: version,
        toolVersionSlug: toolSlug,
        cocosCreatorVersion: version,
        cocosVersionSlug: toolSlug,
        installPath: path.relative(projectRoot, dest).replace(/\\/g, "/"),
        toolsVersioned: manifest.toolsVersioned,
    });
    cfg.cocosCreatorVersion = version;
    cfg.cocosVersionSlug = toolSlug;
    writePluginsConfig(projectRoot, cfg);

    return {
        ok: true,
        pluginId,
        installPath: dest,
        cocosVersionSpec: versionSpec,
        detectedCreatorVersion: version,
        toolVersionSlug: toolSlug,
        cocosCreatorVersion: version,
        cocosVersionSlug: toolSlug,
        toolsVersioned: manifest.toolsVersioned,
        reinstalled: true,
    };
}

export async function ensurePluginInstalled(projectRoot, pluginId, ctx) {
    const dest = installedPluginDir(projectRoot, pluginId);
    const manifestPath = path.join(dest, "manifest.json");
    const { version } = await resolveCocosVersion(projectRoot, ctx.fetchCreatorBridge);

    if (fs.existsSync(manifestPath)) {
        const manifest = readManifestAt(dest, pluginId);
        const versionSpec = manifest.cocosVersionSpec ?? getManifestVersionSpec(manifest);
        const specOk = version === "unknown" || matchCocosVersion(version, versionSpec);
        const expectedSlug = resolveToolVersionSlug(version, { ...manifest, cocosVersion: versionSpec });
        const slugOk = manifest.toolVersionSlug === expectedSlug || manifest.cocosVersionSlug === expectedSlug;

        if (specOk && slugOk && manifest.toolsVersioned?.length) {
            setPluginRecord(projectRoot, pluginId, {
                enabled: true,
                cocosVersionSpec: versionSpec,
                detectedCreatorVersion: version,
                toolVersionSlug: manifest.toolVersionSlug ?? expectedSlug,
                toolsVersioned: manifest.toolsVersioned,
            });
            return {
                ok: true,
                pluginId,
                installPath: dest,
                skipped: true,
                cocosVersionSpec: versionSpec,
                detectedCreatorVersion: version,
                toolVersionSlug: manifest.toolVersionSlug ?? expectedSlug,
                versionMismatch: false,
            };
        }

        if (!specOk) {
            throw new Error(
                `Creator ${version} outside plugin ${pluginId} spec ${JSON.stringify(versionSpec)}; update manifest or Creator version`,
            );
        }
    }

    return installPluginFull(projectRoot, pluginId, ctx);
}

export async function loadPlugin(server, ctx, pluginId) {
    if (loaded.has(pluginId)) {
        return { ok: true, pluginId, alreadyLoaded: true, ...loaded.get(pluginId) };
    }

    const projectRoot = ctx.PROJECT_ROOT;
    await ensurePluginInstalled(projectRoot, pluginId, ctx);

    const dest = installedPluginDir(projectRoot, pluginId);
    const manifest = readManifestAt(dest, pluginId);
    if (!manifest || manifest.error) {
        throw new Error(`installed plugin invalid: ${pluginId}`);
    }

    const slug = manifest.toolVersionSlug ?? manifest.cocosVersionSlug ?? "unknown";
    ctx.versionedToolName = (baseName) => versionedToolName(slug, baseName);
    ctx.cocosCreatorVersion = manifest.detectedCreatorVersion ?? manifest.cocosCreatorVersion;
    ctx.cocosVersionSlug = slug;
    ctx.cocosVersionSpec = manifest.cocosVersionSpec ?? getManifestVersionSpec(manifest);

    const modPath = pathToFileURL(path.join(dest, "index.mjs")).href;
    const mod = await import(`${modPath}?v=${manifest.installedAt ?? Date.now()}`);
    if (typeof mod.register !== "function") {
        throw new Error(`plugin ${pluginId} missing register()`);
    }

    const result = mod.register(server, ctx);
    loaded.set(pluginId, { ...result, cocosCreatorVersion: manifest.cocosCreatorVersion, toolsVersioned: result.toolNames });
    return {
        ok: true,
        pluginId,
        installPath: dest,
        cocosCreatorVersion: manifest.cocosCreatorVersion,
        toolNames: result.toolNames,
    };
}

export async function loadPlugins(server, ctx, pluginIds) {
    const loadedIds = [];
    const failed = [];
    for (const id of pluginIds) {
        try {
            await loadPlugin(server, ctx, id);
            loadedIds.push(id);
        } catch (e) {
            failed.push({ id, error: String(e) });
        }
    }
    return { loaded: loadedIds, failed };
}

export function enablePluginPersist(projectRoot, pluginId, installMeta = {}) {
    return setPluginRecord(projectRoot, pluginId, { enabled: true, ...installMeta });
}

export function disablePluginPersist(projectRoot, pluginId) {
    const cfg = readPluginsConfig(projectRoot);
    if (cfg.plugins?.[pluginId]) {
        cfg.plugins[pluginId].enabled = false;
        cfg.plugins[pluginId].disabledAt = new Date().toISOString();
        return writePluginsConfig(projectRoot, cfg);
    }
    return cfg;
}

export function unloadPlugin(pluginId) {
    const entry = loaded.get(pluginId);
    if (!entry) {
        return { ok: false, error: `plugin not loaded: ${pluginId}` };
    }
    for (const handle of entry.handles ?? []) {
        try {
            handle.remove?.();
        } catch {
            /* ignore */
        }
    }
    loaded.delete(pluginId);
    return { ok: true, pluginId, removedTools: entry.toolNames ?? entry.toolsVersioned ?? [] };
}

export function registerPluginManagementTools(server, ctx, { recipeLayer }) {
    if (recipeLayer < 1) {return [];}

    const { PROJECT_ROOT } = ctx;
    const handles = [];

    handles.push(
        server.tool(
            "cocosmcp_plugin_list",
            "列出内置/已全量安装到工程的插件（.cocosmcp/installed/），含 Cocos 版本与 versioned tool 名。",
            {},
            async () => {
                const cfg = readPluginsConfig(PROJECT_ROOT);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    projectRoot: PROJECT_ROOT,
                                    configPath: pluginsConfigPath(PROJECT_ROOT),
                                    installedRoot: installedRoot(PROJECT_ROOT),
                                    envPlugins: process.env.COCOSMCP_PLUGINS ?? "",
                                    config: cfg,
                                    available: listAvailablePlugins(PROJECT_ROOT),
                                    enabled: resolveEnabledPluginIds(PROJECT_ROOT),
                                    loaded: getLoadedPluginIds(),
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            },
        ),
    );

    handles.push(
        server.tool(
            "cocosmcp_plugin_install",
            "全量安装插件到工程 .cocosmcp/installed/{id}/（含 manifest、index.mjs 副本），tool 名带 Cocos 版本号。",
            {
                pluginId: z.string(),
                load: z.boolean().optional().describe("true=安装后立即加载 tool，默认 true"),
            },
            async ({ pluginId, load = true }) => {
                try {
                    const installed = await installPluginFull(PROJECT_ROOT, pluginId, ctx);
                    let loadedResult;
                    if (load) {
                        loadedResult = await loadPlugin(server, ctx, pluginId);
                    } else {
                        enablePluginPersist(PROJECT_ROOT, pluginId, {
                            cocosCreatorVersion: installed.cocosCreatorVersion,
                            cocosVersionSlug: installed.cocosVersionSlug,
                            toolsVersioned: installed.toolsVersioned,
                        });
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ installed, loaded: loadedResult }, null, 2),
                            },
                        ],
                    };
                } catch (e) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String(e) }, null, 2) }],
                        isError: true,
                    };
                }
            },
        ),
    );

    handles.push(
        server.tool(
            "cocosmcp_plugin_enable",
            "全量安装（若尚未安装）并加载插件 tool；持久化到 .cocosmcp/plugins.json + installed/。",
            {
                pluginId: z.string(),
            },
            async ({ pluginId }) => {
                try {
                    const installed = await ensurePluginInstalled(PROJECT_ROOT, pluginId, ctx);
                    const loadedResult = await loadPlugin(server, ctx, pluginId);
                    const cfg = enablePluginPersist(PROJECT_ROOT, pluginId, {
                        cocosCreatorVersion: installed.cocosCreatorVersion ?? loadedResult.cocosCreatorVersion,
                        toolsVersioned: loadedResult.toolNames,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ installed, loaded: loadedResult, config: cfg }, null, 2),
                            },
                        ],
                    };
                } catch (e) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String(e) }, null, 2) }],
                        isError: true,
                    };
                }
            },
        ),
    );

    handles.push(
        server.tool(
            "cocosmcp_plugin_disable",
            "卸载 MCP tool（保留 .cocosmcp/installed/ 全量副本供下次复用）。",
            {
                pluginId: z.string(),
            },
            async ({ pluginId }) => {
                const unloaded = unloadPlugin(pluginId);
                const cfg = disablePluginPersist(PROJECT_ROOT, pluginId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    unloaded,
                                    config: cfg,
                                    note: "installed/ 目录保留，可 cocosmcp_plugin_enable 再次加载",
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                    isError: !unloaded.ok,
                };
            },
        ),
    );

    return handles;
}
