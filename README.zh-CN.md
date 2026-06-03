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

[English](README.md)

Cocos Creator MCP + 扩展桥，让 Cursor 等客户端通过 AI 驱动编辑器内脚本与资源操作。

## 安装

需要：**Node.js 18+**、**Cocos Creator 3.8+**、**Cursor**（或其它 MCP 客户端）。

### npm（推荐）

```bash
npm install -g cocos-meta-mcp
cocos-meta-mcp setup --project-root D:/path/to/your-cocos-project
```

### 克隆仓库（开发）

```bash
git clone https://github.com/shinjiyu/cocos_meta_mcp.git
cd cocos_meta_mcp && npm install
npm run setup -- --project-root D:/path/to/your-cocos-project
```

在 Cocos 工程目录下可省略 `--project-root`（自动探测）。

### Creator

1. 完全退出并重启 Creator，打开对应工程  
2. **扩展 → 扩展管理器 → 项目** → 启用 **cocos-meta-mcp**  
3. 控制台：`MCP HTTP bridge http://127.0.0.1:3921`

### Cursor

安装脚本写入 `%USERPROFILE%\.cursor\mcp.json`。重启 Cursor，在 MCP 设置中确认已连接。

默认 **workflow** 会启用 MCP 插件 `asset-meta`、`asset-sync`，并开启 recipe 提升。自研插件：`cocos-meta-mcp plugin install --from <仓库路径>`，详见 [`docs/PLUGINS.md`](docs/PLUGINS.md)。

## 验证

1. Creator 中启用 **cocos-meta-mcp**  
2. Cursor Agent 调用 `cocosmcp_health` 或 `cocosmcp_exec`

## 核心能力：脚本自动提升为 Tool

`cocos-meta-mcp setup` 默认 **workflow** 已开启 recipe 提升（`COCOSMCP_RECIPE_LAYER=2`）。Agent 可发现高频脚本并提升为独立 MCP Tool。

```text
cocosmcp_exec（探索）
      │
      ▼
exec 审计日志 ──► cocosmcp_exec_stats（找高频脚本）
      │
      ▼
cocosmcp_register_recipe（保存到 .cocosmcp/recipes/）
      │
      ▼
cocosmcp_promote_recipe ──► cocosmcp_r_{name}（独立 Tool，通知 Cursor 刷新列表）
```

| 阶段 | 暴露的 Tool | 说明 |
|------|-------------|------|
| 默认 | `cocosmcp_exec` | 通用入口，在 Creator 内执行任意脚本 |
| 探索后 | `cocosmcp_run_recipe` | 运行已注册 recipe，无需重复写 code |
| **提升后** | **`cocosmcp_r_{name}`** | 升格为一级 Tool，Agent 直接选用 |

数据保存在 `{工程}/.cocosmcp/`，可进 Git 与团队共享。

仅要 `cocosmcp_exec` 时可设 `COCOSMCP_RECIPE_LAYER=0`（`setup --cursor-profile minimal`）。

| 值 | 能力 |
|----|------|
| `0` | 仅 `cocosmcp_exec` |
| `1` | + recipe 注册 / 运行 / 统计、插件管理 |
| `2`（**setup 默认**） | + **promote / demote**（提升为独立 Tool） |

详见 [`docs/RECIPES.md`](docs/RECIPES.md)。

## 文档

| 主题 | 链接 |
|------|------|
| **MCP 插件安装** | [`docs/PLUGINS.md`](docs/PLUGINS.md) |
| Recipe / 提升详解 | [`docs/RECIPES.md`](docs/RECIPES.md) |
| 分层架构与插件 | [`docs/LAYERS.md`](docs/LAYERS.md) |
| 安装参数 | [`docs/INSTALL.md`](docs/INSTALL.md) |
| npm 发布 | [`docs/NPM.md`](docs/NPM.md) |
