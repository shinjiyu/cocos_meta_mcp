import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REGISTRY_VERSION = 1;
const SERVICE_NAME = "cocos-meta-mcp";
const HEALTH_TIMEOUT_MS = 2500;

/** Shared with Creator extension — override for tests. */
export function bridgeRegistryHome() {
    if (process.env.COCOSMCP_REGISTRY_HOME) {
        return path.resolve(process.env.COCOSMCP_REGISTRY_HOME);
    }
    if (process.platform === "win32") {
        const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
        return path.join(base, "cocos-meta-mcp");
    }
    return path.join(os.homedir(), ".cocos-meta-mcp");
}

export function bridgeRegistryPath() {
    return path.join(bridgeRegistryHome(), "instances.json");
}

/** Normalize for cross-platform registry lookup. */
export function normalizeProjectPath(projectPath) {
    if (!projectPath || typeof projectPath !== "string") {
        return "";
    }
    let resolved = path.resolve(projectPath);
    if (process.platform === "win32") {
        resolved = resolved.replace(/\\/g, "/");
        if (resolved.length >= 2 && resolved[1] === ":") {
            resolved = resolved[0].toLowerCase() + resolved.slice(1);
        }
    }
    return resolved;
}

function ensureRegistryDir() {
    fs.mkdirSync(bridgeRegistryHome(), { recursive: true });
}

export function readRegistry() {
    const file = bridgeRegistryPath();
    if (!fs.existsSync(file)) {
        return { version: REGISTRY_VERSION, instances: {} };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));
        return {
            version: raw.version ?? REGISTRY_VERSION,
            instances: raw.instances && typeof raw.instances === "object" ? raw.instances : {},
        };
    } catch {
        return { version: REGISTRY_VERSION, instances: {}, error: "invalid instances.json" };
    }
}

function writeRegistry(data) {
    ensureRegistryDir();
    const file = bridgeRegistryPath();
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(
        tmp,
        `${JSON.stringify({ version: REGISTRY_VERSION, instances: data.instances ?? {} }, null, 2)}\n`,
        "utf8",
    );
    fs.renameSync(tmp, file);
}

export function registryKeyForProject(projectPath) {
    return normalizeProjectPath(projectPath);
}

export function upsertRegistryInstance({ projectPath, port, pid }) {
    const key = registryKeyForProject(projectPath);
    if (!key) {
        throw new Error("projectPath required for bridge registry");
    }
    const registry = readRegistry();
    registry.instances[key] = {
        projectPath: path.resolve(projectPath),
        port,
        pid: pid ?? process.pid,
        service: SERVICE_NAME,
        updatedAt: new Date().toISOString(),
    };
    writeRegistry(registry);
    return registry.instances[key];
}

export function removeRegistryInstance(projectPath) {
    const key = registryKeyForProject(projectPath);
    if (!key) {
        return { removed: false };
    }
    const registry = readRegistry();
    if (!registry.instances[key]) {
        return { removed: false, key };
    }
    delete registry.instances[key];
    writeRegistry(registry);
    return { removed: true, key };
}

export function findRegistryInstance(projectPath) {
    const key = registryKeyForProject(projectPath);
    if (!key) {
        return null;
    }
    const entry = readRegistry().instances[key];
    if (!entry) {
        return null;
    }
    return { key, ...entry };
}

export function bridgeUrlForPort(port) {
    return `http://127.0.0.1:${port}`;
}

export async function probeBridgeHealth(bridgeUrl, { timeoutMs = HEALTH_TIMEOUT_MS } = {}) {
    const url = `${bridgeUrl.replace(/\/$/, "")}/health`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        const text = await res.text();
        let body;
        try {
            body = JSON.parse(text);
        } catch {
            body = { raw: text };
        }
        return { ok: res.ok && body?.ok !== false, status: res.status, body, url: bridgeUrl };
    } catch (e) {
        return { ok: false, url: bridgeUrl, error: String(e) };
    }
}

