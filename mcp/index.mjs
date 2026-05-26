#!/usr/bin/env node
/**
 * cocosmcp — 糖果工程专用 stdio MCP（IR/meta + genbot + Creator exec）。
 * 目标工程路径由 Cursor mcp.json 的 cwd 或 COCOSMCP_PROJECT_ROOT 指定。
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
    expectedGenbotOutputs,
    genbotSetupHint,
    readRegistryEntry,
    resolveGenbotRoot,
    resolvePrefabPath,
    runGenbotCli,
} from "./genbot-runner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(
    process.env.COCOSMCP_PROJECT_ROOT ||
        process.env.CANDYSTORM_PROJECT_ROOT ||
        process.cwd(),
);
const DEFAULT_IR_ROOT = "D:/svn/new_game/糖果风暴客户端资源/export/cocosmcp_ir";
const GAME_ART_ROOT = path.join(PROJECT_ROOT, "assets/asset_bundles/game_art/ab/candystorm");
const CREATOR_BRIDGE =
    process.env.COCOSMCP_HTTP_URL ||
    process.env.CANDYSTORM_IR_HTTP_URL ||
    "http://127.0.0.1:3921";

function irRoot() {
    return process.env.COCOSMCP_IR_ROOT || process.env.CANDYSTORM_IR_ROOT || DEFAULT_IR_ROOT;
}

const EXPECTED_META = [
    "assets/asset_bundles/game_art/ab/candystorm.meta",
    "assets/asset_bundles/game_art/ab/candystorm/spine/eff_candystorm_icon/eff_candystorm_icon.png.meta",
    "assets/asset_bundles/game_art/ab/candystorm/spine/eff_candystorm_icon/eff_candystorm_icon.atlas.meta",
    "assets/asset_bundles/game_art/ab/candystorm/spine/eff_candystorm_icon/eff_candystorm_icon.json.meta",
    "assets/asset_bundles/game_art/ab/candystorm/ui/rasters/cocosmcp_kuang.png.meta",
];

function runNodeScript(scriptRel, args = [], envExtra = {}) {
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

function metaStatus() {
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

async function fetchCreatorBridge(pathname, method = "GET", jsonBody) {
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

async function runGenbotGenerate({ prefab, regenBind = false, dryRun = false, preferEditor = false }) {
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

const server = new McpServer({
    name: "cocosmcp",
    version: "1.0.0",
});

server.tool(
    "cocosmcp_meta_status",
    "检查 ab/candystorm 关键 .meta 是否已生成，并读取 SYNC_MANIFEST.json",
    {},
    async () => {
        const status = metaStatus();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(status, null, 2),
                },
            ],
        };
    },
);

server.tool(
    "cocosmcp_sync_ir",
    "从 SVN IR 目录同步资源到 ab/candystorm（不生成 meta）",
    {
        only: z.string().optional().describe("逗号分隔 id 过滤；省略则全量（4 Spine + 4 PNG + ir JSON）"),
        dryRun: z.boolean().optional().describe("仅打印将复制的文件"),
    },
    async ({ only, dryRun }) => {
        const args = [];
        if (dryRun) args.push("--dry-run");
        if (only) args.push("--only", only);
        const r = await runNodeScript("scripts/sync-candystorm-ir.mjs", args, {
            COCOSMCP_IR_ROOT: irRoot(),
            CANDYSTORM_IR_ROOT: irRoot(),
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(
                        {
                            exitCode: r.code,
                            stdout: r.stdout,
                            stderr: r.stderr,
                            metaStatus: metaStatus(),
                        },
                        null,
                        2,
                    ),
                },
            ],
            isError: r.code !== 0,
        };
    },
);

server.tool(
    "cocosmcp_import_meta",
    "启动 Creator 并等待 .meta 出现（或仅轮询，Creator 已开时用 waitOnly）",
    {
        waitOnly: z.boolean().optional().describe("true=不启动 Creator，只轮询 meta（需已打开工程）"),
        launchCreator: z.boolean().optional().describe("false=不启动 Creator；默认 waitOnly 时 false 否则 true"),
    },
    async ({ waitOnly, launchCreator }) => {
        const args = [];
        if (waitOnly) args.push("--wait-only");
        const r = await runNodeScript("scripts/creator-import-ir-meta.mjs", args);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(
                        {
                            exitCode: r.code,
                            stdout: r.stdout,
                            stderr: r.stderr,
                            metaStatus: metaStatus(),
                        },
                        null,
                        2,
                    ),
                },
            ],
            isError: r.code !== 0,
        };
    },
);

server.tool(
    "cocosmcp_refresh_meta_in_editor",
    "Creator 已打开且 fg-cocosmcp 扩展已启用时，通过本地 HTTP 刷新 asset-db 生成 meta",
    {},
    async () => {
        try {
            const health = await fetchCreatorBridge("/health");
            if (!health.ok) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    error: "Creator bridge not reachable",
                                    url: CREATOR_BRIDGE,
                                    hint: "Open Cocos Creator with this project and enable extension fg-cocosmcp",
                                    health,
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                    isError: true,
                };
            }
            const refresh = await fetchCreatorBridge("/refresh-ir-meta", "POST");
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                health: health.body,
                                refresh: refresh.body,
                                metaStatus: metaStatus(),
                            },
                            null,
                            2,
                        ),
                    },
                ],
                isError: !refresh.ok,
            };
        } catch (e) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                error: String(e),
                                url: CREATOR_BRIDGE,
                                hint: "Start Creator + fg-cocosmcp, or use cocosmcp_import_meta",
                            },
                            null,
                            2,
                        ),
                    },
                ],
                isError: true,
            };
        }
    },
);

server.tool(
    "cocosmcp_genbot_generate",
    [
        "对指定 prefab 运行 genbot：生成/更新 bind.json、*.gen.ts，首次生成 *.view.ts。",
        "建议在 Cursor 搭好 prefab 并保存后调用。",
        "prefab 可用 db://assets/.../foo.prefab 或相对工程根路径。",
        "首次或 prefab 结构大变时用 regenBind=true 重建默认 bind 契约。",
        "preferEditor=true 且 Creator+genbot 扩展已开时走 HTTP；否则 CLI。",
    ].join(" "),
    {
        prefab: z.string().describe("prefab 路径，如 db://assets/prefab/candystorm/candystorm_shell.prefab"),
        regenBind: z.boolean().optional().describe("true=用默认规则覆盖已有 bind.json"),
        dryRun: z.boolean().optional().describe("只解析预览，不写盘"),
        preferEditor: z.boolean().optional().describe("优先 Creator HTTP（需 fg-cocosmcp + genbot 扩展）"),
    },
    async ({ prefab, regenBind, dryRun, preferEditor }) => {
        const result = await runGenbotGenerate({
            prefab,
            regenBind: !!regenBind,
            dryRun: !!dryRun,
            preferEditor: !!preferEditor,
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
            isError: !result.ok,
        };
    },
);

server.tool(
    "cocosmcp_genbot_status",
    "查看 prefab 在 _genbot/__registry.json 中的登记与预期输出路径",
    {
        prefab: z.string().describe("prefab 路径或名称（如 candystorm_shell）"),
    },
    async ({ prefab }) => {
        let prefabAbs;
        let prefabName;
        if (prefab.includes("/") || prefab.includes("\\") || prefab.startsWith("db://")) {
            prefabAbs = resolvePrefabPath(prefab, PROJECT_ROOT);
            prefabName = path.basename(prefabAbs, path.extname(prefabAbs));
        } else {
            prefabName = prefab.replace(/\.prefab$/i, "");
            prefabAbs = null;
        }
        const outputs = prefabAbs
            ? expectedGenbotOutputs(PROJECT_ROOT, prefabAbs)
            : expectedGenbotOutputs(PROJECT_ROOT, path.join(PROJECT_ROOT, `_placeholder/${prefabName}.prefab`));
        const registry = readRegistryEntry(PROJECT_ROOT, prefabName);
        const payload = {
            prefabName,
            prefabExists: prefabAbs ? fs.existsSync(prefabAbs) : undefined,
            prefabAbs,
            outputs,
            filesPresent: {
                bindJson: fs.existsSync(outputs.bindJson),
                genTs: fs.existsSync(outputs.genTs),
                viewTs: fs.existsSync(outputs.viewTs),
            },
            registry,
            genbotRoot: resolveGenbotRoot(PROJECT_ROOT),
        };
        return {
            content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
    },
);

server.tool(
    "cocosmcp_exec",
    [
        "在已打开的 Cocos Creator 中执行（需 fg-cocosmcp，不走子进程、不构建）。",
        "message/eval=扩展主进程；scene-script/scene-eval=场景进程；open-url=系统浏览器打开预览（默认端口或 server.query-port）。",
    ].join(" "),
    {
        mode: z
            .enum(["message", "eval", "scene-script", "scene-eval", "open-url"])
            .describe(
                "message|eval=主进程；scene-script|scene-eval=场景进程；open-url=打开预览页（预览服需已开）",
            ),
        module: z.string().optional().describe("message：模块名"),
        method: z.string().optional().describe("message / scene-script：方法名"),
        name: z
            .string()
            .optional()
            .describe("scene-script：扩展包名，默认 fg-cocosmcp；也可调其他扩展 scene 脚本"),
        args: z.array(z.unknown()).optional().describe("message / scene-script：参数"),
        messageType: z.enum(["request", "send"]).optional(),
        code: z.string().optional().describe("eval / scene-eval：async 函数体"),
        url: z.string().optional().describe("open-url：完整 URL；省略则用 http://127.0.0.1:<port>/"),
        port: z.number().optional().describe("open-url：预览端口，省略则 query-port 或 7456"),
    },
    async ({ mode, module, method, name, args, messageType, code, url, port }) => {
        try {
            const health = await fetchCreatorBridge("/health");
            if (!health.ok) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    ok: false,
                                    error: "Creator bridge not reachable",
                                    url: CREATOR_BRIDGE,
                                    hint: "Open Creator, enable fg-cocosmcp, reload extension if needed",
                                    health,
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                    isError: true,
                };
            }

            const body = { mode, module, method, name, args, messageType, code, url, port };
            const exec = await fetchCreatorBridge("/exec", "POST", body);
            const payload = {
                ok: exec.ok && exec.body?.ok !== false,
                bridge: CREATOR_BRIDGE,
                request: body,
                status: exec.status,
                ...exec.body,
            };
            return {
                content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
                isError: !payload.ok,
            };
        } catch (e) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                ok: false,
                                error: String(e),
                                url: CREATOR_BRIDGE,
                            },
                            null,
                            2,
                        ),
                    },
                ],
                isError: true,
            };
        }
    },
);

server.tool(
    "cocosmcp_generate_prefabs",
    "从 IR 生成 candystorm_shell / candystorm_symbol_cell 的 .prefab 到 ab/candystorm/prefab/",
    {},
    async () => {
        const r = await runNodeScript("scripts/generate-candystorm-prefabs.mjs");
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(
                        {
                            exitCode: r.code,
                            stdout: r.stdout,
                            stderr: r.stderr,
                            outputs: [
                                "assets/asset_bundles/game_art/ab/candystorm/prefab/candystorm_shell.prefab",
                                "assets/asset_bundles/game_art/ab/candystorm/prefab/candystorm_symbol_cell.prefab",
                            ],
                        },
                        null,
                        2,
                    ),
                },
            ],
            isError: r.code !== 0,
        };
    },
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[cocosmcp] running on stdio (8 tools)");
}

main().catch((e) => {
    console.error("[cocosmcp] fatal", e);
    process.exit(1);
});
