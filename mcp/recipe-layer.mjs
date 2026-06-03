import path from "node:path";
import { z } from "zod";
import {
    computeExecStats,
    deleteRecipe,
    demotePromotedRecipeTool,
    getRecipe,
    listRecipes,
    loadPromotedRecipesOnStartup,
    registerPromotedRecipeTool,
    runRecipe,
    saveRecipe,
} from "./recipe-registry.mjs";

export function registerRecipeLayerTools(server, ctx, recipeLayer) {
    if (recipeLayer < 1) {return { handles: [], promoted: { restored: [], failed: [] } };}

    const { PROJECT_ROOT, fetchCreatorBridge } = ctx;
    const handles = [];
    const allowPromote = recipeLayer >= 2;

    handles.push(
        server.tool(
            "cocosmcp_exec_stats",
            "[Recipe L1+] 分析 exec/recipe 审计日志，供 Agent 决定是否注册 recipe。",
            {
                limit: z.number().optional(),
            },
            async ({ limit }) => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                recipeLayer,
                                promoteEnabled: allowPromote,
                                auditPath: path.join(PROJECT_ROOT, ".cocosmcp", "exec-audit.jsonl"),
                                ...computeExecStats(PROJECT_ROOT, { limit: limit ?? 2000 }),
                            },
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
            "cocosmcp_list_recipes",
            "[Recipe L1+] 列出已注册 recipe 与提升状态（含 Cocos 版本 tool 名）。",
            {},
            async () => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ projectRoot: PROJECT_ROOT, recipes: listRecipes(PROJECT_ROOT) }, null, 2),
                    },
                ],
            }),
        ),
    );

    handles.push(
        server.tool(
            "cocosmcp_register_recipe",
            [
                "[Recipe L1+] 注册常用 Creator 脚本到 .cocosmcp/recipes/。",
                allowPromote
                    ? "promote=true 提升为 cocosmcp_r_{name} tool。"
                    : "提升需 COCOSMCP_RECIPE_LAYER=2。",
            ].join(" "),
            {
                name: z.string(),
                description: z.string(),
                mode: z.enum(["message", "eval", "scene-script", "scene-eval", "open-url"]),
                code: z.string().optional(),
                module: z.string().optional(),
                method: z.string().optional(),
                sceneExtension: z.string().optional(),
                args: z.array(z.unknown()).optional(),
                messageType: z.enum(["request", "send"]).optional(),
                url: z.string().optional(),
                port: z.number().optional(),
                params: z
                    .record(
                        z.object({
                            type: z.enum(["string", "number", "boolean", "array"]).optional(),
                            description: z.string().optional(),
                            default: z.unknown().optional(),
                            optional: z.boolean().optional(),
                        }),
                    )
                    .optional(),
                overwrite: z.boolean().optional(),
                promote: z.boolean().optional(),
                toolName: z.string().optional(),
            },
            async (input) => {
                try {
                    const saved = saveRecipe(PROJECT_ROOT, input, { overwrite: !!input.overwrite });
                    let promoted;
                    if (input.promote) {
                        if (!allowPromote) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: JSON.stringify(
                                            {
                                                ok: false,
                                                error: "promote requires COCOSMCP_RECIPE_LAYER=2",
                                                recipe: saved,
                                            },
                                            null,
                                            2,
                                        ),
                                    },
                                ],
                                isError: true,
                            };
                        }
                        promoted = registerPromotedRecipeTool(
                            server,
                            PROJECT_ROOT,
                            input.name,
                            fetchCreatorBridge,
                            { toolName: input.toolName },
                        );
                    }
                    return {
                        content: [{ type: "text", text: JSON.stringify({ ok: true, recipe: saved, promoted }, null, 2) }],
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

    handles.push(
        server.tool(
            "cocosmcp_run_recipe",
            "[Recipe L1+] 运行已注册 recipe（无需 promote）。",
            {
                name: z.string(),
                params: z.record(z.unknown()).optional(),
            },
            async ({ name, params }) => {
                const result = await runRecipe(PROJECT_ROOT, name, params ?? {}, fetchCreatorBridge);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    isError: !result.ok,
                };
            },
        ),
    );

    if (allowPromote) {
        handles.push(
            server.tool(
                "cocosmcp_promote_recipe",
                "[Recipe L2] 提升 recipe 为 cocosmcp_r_{name} MCP tool（不带 Cocos 版本号）。",
                {
                    name: z.string(),
                    toolName: z.string().optional(),
                },
                async ({ name, toolName }) => {
                    try {
                        if (!getRecipe(PROJECT_ROOT, name)) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: JSON.stringify({ ok: false, error: `recipe not found: ${name}` }, null, 2),
                                    },
                                ],
                                isError: true,
                            };
                        }
                        const promoted = registerPromotedRecipeTool(
                            server,
                            PROJECT_ROOT,
                            name,
                            fetchCreatorBridge,
                            { toolName },
                        );
                        return {
                            content: [{ type: "text", text: JSON.stringify(promoted, null, 2) }],
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

        handles.push(
            server.tool(
                "cocosmcp_demote_recipe",
                "[Recipe L2] 取消 recipe 的 MCP tool 提升。",
                { name: z.string() },
                async ({ name }) => {
                    try {
                        const result = demotePromotedRecipeTool(server, PROJECT_ROOT, name);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                            isError: !result.ok,
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

        handles.push(
            server.tool(
                "cocosmcp_unregister_recipe",
                "[Recipe L2] 删除 recipe（已提升会先 demote）。",
                { name: z.string() },
                async ({ name }) => {
                    try {
                        const recipe = getRecipe(PROJECT_ROOT, name);
                        if (recipe?.promoted) {
                            demotePromotedRecipeTool(server, PROJECT_ROOT, name);
                        }
                        const deleted = deleteRecipe(PROJECT_ROOT, name);
                        return {
                            content: [{ type: "text", text: JSON.stringify(deleted, null, 2) }],
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
    }

    const promoted = allowPromote
        ? loadPromotedRecipesOnStartup(server, PROJECT_ROOT, fetchCreatorBridge)
        : { restored: [], failed: [] };

    return { handles, promoted };
}
