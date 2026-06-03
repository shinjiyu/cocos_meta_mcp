# MCP 插件安装

## 存储位置

| 内容 | 路径 | 说明 |
|------|------|------|
| **npm 内置** | `{npm包}/mcp/plugins/asset-meta` 等 | 随 `npm update -g` 更新 |
| **自研插件** | `{tmpdir}/cocos-meta-mcp/plugins/{id}/` | **不在 npm 包里**，升级 npm 不丢 |
| **启用列表** | `{tmpdir}/cocos-meta-mcp/load.json` | 加载哪些插件 |
| **工程副本** | `{工程}/.cocosmcp/installed/` | MCP 运行时复制 |

Windows 默认 tmp 示例：`C:\Users\<you>\AppData\Local\Temp\cocos-meta-mcp\`

自定义目录：

```bash
set COCOSMCP_USER_PLUGINS_HOME=D:/my/cocosmcp-plugins
```

**Cursor `mcp.json` 不写插件列表。**

---

## 安装命令

```bash
cocos-meta-mcp plugin install --from D:/path/to/repo
cocos-meta-mcp plugin list
```

1. 检查 `manifest.json` + `index.mjs`
2. 拷贝到 `{tmpdir}/cocos-meta-mcp/plugins/{id}/`
3. 更新 `load.json`
4. 若曾写入 `mcp.json` 的 `COCOSMCP_PLUGINS`，自动清理

在 Cursor **MCP 设置里关闭再打开** `cocos-meta-mcp` 即可（不必重启整个 Cursor）。

---

## load.json

```json
{
  "version": 1,
  "enabled": ["asset-meta", "asset-sync", "my-plugin"]
}
```

内置 `asset-meta`、`asset-sync` 始终在 npm 包内；自研插件只在 user store。

---

## 编写新插件

```text
mcp/plugins/my-plugin/
  manifest.json
  index.mjs
```

参考 `asset-meta`。完成后 `plugin install --from .`。

---

## 工程级追加（可选）

`{工程}/.cocosmcp/plugins.json` 与 `load.json` 合并启用。

---

## 相关文档

- [`INSTALL.md`](INSTALL.md)
- [`LAYERS.md`](LAYERS.md)
