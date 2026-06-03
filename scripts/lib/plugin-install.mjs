import fs from "node:fs";
import path from "node:path";
import {
    cursorGlobalMcpConfigPath,
    cursorProjectMcpConfigPath,
    packageRoot,
    readJsonFile,
    writeJsonFile,
} from "./paths.mjs";

export const NPM_BUNDLED_PLUGINS = ["asset-meta", "asset-sync"];

export function resolvePluginsSource(fromPath) {
    const resolved = path.resolve(fromPath);
    const nested = path.join(resolved, "mcp", "plugins");
    if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
        return { pluginsDir: nested, repoRoot: resolved };
    }
    if (fs.existsSync(path.join(resolved, "manifest.json"))) {
        return { pluginsDir: path.dirname(resolved), repoRoot: path.dirname(resolved), singleId: path.basename(resolved) };
    }
    throw new Error(`No mcp/plugins/ or plugin manifest under: ${resolved}`);
}

export function readPluginManifest(pluginDir, fallbackId) {
    const file = path.join(pluginDir, "manifest.json");
    if (!fs.existsSync(file)) {
        return { ok: false, id: fallbackId, error: "missing manifest.json" };
    }
    try {
        const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
        const id = manifest.id ?? fallbackId;
        if (!id) {
            return { ok: false, id: fallbackId, error: "manifest.json missing id" };
        }
        return { ok: true, id, manifest, manifestPath: file };
    } catch (e) {
        return { ok: false, id: fallbackId, error: `invalid manifest.json: ${e}` };
    }
}

export function validatePluginDir(pluginDir, fallbackId) {
    const manifest = readPluginManifest(pluginDir, fallbackId);
    if (!manifest.ok) {
        return manifest;
    }
    if (!fs.existsSync(path.join(pluginDir, "index.mjs"))) {
        return { ok: false, id: manifest.id, error: "missing index.mjs" };
    }
    return { ok: true, id: manifest.id, manifest: manifest.manifest, pluginDir };
}

export function discoverPluginIds(pluginsDir, { ids = null, includeBundled = false } = {}) {
    if (!fs.existsSync(pluginsDir)) {
        return [];
    }
    const requested = ids?.length ? new Set(ids) : null;
    return fs
        .readdirSync(pluginsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((id) => includeBundled || !NPM_BUNDLED_PLUGINS.includes(id))
        .filter((id) => !requested || requested.has(id))
        .filter((id) => fs.existsSync(path.join(pluginsDir, id, "manifest.json")));
}

export function listInstalledPlugins(targetPkgRoot = packageRoot()) {
    const pluginsDir = path.join(targetPkgRoot, "mcp", "plugins");
    if (!fs.existsSync(pluginsDir)) {
        return [];
    }
    return fs
        .readdirSync(pluginsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => {
            const dir = path.join(pluginsDir, d.name);
            const check = validatePluginDir(dir, d.name);
            return {
                id: d.name,
                valid: check.ok,
                bundled: NPM_BUNDLED_PLUGINS.includes(d.name),
                error: check.ok ? undefined : check.error,
                name: check.manifest?.name,
                tools: check.manifest?.tools ?? [],
            };
        });
}

function copyDirReplace(src, dest) {
    if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.cpSync(src, dest, { recursive: true });
}

function dirFingerprint(dir) {
    const parts = [];
    function walk(current, prefix = "") {
        for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
            const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
            const full = path.join(current, ent.name);
            if (ent.isDirectory()) {
                walk(full, rel);
            } else {
                const st = fs.statSync(full);
                parts.push(`${rel}:${st.size}:${st.mtimeMs}`);
            }
        }
    }
    walk(dir);
    return parts.sort().join("\n");
}

/**
 * @returns {{ installed: object[], skipped: object[], unchanged: object[] }}
 */
