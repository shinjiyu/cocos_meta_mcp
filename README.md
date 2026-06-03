# cocosmcp



芬格 **Cocos Creator 糖果工程** 专用 MCP（stdio）+ Creator 扩展 HTTP 桥。**不含** DaxianLee 通用扩展。



## 分层架构（v2）



**默认只暴露 1 个 Core tool**：`cocosmcp_exec`。其余按需加载。



```text

L0 Core        cocosmcp_exec

L1 Recipe      register / run / stats + plugin 管理（COCOSMCP_RECIPE_LAYER=1）

L2 Promote      promote / demote（COCOSMCP_RECIPE_LAYER=2）

Plugins        asset-meta、asset-sync、ir-prefab（COCOSMCP_PLUGINS 或 .cocosmcp/plugins.json）

```



详见 `docs/LAYERS.md`。



## 仓库结构



```text

cocosmcp/

  mcp/              # stdio MCP（core + plugins/）

  extension/        # Creator 扩展 fg-cocosmcp

  docs/

  examples/

```



## npm 发布

包名 **`cocos-meta-mcp@2.1.0`**，含 MCP + Creator 扩展 + 安装脚本。详见 [`docs/NPM.md`](docs/NPM.md)。

```bash
npm install -g cocos-meta-mcp
cocos-meta-mcp-setup all --project-root D:/path/to/cocos/project
```

Cursor 里 `command` 填 `cocos-meta-mcp` 即可。

## 安装（源码 / 开发）

一键安装（Cursor MCP + Creator 扩展）见 [`docs/INSTALL.md`](docs/INSTALL.md)。

```powershell
.\scripts\install.ps1 -ProjectRoot D:\path\to\your-cocos-project
```

默认：MCP 写入 `%USERPROFILE%\.cursor\mcp.json`，扩展装到 **Creator 全局** `%USERPROFILE%\.CocosCreator\extensions\fg-cocosmcp`（所有工程可用）。

手动安装：



Creator：**扩展管理器** → 启用 **fg-cocosmcp** → `MCP HTTP bridge http://127.0.0.1:3921`。



## Cursor 配置示例



| 场景 | 配置 |

|------|------|

| 日常（仅 exec） | `examples/cursor-mcp.json` |

| IR + genbot | `examples/cursor-mcp-layered.json` → `cocosmcp-workflow` |

| Agent admin | `cocosmcp-admin`（recipe L2 + 插件） |

| 等同旧版全量 | `COCOSMCP_TOOL_PROFILE=full` |



## 插件



| 插件 id | 说明 | tools（`3.8.8` → `cc388` 前缀） |
|----|------|------|
| `asset-meta` | .meta 检查 / 导入 / 刷新 | `cocosmcp_cc388_asset_meta_status` 等 3 个 |
| `asset-sync` | 外部资源目录同步 | `cocosmcp_cc388_sync_external_assets` |
| `ir-prefab` | IR prefab 脚本 | `cocosmcp_cc388_generate_ir_prefabs` |
| `genbot` | bind / gen.ts / view.ts（本地私有，不进公开仓库） |



```json

{ "env": { "COCOSMCP_PLUGINS": "asset-meta,asset-sync,ir-prefab" } }

```



## 环境变量



| 变量 | 说明 |

|------|------|

| `COCOSMCP_RECIPE_LAYER` | `0`（默认）\| `1` \| `2` |

| `COCOSMCP_PLUGINS` | 逗号分隔插件 id |

| `COCOSMCP_TOOL_PROFILE` | `full` = 全插件 + recipe L2 |

| `COCOSMCP_PROJECT_ROOT` | 工程根（默认 mcp.json `cwd`） |

| `COCOSMCP_IR_ROOT` | SVN IR 目录 |

| `COCOSMCP_HTTP_URL` | 扩展桥，默认 `http://127.0.0.1:3921` |



文档：`docs/LAYERS.md`、`docs/EXEC.md`、`docs/RECIPES.md`。


