# MCP 插件安装

CocosMetaMCP 有两层「插件」概念，不要混淆：

| 类型 | 是什么 | 装在哪 |
|------|--------|--------|
| **Creator 扩展** | HTTP 桥，供 `cocosmcp_exec` 调编辑器 | `{工程}/extensions/cocos-meta-mcp` |
| **MCP 插件** | 额外 MCP tool（asset-meta 等） | npm 包内 `mcp/plugins/` → 复制到 `{工程}/.cocosmcp/installed/` |

本文只讲 **MCP 插件**。Creator 扩展见 [`INSTALL.md`](INSTALL.md)。

## 随 npm 发布的插件

| 插件 id | 说明 | 典型 tool（Creator 3.8.8 → `cc388`） |
|---------|------|--------------------------------------|
| `asset-meta` | .meta 检查 / 导入 / 刷新 | `cocosmcp_cc388_asset_meta_status` 等 |
| `asset-sync` | 外部资源目录同步 | `cocosmcp_cc388_sync_external_assets` |

**不进 npm**（需本地私有部署）：`ir-prefab`、`genbot`

---

## 方式一：一键 setup（推荐）

`cocos-meta-mcp setup` 默认 **profile=workflow**，会在 Cursor `mcp.json` 写入：

```json
{
  "env": {
    "COCOSMCP_PLUGINS": "asset-meta,asset-sync"
  }
}
```

MCP 启动时会自动 **全量安装** 到 `{工程}/.cocosmcp/installed/{id}/` 并加载 tool。

```bash
cd D:/你的/cocos/工程
cocos-meta-mcp setup
# 重启 Cursor
```

只要 `cocosmcp_exec`、不要插件：

```bash
cocos-meta-mcp setup --cursor-profile minimal
```

要 recipe + 插件管理 + 全部内置插件：

```bash
cocos-meta-mcp setup --cursor-profile admin
```

---

## 方式二：手动改 Cursor `mcp.json`

全局配置：`%USERPROFILE%\.cursor\mcp.json`（Windows）

```json
{
  "mcpServers": {
    "cocosmcp-workflow": {
      "command": "cocos-meta-mcp",
      "cwd": "D:/path/to/cocos/project",
      "env": {
        "COCOSMCP_PLUGINS": "asset-meta,asset-sync"
      }
    }
  }
}
```

| 环境变量 | 说明 |
|----------|------|
| `COCOSMCP_PLUGINS` | 逗号分隔插件 id，启动时安装并加载 |
| `COCOSMCP_TOOL_PROFILE=full` | 加载当前可用的**全部**插件 |
| `COCOSMCP_ALL=1` | 同 full |

改完后 **重启 Cursor** 或 Reload MCP。

---

## 方式三：工程内 `plugins.json`（持久化、可进 Git）

路径：`{工程}/.cocosmcp/plugins.json`

示例（见 `examples/cocosmcp.plugins.example.json`）：

```json
{
  "version": 2,
  "cocosCreatorVersion": "3.8.8",
  "plugins": {
    "asset-meta": {
      "enabled": true,
      "installPath": ".cocosmcp/installed/asset-meta",
      "toolsVersioned": [
        "cocosmcp_cc388_asset_meta_status",
        "cocosmcp_cc388_import_asset_meta",
        "cocosmcp_cc388_refresh_asset_meta"
      ]
    },
    "asset-sync": {
      "enabled": true
    }
  }
}
```

`COCOSMCP_PLUGINS` 与 `plugins.json` 里 `enabled: true` 的 id **会合并**。

首次启用某插件时，MCP 仍会从 npm 包内的 `mcp/plugins/{id}/` 复制到 `installed/`（需 Creator 已打开且扩展桥可达，用于检测 Cocos 版本）。

---

## 方式四：运行时由 Agent 安装（Recipe L1+）

在 `mcp.json` 增加：

```json
{
  "env": {
    "COCOSMCP_RECIPE_LAYER": "1",
    "COCOSMCP_PLUGINS": "asset-meta"
  }
}
```

重启 Cursor 后可使用：

| tool | 作用 |
|------|------|
| `cocosmcp_plugin_list` | 列出可用 / 已安装 / 已加载插件 |
| `cocosmcp_plugin_install` | 全量安装到 `.cocosmcp/installed/` |
| `cocosmcp_plugin_enable` | 安装（若未装）并加载 tool |
| `cocosmcp_plugin_disable` | 卸载 tool（保留 `installed/` 目录） |

对 Agent 说：「列出插件并启用 asset-sync」即可。

---

## 本地私有插件（ir-prefab、genbot）

npm 包**不包含**这些目录。仅在源码仓库或本机保留：

```text
mcp/plugins/
  ir-prefab/
  genbot/
```

### 开发机（克隆仓库）

1. 确保 `mcp/plugins/ir-prefab/`（或 `genbot/`）存在于本地  
2. Cursor 用 **源码** 启动 MCP，或全局 npm 包旁另有插件目录时，在 env 加上 id：

```json
{
  "env": {
    "COCOSMCP_PLUGINS": "asset-meta,asset-sync,ir-prefab"
  }
}
```

3. 重启 Cursor；插件会安装到 `{工程}/.cocosmcp/installed/ir-prefab/`

### 仅 npm 全局包、无源码

任选其一：

**A. 手动放入工程 `installed/`**

```text
{工程}/.cocosmcp/installed/ir-prefab/
  manifest.json
  index.mjs
```

然后在 `plugins.json` 或 `COCOSMCP_PLUGINS` 里写 `ir-prefab`。

**B. 拷贝到全局 npm 包**（不推荐，升级 npm 会丢）

```text
%AppData%/npm/node_modules/cocos-meta-mcp/mcp/plugins/ir-prefab/
```

---

## 安装后目录

```text
{工程}/.cocosmcp/
  plugins.json          # 启用状态
  project.json          # 检测到的 Creator 版本
  installed/
    asset-meta/
      manifest.json     # 含 toolsVersioned、cocosVersionSlug
      index.mjs
    asset-sync/
```

`plugin_disable` **只卸 MCP tool**，不删 `installed/`，可随时 `plugin_enable` 恢复。

---

## 验证

1. Creator 打开工程，启用 **cocos-meta-mcp** 扩展  
2. Cursor MCP 已连接  
3. 调用 `cocosmcp_plugin_list`（需 `COCOSMCP_RECIPE_LAYER>=1`）或查看 MCP tool 列表  
4. 应出现带版本前缀的 tool，例如 `cocosmcp_cc388_asset_meta_status`

常见问题：

| 现象 | 处理 |
|------|------|
| 只有 `cocosmcp_exec` | 检查 `COCOSMCP_PLUGINS`；或改用 `setup` / `--cursor-profile workflow` |
| 插件 id 报错 not found | npm 包不含该插件；用本地 `mcp/plugins/` 或手动 `installed/` |
| tool 名不对 | Creator 版本与 manifest `cocosVersion` 不匹配；见 [`LAYERS.md`](LAYERS.md) |

---

## 相关文档

- [`INSTALL.md`](INSTALL.md) — Creator 扩展 + Cursor 一键安装  
- [`LAYERS.md`](LAYERS.md) — 插件全量安装、tool 命名规则  
- [`NPM.md`](NPM.md) — npm 包内容与发布
