import path from "node:path";
import { z } from "zod";
import { registerMcpTool } from "./register-tool.mjs";
import { runRecipeInputSchema } from "./tool-schemas.mjs";
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

    const { PROJECT_ROOT, fetchCreatorBridge, resolveTargetProjectRoot, resolveProjectRootSync } = ctx;
    const handles = [];
    const allowPromote = recipeLayer >= 2;

    /** recipes/审计存储跟随当前目标工程（多开会话切换后自动改路径）。 */
    async function recipeRoot(projectRoot) {
        const resolved = await resolveTargetProjectRoot(projectRoot);
        if (!resolved.ok) {
            throw new Error(resolved.error);
        }
        return resolved.projectRoot;
    }

    handles.push(
        server.tool(
            "cocosmcp_exec_stats",
            "[Recipe L1+] 分析 exec/recipe 审计日志，供 Agent 决定是否注册 recipe。",
            {
                limit: z.number().optional(),
                projectRoot: z.string().optional(),
            },
            async ({ limit, projectRoot }) => {
                const root = await recipeRoot(projectRoot);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    recipeLayer,
                                    promoteEnabled: allowPromote,
                                    auditPath: path.join(root, ".cocosmcp", "exec-audit.jsonl"),
                                    ...computeExecStats(root, { limit: limit ?? 2000 }),
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            },
        ),
    );

    handles.push(
        server.tool(
            "cocosmcp_list_recipes",
            "[Recipe L1+] 列出已注册 recipe 与提升状态（含 Cocos 版本 tool 名）。",
            {
                projectRoot: z.string().optional(),
            },
            async ({ projectRoot }) => {
                const root = await recipeRoot(projectRoot);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ projectRoot: root, recipes: listRecipes(root) }, null, 2),
                        },
                    ],
                };
            },
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
                projectRoot: z.string().optional(),
            },
            async (input) => {
                try {
                    const root = await recipeRoot(input.projectRoot);
                    const saved = saveRecipe(root, input, { overwrite: !!input.overwrite });
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
                            root,
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
        registerMcpTool(
            server,
            "cocosmcp_run_recipe",
            {
                description: "[Recipe L1+] 运行已注册 recipe（无需 promote）。projectRoot 可选，多开时指定目标工程。",
                inputSchema: runRecipeInputSchema,
            },
            async ({ name, params, projectRoot }) => {
                const targetRoot = await recipeRoot(projectRoot);
                const result = await runRecipe(targetRoot, name, params ?? {}, fetchCreatorBridge, {
                    execProjectRoot: targetRoot,
                });
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
                    projectRoot: z.string().optional(),
                },
                async ({ name, toolName, projectRoot }) => {
                    try {
                        const root = await recipeRoot(projectRoot);
                        if (!getRecipe(root, name)) {
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
                            root,
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
                { name: z.string(), projectRoot: z.string().optional() },
                async ({ name, projectRoot }) => {
                    try {
                        const result = demotePromotedRecipeTool(server, await recipeRoot(projectRoot), name);
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
                { name: z.string(), projectRoot: z.string().optional() },
                async ({ name, projectRoot }) => {
                    try {
                        const root = await recipeRoot(projectRoot);
                        const recipe = getRecipe(root, name);
                        if (recipe?.promoted) {
                            demotePromotedRecipeTool(server, root, name);
                        }
                        const deleted = deleteRecipe(root, name);
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

    const promotedRoot = resolveProjectRootSync() ?? PROJECT_ROOT;
    const promoted = allowPromote
        ? loadPromotedRecipesOnStartup(server, promotedRoot, fetchCreatorBridge)
        : { restored: [], failed: [] };

    return { handles, promoted };
}
