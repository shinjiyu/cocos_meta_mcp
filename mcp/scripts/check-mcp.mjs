#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mcpRoot = path.join(root, "..");

function collectMjs(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name === "node_modules" || ent.name === "genbot" || ent.name === "ir-prefab") {continue;}
            collectMjs(full, out);
        } else if (ent.name.endsWith(".mjs") && ent.name !== "genbot-runner.mjs" && ent.name !== "test-invoke.mjs") {
            out.push(full);
        }
    }
    return out;
}

const files = collectMjs(mcpRoot);
let failed = 0;

for (const file of files) {
    const rel = path.relative(mcpRoot, file);
    const r = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    if (r.status !== 0) {
        console.error(`[typecheck:mcp] failed: ${rel}`);
        failed++;
    }
}

if (failed) {process.exit(1);}
console.error(`[typecheck:mcp] ok (${files.length} files)`);
