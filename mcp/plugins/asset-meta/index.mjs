export function register(server, ctx) {
    const { z, pluginManifest: manifest, runNodeScript, metaStatus, fetchCreatorBridge, CREATOR_BRIDGE } = ctx;
    const t = (name) => (ctx.versionedToolName ? ctx.versionedToolName(name) : name);
    const ver = ctx.cocosCreatorVersion ?? "unknown";
    const handles = [];

    handles.push(
        server.tool(
            t("cocosmcp_asset_meta_status"),
            `[Creator ${ver}] Check .meta for candystorm game_art assets`,
            {},
            async () => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            { creatorBridge: CREATOR_BRIDGE, ...metaStatus() },
                            null,
                            2,
                        ),
                    },
                ],
            }),
        ),
    );

    handles.push(
        server.tool(
            t("cocosmcp_import_asset_meta"),
            `[Creator ${ver}] Import candystorm game_art assets into Creator asset-db`,
            {},
            async () => {
                const r = await runNodeScript("scripts/import-candystorm-meta.mjs");
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
            `[Creator ${ver}] Refresh candystorm IR assets in Creator and verify .meta`,
            {},
            async () => {
                try {
                    const health = await fetchCreatorBridge("/health");
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
                        content: [{ type: "text", text: JSON.stringify({ ok: false, error: String(e) }, null, 2) }],
                        isError: true,
                    };
                }
            },
        ),
    );

    return { pluginId: manifest.id, toolNames: manifest.tools.map((n) => t(n)), handles };
}
