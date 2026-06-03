#!/usr/bin/env node
/**
 * Setup CLI: Cursor MCP config + Cocos Creator extension install
 *
 *   cocos-meta-mcp-setup cursor --project-root D:/proj
 *   cocos-meta-mcp-setup extension --mode global
 *   cocos-meta-mcp-setup all --project-root D:/proj
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageRoot } from "../scripts/lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
    console.error(`Usage: cocos-meta-mcp-setup <command> [options]

Commands:
  cursor      Merge MCP entries into Cursor mcp.json
  extension   Install fg-cocosmcp Creator extension (global or project)
  all         cursor + extension (extension defaults to global)

Run with --help on each command for options, e.g.:
  cocos-meta-mcp-setup cursor --help
  cocos-meta-mcp-setup extension --help
`);
}

function runScript(scriptName, args) {
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

    const rest = argv.slice(1);

    switch (cmd) {
        case "cursor":
            runScript("install-cursor.mjs", rest);
            break;
        case "extension":
            runScript("install-extension.mjs", rest);
            break;
        case "all": {
            if (!rest.includes("--project-root") && !rest.some((a, i) => rest[i - 1] === "--project-root")) {
                console.error("cocos-meta-mcp-setup all requires --project-root");
                process.exit(1);
            }
            runScript("install-cursor.mjs", rest);
            const extArgs = rest.includes("--mode")
                ? rest
                : ["--mode", "global", ...rest.filter((a, i) => rest[i - 1] !== "--mode" && a !== "--mode")];
            runScript("install-extension.mjs", extArgs);
            break;
        }
        default:
            console.error(`Unknown command: ${cmd}`);
            usage();
            process.exit(1);
    }
}

main();
