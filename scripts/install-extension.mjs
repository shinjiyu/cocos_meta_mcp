#!/usr/bin/env node
/**
 * Install fg-cocosmcp Creator extension (project or global).
 *
 * Global path (all projects): ~/.CocosCreator/extensions/fg-cocosmcp
 * Project path: {project}/extensions/fg-cocosmcp
 *
 * Usage:
 *   node scripts/install-extension.mjs --mode global
 *   node scripts/install-extension.mjs --mode project --project-root D:/path/to/project
 *   node scripts/install-extension.mjs --mode global --link
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    cocosGlobalExtensionsDir,
    extensionDestDir,
    extensionSourceDir,
    packageRoot,
} from "./lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
    console.error(`Usage: node scripts/install-extension.mjs [options]

Options:
  --mode <global|project>   Install target (default: global)
  --project-root <path>     Required when mode=project
  --repo <path>             cocosmcp repo root (default: auto)
  --link                    Symlink/junction instead of copy (dev)
  --skip-build              Skip npm install && npm run build in destination
  --dry-run                 Show actions only
  -h, --help                Show help

After install: open Creator → Extension Manager → enable fg-cocosmcp
  Global tab when mode=global, Project tab when mode=project
`);
}

function parseArgs(argv) {
    const opts = { mode: "global", link: false, skipBuild: false, dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "-h" || a === "--help") {
            opts.help = true;
        } else if (a === "--link") {
            opts.link = true;
        } else if (a === "--skip-build") {
            opts.skipBuild = true;
        } else if (a === "--dry-run") {
            opts.dryRun = true;
        } else if (a === "--mode") {
            opts.mode = argv[++i];
        } else if (a === "--project-root") {
            opts.projectRoot = argv[++i];
        } else if (a === "--repo") {
            opts.repo = argv[++i];
        } else {
            throw new Error(`Unknown argument: ${a}`);
        }
    }
    return opts;
}

function copyDirRecursive(src, dest, skipNames = new Set(["node_modules"])) {
    fs.mkdirSync(dest, { recursive: true });
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
        if (skipNames.has(ent.name)) {
            continue;
        }
        const from = path.join(src, ent.name);
        const to = path.join(dest, ent.name);
        if (ent.isDirectory()) {
            copyDirRecursive(from, to, skipNames);
        } else {
            fs.copyFileSync(from, to);
        }
    }
}

function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function linkDir(src, dest) {
    removeDir(dest);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (process.platform === "win32") {
        const r = spawnSync("cmd.exe", ["/c", "mklink", "/J", dest, src], { stdio: "inherit" });
        if (r.status !== 0) {
            throw new Error(`Failed to create junction: ${dest} -> ${src}`);
        }
    } else {
        fs.symlinkSync(src, dest, "dir");
    }
}

function runBuild(dest) {
    console.error(`[install-extension] npm install in ${dest}`);
    let r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install"], {
        cwd: dest,
        stdio: "inherit",
    });
    if (r.status !== 0) {
        throw new Error("npm install failed in extension/");
    }
    console.error(`[install-extension] npm run build in ${dest}`);
    r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
        cwd: dest,
        stdio: "inherit",
    });
    if (r.status !== 0) {
        throw new Error("npm run build failed in extension/");
    }
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        usage();
        process.exit(0);
    }
    if (opts.mode === "project" && !opts.projectRoot) {
        usage();
        process.exit(1);
    }

    const repo = path.resolve(opts.repo ?? packageRoot());
    const src = extensionSourceDir(repo);
    if (!fs.existsSync(path.join(src, "package.json"))) {
        throw new Error(`Extension source not found: ${src}`);
    }
    const hasPrebuiltDist = fs.existsSync(path.join(src, "dist", "main.js"));

    const dest = extensionDestDir({ mode: opts.mode, projectRoot: opts.projectRoot });

    if (opts.dryRun) {
        console.log(
            JSON.stringify(
                {
                    mode: opts.mode,
                    src,
                    dest,
                    link: opts.link,
                    globalExtensionsDir: cocosGlobalExtensionsDir(),
                },
                null,
                2,
            ),
        );
        return;
    }

    if (opts.mode === "global") {
        fs.mkdirSync(cocosGlobalExtensionsDir(), { recursive: true });
    }

    if (opts.link) {
        console.error(`[install-extension] junction ${dest} -> ${src}`);
        linkDir(src, dest);
    } else {
        console.error(`[install-extension] copy ${src} -> ${dest}`);
        removeDir(dest);
        copyDirRecursive(src, dest);
    }

    if (!opts.skipBuild && !hasPrebuiltDist) {
        runBuild(dest);
    } else if (hasPrebuiltDist) {
        console.error("[install-extension] using prebuilt extension/dist (skip npm run build)");
    }

    console.error(`[install-extension] done: ${dest}`);
    console.error(
        `[install-extension] Creator → Extension Manager → ${opts.mode === "global" ? "Global" : "Project"} → enable fg-cocosmcp`,
    );
}

main();
