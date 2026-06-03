import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import manifest from "./manifest.json" with { type: "json" };

export { manifest };

export function register(server, ctx) {
    const { irRoot, runNodeScript, metaStatus, fetchCreatorBridge, CREATOR_BRIDGE } = ctx;
    const t = (name) => (ctx.versionedToolName ? ctx.versionedToolName(name) : name);
    const ver = ctx.cocosCreatorVersion ?? "unknown";
    const handles = [];

    handles.push(
        server.tool(
            t("cocosmcp_meta_status"),
            `[Creator ${ver}] 检查 ab/candystorm 关键 .meta 是否已生成，并读取 SYNC_MANIFEST.json`,
            {},
            async () => ({
                content: [{ type: "text", text: JSON.stringify(metaStatus(), null, 2) }],
            }),
        ),
    );

    handles.push(
        server.tool(
            t("cocosmcp_sync_ir"),
            `[Creator ${ver}] 从 SVN IR 目录同步资源到 ab/candystorm（不生成 meta）`,
            {
                only: z.string().optional().describe("逗号分隔 id 过滤；省略则全量"),
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
                                { exitCode: r.code, stdout: r.stdout, stderr: r.stderr, metaStatus: metaStatus() },
                                null,
                                2,
                            ),
                        },
                    ],
                    isError: r.code !== 0,
                };
            },
        ),
    );

    handles.push(
        server.tool(
            t("cocosmcp_import_meta"),
            `[Creator ${ver}] 启动 Creator 并等待 .meta 出现（或仅轮询）`,
            {
                waitOnly: z.boolean().optional(),
                launchCreator: z.boolean().optional(),
            },
            async ({ waitOnly }) => {
                const args = [];
                if (waitOnly) args.push("--wait-only");
                const r = await runNodeScript("scripts/creator-import-ir-meta.mjs", args);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                { exitCode: r.code, stdout: r.stdout, stderr: r.stderr, metaStatus: metaStatus() },
                                null,
                                2,
                            ),
                        },
                    ],
                    isError: r.code !== 0,
                };
            },
        ),
    );

    handles.push(
        server.tool(
            t("cocosmcp_refresh_meta_in_editor"),
            `[Creator ${ver}] Creator 已打开且 fg-cocosmcp 扩展已启用时，通过 HTTP 刷新 asset-db 生成 meta`,
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
                                            hint: "Open Creator + enable fg-cocosmcp",
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
                                    { health: health.body, refresh: refresh.body, metaStatus: metaStatus() },
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
                                text: JSON.stringify({ error: String(e), url: CREATOR_BRIDGE }, null, 2),
                            },
                        ],
                        isError: true,
                    };
                }
            },
        ),
    );

    handles.push(
        server.tool(
            t("cocosmcp_generate_prefabs"),
            `[Creator ${ver}] 从 IR 生成 candystorm_shell / candystorm_symbol_cell 的 .prefab`,
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
        ),
    );

    return { pluginId: manifest.id, toolNames: manifest.tools.map((n) => t(n)), handles };
}
