# cocosmcp（stdio MCP）

糖果工程专用，**8 个工具**。工程根目录由 Cursor `cwd` 或 `COCOSMCP_PROJECT_ROOT` 指定。

| 工具 | 作用 |
|------|------|
| `cocosmcp_meta_status` | 检查关键 `.meta` |
| `cocosmcp_sync_ir` | IR → `ab/candystorm` |
| `cocosmcp_import_meta` | 拉起 Creator 并等待 meta |
| `cocosmcp_refresh_meta_in_editor` | HTTP 刷新 meta（需 `fg-cocosmcp`） |
| `cocosmcp_genbot_generate` | genbot 生成 bind / gen.ts / view.ts |
| `cocosmcp_genbot_status` | genbot 输出状态 |
| `cocosmcp_generate_prefabs` | IR 生成 prefab |
| `cocosmcp_exec` | Creator 主进程/场景/打开预览 URL |

```powershell
cd mcp && npm install
```

Cursor 配置见仓库根目录 `examples/cursor-mcp.json`。

`cocosmcp_exec` 五种 mode 见 `../docs/EXEC.md`。
