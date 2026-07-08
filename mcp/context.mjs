import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
    listBridgeInstances,
    normalizeProjectPath,
    probeBridgeHealth,
    bridgeUrlForPort,
    readRegistry,
    resolveBridgeUrl,
} from "./bridge-registry.mjs";

async function loadGenbotRunner() {
    try {
        return await import("./genbot-runner.mjs");
    } catch {
        return null;
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MCP_ROOT = __dirname;

/** cwd 是否像 Cocos Creator 工程根（assets/ + settings/ 或 project.json）。 */
export function looksLikeCocosProject(dir) {
    try {
        return (
            (fs.existsSync(path.join(dir, "assets")) && fs.existsSync(path.join(dir, "settings"))) ||
            fs.existsSync(path.join(dir, "project.json"))
        );
    } catch {
        return false;
    }
}

function initialProjectRoot() {
    const explicit = process.env.COCOSMCP_PROJECT_ROOT || process.env.CANDYSTORM_PROJECT_ROOT;
    if (explicit) {
        return path.resolve(explicit);
    }
    // Cursor 等客户端不保证遵守 mcp.json 的 cwd（可能落在 home 目录），
    // 只有 cwd 看起来像 Cocos 工程时才采纳，否则留空走 registry 自动探测。
    const cwd = process.cwd();
    return looksLikeCocosProject(cwd) ? path.resolve(cwd) : null;
}

/** 会话级"当前工程"。null 表示未定，届时按 registry 自动探测。 */
let currentProjectRoot = initialProjectRoot();

export function getProjectRoot() {
    return currentProjectRoot;
}

/** 同步 best-effort：当前工程，否则 registry 唯一实例（不探测），否则 null。 */
export function resolveProjectRootSync() {
    if (currentProjectRoot) {
        return currentProjectRoot;
    }
    const entries = Object.values(readRegistry().instances ?? {});
    if (entries.length === 1) {
        currentProjectRoot = path.resolve(entries[0].projectPath);
        return currentProjectRoot;
    }
    return null;
}

export function setProjectRoot(root) {
    currentProjectRoot = path.resolve(root);
    return currentProjectRoot;
}

/** 兼容旧引用：启动时的默认工程（可能为 process.cwd()，仅作展示/遗留路径用途）。 */
export const PROJECT_ROOT = currentProjectRoot ?? path.resolve(process.cwd());
export const DEFAULT_IR_ROOT = "D:/svn/new_game/糖果风暴客户端资源/export/cocosmcp_ir";
export const GAME_ART_ROOT = path.join(PROJECT_ROOT, "assets/asset_bundles/game_art/ab/candystorm");
export const CREATOR_EXTENSION_NAME = "cocos-meta-mcp";
export const CREATOR_BRIDGE =
    process.env.COCOSMCP_HTTP_URL ||
    process.env.CANDYSTORM_IR_HTTP_URL ||
    "http://127.0.0.1:3921";

export const EXPECTED_META = [
    "assets/asset_bundles/game_art/ab/candystorm.meta",
    "assets/asset_bundles/game_art/ab/candystorm/spine/eff_candystorm_icon/eff_candystorm_icon.png.meta",
    "assets/asset_bundles/game_art/ab/candystorm/spine/eff_candystorm_icon/eff_candystorm_icon.atlas.meta",
    "assets/asset_bundles/game_art/ab/candystorm/spine/eff_candystorm_icon/eff_candystorm_icon.json.meta",
    "assets/asset_bundles/game_art/ab/candystorm/ui/rasters/cocosmcp_kuang.png.meta",
];

export function irRoot() {
    return process.env.COCOSMCP_IR_ROOT || process.env.CANDYSTORM_IR_ROOT || DEFAULT_IR_ROOT;
}

export function resolveAuditProjectRoot(projectRoot) {
    return path.resolve(projectRoot || currentProjectRoot || PROJECT_ROOT);
}

/**
 * 解析目标工程（多开核心）：
 *   显式 projectRoot → 会话 currentProjectRoot → registry 唯一在线实例（并粘住）。
 * 多实例且未指定时返回错误，附实例列表提示。
 */
export async function resolveTargetProjectRoot(projectRoot, { probe = true } = {}) {
    if (projectRoot) {
        return { ok: true, projectRoot: path.resolve(projectRoot), source: "explicit" };
    }
    if (currentProjectRoot) {
        return { ok: true, projectRoot: currentProjectRoot, source: "session" };
    }

    const entries = Object.values(readRegistry().instances ?? {});
    if (entries.length === 0) {
        return {
            ok: false,
            error: "no Creator bridge registered",
            hint: `Open Creator with ${CREATOR_EXTENSION_NAME} extension, or pass projectRoot`,
        };
    }

    let candidates = entries;
    if (entries.length > 1 && probe) {
        const online = [];
        for (const entry of entries) {
            const health = await probeBridgeHealth(bridgeUrlForPort(entry.port));
            if (health.ok) {
                online.push(entry);
            }
        }
        candidates = online;
    }

    if (candidates.length === 1) {
        currentProjectRoot = path.resolve(candidates[0].projectPath);
        return { ok: true, projectRoot: currentProjectRoot, source: "registry-auto" };
    }

    return {
        ok: false,
        error: `multiple Creator bridges online (${candidates.length}); specify projectRoot or call cocosmcp_use_project`,
        instances: candidates.map((e) => ({
            projectPath: e.projectPath,
            port: e.port,
        })),
    };
}

export async function resolveBridgeForProject(projectRoot, { probe = false } = {}) {
    const resolved = await resolveTargetProjectRoot(projectRoot, { probe: true });
    if (!resolved.ok) {
        return { ok: false, error: resolved.error, hint: resolved.hint, instances: resolved.instances };
    }
    return resolveBridgeUrl(resolved.projectRoot, {
        fallbackUrl: CREATOR_BRIDGE,
        defaultProjectRoot: normalizeProjectPath(resolved.projectRoot),
        probe,
    });
}

export function runNodeScript(scriptRel, args = [], envExtra = {}) {
    return new Promise((resolve, reject) => {
        const script = path.join(PROJECT_ROOT, scriptRel);
        const child = spawn(process.execPath, [script, ...args], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, ...envExtra },
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (d) => {
            stdout += d;
        });
        child.stderr?.on("data", (d) => {
            stderr += d;
        });
        child.on("close", (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });
        child.on("error", reject);
    });
}

export function metaStatus() {
    const missing = EXPECTED_META.filter((rel) => !fs.existsSync(path.join(PROJECT_ROOT, rel)));
    let syncManifest = null;
    const manifestPath = path.join(GAME_ART_ROOT, "SYNC_MANIFEST.json");
    if (fs.existsSync(manifestPath)) {
        try {
            syncManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        } catch {
            syncManifest = { error: "invalid SYNC_MANIFEST.json" };
        }
    }
    return {
        allPresent: missing.length === 0,
        missing,
        gameArtRoot: GAME_ART_ROOT,
        irRoot: irRoot(),
        syncManifest,
    };
}

export async function fetchCreatorBridge(pathname, method = "GET", jsonBody, options = {}) {
    const { projectRoot } = options;
    const resolved = await resolveBridgeForProject(projectRoot, { probe: false });
    if (!resolved.ok || !resolved.url) {
        return {
            status: 0,
            ok: false,
            body: {
                ok: false,
                error: resolved.error ?? "Creator bridge not resolved",
                hint: resolved.hint,
                projectRoot: projectRoot || PROJECT_ROOT,
            },
            bridge: null,
            resolve: resolved,
        };
    }

    const url = `${resolved.url.replace(/\/$/, "")}${pathname}`;
    const init = { method };
    if (jsonBody !== undefined) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(jsonBody);
    }
    const res = await fetch(url, init);
    const text = await res.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = { raw: text };
    }
    return {
        status: res.status,
        ok: res.ok,
        body,
        bridge: resolved.url,
        resolve: resolved,
    };
}

