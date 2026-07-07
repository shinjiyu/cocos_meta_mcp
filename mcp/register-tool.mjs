import { normalizeObjectSchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";

/**
 * Register an MCP tool via registerTool (stable API) with a Zod object schema.
 * Returns the RegisteredTool handle.
 */
export function registerMcpTool(server, name, { description, inputSchema }, handler) {
    return server.registerTool(
        name,
        {
            description,
            inputSchema,
        },
        handler,
    );
}

/** Convert a registered tool's Zod inputSchema to JSON Schema (tools/list shape). */
export function toolInputJsonSchema(inputSchema) {
    const obj = normalizeObjectSchema(inputSchema);
    if (!obj) {
        return { type: "object", properties: {} };
    }
    return toJsonSchemaCompat(obj, {
        strictUnions: true,
        pipeStrategy: "input",
    });
}
