import {
    appendExecAudit,
    buildExecAuditEntry,
    executeCreatorBody,
} from "./recipe-registry.mjs";
import { registerMcpTool } from "./register-tool.mjs";
import {
    execInputSchema,
    healthInputSchema,
    listBridgesInputSchema,
} from "./tool-schemas.mjs";

export function registerCoreTools(server, ctx) {
    const {
        PROJECT_ROOT,
        CREATOR_BRIDGE,
        CREATOR_EXTENSION_NAME,
        fetchCreatorBridge,
        listBridgeInstances,
        resolveAuditProjectRoot,
    } = ctx;
    const handles = [];
    const includeHealth = process.env.COCOSMCP_CORE_HEALTH !== "0";

    handles.push(
        registerMcpTool(
            server,
            "cocosmcp_list_bridges",
            {
                description: [
                    "[Core] 列出本机已注册的 Creator HTTP bridge（多开场景）。",
                    "probe=true 时对每个实例 GET /health，并清理离线条目。",
                ].join(" "),
                inputSchema: listBridgesInputSchema,
            },
            async ({ probe }) => {
                try {
                    const listed = await listBridgeInstances({
                        probe: probe !== false,
                        pruneStale: probe !== false,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(
                                    {
                                        defaultProjectRoot: PROJECT_ROOT,
                                        defaultBridge: CREATOR_BRIDGE,
                                        ...listed,
                                    },
                                    null,
                                    2,
                                ),
                            },
                        ],
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

    if (includeHealth) {
        handles.push(
            registerMcpTool(
                server,
                "cocosmcp_health",
                {
                    description: `检查 ${CREATOR_EXTENSION_NAME} HTTP bridge 是否可达（比 exec 更轻）。可选 projectRoot 指定目标工程。`,
                    inputSchema: healthInputSchema,
                },
                async ({ projectRoot }) => {
                    const targetRoot = resolveAuditProjectRoot(projectRoot);
                    try {
                        const health = await fetchCreatorBridge("/health", "GET", undefined, {
                            projectRoot: targetRoot,
                        });
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(
                                        {
                                            ok: health.ok,
                                            projectRoot: targetRoot,
                                            url: health.bridge ?? CREATOR_BRIDGE,
                                            ...health.body,
                                            resolve: health.resolve,
                                        },
                                        null,
                                        2,
                                    ),
                                },
                            ],
                            isError: !health.ok,
                        };
                    } catch (e) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(
                                        { ok: false, error: String(e), projectRoot: targetRoot, url: CREATOR_BRIDGE },
                                        null,
                                        2,
                                    ),
                                },
                            ],
                            isError: true,
                        };
                    }
                },
            ),
        );
    }

    handles.push(
        registerMcpTool(
            server,
            "cocosmcp_exec",
            {
                description: [
                    `[Core] 在已打开的 Cocos Creator 中执行（需 ${CREATOR_EXTENSION_NAME}）。`,
                    "message/eval=主进程；scene-script/scene-eval=场景；open-url=打开预览。",
                    "projectRoot 可选，用于多开时指定目标工程（默认 MCP cwd）。",
                    "跨工程前先 cocosmcp_list_bridges。",
                ].join(" "),
                inputSchema: execInputSchema,
            },
            async ({ mode, module, method, name, args, messageType, code, url, port, projectRoot }) => {
                const started = Date.now();
                const targetRoot = resolveAuditProjectRoot(projectRoot);
                try {
                    const body = { mode, module, method, name, args, messageType, code, url, port };
                    const result = await executeCreatorBody(fetchCreatorBridge, body, { projectRoot: targetRoot });
                    appendExecAudit(
                        targetRoot,
                        buildExecAuditEntry(body, result, started, {
                            source: "exec",
                            projectRoot: targetRoot,
                        }),
                    );

                    if (!result.ok && result.error === "Creator bridge not reachable") {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(
                                        {
                                            ok: false,
                                            error: "Creator bridge not reachable",
                                            projectRoot: targetRoot,
                                            url: result.bridge ?? CREATOR_BRIDGE,
                                            hint: `Open Creator for this project and enable ${CREATOR_EXTENSION_NAME}`,
                                            health: result.health,
                                            resolve: result.resolve,
                                        },
                                        null,
                                        2,
                                    ),
                                },
                            ],
                            isError: true,
                        };
                    }

                    if (!result.ok && result.error === "bridge project mismatch") {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(
                                        {
                                            ok: false,
                                            error: result.error,
                                            projectRoot: targetRoot,
                                            expectedProject: result.expectedProject,
                                            actualProject: result.actualProject,
                                            bridge: result.bridge,
                                            hint: "Use cocosmcp_list_bridges and matching projectRoot",
                                        },
                                        null,
                                        2,
                                    ),
                                },
                            ],
                            isError: true,
                        };
                    }

                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(
                                    {
                                        ok: result.ok,
                                        projectRoot: targetRoot,
                                        bridge: result.bridge ?? CREATOR_BRIDGE,
                                        request: body,
                                        status: result.status,
                                        result: result.result,
                                        error: result.error,
                                    },
                                    null,
                                    2,
                                ),
                            },
                        ],
                        isError: !result.ok,
                    };
                } catch (e) {
                    appendExecAudit(
                        targetRoot,
                        buildExecAuditEntry(
                            { mode, module, method, name, code, projectRoot: targetRoot },
                            { ok: false, error: String(e) },
                            started,
                            { source: "exec" },
                        ),
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(
                                    { ok: false, error: String(e), projectRoot: targetRoot, url: CREATOR_BRIDGE },
                                    null,
                                    2,
                                ),
                            },
                        ],
                        isError: true,
                    };
                }
            },
        ),
    );

    return handles;
}

export function resolveRecipeLayer() {
    if (process.env.COCOSMCP_ALL === "1" || process.env.COCOSMCP_TOOL_PROFILE === "full") {
        return 2;
    }
    if (process.env.COCOSMCP_TOOL_PROFILE === "admin") {
        return 2;
    }
    if (process.env.COCOSMCP_TOOL_PROFILE === "workflow") {
        return 2;
    }
    const raw = process.env.COCOSMCP_RECIPE_LAYER ?? "2";
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {return 0;}
    return Math.min(2, Math.max(0, n));
}
