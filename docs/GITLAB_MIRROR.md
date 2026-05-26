# GitLab 镜像说明（extension-tools/cocosmcp）

本仓库为 **[DaxianLee/cocos-mcp-server](https://github.com/DaxianLee/cocos-mcp-server)** 的团队内镜像（Creator 扩展 + 内置 HTTP MCP），**不是** CososInspector / Cocos Inspector 3 的 Chrome 扩展 MCP。

## 与 Inspector MCP 的区别

| | **本仓库（cocos-mcp-server）** | CososInspector MCP |
|--|--|--|
| 形态 | Cocos Creator **编辑器扩展** | Chrome 扩展 + 独立 stdio MCP + WS 桥 |
| 控制对象 | **编辑器**（场景、节点、预制体、资源…） | **试玩页**（列 Sprite、截屏、换图…） |
| Cursor 连接 | HTTP `http://127.0.0.1:<port>/mcp` | `node mcp/index.mjs` + `cocos-bridge` |

## 安装到工程

```powershell
git clone git@gitlab.fingergame.com:h5_game_sh_tpe/extension-tools/cocosmcp.git
# 复制到目标工程的 extensions 目录，文件夹名建议 cocos-mcp-server
Copy-Item -Recurse cocosmcp D:\path\to\your-project\extensions\cocos-mcp-server
```

在 Creator：**扩展管理器** → 启用 **Cocos MCP Server** → 面板里启动 MCP 并记下端口（默认 3000）。

## Cursor 配置

合并 `examples/cursor-mcp.json` 到用户级 `mcp.json`，端口与扩展面板一致。

## 上游同步

```powershell
hutao remote add upstream https://github.com/DaxianLee/cocos-mcp-server.git
hutao fetch upstream
# 按需 cherry-pick / merge
```

当前镜像基线见根目录 `package.json` 的 `version` 字段。

## 同仓 Candystorm 组件（芬格自研）

| 目录 | 说明 |
|------|------|
| `candystorm-mcp/` | stdio MCP（IR、meta、genbot、`candystorm_exec` 等） |
| `fg-candystorm-ir/` | Creator 扩展，HTTP `127.0.0.1:3921`（`/exec` 含场景进程 + open-url） |

详见 [CANDYSTORM_MCP.md](./CANDYSTORM_MCP.md)。
