/**
 * 调用 genbot CLI，为指定 prefab 生成 bind.json / *.gen.ts / *.view.ts
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** 工程内 genbot 扩展（git submodule，见 .gitmodules） */
export const GENBOT_EXT_REL = "extensions/genbot";

/**
 * 解析 genbot 根目录：优先工程 submodule，GENBOT_ROOT 仅作本机覆盖。
 * @param {string} projectRoot
 */
export function resolveGenbotRoot(projectRoot) {
    const candidates = [process.env.GENBOT_ROOT, path.join(projectRoot, GENBOT_EXT_REL)].filter(Boolean);

    for (const c of candidates) {
        const root = path.resolve(c);
        if (resolveGenbotCliPath(root)) return root;
    }
    return null;
}

/** @returns {string | null} 传给 node 的 cli 入口（.ts 或已编译 .js） */
export function resolveGenbotCliPath(genbotRoot) {
    const srcCli = path.join(genbotRoot, "src/cli.ts");
    if (fs.existsSync(srcCli)) return srcCli;
    const distCli = path.join(genbotRoot, "dist/cli.js");
    if (fs.existsSync(distCli)) return distCli;
    return null;
}

export function genbotSetupHint(projectRoot) {
    return [
        `Initialize in-repo genbot: git submodule update --init ${GENBOT_EXT_REL}`,
        `Then enable extension "genbot" in Cocos Creator (optional, for preferEditor).`,
        `Override only if needed: GENBOT_ROOT env.`,
        `Project: ${projectRoot}`,
    ].join("\n");
}

/**
 * @param {string} prefabInput 绝对路径、相对 projectRoot 的路径，或 db://assets/...
 */
export function resolvePrefabPath(prefabInput, projectRoot) {
    const raw = prefabInput.trim();
    if (raw.startsWith("db://")) {
        const withoutScheme = raw.slice("db://".length).replace(/^\/+/, "");
        return path.join(projectRoot, withoutScheme);
    }
    if (path.isAbsolute(raw)) return path.normalize(raw);
    return path.join(projectRoot, raw.replace(/^[/\\]+/, ""));
}

export function expectedGenbotOutputs(projectRoot, prefabAbsPath) {
    const prefabName = path.basename(prefabAbsPath, path.extname(prefabAbsPath));
    const outDir = path.join(projectRoot, "assets/scripts/_genbot", prefabName);
    return {
        prefabName,
        outDir,
        bindJson: path.join(outDir, `${prefabName}.bind.json`),
        genTs: path.join(outDir, `${prefabName}.gen.ts`),
        viewTs: path.join(outDir, `${prefabName}.view.ts`),
        registry: path.join(projectRoot, "assets/scripts/_genbot/__registry.json"),
    };
}

export function readRegistryEntry(projectRoot, prefabName) {
    const registryPath = path.join(projectRoot, "assets/scripts/_genbot/__registry.json");
    if (!fs.existsSync(registryPath)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(registryPath, "utf8"));
        const entries = data.entries;
        if (!entries || typeof entries !== "object") return null;
        return entries[prefabName] ?? null;
    } catch {
        return null;
    }
}

/**
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {string} opts.prefabPath absolute .prefab
 * @param {string} opts.genbotRoot
 * @param {boolean} [opts.regenBind]
 * @param {boolean} [opts.dryRun]
 * @param {boolean} [opts.quiet]
 */
export function runGenbotCli(opts) {
    const { projectRoot, prefabPath, genbotRoot, regenBind, dryRun, quiet } = opts;
    const cli = resolveGenbotCliPath(genbotRoot);
    if (!cli) {
        return Promise.resolve({
            code: 1,
            stdout: "",
            stderr: `[cocosmcp] genbot cli missing under ${genbotRoot}\n`,
        });
    }
    const args = [cli, prefabPath, "--project", projectRoot];
    if (cli.endsWith(".ts")) {
        args.unshift("--experimental-strip-types");
    }
    if (regenBind) args.push("--regen-bind");
    if (dryRun) args.push("--dry-run");
    if (quiet) args.push("--quiet");

    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {
            cwd: projectRoot,
            env: process.env,
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (d) => {
            stdout += d;
        });
        child.stderr?.on("data", (d) => {
            stderr += d;
        });
        child.on("close", (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });
        child.on("error", reject);
    });
}