export async function runGenbotGenerate({ prefab, regenBind = false, dryRun = false, preferEditor = false, projectRoot }) {
    const genbot = await loadGenbotRunner();
    if (!genbot) {
        return {
            ok: false,
            error: "genbot-runner.mjs not available (install genbot plugin locally)",
            prefabInput: prefab,
        };
    }
    const {
        expectedGenbotOutputs,
        genbotSetupHint,
        readRegistryEntry,
        resolveGenbotRoot,
        resolvePrefabPath,
        runGenbotCli,
    } = genbot;
    const rootResolved = await resolveTargetProjectRoot(projectRoot);
    if (!rootResolved.ok) {
        return { ok: false, error: rootResolved.error, hint: rootResolved.hint, instances: rootResolved.instances };
    }
    const targetRoot = rootResolved.projectRoot;
    const prefabAbs = resolvePrefabPath(prefab, targetRoot);
    if (!fs.existsSync(prefabAbs)) {
        return {
            ok: false,
            error: `prefab not found: ${prefabAbs}`,
            prefabInput: prefab,
        };
    }

    const outputs = expectedGenbotOutputs(targetRoot, prefabAbs);

    if (preferEditor) {
        try {
            const health = await fetchCreatorBridge("/health", "GET", undefined, { projectRoot: targetRoot });
            if (health.ok) {
                const editor = await fetchCreatorBridge(
                    "/genbot-generate",
                    "POST",
                    {
                        prefab: prefab.startsWith("db://")
                            ? prefab
                            : `db://assets/${path
                                  .relative(path.join(targetRoot, "assets"), prefabAbs)
                                  .replace(/\\/g, "/")}`,
                        regenBind,
                    },
                    { projectRoot: targetRoot },
                );
                if (editor.ok && editor.body?.ok) {
                    return {
                        ok: true,
                        mode: "editor",
                        prefabAbs,
                        outputs,
                        registry: readRegistryEntry(targetRoot, outputs.prefabName),
                        editor: editor.body,
                    };
                }
            }
        } catch {
            /* fall through to CLI */
        }
    }

    const genbotRoot = resolveGenbotRoot(targetRoot);
    if (!genbotRoot) {
        return {
            ok: false,
            error: "genbot not found in project (extensions/genbot submodule missing or empty)",
            setup: genbotSetupHint(targetRoot),
            prefabAbs,
            outputs,
        };
    }

    const r = await runGenbotCli({
        projectRoot: targetRoot,
        prefabPath: prefabAbs,
        genbotRoot,
        regenBind,
        dryRun,
        quiet: false,
    });

    const written = {
        bindJson: fs.existsSync(outputs.bindJson),
        genTs: fs.existsSync(outputs.genTs),
        viewTs: fs.existsSync(outputs.viewTs),
    };

    return {
        ok: r.code === 0,
        mode: "cli",
        exitCode: r.code,
        genbotRoot,
        prefabAbs,
        outputs: {
            ...outputs,
            written,
        },
        registry: readRegistryEntry(targetRoot, outputs.prefabName),
        stdout: r.stdout,
        stderr: r.stderr,
    };
}

export function createContext() {
    return {
        PROJECT_ROOT,
        MCP_ROOT,
        CREATOR_EXTENSION_NAME,
        CREATOR_BRIDGE,
        GAME_ART_ROOT,
        irRoot,
        runNodeScript,
        metaStatus,
        fetchCreatorBridge,
        resolveBridgeForProject,
        listBridgeInstances,
        resolveAuditProjectRoot,
        resolveTargetProjectRoot,
        resolveProjectRootSync,
        getProjectRoot,
        setProjectRoot,
        runGenbotGenerate,
    };
}

/** Per-plugin ctx passed to register() — includes zod + manifest from catalog dir. */
export function createPluginContext(baseCtx, { manifest, genbotRunner = null }) {
    return {
        ...baseCtx,
        z,
        pluginManifest: manifest,
        genbotRunner,
    };
}
