import fs from "fs";
import http from "http";
import path from "path";

/**
 * Candystorm IR：触发 asset-db 扫描/导入，由 Creator 生成 .meta。
 *
 * 自动模式：启动 Creator 前设置环境变量 CANDYSTORM_IR_AUTO_META=1
 * （见 scripts/creator-import-ir-meta.mjs）
 */

/** 相对 assets 的 db 路径（与 sync 落盘一致） */
const CANDYSTORM_DB_URL = "db://assets/asset_bundles/game_art/ab/candystorm";

const SPINE_IDS = [
    "eff_candystorm_icon",
    "eff_candystorm_scatter",
    "eff_candystorm_collect",
    "eff_candystorm_scene",
] as const;

const RASTER_BASENAMES = ["candystorm_bg", "candystorm_kuang", "candystorm_iconbg", "candystorm_fgbg"] as const;

function collectReimportUrls(): string[] {
    const base = CANDYSTORM_DB_URL;
    const urls: string[] = [];
    for (const id of SPINE_IDS) {
        const p = `${base}/spine/${id}`;
        urls.push(`${p}/${id}.png`, `${p}/${id}.atlas`, `${p}/${id}.json`, `${p}/${id}.skel`);
    }
    for (const name of RASTER_BASENAMES) {
        urls.push(`${base}/ui/rasters/${name}.png`);
    }
    return urls;
}

function collectImportableRelPaths(projectPath: string): string[] {
    const root = path.join(projectPath, "assets/asset_bundles/game_art/ab/candystorm");
    const needMeta: string[] = [path.join(projectPath, "assets/asset_bundles/game_art/ab/candystorm.meta")];
    if (!fs.existsSync(root)) return needMeta;

    const skipExt = new Set([".meta", ".md"]);
    const walk = (dir: string) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                needMeta.push(full + ".meta");
                walk(full);
            } else if (ent.isFile()) {
                const ext = path.extname(ent.name).toLowerCase();
                if (skipExt.has(ext)) continue;
                if (ent.name === "SYNC_MANIFEST.json") continue;
                if (full.includes(`${path.sep}ir${path.sep}`) && ext === ".json") continue;
                needMeta.push(full + ".meta");
            }
        }
    };
    walk(root);
    return needMeta;
}

async function refreshIrMeta(): Promise<{ ok: boolean; refreshed: string; metaCheck: string[] }> {
    console.log("[fg-candystorm-ir] refresh-asset", CANDYSTORM_DB_URL);
    await Editor.Message.request("asset-db", "refresh-asset", CANDYSTORM_DB_URL);

    for (const url of collectReimportUrls()) {
        try {
            await Editor.Message.request("asset-db", "reimport-asset", url);
        } catch (e) {
            console.warn("[fg-candystorm-ir] reimport skip", url, e);
        }
    }

    const projectPath = Editor.Project.path;
    const missing = collectImportableRelPaths(projectPath).filter(
        (rel) => !fs.existsSync(rel),
    );
    if (missing.length) {
        console.warn("[fg-candystorm-ir] meta still missing:", missing);
    } else {
        console.log("[fg-candystorm-ir] all expected .meta present");
    }

    return { ok: missing.length === 0, refreshed: CANDYSTORM_DB_URL, metaCheck: missing };
}

export const methods = {
    refreshIrMeta,
};

let httpServer: http.Server | null = null;

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * 通过已安装的 genbot 扩展生成 bind / gen.ts（需工程启用 genbot 扩展）。
 */
