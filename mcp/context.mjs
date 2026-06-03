import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

async function loadGenbotRunner() {
    try {
        return await import("./genbot-runner.mjs");
    } catch {
        return null;
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MCP_ROOT = __dirname;
export const PROJECT_ROOT = path.resolve(
    process.env.COCOSMCP_PROJECT_ROOT ||
        process.env.CANDYSTORM_PROJECT_ROOT ||
        process.cwd(),
);
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

export async function fetchCreatorBridge(pathname, method = "GET", jsonBody) {
    const url = `${CREATOR_BRIDGE.replace(/\/$/, "")}${pathname}`;
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
    return { status: res.status, ok: res.ok, body };
}

export async function runGenbotGenerate({ prefab, regenBind = false, dryRun = false, preferEditor = false }) {
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
    const prefabAbs = resolvePrefabPath(prefab, PROJECT_ROOT);
    if (!fs.existsSync(prefabAbs)) {
        return {
            ok: false,
            error: `prefab not found: ${prefabAbs}`,
            prefabInput: prefab,
        };
    }

    const outputs = expectedGenbotOutputs(PROJECT_ROOT, prefabAbs);

    if (preferEditor) {
        try {
            const health = await fetchCreatorBridge("/health");
            if (health.ok) {
                const editor = await fetchCreatorBridge("/genbot-generate", "POST", {
                    prefab: prefab.startsWith("db://")
                        ? prefab
                        : `db://assets/${path
                              .relative(path.join(PROJECT_ROOT, "assets"), prefabAbs)
                              .replace(/\\/g, "/")}`,
                    regenBind,
                });
                if (editor.ok && editor.body?.ok) {
                    return {
                        ok: true,
                        mode: "editor",
                        prefabAbs,
                        outputs,
                        registry: readRegistryEntry(PROJECT_ROOT, outputs.prefabName),
                        editor: editor.body,
                    };
                }
            }
        } catch {
            /* fall through to CLI */
        }
    }

    const genbotRoot = resolveGenbotRoot(PROJECT_ROOT);
    if (!genbotRoot) {
        return {
            ok: false,
            error: "genbot not found in project (extensions/genbot submodule missing or empty)",
            setup: genbotSetupHint(PROJECT_ROOT),
            prefabAbs,
            outputs,
        };
    }

    const r = await runGenbotCli({
        projectRoot: PROJECT_ROOT,
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
        registry: readRegistryEntry(PROJECT_ROOT, outputs.prefabName),
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
