import fs from "node:fs";
import path from "node:path";
import { cocosmcpDir } from "./recipe-registry.mjs";
import { cocosVersionSlug } from "./tool-naming.mjs";

let cached = null;

function readStoredVersion(projectRoot) {
    const file = path.join(cocosmcpDir(projectRoot), "project.json");
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}

function writeStoredVersion(projectRoot, version, slug) {
    const dir = cocosmcpDir(projectRoot);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "project.json");
    const prev = readStoredVersion(projectRoot) ?? {};
    const payload = {
        ...prev,
        cocosCreatorVersion: version,
        cocosVersionSlug: slug,
        updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return payload;
}

export async function resolveCocosVersion(projectRoot, fetchCreatorBridge) {
    if (cached?.projectRoot === projectRoot && cached.version !== "unknown") {
        return cached;
    }

    let version = "unknown";
    try {
        const health = await fetchCreatorBridge("/health");
        const v = health.body?.cocosCreatorVersion;
        if (v && v !== "unknown") version = String(v);
    } catch {
        /* bridge offline */
    }

    if (version === "unknown") {
        const stored = readStoredVersion(projectRoot);
        if (stored?.cocosCreatorVersion) version = stored.cocosCreatorVersion;
    }

    const slug = cocosVersionSlug(version);
    if (version !== "unknown") {
        writeStoredVersion(projectRoot, version, slug);
    }

    cached = { projectRoot, version, slug };
    return cached;
}

export function clearCocosVersionCache() {
    cached = null;
}
