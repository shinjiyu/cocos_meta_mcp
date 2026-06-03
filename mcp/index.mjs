#!/usr/bin/env node
/**
 * cocosmcp — 分层 stdio MCP
 * L0 Core: cocosmcp_exec（默认）
 * L1 Recipe: COCOSMCP_RECIPE_LAYER=1|2
 * Plugins: 全量安装到 .cocosmcp/installed/，tool 名含 Cocos 版本
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveCocosVersion } from "./cocos-version.mjs";
import { createContext, PROJECT_ROOT } from "./context.mjs";
import { registerCoreTools, resolveRecipeLayer } from "./core.mjs";
import {
    loadPlugins,
    listInstalledPlugins,
    registerPluginManagementTools,
    resolveEnabledPluginIds,
} from "./plugin-loader.mjs";
import { registerRecipeLayerTools } from "./recipe-layer.mjs";

const server = new McpServer({
    name: "cocosmcp",
    version: "2.1.5",
});

async function main() {
    const ctx = createContext();
    const recipeLayer = resolveRecipeLayer();
    const cocos = await resolveCocosVersion(PROJECT_ROOT, ctx.fetchCreatorBridge);

    const coreHandles = registerCoreTools(server, ctx);
    const recipe = registerRecipeLayerTools(server, ctx, recipeLayer);
    registerPluginManagementTools(server, ctx, { recipeLayer });

    const pluginIds = resolveEnabledPluginIds(PROJECT_ROOT);
    const plugins = await loadPlugins(server, ctx, pluginIds);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    const installed = listInstalledPlugins(PROJECT_ROOT);
    const pluginToolCount = installed
        .filter((p) => plugins.loaded.includes(p.id))
        .reduce((n, p) => n + (p.tools?.length ?? 0), 0);
    const recipeToolCount = recipe.handles.length + (recipeLayer >= 1 ? 4 : 0);
    const totalApprox = coreHandles.length + recipeToolCount + pluginToolCount + recipe.promoted.restored.length;

    console.error(
        `[cocosmcp] v2.1 layered ~${totalApprox} tools | Creator ${cocos.version} (${cocos.slug}) | core=${coreHandles.length} recipeL${recipeLayer}=${recipeToolCount} plugins=[${plugins.loaded.join(",") || "none"}](${pluginToolCount}) promoted=${recipe.promoted.restored.length}`,
    );
    if (plugins.failed.length) {
        console.error("[cocosmcp] plugin load failed:", JSON.stringify(plugins.failed));
    }
    if (recipe.promoted.failed.length) {
        console.error("[cocosmcp] promoted restore failed:", JSON.stringify(recipe.promoted.failed));
    }
}

main().catch((e) => {
    console.error("[cocosmcp] fatal", e);
    process.exit(1);
});
