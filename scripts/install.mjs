#!/usr/bin/env node
/**
 * One-shot install: Cursor MCP + Creator extension (Node only, no PowerShell).
 *
 *   node scripts/install.mjs
 *   node scripts/install.mjs --project-root D:/path/to/cocos/project
 *   node scripts/install.mjs --project-root D:/proj --cursor-profile workflow --ir-root D:/export/ir
 *   node scripts/install.mjs --project-root D:/proj --extension-only --extension-mode project
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageRoot } from "./lib/paths.mjs";
import { formatProjectCandidates, resolveCocosProjectRoot } from "./lib/detect-cocos-project.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
    console.error(`Usage: node scripts/install.mjs [options]

Options:
  --project-root <path>       Cocos project root (auto-detected if omitted)
  --search-from <path>        Start directory for auto search (default: cwd)
  --no-auto-project           Require --project-root; disable auto detection
  --repo <path>               Package/repo root (default: auto)
  --ir-root <path>            COCOSMCP_IR_ROOT for Cursor MCP env
  --cursor-profile <name>     minimal | workflow | admin | all (default: minimal)
  --cursor-target <where>     global | project (default: global)
  --extension-mode <mode>     project | none | global-legacy (default: project)
  --extension-link            Junction/symlink extension dir (dev)
  --skip-build                Skip extension npm build when no prebuilt dist
  --cursor-only               Only configure Cursor MCP
  --extension-only            Only install Creator extension
  --dry-run                   Print actions only
  -h, --help                  Show help

Auto detection order:
  1. --project-root  2. COCOSMCP_PROJECT_ROOT  3. walk up from cwd
  4. Cursor mcp.json cwd  5. Cocos Creator recent projects
`);
}

function parseArgs(argv) {
    const opts = {
        cursorProfile: "minimal",
        cursorTarget: "global",
        extensionMode: "project",
        extensionLink: false,
        skipBuild: false,
        dryRun: false,
        cursorOnly: false,
        extensionOnly: false,
        noAutoProject: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "-h" || a === "--help") {
            opts.help = true;
        } else if (a === "--dry-run") {
            opts.dryRun = true;
        } else if (a === "--extension-link") {
            opts.extensionLink = true;
        } else if (a === "--skip-build") {
            opts.skipBuild = true;
        } else if (a === "--cursor-only") {
            opts.cursorOnly = true;
        } else if (a === "--extension-only") {
            opts.extensionOnly = true;
        } else if (a === "--no-auto-project") {
            opts.noAutoProject = true;
        } else if (a === "--project-root") {
            opts.projectRoot = argv[++i];
        } else if (a === "--search-from") {
            opts.searchFrom = argv[++i];
        } else if (a === "--repo") {
            opts.repo = argv[++i];
        } else if (a === "--ir-root") {
            opts.irRoot = argv[++i];
        } else if (a === "--cursor-profile") {
            opts.cursorProfile = argv[++i];
        } else if (a === "--cursor-target") {
            opts.cursorTarget = argv[++i];
        } else if (a === "--extension-mode") {
            opts.extensionMode = argv[++i];
        } else {
            throw new Error(`Unknown argument: ${a}`);
        }
    }
    return opts;
}

function runScript(scriptName, args) {
    const script = path.join(__dirname, scriptName);
    const r = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
    if (r.status !== 0) {
        process.exit(r.status ?? 1);
    }
}

function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (e) {
        console.error(String(e));
        usage();
        process.exit(1);
    }

    if (opts.help) {
        usage();
        process.exit(0);
    }

    const needsCursor = !opts.extensionOnly;
    const needsExtension = !opts.cursorOnly && opts.extensionMode !== "none";
    const needsProjectRoot =
        needsCursor || (needsExtension && opts.extensionMode === "project");

    if (needsProjectRoot && !opts.projectRoot && !opts.noAutoProject) {
        try {
            const found = resolveCocosProjectRoot({
                explicit: null,
                searchFrom: opts.searchFrom ?? process.cwd(),
            });
            if (found) {
                opts.projectRoot = found.path;
                console.error(`[install] auto project-root (${found.source}): ${found.path}`);
            }
        } catch (e) {
            console.error(String(e));
            process.exit(1);
        }
    }

    if (needsProjectRoot && !opts.projectRoot) {
        console.error("Could not auto-detect Cocos project root. Use --project-root <path>");
        const hints = formatProjectCandidates();
        if (hints) {
            console.error(`\nCandidates checked:\n${hints}`);
        }
        usage();
        process.exit(1);
    }

    const repo = path.resolve(opts.repo ?? packageRoot());
    const common = ["--repo", repo];
    if (opts.dryRun) {
        common.push("--dry-run");
    }

    if (!opts.extensionOnly) {
        const cursorArgs = [
            "--project-root",
            path.resolve(opts.projectRoot),
            "--profile",
            opts.cursorProfile,
            "--target",
            opts.cursorTarget,
            ...common,
        ];
        if (opts.irRoot) {
            cursorArgs.push("--ir-root", opts.irRoot);
        }
        console.error("==> Cursor MCP");
        runScript("install-cursor.mjs", cursorArgs);
    }

    if (!opts.cursorOnly && opts.extensionMode !== "none") {
        const extMode =
            opts.extensionMode === "global" ? "global-legacy" : opts.extensionMode;
        const extArgs = ["--mode", extMode, ...common];
        if (opts.projectRoot) {
            extArgs.push("--project-root", path.resolve(opts.projectRoot));
        }
        if (opts.extensionLink) {
            extArgs.push("--link");
        }
        if (opts.skipBuild) {
            extArgs.push("--skip-build");
        }
        console.error(`==> Creator extension (${extMode})`);
        runScript("install-extension.mjs", extArgs);
    }

    console.error("Done.");
}

main();