async function genbotGenerateFromDbUrl(
    dbUrl: string,
): Promise<{ ok: boolean; prefab?: string; detail?: string; error?: string }> {
    let uuid: string | null | undefined;
    try {
        uuid = (await Editor.Message.request("asset-db", "query-uuid", dbUrl)) as string | null;
    } catch (e) {
        return { ok: false, error: `query-uuid failed: ${String(e)}` };
    }
    if (!uuid) {
        return { ok: false, error: `asset not found: ${dbUrl}` };
    }

    const info = (await Editor.Message.request(
        "asset-db",
        "query-asset-info",
        uuid,
    )) as { file?: string } | null;
    if (!info?.file?.endsWith(".prefab")) {
        return { ok: false, error: `not a prefab: ${dbUrl}` };
    }

    try {
        await Editor.Message.request("genbot", "generate-from-asset", uuid);
    } catch (e) {
        const msg = String(e);
        if (msg.includes("genbot") || msg.includes("Extension")) {
            return {
                ok: false,
                error:
                    "genbot extension not available. Run: git submodule update --init extensions/genbot, enable genbot in Creator, or use MCP CLI without preferEditor.",
                detail: msg,
            };
        }
        return { ok: false, error: msg };
    }

    return { ok: true, prefab: info.file, detail: "generate-from-asset" };
}

type ExecMessageBody = {
    mode: "message";
    module: string;
    method: string;
    args?: unknown[];
    messageType?: "request" | "send";
};

type ExecEvalBody = {
    mode: "eval";
    code: string;
};

/** 场景进程：execute-scene-script */
type ExecSceneScriptBody = {
    mode: "scene-script";
    name: string;
    method: string;
    args?: unknown[];
};

/** 场景进程：本扩展 scene.eval */
type ExecSceneEvalBody = {
    mode: "scene-eval";
    code: string;
};

/** 系统浏览器打开预览 URL（不构建；默认预览服已开时只需 open-url） */
type ExecOpenUrlBody = {
    mode: "open-url";
    url?: string;
    port?: number;
};

type ExecBody =
    | ExecMessageBody
    | ExecEvalBody
    | ExecSceneScriptBody
    | ExecSceneEvalBody
    | ExecOpenUrlBody;

const SCENE_EXTENSION_NAME = "fg-candystorm-ir";
const DEFAULT_PREVIEW_PORT = 7456;

async function queryPreviewPort(preferred?: number): Promise<number> {
    if (preferred != null && preferred > 0) return preferred;
    try {
        const p = (await Editor.Message.request("server", "query-port")) as number;
        if (typeof p === "number" && p > 0) return p;
    } catch {
        /* use default */
    }
    return DEFAULT_PREVIEW_PORT;
}

async function openPreviewUrl(
    body: ExecOpenUrlBody,
): Promise<{ ok: boolean; url?: string; port?: number; error?: string }> {
    try {
        const port = await queryPreviewPort(body.port);
        const url = body.url?.trim() || `http://127.0.0.1:${port}/`;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { shell } = require("electron") as { shell: { openExternal: (u: string) => Promise<void> } };
        await shell.openExternal(url);
        return { ok: true, url, port };
    } catch (e) {
        return { ok: false, error: (e as Error)?.message ?? String(e) };
    }
}

async function execSceneScript(
    name: string,
    method: string,
    args: unknown[] = [],
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
    try {
        const result = await Editor.Message.request("scene", "execute-scene-script", {
            name,
            method,
            args,
        });
        return { ok: true, result };
    } catch (e) {
        const err = e as Error;
        return { ok: false, error: err?.message ?? String(e), result: err?.stack };
    }
}

/**
 * Creator 内通用执行（无白名单）：Editor.Message 或 eval 函数体。
 * 供 candystorm_exec MCP 经 HTTP 调用。
 */
async function execInCreator(body: ExecBody): Promise<{ ok: boolean; result?: unknown; error?: string }> {
    try {
        if (body.mode === "message") {
            const { module, method, args = [], messageType = "request" } = body;
            if (!module || !method) {
                return { ok: false, error: "message mode requires module and method" };
            }
            let result: unknown;
            if (messageType === "send") {
                result = Editor.Message.send(module, method, ...args);
            } else {
                result = await Editor.Message.request(module, method, ...args);
            }
            return { ok: true, result };
        }

        if (body.mode === "eval") {
            const code = body.code?.trim();
            if (!code) {
                return { ok: false, error: "eval mode requires non-empty code" };
            }
            const AsyncFunction = Object.getPrototypeOf(async function () {
                /* noop */
            }).constructor as new (
                ...params: string[]
            ) => (...args: unknown[]) => Promise<unknown>;
            const fn = new AsyncFunction("Editor", "console", "path", "fs", code);
            const result = await fn(Editor, console, path, fs);
            return { ok: true, result };
        }

        if (body.mode === "scene-script") {
            const { name, method, args = [] } = body;
            if (!name || !method) {
                return { ok: false, error: "scene-script requires name and method" };
            }
            return execSceneScript(name, method, args);
        }

        if (body.mode === "scene-eval") {
            const code = body.code?.trim();
            if (!code) {
                return { ok: false, error: "scene-eval requires non-empty code" };
            }
            return execSceneScript(SCENE_EXTENSION_NAME, "eval", [code]);
        }

        if (body.mode === "open-url") {
            return openPreviewUrl(body);
        }

        return { ok: false, error: `unknown mode: ${(body as { mode?: string }).mode}` };
    } catch (e) {
        const err = e as Error;
        return { ok: false, error: err?.message ?? String(e), result: err?.stack };
    }
}

