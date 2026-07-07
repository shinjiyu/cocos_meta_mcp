#!/usr/bin/env node
/**
 * Assert critical multi-instance tools appear in tools/list JSON Schema.
 * Run: node mcp/scripts/verify-tool-schemas.mjs
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.mjs";
import { registerCoreTools } from "../core.mjs";
import { registerRecipeLayerTools } from "../recipe-layer.mjs";
import { toolInputJsonSchema } from "../register-tool.mjs";

const REQUIRED = {
    cocosmcp_list_bridges: { properties: ["probe"] },
    cocosmcp_exec: { properties: ["mode", "projectRoot"] },
    cocosmcp_run_recipe: { properties: ["name", "projectRoot"] },
    cocosmcp_health: { properties: ["projectRoot"] },
};

function main() {
    const server = new McpServer({ name: "verify", version: "0" });
    const ctx = createContext();
    registerCoreTools(server, ctx);
    registerRecipeLayerTools(server, ctx, 2);

    const tools = server._registeredTools ?? {};
    let failed = 0;

    for (const [toolName, spec] of Object.entries(REQUIRED)) {
        const tool = tools[toolName];
        if (!tool) {
            console.error(`[verify-tool-schemas] missing tool: ${toolName}`);
            failed++;
            continue;
        }
        if (!tool.enabled) {
            console.error(`[verify-tool-schemas] tool disabled: ${toolName}`);
            failed++;
            continue;
        }

        const jsonSchema = toolInputJsonSchema(tool.inputSchema);
        const props = Object.keys(jsonSchema.properties ?? {});
        for (const key of spec.properties) {
            if (!props.includes(key)) {
                console.error(
                    `[verify-tool-schemas] ${toolName} missing property "${key}" (have: ${props.join(", ") || "(none)"})`,
                );
                failed++;
            }
        }
    }

    if (failed) {
        process.exit(1);
    }
    console.error(`[verify-tool-schemas] ok (${Object.keys(REQUIRED).length} tools)`);
}

main();
