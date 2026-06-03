#!/usr/bin/env node
/**
 * Install cocos-meta-mcp Creator extension (project per Creator 3.8 docs, or global-legacy).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateExtensionInstall, writeInstalledPackageJson } from "./lib/extension-manifest.mjs";
import { CREATOR_EXTENSION_NAME, cocosGlobalExtensionsDir, extensionDestDir, extensionSourceDir, packageRoot } from "./lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
    console.error(`Usage: node scripts/install-extension.mjs [options]

Options:
  --mode <project|global-legacy>   Install target (default: project)
  --project-root <path>     Required when mode=project
  --repo <path>             Package root (default: auto)
  --link                    Symlink/junction to source (dev only)
  --skip-build              Skip build when dist missing
  --dry-run                 Show actions only
  -h, --help                Show help

After install (Creator 3.8 官方方式 — 项目扩展):
  1. 完全退出并重启 Cocos Creator，打开对应工程
  2. 扩展 → 扩展管理器 → **项目** 标签
  3. 找到 ${CREATOR_EXTENSION_NAME} → 启用

  路径: {工程}/extensions/${CREATOR_EXTENSION_NAME}
  文档: https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/install.html

  --mode global-legacy 会装到 ~/.CocosCreator/extensions（非 3.8 中文文档路径，不推荐）
`);
}

function parseArgs(argv) {
    const opts = { mode: "project", link: false, skipBuild: false, dryRun: false };
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

function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, ent.name);
        const to = path.join(dest, ent.name);
        if (ent.isDirectory()) {
            copyDirRecursive(from, to);
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

function runBuild(src) {
    console.error(`[install-extension] npm install in ${src}`);
    let r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install"], {
        cwd: src,
        stdio: "inherit",
    });
    if (r.status !== 0) {
        throw new Error("npm install failed in extension/");
    }
    console.error(`[install-extension] npm run build in ${src}`);
    r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
        cwd: src,
        stdio: "inherit",
    });
    if (r.status !== 0) {
        throw new Error("npm run build failed in extension/");
    }
}

function copyExtensionPayload(src, dest) {
    removeDir(dest);
    fs.mkdirSync(dest, { recursive: true });
    const distSrc = path.join(src, "dist");
    if (!fs.existsSync(path.join(distSrc, "main.js"))) {
        throw new Error(`Extension dist/main.js missing. Run: npm run build:extension`);
    }
    copyDirRecursive(distSrc, path.join(dest, "dist"));
    const manifest = JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8"));
    const clean = writeInstalledPackageJson(dest, manifest);
    console.error(`[install-extension] package.json editor=${clean.editor}`);
}

function printValidation(dest) {
    const issues = validateExtensionInstall(dest);
    if (issues.length) {
        console.error("[install-extension] validation failed:");
        for (const issue of issues) {
            console.error(`  - ${issue}`);
        }
        process.exit(1);
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

    let hasPrebuiltDist = fs.existsSync(path.join(src, "dist", "main.js"));
    if (!hasPrebuiltDist && !opts.skipBuild && !opts.dryRun) {
        runBuild(src);
        hasPrebuiltDist = fs.existsSync(path.join(src, "dist", "main.js"));
    }

    const destMode = opts.mode === "global" ? "global-legacy" : opts.mode;
    const dest = extensionDestDir({
        mode: destMode === "global-legacy" ? "global" : destMode,
        projectRoot: opts.projectRoot,
    });

    if (opts.dryRun) {
        console.log(JSON.stringify({ mode: opts.mode, src, dest, link: opts.link }, null, 2));
        return;
    }

    if (opts.mode === "global-legacy" || opts.mode === "global") {
        if (opts.mode === "global") {
            console.error("[install-extension] warn: --mode global 已改为 global-legacy；Creator 3.8 请用 --mode project");
        }
        fs.mkdirSync(cocosGlobalExtensionsDir(), { recursive: true });
    }

    if (opts.link) {
        console.error(`[install-extension] junction ${dest} -> ${src}`);
        linkDir(src, dest);
        writeInstalledPackageJson(dest, JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8")));
    } else {
        console.error(`[install-extension] install dist + package.json → ${dest}`);
        copyExtensionPayload(src, dest);
    }

    printValidation(dest);

    console.error(`[install-extension] done: ${dest}`);
    const tab = destMode === "global-legacy" ? "全局(legacy)" : "项目";
    console.error(
        `[install-extension] 重启 Creator 并打开工程 → 扩展 → 扩展管理器 → ${tab} → 启用 ${CREATOR_EXTENSION_NAME}`,
    );
}

main();
