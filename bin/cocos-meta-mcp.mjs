#!/usr/bin/env node
/** stdio MCP entry (Cursor mcp.json: command = cocos-meta-mcp) */
import { pathToFileURL } from "node:url";
import { mcpDir, packageRoot } from "../scripts/lib/paths.mjs";

const entry = pathToFileURL(`${mcpDir(packageRoot())}/index.mjs`).href;
await import(entry);
