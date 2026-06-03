# cocosmcp



芬格 **Cocos Creator 糖果工程** 专用 MCP（stdio）+ Creator 扩展 HTTP 桥。**不含** DaxianLee 通用扩展。



## 分层架构（v2）



**默认只暴露 1 个 Core tool**：`cocosmcp_exec`。其余按需加载。



```text

L0 Core        cocosmcp_exec

L1 Recipe      register / run / stats + plugin 管理（COCOSMCP_RECIPE_LAYER=1）

L2 Promote      promote / demote（COCOSMCP_RECIPE_LAYER=2）

Plugins        candystorm-ir、genbot（COCOSMCP_PLUGINS 或 .cocosmcp/plugins.json）

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



## 安装



```powershell

git clone https://gitlab.fingergame.com/h5_game_sh_tpe/extension-tools/cocosmcp.git

Copy-Item -Recurse cocosmcp\extension D:\path\to\proj-l-client\extensions\fg-cocosmcp

cd cocosmcp\mcp && npm install

```



Creator：**扩展管理器** → 启用 **fg-cocosmcp** → `MCP HTTP bridge http://127.0.0.1:3921`。



## Cursor 配置示例



| 场景 | 配置 |

|------|------|

| 日常（仅 exec） | `examples/cursor-mcp.json` |

| IR + genbot | `examples/cursor-mcp-layered.json` → `cocosmcp-workflow` |

| Agent admin | `cocosmcp-admin`（recipe L2 + 插件） |

| 等同旧版全量 | `COCOSMCP_TOOL_PROFILE=full` |



## 插件



| id | 说明 |

|----|------|

| `candystorm-ir` | IR 同步、meta、prefab 生成 |

| `genbot` | bind / gen.ts / view.ts |



```json

{ "env": { "COCOSMCP_PLUGINS": "candystorm-ir,genbot" } }

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