/** 供 candystorm-mcp 调用：127.0.0.1:3921 — health / IR meta / genbot / exec */
function startHttpBridge() {
    if (process.env.CANDYSTORM_IR_HTTP === "0") return;

    const port = Number(process.env.CANDYSTORM_IR_HTTP_PORT || 3921);
    if (httpServer) return;

    httpServer = http.createServer((req, res) => {
        const send = (code: number, body: object) => {
            res.writeHead(code, { "Content-Type": "application/json" });
            res.end(JSON.stringify(body));
        };

        if (req.method === "GET" && req.url === "/health") {
            send(200, {
                ok: true,
                service: "fg-candystorm-ir",
                genbotBridge: true,
                execBridge: true,
                execModes: ["message", "eval", "scene-script", "scene-eval", "open-url"],
                sceneExtension: SCENE_EXTENSION_NAME,
                defaultPreviewPort: DEFAULT_PREVIEW_PORT,
                projectPath: Editor.Project?.path,
            });
            return;
        }

        if (req.method === "POST" && req.url === "/refresh-ir-meta") {
            refreshIrMeta()
                .then((result) => send(200, { ok: true, result }))
                .catch((e) => send(500, { ok: false, error: String(e) }));
            return;
        }

        if (req.method === "POST" && req.url === "/genbot-generate") {
            readJsonBody(req)
                .then((body) => {
                    const prefab = typeof body.prefab === "string" ? body.prefab : "";
                    if (!prefab.startsWith("db://")) {
                        send(400, {
                            ok: false,
                            error: "body.prefab must be db://assets/.../*.prefab",
                        });
                        return;
                    }
                    if (body.regenBind) {
                        send(400, {
                            ok: false,
                            error:
                                "regenBind is CLI-only. Use candystorm_genbot_generate without preferEditor, or regen in genbot Inspector.",
                        });
                        return;
                    }
                    return genbotGenerateFromDbUrl(prefab);
                })
                .then((result) => {
                    if (!result) return;
                    send(result.ok ? 200 : 500, result);
                })
                .catch((e) => send(500, { ok: false, error: String(e) }));
            return;
        }

        if (req.method === "POST" && req.url === "/exec") {
            readJsonBody(req)
                .then((raw) => execInCreator(raw as ExecBody))
                .then((result) => send(result.ok ? 200 : 500, result))
                .catch((e) => send(500, { ok: false, error: String(e) }));
            return;
        }

        send(404, { ok: false, error: "not found" });
    });

    httpServer.listen(port, "127.0.0.1", () => {
        console.log(`[fg-candystorm-ir] MCP HTTP bridge http://127.0.0.1:${port}`);
    });
}

export function load() {
    startHttpBridge();

    if (process.env.CANDYSTORM_IR_AUTO_META === "1") {
        console.log("[fg-candystorm-ir] CANDYSTORM_IR_AUTO_META=1 — scheduling refresh");
        setTimeout(() => {
            refreshIrMeta()
                .then((r) => console.log("[fg-candystorm-ir] auto refresh done", r))
                .catch((e) => console.error("[fg-candystorm-ir] auto refresh failed", e));
        }, 8000);
    }
}

export function unload() {
    if (httpServer) {
        httpServer.close();
        httpServer = null;
    }
}
