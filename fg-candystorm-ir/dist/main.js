"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
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
];
const RASTER_BASENAMES = ["candystorm_bg", "candystorm_kuang", "candystorm_iconbg", "candystorm_fgbg"];
function collectReimportUrls() {
    const base = CANDYSTORM_DB_URL;
    const urls = [];
    for (const id of SPINE_IDS) {
        const p = `${base}/spine/${id}`;
        urls.push(`${p}/${id}.png`, `${p}/${id}.atlas`, `${p}/${id}.json`, `${p}/${id}.skel`);
    }
    for (const name of RASTER_BASENAMES) {
        urls.push(`${base}/ui/rasters/${name}.png`);
    }
    return urls;
}
function collectImportableRelPaths(projectPath) {
    const root = path_1.default.join(projectPath, "assets/asset_bundles/game_art/ab/candystorm");
    const needMeta = [path_1.default.join(projectPath, "assets/asset_bundles/game_art/ab/candystorm.meta")];
    if (!fs_1.default.existsSync(root))
        return needMeta;
    const skipExt = new Set([".meta", ".md"]);
    const walk = (dir) => {
        for (const ent of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
            const full = path_1.default.join(dir, ent.name);
            if (ent.isDirectory()) {
                needMeta.push(full + ".meta");
                walk(full);
            }
            else if (ent.isFile()) {
                const ext = path_1.default.extname(ent.name).toLowerCase();
                if (skipExt.has(ext))
                    continue;
                if (ent.name === "SYNC_MANIFEST.json")
                    continue;
                if (full.includes(`${path_1.default.sep}ir${path_1.default.sep}`) && ext === ".json")
                    continue;
                needMeta.push(full + ".meta");
            }
        }
    };
    walk(root);
    return needMeta;
}
async function refreshIrMeta() {
    console.log("[fg-candystorm-ir] refresh-asset", CANDYSTORM_DB_URL);
    await Editor.Message.request("asset-db", "refresh-asset", CANDYSTORM_DB_URL);
    for (const url of collectReimportUrls()) {
        try {
            await Editor.Message.request("asset-db", "reimport-asset", url);
        }
        catch (e) {
            console.warn("[fg-candystorm-ir] reimport skip", url, e);
        }
    }
    const projectPath = Editor.Project.path;
    const missing = collectImportableRelPaths(projectPath).filter((rel) => !fs_1.default.existsSync(rel));
    if (missing.length) {
        console.warn("[fg-candystorm-ir] meta still missing:", missing);
    }
    else {
        console.log("[fg-candystorm-ir] all expected .meta present");
    }
    return { ok: missing.length === 0, refreshed: CANDYSTORM_DB_URL, metaCheck: missing };
}
exports.methods = {
    refreshIrMeta,
};
let httpServer = null;
async function readJsonBody(req) {
    var _a, e_1, _b, _c;
    const chunks = [];
    try {
        for (var _d = true, req_1 = __asyncValues(req), req_1_1; req_1_1 = await req_1.next(), _a = req_1_1.done, !_a; _d = true) {
            _c = req_1_1.value;
            _d = false;
            const chunk = _c;
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = req_1.return)) await _b.call(req_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw)
        return {};
    return JSON.parse(raw);
}
/**
 * 通过已安装的 genbot 扩展生成 bind / gen.ts（需工程启用 genbot 扩展）。
 */
