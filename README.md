```
    ╭────────────────────────────────╮
    │                                │
    │          /\___/\               │
    │         (  ◕ ω ◕ )             │
    │          >  ♡  <               │
    │     ~~  \_____/  ~~            │
    │  ~~~~~~~~~~~~~~~~~~~~~         │
    │                                │
    │       CocosMetaMCP             │
    │                                │
    ╰────────────────────────────────╯
```

# CocosMetaMCP

[中文文档](README.zh-CN.md)

MCP (stdio) + Creator extension bridge. Drive in-editor scripts and asset workflows from Cursor and other MCP clients.

## Install

Requires **Node.js 18+**, **Cocos Creator 3.8+**, and **Cursor** (or any MCP client).

### npm (recommended)

```bash
npm install -g cocos-meta-mcp
cocos-meta-mcp setup --project-root /path/to/your-cocos-project
```

### From source (development)

```bash
git clone https://github.com/shinjiyu/cocos_meta_mcp.git
cd cocos_meta_mcp && npm install
npm run setup -- --project-root /path/to/your-cocos-project
```

Run inside your Cocos project directory to auto-detect the project root (omit `--project-root`).

### Creator

1. Fully quit and restart Creator; open the target project  
2. **Extension → Extension Manager → Project** → enable **cocos-meta-mcp**  
3. Console should show: `MCP HTTP bridge http://127.0.0.1:3921`

### Cursor

Setup writes `%USERPROFILE%\.cursor\mcp.json` (Windows). Restart Cursor and confirm the MCP server is connected.

Default **workflow** profile enables bundled plugins and recipe promote. Custom plugins: `cocos-meta-mcp plugin install --from <repo>`. See [`docs/PLUGINS.md`](docs/PLUGINS.md).

## Verify

1. Enable **cocos-meta-mcp** in Creator  
2. In Cursor Agent, call `cocosmcp_health` or `cocosmcp_exec`

## Self-evolving tools (Recipe promote)

Default **workflow** from `cocos-meta-mcp setup` enables recipe promote (`COCOSMCP_RECIPE_LAYER=2`). The Agent can discover hot scripts and promote them to dedicated MCP tools.

```text
cocosmcp_exec (explore)
      │
      ▼
exec audit log ──► cocosmcp_exec_stats (find hot scripts)
      │
      ▼
cocosmcp_register_recipe (save to .cocosmcp/recipes/)
      │
      ▼
cocosmcp_promote_recipe ──► cocosmcp_r_{name} (standalone tool; Cursor refreshes list)
```

| Stage | Tools | Description |
|-------|-------|-------------|
| Default | `cocosmcp_exec` | Run any script inside open Creator |
| After explore | `cocosmcp_run_recipe` | Re-run saved recipes |
| **Promoted** | **`cocosmcp_r_{name}`** | First-class tools the Agent picks directly |

Data lives under `{project}/.cocosmcp/` and can be committed to Git for your team.

For `cocosmcp_exec` only: `COCOSMCP_RECIPE_LAYER=0` (`setup --cursor-profile minimal`).

| Value | Capability |
|-------|------------|
| `0` | `cocosmcp_exec` only |
| `1` | + recipe register / run / stats, plugin management |
| `2` (**setup default**) | + **promote / demote** (standalone tools) |

See [`docs/RECIPES.md`](docs/RECIPES.md).

## Documentation

| Topic | Link |
|-------|------|
| **MCP plugin install** | [`docs/PLUGINS.md`](docs/PLUGINS.md) |
| Recipes / promote | [`docs/RECIPES.md`](docs/RECIPES.md) |
| Layered architecture | [`docs/LAYERS.md`](docs/LAYERS.md) |
| Install options | [`docs/INSTALL.md`](docs/INSTALL.md) |
| npm package | [`docs/NPM.md`](docs/NPM.md) |
