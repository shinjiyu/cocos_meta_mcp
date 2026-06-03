/**
 * cocos-meta-mcp setup — Cursor MCP + Creator extension install
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { packageRoot } from "../scripts/lib/paths.mjs";

export function setupUsage() {
    console.error(`Usage: cocos-meta-mcp setup [command] [options]

Commands (optional):
  (default)   Cursor MCP + Creator 项目扩展
  all         Same as default
  cursor      Cursor MCP only
  extension   Creator extension only

Examples:
  cocos-meta-mcp setup --project-root D:/path/to/cocos/project
  cocos-meta-mcp setup --project-root D:/proj --cursor-profile workflow
  cocos-meta-mcp setup cursor --help
  cocos-meta-mcp setup extension --help
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

/** @param {string[]} argv arguments after "setup" */
export function runSetupCli(argv) {
    const cmd = argv[0];

    if (!cmd || cmd === "-h" || cmd === "--help") {
        setupUsage();
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
            console.error(`Unknown setup command: ${cmd}`);
            setupUsage();
            process.exit(1);
    }
}
