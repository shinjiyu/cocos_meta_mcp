import { z } from "zod";
import {
    appendExecAudit,
    buildExecAuditEntry,
    executeCreatorBody,
} from "./recipe-registry.mjs";

export function registerCoreTools(server, ctx) {
    const { PROJECT_ROOT, CREATOR_BRIDGE, fetchCreatorBridge } = ctx;
    const handles = [];
    const includeHealth = process.env.COCOSMCP_CORE_HEALTH === "1";

    if (includeHealth) {
        handles.push(
            server.tool(
                "cocosmcp_health",
                "检查 fg-cocosmcp HTTP bridge 是否可达（比 exec 更轻）。",
                {},
                async () => {
                    try {
                        const health = await fetchCreatorBridge("/health");
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(
                                        { ok: health.ok, url: CREATOR_BRIDGE, ...health.body },
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
                                    text: JSON.stringify({ ok: false, error: String(e), url: CREATOR_BRIDGE }, null, 2),
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
        server.tool(
            "cocosmcp_exec",
            [
                "[Core] 在已打开的 Cocos Creator 中执行（需 fg-cocosmcp）。",
                "message/eval=主进程；scene-script/scene-eval=场景；open-url=打开预览。",
                "其它能力请安装插件：COCOSMCP_PLUGINS=candystorm-ir,genbot 或 cocosmcp_plugin_enable。",
            ].join(" "),
            {
                mode: z.enum(["message", "eval", "scene-script", "scene-eval", "open-url"]),
                module: z.string().optional(),
                method: z.string().optional(),
                name: z.string().optional(),
                args: z.array(z.unknown()).optional(),
                messageType: z.enum(["request", "send"]).optional(),
                code: z.string().optional(),
                url: z.string().optional(),
                port: z.number().optional(),
            },
            async ({ mode, module, method, name, args, messageType, code, url, port }) => {
                const started = Date.now();
                try {
                    const body = { mode, module, method, name, args, messageType, code, url, port };
                    const result = await executeCreatorBody(fetchCreatorBridge, body);
                    appendExecAudit(
                        PROJECT_ROOT,
                        buildExecAuditEntry(body, result, started, { source: "exec" }),
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
                                            url: CREATOR_BRIDGE,
                                            hint: "Open Creator, enable fg-cocosmcp",
                                            health: result.health,
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
                                        bridge: CREATOR_BRIDGE,
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
                        PROJECT_ROOT,
                        buildExecAuditEntry(
                            { mode, module, method, name, code },
                            { ok: false, error: String(e) },
                            started,
                            { source: "exec" },
                        ),
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ ok: false, error: String(e), url: CREATOR_BRIDGE }, null, 2),
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
        return 1;
    }
    const raw = process.env.COCOSMCP_RECIPE_LAYER ?? "0";
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.min(2, Math.max(0, n));
}
