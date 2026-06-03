#!/usr/bin/env node
/**
 * Merge cocosmcp MCP server entries into Cursor mcp.json.
 *
 * Usage:
 *   node scripts/install-cursor.mjs --project-root D:/path/to/cocos/project
 *   node scripts/install-cursor.mjs --project-root D:/proj --profile workflow --target global
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    cursorGlobalMcpConfigPath,
    cursorProjectMcpConfigPath,
    mcpDir,
    readJsonFile,
    packageRoot,
    writeJsonFile,
} from "./lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
    console.error(`Usage: node scripts/install-cursor.mjs [options]

Options:
  --project-root <path>   Cocos project root (MCP cwd). Required.
  --repo <path>           cocosmcp repo root (default: auto)
  --ir-root <path>        COCOSMCP_IR_ROOT (optional)
  --profile <name>        minimal | workflow | admin | all (default: minimal)
  --target <where>        global | project (default: global)
  --config <path>         Override mcp.json output path
  --dry-run               Print merged config only
  --skip-npm              Skip npm install in mcp/
  -h, --help              Show help
`);
}

function parseArgs(argv) {
    const opts = {
        profile: "minimal",
        target: "global",
        dryRun: false,
        skipNpm: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "-h" || a === "--help") {
            opts.help = true;
        } else if (a === "--dry-run") {
            opts.dryRun = true;
        } else if (a === "--skip-npm") {
            opts.skipNpm = true;
        } else if (a === "--project-root") {
            opts.projectRoot = argv[++i];
        } else if (a === "--repo") {
            opts.repo = argv[++i];
        } else if (a === "--ir-root") {
            opts.irRoot = argv[++i];
        } else if (a === "--profile") {
            opts.profile = argv[++i];
        } else if (a === "--target") {
            opts.target = argv[++i];
        } else if (a === "--config") {
            opts.config = argv[++i];
        } else {
            throw new Error(`Unknown argument: ${a}`);
        }
    }
    return opts;
}

function normalizePath(p) {
    return path.resolve(p).replace(/\\/g, "/");
}

function buildServers({ repo, projectRoot, irRoot, profile }) {
    const indexMjs = normalizePath(path.join(mcpDir(repo), "index.mjs"));
    const cwd = normalizePath(projectRoot);
    const baseEnv = {};
    if (irRoot) {
        baseEnv.COCOSMCP_IR_ROOT = normalizePath(irRoot);
    }

    const minimal = {
        cocosmcp: {
            command: "node",
            args: [indexMjs],
            cwd,
            env: { ...baseEnv },
        },
    };

    const workflowEnv = {
        ...baseEnv,
        COCOSMCP_PLUGINS: "asset-meta,asset-sync,ir-prefab",
    };

    const adminEnv = {
        COCOSMCP_RECIPE_LAYER: "2",
        COCOSMCP_PLUGINS: "asset-meta,asset-sync,ir-prefab",
        ...baseEnv,
    };

    const workflow = {
        ...minimal,
        "cocosmcp-workflow": {
            comment: "Asset / IR plugins (Creator 3.8.8)",
            command: "node",
            args: [indexMjs],
            cwd,
            env: workflowEnv,
        },
    };

    const admin = {
        ...workflow,
        "cocosmcp-admin": {
            comment: "Agent recipe L2 + plugins",
            command: "node",
            args: [indexMjs],
            cwd,
            env: adminEnv,
        },
    };

    switch (profile) {
        case "minimal":
            return minimal;
        case "workflow":
            return workflow;
        case "admin":
            return admin;
        case "all":
            return admin;
        default:
            throw new Error(`Unknown profile: ${profile}`);
    }
}

function mergeMcpConfig(existing, servers) {
    const next = { ...existing };
    next.mcpServers = { ...(existing.mcpServers ?? {}), ...servers };
    return next;
}

function runNpmInstall(repo) {
    const dir = mcpDir(repo);
    console.error(`[install-cursor] npm install in ${dir}`);
    const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install"], {
        cwd: dir,
        stdio: "inherit",
    });
    if (r.status !== 0) {
        throw new Error("npm install failed in mcp/");
    }
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        usage();
        process.exit(0);
    }
    if (!opts.projectRoot) {
        usage();
        process.exit(1);
    }

    const repo = path.resolve(opts.repo ?? packageRoot());
    const indexFile = path.join(mcpDir(repo), "index.mjs");
    if (!fs.existsSync(indexFile)) {
        throw new Error(`MCP entry not found: ${indexFile}`);
    }

    if (!opts.skipNpm && !opts.dryRun) {
        runNpmInstall(repo);
    }

    const servers = buildServers({
        repo,
        projectRoot: opts.projectRoot,
        irRoot: opts.irRoot,
        profile: opts.profile,
    });

    const configPath =
        opts.config ??
        (opts.target === "project"
            ? cursorProjectMcpConfigPath(opts.projectRoot)
            : cursorGlobalMcpConfigPath());

    const merged = mergeMcpConfig(readJsonFile(configPath, {}), servers);

    if (opts.dryRun) {
        console.log(JSON.stringify(merged, null, 2));
        return;
    }

    writeJsonFile(configPath, merged);
    console.error(`[install-cursor] wrote ${configPath}`);
    console.error(`[install-cursor] profile=${opts.profile} servers=${Object.keys(servers).join(", ")}`);
    console.error("[install-cursor] Restart Cursor (or reload MCP) to apply.");
}

main();
