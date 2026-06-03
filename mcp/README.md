# CocosMetaMCP · MCP 服务（stdio v2）



分层 MCP：**默认 1 个 tool**（`cocosmcp_exec`），插件与 recipe 按需启用。



```powershell

cd mcp && npm install

```



## 层级



| 层 | 开关 | 暴露内容 |

|----|------|----------|

| **Core** | 始终 | `cocosmcp_exec`（可选 `cocosmcp_health`） |

| **Recipe L1** | `COCOSMCP_RECIPE_LAYER=1` | stats、list/register/run recipe、plugin 管理 |

| **Recipe L2** | `COCOSMCP_RECIPE_LAYER=2` | + promote/demote/unregister、恢复 promoted |

| **Plugins** | `COCOSMCP_PLUGINS` 或 `.cocosmcp/plugins.json` | asset-meta、asset-sync（公开）；ir-prefab、genbot 本地私有 |



## 插件



```text

mcp/plugins/

  asset-meta/    # 3 tools
  asset-sync/    # 1 tool
  ir-prefab/     # 1 tool (local only, not in npm)
  genbot/        # 2 tools (local only)

```



## 快速 env



```json

{}

```



```json

{ "COCOSMCP_PLUGINS": "asset-meta,asset-sync" }

```



```json

{ "COCOSMCP_TOOL_PROFILE": "full" }

```



配置示例：`../examples/cursor-mcp-layered.json`  

架构说明：`../docs/LAYERS.md`