async function genbotGenerateFromDbUrl(dbUrl) {
    var _a;
    let uuid;
    try {
        uuid = (await Editor.Message.request("asset-db", "query-uuid", dbUrl));
    }
    catch (e) {
        return { ok: false, error: `query-uuid failed: ${String(e)}` };
    }
    if (!uuid) {
        return { ok: false, error: `asset not found: ${dbUrl}` };
    }
    const info = (await Editor.Message.request("asset-db", "query-asset-info", uuid));
    if (!((_a = info === null || info === void 0 ? void 0 : info.file) === null || _a === void 0 ? void 0 : _a.endsWith(".prefab"))) {
        return { ok: false, error: `not a prefab: ${dbUrl}` };
    }
    try {
        await Editor.Message.request("genbot", "generate-from-asset", uuid);
    }
    catch (e) {
        const msg = String(e);
        if (msg.includes("genbot") || msg.includes("Extension")) {
            return {
                ok: false,
                error: "genbot extension not available. Run: git submodule update --init extensions/genbot, enable genbot in Creator, or use MCP CLI without preferEditor.",
                detail: msg,
            };
        }
        return { ok: false, error: msg };
    }
    return { ok: true, prefab: info.file, detail: "generate-from-asset" };
}
const SCENE_EXTENSION_NAME = "fg-candystorm-ir";
const DEFAULT_PREVIEW_PORT = 7456;
async function queryPreviewPort(preferred) {
    if (preferred != null && preferred > 0)
        return preferred;
    try {
        const p = (await Editor.Message.request("server", "query-port"));
        if (typeof p === "number" && p > 0)
            return p;
    }
    catch (_a) {
        /* use default */
    }
    return DEFAULT_PREVIEW_PORT;
}
async function openPreviewUrl(body) {
    var _a, _b;
    try {
        const port = await queryPreviewPort(body.port);
        const url = ((_a = body.url) === null || _a === void 0 ? void 0 : _a.trim()) || `http://127.0.0.1:${port}/`;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { shell } = require("electron");
        await shell.openExternal(url);
        return { ok: true, url, port };
    }
    catch (e) {
        return { ok: false, error: (_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : String(e) };
    }
}
async function execSceneScript(name, method, args = []) {
    var _a;
    try {
        const result = await Editor.Message.request("scene", "execute-scene-script", {
            name,
            method,
            args,
        });
        return { ok: true, result };
    }
    catch (e) {
        const err = e;
        return { ok: false, error: (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(e), result: err === null || err === void 0 ? void 0 : err.stack };
    }
}
/**
 * Creator 内通用执行（无白名单）：Editor.Message 或 eval 函数体。
 * 供 candystorm_exec MCP 经 HTTP 调用。
 */
async function execInCreator(body) {
    var _a, _b, _c;
    try {
        if (body.mode === "message") {
            const { module, method, args = [], messageType = "request" } = body;
            if (!module || !method) {
                return { ok: false, error: "message mode requires module and method" };
            }
            let result;
            if (messageType === "send") {
                result = Editor.Message.send(module, method, ...args);
            }
            else {
                result = await Editor.Message.request(module, method, ...args);
            }
            return { ok: true, result };
        }
        if (body.mode === "eval") {
            const code = (_a = body.code) === null || _a === void 0 ? void 0 : _a.trim();
            if (!code) {
                return { ok: false, error: "eval mode requires non-empty code" };
            }
            const AsyncFunction = Object.getPrototypeOf(async function () {
                /* noop */
            }).constructor;
            const fn = new AsyncFunction("Editor", "console", "path", "fs", code);
            const result = await fn(Editor, console, path_1.default, fs_1.default);
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
            const code = (_b = body.code) === null || _b === void 0 ? void 0 : _b.trim();
            if (!code) {
                return { ok: false, error: "scene-eval requires non-empty code" };
            }
            return execSceneScript(SCENE_EXTENSION_NAME, "eval", [code]);
        }
        if (body.mode === "open-url") {
            return openPreviewUrl(body);
        }
        return { ok: false, error: `unknown mode: ${body.mode}` };
    }
    catch (e) {
        const err = e;
        return { ok: false, error: (_c = err === null || err === void 0 ? void 0 : err.message) !== null && _c !== void 0 ? _c : String(e), result: err === null || err === void 0 ? void 0 : err.stack };
    }
}
/** 供 candystorm-mcp 调用：127.0.0.1:3921 — health / IR meta / genbot / exec */
function startHttpBridge() {
    if (process.env.CANDYSTORM_IR_HTTP === "0")
        return;
    const port = Number(process.env.CANDYSTORM_IR_HTTP_PORT || 3921);
    if (httpServer)
        return;
    httpServer = http_1.default.createServer((req, res) => {
        var _a;
        const send = (code, body) => {
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
                projectPath: (_a = Editor.Project) === null || _a === void 0 ? void 0 : _a.path,
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
                        error: "regenBind is CLI-only. Use candystorm_genbot_generate without preferEditor, or regen in genbot Inspector.",
                    });
                    return;
                }
                return genbotGenerateFromDbUrl(prefab);
            })
                .then((result) => {
                if (!result)
                    return;
                send(result.ok ? 200 : 500, result);
            })
                .catch((e) => send(500, { ok: false, error: String(e) }));
            return;
        }
        if (req.method === "POST" && req.url === "/exec") {
            readJsonBody(req)
                .then((raw) => execInCreator(raw))
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
function load() {
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
function unload() {
    if (httpServer) {
        httpServer.close();
        httpServer = null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFzWEEsb0JBV0M7QUFFRCx3QkFLQztBQXhZRCw0Q0FBb0I7QUFDcEIsZ0RBQXdCO0FBQ3hCLGdEQUF3QjtBQUV4Qjs7Ozs7R0FLRztBQUVILHFDQUFxQztBQUNyQyxNQUFNLGlCQUFpQixHQUFHLGtEQUFrRCxDQUFDO0FBRTdFLE1BQU0sU0FBUyxHQUFHO0lBQ2QscUJBQXFCO0lBQ3JCLHdCQUF3QjtJQUN4Qix3QkFBd0I7SUFDeEIsc0JBQXNCO0NBQ2hCLENBQUM7QUFFWCxNQUFNLGdCQUFnQixHQUFHLENBQUMsZUFBZSxFQUFFLGtCQUFrQixFQUFFLG1CQUFtQixFQUFFLGlCQUFpQixDQUFVLENBQUM7QUFFaEgsU0FBUyxtQkFBbUI7SUFDeEIsTUFBTSxJQUFJLEdBQUcsaUJBQWlCLENBQUM7SUFDL0IsTUFBTSxJQUFJLEdBQWEsRUFBRSxDQUFDO0lBQzFCLEtBQUssTUFBTSxFQUFFLElBQUksU0FBUyxFQUFFLENBQUM7UUFDekIsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLFVBQVUsRUFBRSxFQUFFLENBQUM7UUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFGLENBQUM7SUFDRCxLQUFLLE1BQU0sSUFBSSxJQUFJLGdCQUFnQixFQUFFLENBQUM7UUFDbEMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksZUFBZSxJQUFJLE1BQU0sQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFDO0FBRUQsU0FBUyx5QkFBeUIsQ0FB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