export function installPlugins({
    targetPkgRoot = packageRoot(),
    sourceRoot,
    ids = null,
    includeBundled = false,
    dryRun = false,
    force = false,
}) {
    const { pluginsDir: sourcePluginsDir, singleId } = resolvePluginsSource(sourceRoot);
    const targetPluginsDir = path.join(targetPkgRoot, "mcp", "plugins");

    const candidateIds =
        singleId && (!ids?.length || ids.includes(singleId))
            ? [singleId]
            : discoverPluginIds(sourcePluginsDir, { ids, includeBundled });

    if (!candidateIds.length) {
        throw new Error(
            ids?.length
                ? `No matching plugins under ${sourcePluginsDir} for ids: ${ids.join(", ")}`
                : `No installable plugins under ${sourcePluginsDir}`,
        );
    }

    const installed = [];
    const skipped = [];
    const unchanged = [];

    for (const id of candidateIds) {
        const src = path.join(sourcePluginsDir, id);
        const dest = path.join(targetPluginsDir, id);
        const check = validatePluginDir(src, id);
        if (!check.ok) {
            skipped.push({ id, reason: check.error });
            continue;
        }

        const same =
            !force &&
            fs.existsSync(dest) &&
            validatePluginDir(dest, id).ok &&
            dirFingerprint(src) === dirFingerprint(dest);

        if (same) {
            unchanged.push({ id, dest });
            continue;
        }

        if (dryRun) {
            installed.push({ id, src, dest, action: fs.existsSync(dest) ? "replace" : "install" });
            continue;
        }

        fs.mkdirSync(targetPluginsDir, { recursive: true });
        copyDirReplace(src, dest);
        installed.push({ id, src, dest, action: "installed" });
    }

    return { installed, skipped, unchanged, targetPkgRoot, sourcePluginsDir };
}

export function parsePluginsEnv(raw) {
    return (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

export function mergePluginIds(existingIds, newIds) {
    const merged = [...NPM_BUNDLED_PLUGINS];
    for (const id of [...parsePluginsEnv(existingIds), ...newIds]) {
        if (!merged.includes(id)) {
            merged.push(id);
        }
    }
    return merged;
}

function isCocosMetaMcpServer(server, targetPkgRoot) {
    if (!server || typeof server !== "object") {
        return false;
    }
    if (server.command === "cocos-meta-mcp") {
        return true;
    }
    const args = server.args ?? [];
    const indexPath = path.join(targetPkgRoot, "mcp", "index.mjs").replace(/\\/g, "/");
    return args.some((a) => String(a).replace(/\\/g, "/") === indexPath);
}

/**
 * Merge plugin ids into Cursor mcp.json for cocos-meta-mcp servers.
 * @returns {{ configPath: string, updatedServers: string[] }}
 */
export function updateCursorMcpPlugins({
    pluginIds,
    target = "global",
    projectRoot,
    configPath,
    targetPkgRoot = packageRoot(),
    dryRun = false,
}) {
    const file =
        configPath ??
        (target === "project"
            ? cursorProjectMcpConfigPath(projectRoot)
            : cursorGlobalMcpConfigPath());

    const cfg = readJsonFile(file, { mcpServers: {} });
    cfg.mcpServers = cfg.mcpServers ?? {};

    const updatedServers = [];
    for (const [name, server] of Object.entries(cfg.mcpServers)) {
        if (!isCocosMetaMcpServer(server, targetPkgRoot)) {
            continue;
        }
        server.env = server.env ?? {};
        const next = mergePluginIds(server.env.COCOSMCP_PLUGINS, pluginIds);
        const prev = server.env.COCOSMCP_PLUGINS ?? "";
        const nextStr = next.join(",");
        if (prev !== nextStr) {
            server.env.COCOSMCP_PLUGINS = nextStr;
            updatedServers.push(name);
        }
        if (!server.env.COCOSMCP_RECIPE_LAYER) {
            server.env.COCOSMCP_RECIPE_LAYER = "2";
            if (!updatedServers.includes(name)) {
                updatedServers.push(name);
            }
        }
    }

    if (!updatedServers.length) {
        return { configPath: file, updatedServers, changed: false };
    }

    if (!dryRun) {
        writeJsonFile(file, cfg);
    }
    return { configPath: file, updatedServers, changed: true };
}

export function pluginInstallUsage() {
    return `Usage: cocos-meta-mcp plugin <command> [options]

Commands:
  list      List plugins in the installed cocos-meta-mcp package
  install   Validate, copy/replace plugins and update Cursor mcp.json

Install options:
  --from <path>           Source repo, mcp/plugins dir, or single plugin dir (default: cwd)
  --ids <a,b,c>           Plugin ids to install (default: all non-bundled under source)
  --include-bundled       Also copy asset-meta / asset-sync from source
  --target <global|project>  mcp.json target (default: global)
  --project-root <path>   Required when --target project
  --config <path>         Override mcp.json path
  --no-cursor             Skip updating Cursor mcp.json
  --force                 Replace even when content unchanged
  --dry-run               Print actions only
  -h, --help

Examples:
  cocos-meta-mcp plugin list
  cocos-meta-mcp plugin install --from D:/path/to/cocos-meta-mcp-repo
  cocos-meta-mcp plugin install --from ./mcp/plugins/my-plugin
  cocos-meta-mcp plugin install --from . --ids my-plugin
`;
}

export function parsePluginCliArgs(argv) {
    const opts = {
        command: null,
        from: process.cwd(),
        ids: null,
        includeBundled: false,
        target: "global",
        updateCursor: true,
        dryRun: false,
        force: false,
    };

    if (!argv.length) {
        return opts;
    }

    const cmd = argv[0];
    if (cmd === "list" || cmd === "install") {
        opts.command = cmd;
        argv = argv.slice(1);
    } else if (cmd === "-h" || cmd === "--help" || cmd === "help") {
        opts.help = true;
        return opts;
    } else {
        throw new Error(`Unknown plugin command: ${cmd}`);
    }

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "-h" || a === "--help") {
            opts.help = true;
        } else if (a === "--dry-run") {
            opts.dryRun = true;
        } else if (a === "--force") {
            opts.force = true;
        } else if (a === "--include-bundled") {
            opts.includeBundled = true;
        } else if (a === "--no-cursor") {
            opts.updateCursor = false;
        } else if (a === "--from") {
            opts.from = argv[++i];
        } else if (a === "--ids") {
            opts.ids = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
        } else if (a === "--target") {
            opts.target = argv[++i];
        } else if (a === "--project-root") {
            opts.projectRoot = argv[++i];
        } else if (a === "--config") {
            opts.config = argv[++i];
        } else {
            throw new Error(`Unknown argument: ${a}`);
        }
    }

    if (opts.target === "project" && !opts.projectRoot && !opts.config) {
        throw new Error("--project-root is required when --target project");
    }

    return opts;
}

