#!/usr/bin/env node
/** One-shot CLI to exercise MCP tool handlers without Cursor. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

const SPINE_IDS = [
    "eff_candystorm_icon",
    "eff_candystorm_scatter",
    "eff_candystorm_collect",
    "eff_candystorm_scene",
];
const RASTER_IDS = [
    "candystorm_bg",
    "candystorm_kuang",
    "candystorm_iconbg",
    "candystorm_fgbg",
];

const EXPECTED_META = [
    "assets/asset_bundles/game_art/ab/candystorm.meta",
    ...SPINE_IDS.flatMap((id) => [
        `assets/asset_bundles/game_art/ab/candystorm/spine/${id}/${id}.png.meta`,
        `assets/asset_bundles/game_art/ab/candystorm/spine/${id}/${id}.atlas.meta`,
        `assets/asset_bundles/game_art/ab/candystorm/spine/${id}/${id}.json.meta`,
    ]),
    ...RASTER_IDS.map(
        (id) =>
            `assets/asset_bundles/game_art/ab/candystorm/ui/rasters/${id}.png.meta`,
    ),
];

function metaStatus() {
    const missing = EXPECTED_META.filter(
        (rel) => !fs.existsSync(path.join(PROJECT_ROOT, rel)),
    );
    return { allPresent: missing.length === 0, missing };
}

async function bridgeHealth() {
    try {
        const res = await fetch("http://127.0.0.1:3921/health", { signal: AbortSignal.timeout(3000) });
        return { ok: res.ok, status: res.status, body: await res.json() };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

async function bridgeRefresh() {
    const res = await fetch("http://127.0.0.1:3921/refresh-ir-meta", {
        method: "POST",
        signal: AbortSignal.timeout(120000),
    });
    return { ok: res.ok, status: res.status, body: await res.json() };
}

console.log("=== 1. candystorm_meta_status ===");
console.log(JSON.stringify(metaStatus(), null, 2));

console.log("\n=== 2. Creator HTTP bridge /health ===");
console.log(JSON.stringify(await bridgeHealth(), null, 2));

const bridge = await bridgeHealth();
if (bridge.ok) {
    console.log("\n=== 3. candystorm_refresh_meta_in_editor ===");
    console.log(JSON.stringify(await bridgeRefresh(), null, 2));
    console.log("\n=== 4. meta after refresh ===");
    console.log(JSON.stringify(metaStatus(), null, 2));
} else {
    console.log("\n=== 3. SKIP refresh (open Creator + enable cocos-meta-mcp) ===");
    console.log("Then: npm run sync:ir:meta:wait  OR  MCP candystorm_refresh_meta_in_editor");
}
