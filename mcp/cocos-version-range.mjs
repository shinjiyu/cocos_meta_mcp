import { cocosVersionSlug } from "./tool-naming.mjs";

/** 规范化版本声明：3.8.x → 3.8.* */
export function normalizeVersionSpec(spec) {
    if (spec === null || spec === undefined || spec === "") {return "3.8.*";}
    if (Array.isArray(spec)) {return spec.map(normalizeVersionSpec);}
    const s = String(spec).trim();
    if (s === "any" || s === "all") {return "*";}
    return s.replace(/\.x(?=\.|$)/gi, ".*").replace(/\.X(?=\.|$)/g, ".*");
}

function parseVersionParts(version) {
    const m = String(version)
        .trim()
        .match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) {return null;}
    return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

function cmpVersion(a, b) {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) {return a[i] - b[i];}
    }
    return 0;
}

/** 通配符：* / 3.* / 3.8.* / 3.8.x */
function matchWildcardSpec(current, spec) {
    const normalized = normalizeVersionSpec(spec);
    if (normalized === "*") {return true;}

    const cur = parseVersionParts(current);
    if (!cur) {return false;}

    const parts = normalized.split(".");
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p === "*" || p.toLowerCase() === "x") {
            return true;
        }
        const n = Number(p);
        if (Number.isNaN(n) || cur[i] !== n) {
            return false;
        }
    }
    return parts.length >= 3 ? true : true;
}

/** 简单范围：>=3.8.0 <3.9.0（可组合） */
function matchRangeSpec(current, range) {
    const cur = parseVersionParts(current);
    if (!cur) {return false;}

    const clauses = String(range).trim().split(/\s+/);
    for (const clause of clauses) {
        const m = clause.match(/^(>=|<=|>|<|=)?(\d+(?:\.\d+){0,2})$/);
        if (!m) {continue;}
        const op = m[1] || "=";
        const target = parseVersionParts(m[2]);
        if (!target) {continue;}
        const c = cmpVersion(cur, target);
        if (op === ">=" && c < 0) {return false;}
        if (op === "<=" && c > 0) {return false;}
        if (op === ">" && c <= 0) {return false;}
        if (op === "<" && c >= 0) {return false;}
        if (op === "=" && c !== 0) {return false;}
    }
    return true;
}

/** 当前 Creator 版本是否满足 manifest 声明 */
export function matchCocosVersion(currentVersion, spec) {
    const normalized = normalizeVersionSpec(spec);
    if (Array.isArray(normalized)) {
        return normalized.some((s) => matchCocosVersion(currentVersion, s));
    }
    const s = String(normalized).trim();
    if (s.includes(">") || s.includes("<") || (s.includes("=") && s.includes("."))) {
        return matchRangeSpec(currentVersion, s);
    }
    return matchWildcardSpec(currentVersion, s);
}

function isRangeSpec(spec) {
    const s = String(spec);
    return s.includes(">") || s.includes("<");
}

function isWildcardSpec(spec) {
    const s = normalizeVersionSpec(spec);
    if (Array.isArray(s)) {return s.some(isWildcardSpec);}
    return s === "*" || s.includes("*") || /\.x$/i.test(String(spec));
}

/** 通配/范围 → tool slug；精确版本 → cc388 */
export function specToToolVersionSlug(spec) {
    const normalized = normalizeVersionSpec(spec);
    if (Array.isArray(normalized)) {
        return specToToolVersionSlug(normalized[0]);
    }
    const s = String(normalized).trim();

    if (s === "*") {return "ccany";}

    if (isRangeSpec(s)) {
        const m = s.match(/(\d+)\.(\d+)/);
        if (m) {return `cc${m[1]}${m[2]}`;}
        const major = s.match(/(\d+)/);
        return major ? `cc${major[1]}` : "ccrange";
    }

    if (s.includes("*")) {
        const parts = s.split(".").filter((p) => p !== "*");
        if (parts.length === 0) {return "ccany";}
        if (parts.length === 1) {return `cc${parts[0]}x`;}
        return `cc${parts.join("")}x`;
    }

    return cocosVersionSlug(s);
}

/** 安装时：按 manifest 声明生成 tool 前缀 slug */
export function resolveToolVersionSlug(currentVersion, manifest) {
    const spec = getManifestVersionSpec(manifest);
    if (isWildcardSpec(spec) || isRangeSpec(String(spec))) {
        return specToToolVersionSlug(spec);
    }
    if (currentVersion && currentVersion !== "unknown") {
        return cocosVersionSlug(currentVersion);
    }
    return specToToolVersionSlug(spec);
}

export function getManifestVersionSpec(manifest) {
    if (manifest?.cocosVersion !== undefined && manifest?.cocosVersion !== null) {
        return manifest.cocosVersion;
    }
    if (manifest?.cocosVersionRange !== undefined && manifest?.cocosVersionRange !== null) {
        return manifest.cocosVersionRange;
    }
    return "3.8.*";
}

export function describeVersionSpec(spec) {
    const normalized = normalizeVersionSpec(spec);
    if (Array.isArray(normalized)) {return normalized.join(" | ");}
    return String(normalized);
}
