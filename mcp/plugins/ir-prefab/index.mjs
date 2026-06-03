import { z } from "zod";
import { loadManifest } from "../load-manifest.mjs";

const manifest = loadManifest(import.meta.url);
export { manifest };

export function register(server, ctx) {
    const { runNodeScript } = ctx;
    const t = (name) => (ctx.versionedToolName ? ctx.versionedToolName(name) : name);
    const ver = ctx.cocosCreatorVersion ?? "unknown";
    const handles = [];

    handles.push(
        server.tool(
            t("cocosmcp_generate_ir_prefabs"),
            `[Creator ${ver}] Run project IR prefab generation script (scripts/generate-candystorm-prefabs.mjs)`,
            {
                script: z
                    .string()
                    .optional()
                    .describe("Relative script path under project root; default scripts/generate-candystorm-prefabs.mjs"),
            },
            async ({ script }) => {
                const scriptRel = script?.trim() || "scripts/generate-candystorm-prefabs.mjs";
                const r = await runNodeScript(scriptRel);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    exitCode: r.code,
                                    script: scriptRel,
                                    stdout: r.stdout,
                                    stderr: r.stderr,
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
