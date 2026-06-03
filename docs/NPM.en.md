# npm package

[中文](NPM.md)

Package: **`cocos-meta-mcp`** (v2.1.6+)

## Contents

| Item | Path |
|------|------|
| stdio MCP server | `mcp/` + CLI `cocos-meta-mcp` |
| Creator extension (prebuilt `dist/`) | `extension/` |
| Install scripts | `scripts/` + `cocos-meta-mcp setup` |

## Bundled MCP plugins (published on npm)

| Plugin id | Description |
|-----------|-------------|
| `asset-meta` | Check, import, refresh `.meta` files |
| `asset-sync` | Sync external asset directories |

`cocos-meta-mcp setup` uses **profile=workflow** by default and writes `COCOSMCP_PLUGINS=asset-meta,asset-sync` to Cursor `mcp.json`.

For `cocosmcp_exec` only: `cocos-meta-mcp setup --cursor-profile minimal`

**Not included** (local/private): `genbot`, `ir-prefab`

Plugin install details: [`PLUGINS.md`](PLUGINS.md)

## Install

```bash
npm install -g cocos-meta-mcp
# or as a dev dependency
npm install -D cocos-meta-mcp
```

## One-shot setup

```bash
# Cursor MCP + Creator project extension
cocos-meta-mcp setup --project-root /path/to/cocos/project

# Cursor MCP only (workflow = with plugins)
cocos-meta-mcp setup cursor --project-root /path/to/cocos/project
```

## Example Cursor `mcp.json` (after global npm install)

```json
{
  "mcpServers": {
    "cocos-meta-mcp": {
      "command": "cocos-meta-mcp",
      "cwd": "/path/to/your/cocos/project",
      "env": {
        "COCOSMCP_PLUGINS": "asset-meta,asset-sync"
      }
    }
  }
}
```

Use the global `cocos-meta-mcp` bin; no need for `node .../index.mjs` paths.

## Maintainers: before publish

```bash
npm run prepack      # build extension + MCP syntax check
npm run pack:check   # preview tarball file list
npm pack
npm publish
```

## Versioning

Semver in `package.json`. Tag before publish:

```bash
npm version patch
git push && git push --tags
npm publish
```
