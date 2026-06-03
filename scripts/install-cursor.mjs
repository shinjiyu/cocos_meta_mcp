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
import { resolveCocosProjectRoot } from "./lib/detect-cocos-project.mjs";
import { mcpDepsReady } from "./lib/ensure-deps.mjs";
import {
    cursorGlobalMcpConfigPath,
    cursorProjectMcpConfigPath,
    mcpDir,
    packageRoot,
    readJsonFile,
    writeJsonFile,
} from "./lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
    console.error(`Usage: node scripts/install-cursor.mjs [options]

Options:
  --project-root <path>   Cocos project root (auto-detected if omitted)
  --repo <path>           cocosmcp repo root (default: auto)
  --ir-root <path>        COCOSMCP_IR_ROOT (optional)
  --profile <name>        minimal | workflow | admin | all (default: workflow)
  --target <where>        global | project (default: global)
  --config <path>         Override mcp.json output path
  --dry-run               Print merged config only
  --skip-npm              Skip npm install in mcp/
  -h, --help              Show help
`);
}

function parseArgs(argv) {
    const opts = {
        profile: "workflow",
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

/** npm 全局包用 `cocos-meta-mcp`；源码开发用 node + index.mjs */
function resolveMcpLaunch(repo) {
    const indexMjs = normalizePath(path.join(mcpDir(repo), "index.mjs"));
    const pkgFile = path.join(repo, "package.json");
    let isNpmPackage = false;
    if (fs.existsSync(pkgFile)) {
        try {
            isNpmPackage = JSON.parse(fs.readFileSync(pkgFile, "utf8")).name === "cocos-meta-mcp";
        } catch {
            /* fall through */
        }
    }
    if (isNpmPackage && fs.existsSync(path.join(repo, "bin", "cocos-meta-mcp.mjs"))) {
        return { command: "cocos-meta-mcp", args: [] };
    }
    return { command: "node", args: [indexMjs] };
}

function mcpServerBlock({ repo, projectRoot, env }) {
    const launch = resolveMcpLaunch(repo);
    return {
        command: launch.command,
        ...(launch.args.length ? { args: launch.args } : {}),
        cwd: normalizePath(projectRoot),
        env,
    };
}

function buildServers({ repo, projectRoot, irRoot, profile }) {
    const cwd = normalizePath(projectRoot);
    const baseEnv = {};
    if (irRoot) {
        baseEnv.COCOSMCP_IR_ROOT = normalizePath(irRoot);
    }

    const pluginEnv = {
        ...baseEnv,
        COCOSMCP_PLUGINS: "asset-meta,asset-sync",
    };

    const minimal = {
        cocosmcp: mcpServerBlock({ repo, projectRoot: cwd, env: { ...baseEnv } }),
    };

    const workflow = {
        ...minimal,
        "cocosmcp-workflow": {
            comment: "Asset / IR plugins (Creator 3.8.8)",
            ...mcpServerBlock({ repo, projectRoot: cwd, env: pluginEnv }),
        },
    };

    const admin = {
        ...workflow,
        "cocosmcp-admin": {
            comment: "Agent recipe L2 + plugins",
            ...mcpServerBlock({
                repo,
                projectRoot: cwd,
                env: { COCOSMCP_RECIPE_LAYER: "2", ...pluginEnv },
            }),
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

function ensurePackageDeps(repo) {
    if (mcpDepsReady(repo)) {
        console.error("[install-cursor] dependencies OK, skip npm install");
        return;
    }
    console.error(`[install-cursor] npm install in ${repo}`);
    const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--ignore-scripts"], {
        cwd: repo,
        stdio: "inherit",
        env: { ...process.env },
    });
    if (r.status !== 0) {
        throw new Error(`npm install failed in ${repo}`);
    }
    if (!mcpDepsReady(repo)) {
        throw new Error("MCP dependencies missing after npm install (@modelcontextprotocol/sdk)");
    }
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        usage();
        process.exit(0);
    }
    if (!opts.projectRoot) {
        const found = resolveCocosProjectRoot({ searchFrom: process.cwd() });
        if (!found) {
            console.error("Could not auto-detect Cocos project root. Use --project-root <path>");
            usage();
            process.exit(1);
        }
        opts.projectRoot = found.path;
        console.error(`[install-cursor] auto project-root (${found.source}): ${found.path}`);
    }

    const repo = path.resolve(opts.repo ?? packageRoot());
    const indexFile = path.join(mcpDir(repo), "index.mjs");
    if (!fs.existsSync(indexFile)) {
        throw new Error(`MCP entry not found: ${indexFile}`);
    }

    if (!opts.skipNpm && !opts.dryRun) {
        ensurePackageDeps(repo);
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
