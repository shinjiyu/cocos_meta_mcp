# MCP 插件安装

CocosMetaMCP 有两层「插件」概念：

| 类型 | 是什么 | 装在哪 |
|------|--------|--------|
| **Creator 扩展** | HTTP 桥 | `{工程}/extensions/cocos-meta-mcp` |
| **MCP 插件** | 额外 MCP tool | `mcp/plugins/` → 工程 `.cocosmcp/installed/` |

Creator 扩展见 [`INSTALL.md`](INSTALL.md)。

---

## 启用哪些插件：配置文件（不在 mcp.json）

| 层级 | 文件 | 作用 |
|------|------|------|
| **MCP 包** | `{cocos-meta-mcp}/mcp/plugins/load.json` | 全局启用列表（`plugin install` 维护） |
| **工程**（可选） | `{工程}/.cocosmcp/plugins.json` | 工程级追加 / 覆盖 |

**Cursor `mcp.json` 只负责启动 MCP**，不写插件 id 列表。

`load.json` 示例：

```json
{
  "version": 1,
  "enabled": ["asset-meta", "asset-sync", "my-plugin"]
}
```

---

## 一条命令安装（推荐）

```bash
cocos-meta-mcp plugin install --from D:/path/to/repo-with-mcp-plugins
```

会自动：

1. **检查** — `manifest.json` + `index.mjs`
2. **拷贝/替换** — 写入 `{npm 包}/mcp/plugins/{id}/`
3. **更新 `load.json`** — 合并 `enabled` 列表
4. **清理 mcp.json** — 移除旧的 `COCOSMCP_PLUGINS`（若存在）

```bash
cocos-meta-mcp plugin list
cocos-meta-mcp plugin install --from .
cocos-meta-mcp plugin install --from . --ids my-plugin
cocos-meta-mcp plugin install --from . --dry-run
```

完成后**重启 Cursor**。

---

## 编写新插件

```text
mcp/plugins/my-plugin/
  manifest.json
  index.mjs
```

参考 `mcp/plugins/asset-meta/`。写好之后：

```bash
cocos-meta-mcp plugin install --from .
```

---

## 工程级追加（可选）

`{工程}/.cocosmcp/plugins.json` 与 `load.json` **合并**启用。见 `examples/cocosmcp.plugins.example.json`。

---

## Agent 运行时

recipe 层默认开启时，可用 `cocosmcp_plugin_install` 等（插件须已在 MCP 包 `mcp/plugins/`）。

---

## 验证

```bash
cocos-meta-mcp plugin list
```

`enabled: true` 且 `valid: true` 即 OK。

---

## 相关文档

- [`INSTALL.md`](INSTALL.md)
- [`LAYERS.md`](LAYERS.md)
- [`NPM.md`](NPM.md)
