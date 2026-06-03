# MCP 插件安装

CocosMetaMCP 有两层「插件」概念：

| 类型 | 是什么 | 装在哪 |
|------|--------|--------|
| **Creator 扩展** | HTTP 桥 | `{工程}/extensions/cocos-meta-mcp` |
| **MCP 插件** | 额外 MCP tool | `mcp/plugins/` → 工程 `.cocosmcp/installed/` |

Creator 扩展见 [`INSTALL.md`](INSTALL.md)。

---

## 一条命令安装（推荐）

在**插件源码所在仓库**或任意目录执行：

```bash
cocos-meta-mcp plugin install --from D:/path/to/repo-with-mcp-plugins
```

会自动完成：

1. **检查** — 每个插件须有 `manifest.json` + `index.mjs`
2. **拷贝/替换** — 写入当前 `cocos-meta-mcp` 包的 `mcp/plugins/{id}/`（npm 全局安装即全局包目录）
3. **更新 Cursor** — 合并 `%USERPROFILE%\.cursor\mcp.json` 里 `cocos-meta-mcp` 相关项的 `COCOSMCP_PLUGINS`（并补 `COCOSMCP_RECIPE_LAYER=2`）

常用选项：

```bash
cocos-meta-mcp plugin list
cocos-meta-mcp plugin install --from . --ids my-plugin
cocos-meta-mcp plugin install --from ./mcp/plugins/my-plugin
cocos-meta-mcp plugin install --from . --no-cursor    # 只拷插件，不改 mcp.json
cocos-meta-mcp plugin install --from . --dry-run
```

完成后**重启 Cursor**。

---

## 安装新插件（对照表）

| 你要装的 | 怎么做 |
|----------|--------|
| **npm 自带**（`asset-meta`、`asset-sync`） | `cocos-meta-mcp setup` 已默认启用 |
| **自研插件** | `cocos-meta-mcp plugin install --from <含 mcp/plugins 的仓库>` |
| **只启用、不拷文件**（插件已在包里） | 手动改 `COCOSMCP_PLUGINS`，或 Agent 调用 `cocosmcp_plugin_install` |

MCP 启动时会把插件**全量复制**到 `{工程}/.cocosmcp/installed/{id}/` 再加载 tool。

---

## 编写新插件

在 `mcp/plugins/{id}/` 下至少包含：

```text
manifest.json    # id、cocosVersion、tools 列表
index.mjs        # export function register(server, ctx) { ... }
```

`manifest.json` 示例：

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "What it does",
  "cocosVersion": "3.8.*",
  "tools": ["cocosmcp_my_tool"]
}
```

参考 `mcp/plugins/asset-meta/`。写好之后执行上面的 `plugin install --from`。

---

## 工程内 `plugins.json`（可选）

路径：`{工程}/.cocosmcp/plugins.json`，与 `COCOSMCP_PLUGINS` **合并**启用。见 `examples/cocosmcp.plugins.example.json`。

插件仍须先出现在 MCP 包的 `mcp/plugins/`（`plugin install` 会写入）。

---

## Agent 运行时安装

recipe 层默认开启时，Agent 可调用 `cocosmcp_plugin_list` / `cocosmcp_plugin_install` 等（前提：插件已在 MCP 包 builtin 目录）。

---

## 验证

1. Creator 打开工程，扩展 **cocos-meta-mcp** 已启用  
2. `cocos-meta-mcp plugin list` 能看到新插件且 `valid: true`  
3. Cursor MCP tool 列表出现对应 tool  

---

## 安装后目录

```text
{工程}/.cocosmcp/
  plugins.json
  installed/
    asset-meta/
    my-plugin/
```

---

## 相关文档

- [`INSTALL.md`](INSTALL.md)
- [`LAYERS.md`](LAYERS.md)
- [`RECIPES.md`](RECIPES.md)
- [`NPM.md`](NPM.md)
