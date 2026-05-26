# Candystorm MCP（stdio）+ fg-candystorm-ir（HTTP 桥）

团队糖果工程专用，与根目录 **DaxianLee cocos-mcp-server**（HTTP 50+ tools）**分开使用**。

## 仓库内路径

| 目录 | 安装到工程 |
|------|------------|
| 根目录 | `extensions/cocos-mcp-server/`（可选，通用编辑器 MCP） |
| `candystorm-mcp/` | 不拷入工程；Cursor `mcp.json` 指向本机路径 |
| `fg-candystorm-ir/` | `extensions/fg-candystorm-ir/` |

## Cursor（candystorm stdio）

见 `candystorm-mcp/README.md`、`candystorm-mcp/cursor-mcp.example.json`。

## candystorm_exec（8+1 流水线外的通用口）

经 `fg-candystorm-ir` → `POST http://127.0.0.1:3921/exec`：

| mode | 说明 |
|------|------|
| `message` / `eval` | 扩展主进程 |
| `scene-script` / `scene-eval` | 场景进程 |
| `open-url` | 系统浏览器打开预览（预览服需已开，不构建） |

无白名单。启用扩展后需 **重载扩展** 以加载 `dist/scene.js`。

## 与 cocos-mcp-server 分工

- **candystorm-mcp**：IR / meta / genbot / prefab 生成 + `candystorm_exec`
- **cocos-mcp-server**（本仓库根）：场景节点、预制体等封装 tool（按需启用，避免与 candystorm 同时撑爆上下文）
