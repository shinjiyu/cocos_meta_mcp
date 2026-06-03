#!/usr/bin/env node
/**
 * cocos-meta-mcp
 *   (no args)     stdio MCP server for Cursor
 *   setup [...]   install Cursor MCP + Creator extension
 *   plugin [...]  install/list MCP plugins
 */
import { pathToFileURL } from "node:url";
import { mcpDir, packageRoot } from "../scripts/lib/paths.mjs";
import { runPluginCli } from "./plugin-cli.mjs";
import { runSetupCli, setupUsage } from "./setup-cli.mjs";

function mainUsage() {
    console.error(`Usage:
  cocos-meta-mcp              Run MCP server (stdio, for Cursor mcp.json)
  cocos-meta-mcp setup [...]  Install Cursor MCP + Creator extension
  cocos-meta-mcp plugin [...] Install/list MCP plugins

Run "cocos-meta-mcp setup --help" or "cocos-meta-mcp plugin --help" for details.
`);
}

const argv = process.argv.slice(2);
const cmd = argv[0];

if (cmd === "setup") {
    runSetupCli(argv.slice(1));
} else if (cmd === "plugin" || cmd === "plugins") {
    runPluginCli(argv.slice(1));
} else if (cmd === "-h" || cmd === "--help" || cmd === "help") {
    mainUsage();
    process.exit(0);
} else if (!cmd) {
    const entry = pathToFileURL(`${mcpDir(packageRoot())}/index.mjs`).href;
    await import(entry);
} else {
    console.error(`Unknown command: ${cmd}`);
    mainUsage();
    process.exit(1);
}
