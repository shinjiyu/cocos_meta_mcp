import fs from "node:fs";
import path from "node:path";

/** MCP 运行时依赖是否已在 package 根 node_modules 就绪 */
export function mcpDepsReady(packageRoot) {
    return fs.existsSync(path.join(packageRoot, "node_modules", "@modelcontextprotocol/sdk"));
}