export function runPluginInstallCli(argv) {
    let opts;
    try {
        opts = parsePluginCliArgs(argv);
    } catch (e) {
        console.error(String(e.message ?? e));
        console.error(pluginInstallUsage());
        process.exit(1);
    }

    if (opts.help || !opts.command) {
        console.error(pluginInstallUsage());
        process.exit(opts.command ? 0 : 1);
    }

    const targetPkgRoot = packageRoot();

    if (opts.command === "list") {
        const plugins = listInstalledPlugins(targetPkgRoot);
        console.log(JSON.stringify({ package: targetPkgRoot, plugins }, null, 2));
        return;
    }

    const result = installPlugins({
        targetPkgRoot,
        sourceRoot: opts.from,
        ids: opts.ids,
        includeBundled: opts.includeBundled,
        dryRun: opts.dryRun,
        force: opts.force,
    });

    const installedIds = result.installed.map((p) => p.id);

    if (opts.dryRun) {
        console.log(JSON.stringify({ dryRun: true, ...result }, null, 2));
    } else {
        console.error(`[plugin install] package: ${targetPkgRoot}`);
        if (result.installed.length) {
            for (const p of result.installed) {
                console.error(`  installed ${p.id}`);
                console.error(`    ${p.src}`);
                console.error(`    -> ${p.dest}`);
            }
        }
        if (result.unchanged.length) {
            console.error(`  unchanged: ${result.unchanged.map((p) => p.id).join(", ")}`);
        }
        if (result.skipped.length) {
            console.error("  skipped:");
            for (const s of result.skipped) {
                console.error(`    - ${s.id}: ${s.reason}`);
            }
        }
    }

    if (!installedIds.length && !result.unchanged.length) {
        console.error("[plugin install] nothing installed");
        process.exit(1);
    }

    const idsForCursor = installedIds.length ? installedIds : result.unchanged.map((p) => p.id);

    if (opts.updateCursor && idsForCursor.length) {
        const cursor = updateCursorMcpPlugins({
            pluginIds: idsForCursor,
            target: opts.target,
            projectRoot: opts.projectRoot,
            configPath: opts.config,
            targetPkgRoot,
            dryRun: opts.dryRun,
        });
        if (cursor.changed) {
            const msg = opts.dryRun ? "[dry-run] would update" : "updated";
            console.error(`[plugin install] ${msg} ${cursor.configPath}: ${cursor.updatedServers.join(", ")}`);
            console.error(`  COCOSMCP_PLUGINS merged with: ${idsForCursor.join(", ")}`);
        } else if (!opts.dryRun) {
            console.error(`[plugin install] Cursor mcp.json unchanged (no cocos-meta-mcp server or plugins already set)`);
        }
    }

    if (!opts.dryRun) {
        console.error("[plugin install] Restart Cursor to load new plugins.");
    }
}
