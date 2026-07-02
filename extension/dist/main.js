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
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
/**
 * Candystorm IR：触发 asset-db 扫描/导入，由 Creator 生成 .meta。
 *
 * 自动模式：启动 Creator 前设置 COCOSMCP_AUTO_META=1（兼容 CANDYSTORM_IR_AUTO_META）
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
    console.log("[cocos-meta-mcp] refresh-asset", CANDYSTORM_DB_URL);
    await Editor.Message.request("asset-db", "refresh-asset", CANDYSTORM_DB_URL);
    for (const url of collectReimportUrls()) {
        try {
            await Editor.Message.request("asset-db", "reimport-asset", url);
        }
        catch (e) {
            console.warn("[cocos-meta-mcp] reimport skip", url, e);
        }
    }
    const projectPath = Editor.Project.path;
    const missing = collectImportableRelPaths(projectPath).filter((rel) => !fs_1.default.existsSync(rel));
    if (missing.length) {
        console.warn("[cocos-meta-mcp] meta still missing:", missing);
    }
    else {
        console.log("[cocos-meta-mcp] all expected .meta present");
    }
    return { ok: missing.length === 0, refreshed: CANDYSTORM_DB_URL, metaCheck: missing };
}
exports.methods = {
    refreshIrMeta,
};
let httpServer = null;
let boundProjectPath = null;
let boundPort = null;
const BRIDGE_SERVICE = "cocos-meta-mcp";
function bridgeRegistryHome() {
    if (process.env.COCOSMCP_REGISTRY_HOME) {
        return path_1.default.resolve(process.env.COCOSMCP_REGISTRY_HOME);
    }
    if (process.platform === "win32") {
        const base = process.env.LOCALAPPDATA || path_1.default.join(os_1.default.homedir(), "AppData", "Local");
        return path_1.default.join(base, "cocos-meta-mcp");
    }
    return path_1.default.join(os_1.default.homedir(), ".cocos-meta-mcp");
}
function bridgeRegistryPath() {
    return path_1.default.join(bridgeRegistryHome(), "instances.json");
}
function normalizeProjectPath(projectPath) {
    let resolved = path_1.default.resolve(projectPath);
    if (process.platform === "win32") {
        resolved = resolved.replace(/\\/g, "/");
        if (resolved.length >= 2 && resolved[1] === ":") {
            resolved = resolved.charAt(0).toLowerCase() + resolved.slice(1);
        }
    }
    return resolved;
}
function readBridgeRegistry() {
    var _a;
    const file = bridgeRegistryPath();
    if (!fs_1.default.existsSync(file)) {
        return { version: 1, instances: {} };
    }
    try {
        const raw = JSON.parse(fs_1.default.readFileSync(file, "utf8"));
        return { version: 1, instances: (_a = raw.instances) !== null && _a !== void 0 ? _a : {} };
    }
    catch (_b) {
        return { version: 1, instances: {} };
    }
}
function writeBridgeRegistry(instances) {
    fs_1.default.mkdirSync(bridgeRegistryHome(), { recursive: true });
    const file = bridgeRegistryPath();
    const tmp = `${file}.${process.pid}.tmp`;
    fs_1.default.writeFileSync(tmp, `${JSON.stringify({ version: 1, instances }, null, 2)}\n`, "utf8");
    fs_1.default.renameSync(tmp, file);
}
function upsertBridgeRegistry(projectPath, port) {
    const key = normalizeProjectPath(projectPath);
    const registry = readBridgeRegistry();
    registry.instances[key] = {
        projectPath: path_1.default.resolve(projectPath),
        port,
        pid: process.pid,
        service: BRIDGE_SERVICE,
        updatedAt: new Date().toISOString(),
    };
    writeBridgeRegistry(registry.instances);
}
function removeBridgeRegistry(projectPath) {
    const key = normalizeProjectPath(projectPath);
    const registry = readBridgeRegistry();
    if (!registry.instances[key]) {
        return;
    }
    delete registry.instances[key];
    writeBridgeRegistry(registry.instances);
}
function listenHttpServer(server, preferredPort) {
    return new Promise((resolve, reject) => {
        const attempt = (port) => {
            const onError = (err) => {
                if (err.code === "EADDRINUSE" && port !== 0) {
                    server.removeListener("error", onError);
                    console.warn(`[cocos-meta-mcp] port ${port} in use, trying dynamic port`);
                    attempt(0);
                    return;
                }
                reject(err);
            };
            server.once("error", onError);
            server.listen(port, "127.0.0.1", () => {
                server.removeListener("error", onError);
                const addr = server.address();
                const actual = typeof addr === "object" && addr ? addr.port : port;
                resolve(actual);
            });
        };
        attempt(preferredPort);
    });
}
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
const SCENE_EXTENSION_NAME = "cocos-meta-mcp";
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
 * 供 cocosmcp_exec MCP 经 HTTP 调用。
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
function httpDisabled() {
    return process.env.COCOSMCP_HTTP === "0" || process.env.CANDYSTORM_IR_HTTP === "0";
}
function httpPort() {
    const p = process.env.COCOSMCP_HTTP_PORT || process.env.CANDYSTORM_IR_HTTP_PORT || "3921";
    return Number(p);
}
function registryEnabled() {
    return process.env.COCOSMCP_HTTP_REGISTRY !== "0";
}
/** 供 cocosmcp stdio MCP 调用 — health / IR meta / genbot / exec；多开时动态端口 + registry */
async function startHttpBridge() {
    var _a, _b;
    if (httpDisabled())
        return;
    if (httpServer)
        return;
    const preferredPort = httpPort();
    const projectPath = (_b = (_a = Editor.Project) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : "";
    httpServer = http_1.default.createServer((req, res) => {
        var _a, _b, _c, _d;
        const send = (code, body) => {
            res.writeHead(code, { "Content-Type": "application/json" });
            res.end(JSON.stringify(body));
        };
        if (req.method === "GET" && req.url === "/health") {
            send(200, {
                ok: true,
                service: "cocos-meta-mcp",
                cocosCreatorVersion: (_d = (_b = (_a = Editor.App) === null || _a === void 0 ? void 0 : _a.version) !== null && _b !== void 0 ? _b : (_c = Editor.versions) === null || _c === void 0 ? void 0 : _c.cocos) !== null && _d !== void 0 ? _d : "unknown",
                genbotBridge: true,
                execBridge: true,
                execModes: ["message", "eval", "scene-script", "scene-eval", "open-url"],
                sceneExtension: SCENE_EXTENSION_NAME,
                defaultPreviewPort: DEFAULT_PREVIEW_PORT,
                projectPath,
                httpPort: boundPort,
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
                        error: "regenBind is CLI-only. Use cocosmcp_genbot_generate without preferEditor, or regen in genbot Inspector.",
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
    try {
        const port = await listenHttpServer(httpServer, preferredPort);
        boundPort = port;
        boundProjectPath = projectPath;
        console.log(`[cocos-meta-mcp] MCP HTTP bridge http://127.0.0.1:${port}`);
        if (registryEnabled() && projectPath) {
            upsertBridgeRegistry(projectPath, port);
            console.log(`[cocos-meta-mcp] bridge registry: ${bridgeRegistryPath()}`);
        }
    }
    catch (e) {
        console.error("[cocos-meta-mcp] HTTP bridge failed to start", e);
        httpServer = null;
        boundPort = null;
        boundProjectPath = null;
    }
}
function load() {
    void startHttpBridge();
    const autoMeta = process.env.COCOSMCP_AUTO_META === "1" || process.env.CANDYSTORM_IR_AUTO_META === "1";
    if (autoMeta) {
        console.log("[cocos-meta-mcp] auto meta refresh scheduled (COCOSMCP_AUTO_META=1)");
        setTimeout(() => {
            refreshIrMeta()
                .then((r) => console.log("[cocos-meta-mcp] auto refresh done", r))
                .catch((e) => console.error("[cocos-meta-mcp] auto refresh failed", e));
        }, 8000);
    }
}
function unload() {
    if (boundProjectPath) {
        removeBridgeRegistry(boundProjectPath);
        boundProjectPath = null;
    }
    boundPort = null;
    if (httpServer) {
        httpServer.close();
        httpServer = null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUEwZkEsb0JBYUM7QUFFRCx3QkFVQztBQW5oQkQsNENBQW9CO0FBQ3BCLGdEQUF3QjtBQUN4Qiw0Q0FBb0I7QUFDcEIsZ0RBQXdCO0FBRXhCOzs7OztHQUtHO0FBRUgscUNBQXFDO0FBQ3JDLE1BQU0saUJBQWlCLEdBQUcsa0RBQWtELENBQUM7QUFFN0UsTUFBTSxTQUFTLEdBQUc7SUFDZCxxQkFBcUI7SUFDckIsd0JBQXdCO0lBQ3hCLHdCQUF3QjtJQUN4QixzQkFBc0I7Q0FDaEIsQ0FBQztBQUVYLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsbUJBQW1CLEVBQUUsaUJBQWlCLENBQVUsQ0FBQztBQUVoSCxTQUFTLG1CQUFtQjtJQUN4QixNQUFNLElBQUksR0FBRyxpQkFBaUIsQ0FBQztJQUMvQixNQUFNLElBQUksR0FBYSxFQUFFLENBQUM7SUFDMUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUN6QixNQUFNLENBQUMsR0FBRyxHQUFHLElBQUksVUFBVSxFQUFFLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDMUYsQ0FBQztJQUNELEtBQUssTUFBTSxJQUFJLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztRQUNsQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxlQUFlLElBQUksTUFBTSxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxT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