import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadManifest(importMetaUrl) {
    const dir = path.dirname(fileURLToPath(importMetaUrl));
    return JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
}
