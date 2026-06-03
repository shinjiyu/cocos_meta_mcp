#!/usr/bin/env node
/**
 * Setup CLI (npm global): Cursor MCP + Cocos Creator extension
 *
 *   cocos-meta-mcp-setup --project-root D:/proj
 *   cocos-meta-mcp-setup cursor --project-root D:/proj
 *   cocos-meta-mcp-setup extension --mode project --project-root D:/proj
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { packageRoot } from "../scripts/lib/paths.mjs";

function usage() {
    console.error(`Usage: cocos-meta-mcp-setup [command] [options]

Commands (optional):
  (default)   Same as "all" when --project-root is given
  all         Cursor MCP + Creator 项目扩展 (default: {工程}/extensions)
  cursor      Cursor MCP only
  extension   Creator extension only

Default one-liner:
  cocos-meta-mcp-setup --project-root D:/path/to/cocos/project

Or pass through install.mjs flags:
  cocos-meta-mcp-setup --project-root D:/proj --cursor-profile workflow

Subcommand help:
  cocos-meta-mcp-setup cursor --help
  cocos-meta-mcp-setup extension --help
`);
}

function runInstall(args) {
    const script = path.join(packageRoot(), "scripts", "install.mjs");
    const r = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
    if (r.status !== 0) {
        process.exit(r.status ?? 1);
    }
}

function runLegacy(scriptName, args) {
    const script = path.join(packageRoot(), "scripts", scriptName);
    const r = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
    if (r.status !== 0) {
        process.exit(r.status ?? 1);
    }
}

function main() {
    const argv = process.argv.slice(2);
    const cmd = argv[0];

    if (!cmd || cmd === "-h" || cmd === "--help") {
        usage();
        process.exit(cmd ? 0 : 1);
    }

    if (cmd.startsWith("-") || cmd === "all") {
        const args = cmd === "all" ? argv.slice(1) : argv;
        runInstall(args);
        return;
    }

    const rest = argv.slice(1);
    switch (cmd) {
        case "cursor":
            runLegacy("install-cursor.mjs", rest);
            break;
        case "extension":
            runLegacy("install-extension.mjs", rest);
            break;
        case "all":
            runInstall(rest);
            break;
        default:
            console.error(`Unknown command: ${cmd}`);
            usage();
            process.exit(1);
    }
}

main();
