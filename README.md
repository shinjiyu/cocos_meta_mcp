# cocosmcp

芬格 **Cocos Creator 糖果工程** 专用 MCP（stdio）+ Creator 扩展 HTTP 桥。**不含** DaxianLee 通用 50-tool 扩展。

## 仓库结构

```text
cocosmcp/
  mcp/              # Cursor stdio MCP（8 tools + cocosmcp_exec）
  extension/        # 安装到工程的 Creator 扩展 fg-cocosmcp
  docs/
  examples/
```

## 安装

```powershell
git clone https://gitlab.fingergame.com/h5_game_sh_tpe/extension-tools/cocosmcp.git
Copy-Item -Recurse cocosmcp\extension D:\path\to\proj-l-client-candy\extensions\fg-cocosmcp
cd cocosmcp\mcp && npm install
```

Creator：**扩展管理器** → 启用 **fg-cocosmcp** → 控制台应出现 `MCP HTTP bridge http://127.0.0.1:3921`。

## Cursor

合并 `examples/cursor-mcp.json`（改 `cwd` 为糖果工程根、`args` 为本机 `mcp/index.mjs` 路径）。

## MCP 工具

| 工具 | 说明 |
|------|------|
| `cocosmcp_meta_status` | 检查关键 `.meta` |
| `cocosmcp_sync_ir` | IR → `ab/candystorm` |
| `cocosmcp_import_meta` | 拉起 Creator 等 meta |
| `cocosmcp_refresh_meta_in_editor` | HTTP 刷新 meta |
| `cocosmcp_genbot_generate` | genbot 生成 |
| `cocosmcp_genbot_status` | genbot 状态 |
| `cocosmcp_generate_prefabs` | IR 生成 prefab |
| `cocosmcp_exec` | Creator 主进程/场景进程/打开预览 URL |

详见 `mcp/README.md`、`docs/EXEC.md`。

## 环境变量

| 变量 | 说明 |
|------|------|
| `COCOSMCP_PROJECT_ROOT` | 糖果工程根（默认用 mcp.json 的 `cwd`） |
| `COCOSMCP_IR_ROOT` | SVN IR 导出目录 |
| `COCOSMCP_HTTP_URL` | 扩展桥 URL，默认 `http://127.0.0.1:3921` |

兼容旧名：`CANDYSTORM_IR_ROOT`、`CANDYSTORM_IR_HTTP_URL` 等仍可读。