export function validateBridgeProject(healthProjectPath, expectedProjectRoot) {
    if (!expectedProjectRoot) {
        return { ok: true };
    }
    const a = normalizeProjectPath(healthProjectPath);
    const b = normalizeProjectPath(expectedProjectRoot);
    if (!a) {
        return { ok: false, error: "bridge health missing projectPath" };
    }
    if (a !== b) {
        return {
            ok: false,
            error: "bridge project mismatch",
            expected: b,
            actual: a,
        };
    }
    return { ok: true };
}

/**
 * Resolve HTTP bridge URL for a Cocos project.
 * Order: registry entry → legacy COCOSMCP_HTTP_URL / default 3921 (only for default PROJECT_ROOT).
 */
export async function resolveBridgeUrl(projectRoot, { fallbackUrl, defaultProjectRoot, probe = false } = {}) {
    const normalized = normalizeProjectPath(projectRoot);
    const entry = findRegistryInstance(projectRoot);

    if (entry?.port) {
        const url = bridgeUrlForPort(entry.port);
        if (probe) {
            const health = await probeBridgeHealth(url);
            if (!health.ok) {
                removeRegistryInstance(projectRoot);
                return {
                    ok: false,
                    url,
                    error: health.error ?? "bridge health probe failed",
                    registry: entry,
                };
            }
            const match = validateBridgeProject(health.body?.projectPath, projectRoot);
            if (!match.ok) {
                return { ok: false, url, error: match.error, expected: match.expected, actual: match.actual };
            }
            return { ok: true, url, source: "registry", registry: entry, health: health.body };
        }
        return { ok: true, url, source: "registry", registry: entry };
    }

    const isDefaultProject =
        defaultProjectRoot &&
        normalized === normalizeProjectPath(defaultProjectRoot);

    if (fallbackUrl && isDefaultProject) {
        if (probe) {
            const health = await probeBridgeHealth(fallbackUrl);
            if (health.ok) {
                const match = validateBridgeProject(health.body?.projectPath, projectRoot);
                if (!match.ok) {
                    return { ok: false, url: fallbackUrl, error: match.error, expected: match.expected, actual: match.actual };
                }
            }
            return {
                ok: health.ok,
                url: fallbackUrl,
                source: "fallback",
                health: health.body,
                error: health.ok ? undefined : health.error ?? "bridge not reachable",
            };
        }
        return { ok: true, url: fallbackUrl, source: "fallback" };
    }

    return {
        ok: false,
        error: `no bridge registered for project: ${projectRoot}`,
        hint: "Open Creator for this project and enable cocos-meta-mcp extension",
        normalized,
    };
}

export async function listBridgeInstances({ probe = true, pruneStale = true } = {}) {
    const registry = readRegistry();
    const results = [];

    for (const [key, entry] of Object.entries(registry.instances)) {
        const url = bridgeUrlForPort(entry.port);
        let item = {
            key,
            projectPath: entry.projectPath,
            port: entry.port,
            pid: entry.pid,
            url,
            updatedAt: entry.updatedAt,
            service: entry.service,
        };

        if (probe) {
            const health = await probeBridgeHealth(url);
            item = {
                ...item,
                online: health.ok,
                health: health.body,
                probeError: health.error,
            };
            if (!health.ok && pruneStale) {
                delete registry.instances[key];
                item.pruned = true;
                continue;
            }
            if (health.ok) {
                const match = validateBridgeProject(health.body?.projectPath, entry.projectPath);
                item.projectMatch = match.ok;
                if (!match.ok) {
                    item.mismatch = { expected: match.expected, actual: match.actual };
                }
            }
        }

        results.push(item);
    }

    if (probe && pruneStale) {
        writeRegistry(registry);
    }

    return {
        registryPath: bridgeRegistryPath(),
        count: results.length,
        instances: results,
    };
}
