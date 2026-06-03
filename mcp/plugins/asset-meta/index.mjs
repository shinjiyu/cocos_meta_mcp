import { z } from "zod";
import { loadManifest } from "../load-manifest.mjs";

const manifest = loadManifest(import.meta.url);
export { manifest };

export function register(server, ctx) {
    const { runNodeScript, metaStatus, fetchCreatorBridge, CREATOR_BRIDGE } = ctx;
    const t = (name) => (ctx.versionedToolName ? ctx.versionedToolName(name) : name);
    const ver = ctx.cocosCreatorVersion ?? "unknown";
    const handles = [];

    handles.push(
        server.tool(
            t("cocosmcp_asset_meta_status"),
            `[Creator ${ver}] Check expected asset .meta files and read SYNC_MANIFEST.json if present`,
            {},
            async () => ({
                content: [{ type: "text", text: JSON.stringify(metaStatus(), null, 2) }],
            }),
        ),
    );

    handles.push(
        server.tool(
            t("cocosmcp_import_asset_meta"),
            `[Creator ${ver}] Launch Creator and wait for asset .meta, or poll only (--wait-only)`,
            {
                waitOnly: z.boolean().optional(),
                launchCreator: z.boolean().optional(),
            },
            async ({ waitOnly }) => {
                const args = [];
                if (waitOnly) {args.push("--wait-only");}
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
            t("cocosmcp_refresh_asset_meta"),
            `[Creator ${ver}] Refresh asset-db via HTTP when Creator and cocos-meta-mcp are running`,
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
                                            hint: "Open Creator + enable cocos-meta-mcp",
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

    return { pluginId: manifest.id, toolNames: manifest.tools.map((n) => t(n)), handles };
}
