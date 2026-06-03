export function register(server, ctx) {
    const { z, pluginManifest: manifest, irRoot, runNodeScript, metaStatus } = ctx;
    const t = (name) => (ctx.versionedToolName ? ctx.versionedToolName(name) : name);
    const ver = ctx.cocosCreatorVersion ?? "unknown";
    const handles = [];

    handles.push(
        server.tool(
            t("cocosmcp_sync_external_assets"),
            `[Creator ${ver}] Sync assets from external export dir (COCOSMCP_IR_ROOT) into the project; does not generate .meta`,
            {
                only: z.string().optional().describe("Comma-separated asset ids; omit for full sync"),
                dryRun: z.boolean().optional().describe("List files that would be copied"),
            },
            async ({ only, dryRun }) => {
                const args = [];
                if (dryRun) {args.push("--dry-run");}
                if (only) {args.push("--only", only);}
                const root = irRoot();
                const r = await runNodeScript("scripts/sync-candystorm-ir.mjs", args, {
                    COCOSMCP_IR_ROOT: root,
                    CANDYSTORM_IR_ROOT: root,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    exitCode: r.code,
                                    irRoot: root,
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
        ),
    );

    return { pluginId: manifest.id, toolNames: manifest.tools.map((n) => t(n)), handles };
}
