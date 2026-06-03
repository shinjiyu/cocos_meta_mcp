import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PACKAGE_NAME = "cocos-meta-mcp";

/** Walk up from module location to find npm package root */
export function packageRoot(fromModuleUrl = import.meta.url) {
    let dir = path.dirname(fileURLToPath(fromModuleUrl));
    while (true) {
        const pkgFile = path.join(dir, "package.json");
        if (fs.existsSync(pkgFile)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
                if (pkg.name === PACKAGE_NAME) {
                    return dir;
                }
            } catch {
                /* continue */
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return path.resolve(__dirname, "..", "..");
}

/** @deprecated use packageRoot */
export function repoRoot() {
    return packageRoot();
}

export function cocosGlobalExtensionsDir() {
    return path.join(os.homedir(), ".CocosCreator", "extensions");
}

export function cursorGlobalMcpConfigPath() {
    return path.join(os.homedir(), ".cursor", "mcp.json");
}

export function cursorProjectMcpConfigPath(projectRoot) {
    return path.join(path.resolve(projectRoot), ".cursor", "mcp.json");
}

export function extensionSourceDir(root = packageRoot()) {
    return path.join(root, "extension");
}

export function mcpDir(root = packageRoot()) {
    return path.join(root, "mcp");
}

export function extensionDestDir({ mode, projectRoot, extensionName = "fg-cocosmcp" }) {
    if (mode === "global" || mode === "global-legacy") {
        return path.join(cocosGlobalExtensionsDir(), extensionName);
    }
    if (mode === "project") {
        if (!projectRoot) {
            throw new Error("projectRoot is required when mode=project");
        }
        return path.join(path.resolve(projectRoot), "extensions", extensionName);
    }
    throw new Error(`Unknown extension install mode: ${mode}`);
}

export function readJsonFile(file, fallback = {}) {
    if (!fs.existsSync(file)) {
        return structuredClone(fallback);
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJsonFile(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function resolveBinPath(commandName) {
    const root = packageRoot();
    const local = path.join(root, "node_modules", ".bin", commandName);
    if (process.platform === "win32" && fs.existsSync(`${local}.cmd`)) {
        return `${local}.cmd`;
    }
    if (fs.existsSync(local)) {
        return local;
    }
    return commandName;
}
