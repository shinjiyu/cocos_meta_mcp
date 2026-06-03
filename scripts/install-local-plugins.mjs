#!/usr/bin/env node
/**
 * @deprecated Use: cocos-meta-mcp plugin install --from <repo>
 */
import { runPluginInstallCli } from "./lib/plugin-install.mjs";

const argv = process.argv.slice(2);
const forwarded = ["install"];

for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") {
        forwarded.push("--from", argv[++i]);
    } else {
        forwarded.push(a);
    }
}

if (!forwarded.includes("--from")) {
    forwarded.push("--from", process.cwd());
}

console.error("[deprecated] use: cocos-meta-mcp plugin install --from <repo>");
runPluginInstallCli(forwarded);
