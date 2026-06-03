#!/usr/bin/env node
/** @deprecated use: cocos-meta-mcp setup */
import { runSetupCli } from "./setup-cli.mjs";

console.error("[cocos-meta-mcp] cocos-meta-mcp-setup is deprecated; use: cocos-meta-mcp setup");
runSetupCli(process.argv.slice(2));
