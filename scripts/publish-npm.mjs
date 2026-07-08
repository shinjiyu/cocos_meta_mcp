#!/usr/bin/env node
/**
 * Publish to npm using NPM_TOKEN (env) or repo-root .npm-token (one line, gitignored).
 *
 *   $env:NPM_TOKEN="npm_..." ; node scripts/publish-npm.mjs
 *   # or: echo npm_... > .npm-token && node scripts/publish-npm.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tokenFile = path.join(root, ".npm-token");

function readToken() {
    if (process.env.NPM_TOKEN?.trim()) {
        return process.env.NPM_TOKEN.trim();
    }
    if (process.env.NODE_AUTH_TOKEN?.trim()) {
        return process.env.NODE_AUTH_TOKEN.trim();
    }
    if (fs.existsSync(tokenFile)) {
        const line = fs.readFileSync(tokenFile, "utf8").trim();
        if (line) {return line;}
    }
    return null;
}

const token = readToken();
if (!token) {
    console.error("[publish-npm] missing token.");
    console.error("Set NPM_TOKEN env or create .npm-token (one line) in repo root.");
    process.exit(1);
}

const npmrc = path.join(root, ".npmrc.publish.tmp");
fs.writeFileSync(npmrc, `//registry.npmjs.org/:_authToken=${token}\n`, "utf8");

try {
    // shell:true — Node ≥18.20 禁止直接 spawn .cmd（CVE-2024-27980）
    const r = spawnSync("npm", ["publish", "--access", "public", "--userconfig", npmrc], {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env },
        shell: true,
    });
    if (r.error) {
        console.error("[publish-npm] spawn failed:", r.error.message);
    }
    process.exit(r.status ?? 1);
} finally {
    try {
        fs.unlinkSync(npmrc);
    } catch {
        /* ignore */
    }
}
