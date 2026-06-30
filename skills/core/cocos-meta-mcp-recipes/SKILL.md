---
name: cocos-meta-mcp-recipes
description: >-
  CocosMetaMCP 2.x 通用 Recipe 工作流：用 register_recipe/promote 安装业务 tool，
  禁止手改 mcp.json。适用 genbot、预览热更、refresh-asset、Creator 控制台、
  任意 Cocos 3.8+ 工程。连接 cocosmcp MCP 前应先读此 skill。
---

# CocosMetaMCP Recipe 工具组（通用）

npm 包 **[cocos-meta-mcp](https://github.com/shinjiyu/cocos_meta_mcp)** 2.x：业务 capability 用 **Recipe 元工具** 注册；**复杂多步流程** 写 Cursor Skill（见 `skills/`），不要塞进 Creator 扩展或 MCP 插件。

## 禁止

- **不要**为安装/卸载业务 tool 去改 `mcp.json` 里的 `COCOSMCP_PLUGINS`（仅保留 `cwd` + `COCOSMCP_RECIPE_LAYER=2`）。
- **不要**手搓 `.cocosmcp/registry.json` 代替 `register_recipe`。
- **不要**在 MCP 插件里实现多步 Agent 工作流 — 应写 Skill + 薄 recipe（单参 eval）。

## 前置

- Creator 打开**当前 Cocos 工程**，扩展 **cocos-meta-mcp** 已启用 → `http://127.0.0.1:3921/health` 返回 `ok: true`。
- Cursor MCP **cocosmcp** 已连接；`COCOSMCP_RECIPE_LAYER=2`（setup workflow 默认）。

注册前执行 `cocosmcp_list_recipes`，确认 `projectRoot` 为**工程根**（含 `assets/`）。若为 `C:\Users\...` 用户目录 → 修正 MCP `cwd` 后重载 MCP，再 register。

## 标准安装流程

```text
1. cocosmcp_register_recipe（overwrite: true, promote: false）→ .cocosmcp/recipes/*.json
2. cocosmcp_run_recipe → 验证参数
3. cocosmcp_promote_recipe → cocosmcp_r_{name}
4. 无用 → cocosmcp_unregister_recipe
5. 与 recipe 重复的 builtin 插件 → cocosmcp_plugin_disable
```

`params` 里可选参数须带 **`default`**（如 `grep: ""`），避免 `run_recipe` 未传参时 ReferenceError。

## 推荐通用 Recipe（可按工程 register）

| Recipe 名 | 提升 tool | 用途 |
|-----------|-----------|------|
| `refresh_asset` | `cocosmcp_r_refresh_asset` | `asset-db.refresh-asset` |
| `preview_reload` | `cocosmcp_r_preview_reload` | `preview.reload-terminal` |
| `preview_refresh_scripts` | `cocosmcp_r_preview_refresh_scripts` | 批量 refresh + reload |
| `tail_creator_console` | `cocosmcp_r_tail_creator_console` | 读 `temp/logs/project.log` |

注册步骤见 [`docs/CREATOR_CONSOLE.md`](https://github.com/shinjiyu/cocos_meta_mcp/blob/main/docs/CREATOR_CONSOLE.md)（控制台）及 [`creator-preview-refresh`](../preview/creator-preview-refresh/SKILL.md)（预览）。

## 工具选型

| 场景 | 优先 |
|------|------|
| 改 TS 后进预览 | `cocosmcp_r_preview_refresh_scripts` 或 Skill `creator-preview-refresh` |
| 读 Creator IDE 控制台 | `cocosmcp_r_tail_creator_console` |
| 通用 Editor 操作 | `cocosmcp_exec`（eval / message） |
| 探索后固化 | `register_recipe` → `promote_recipe` |

## Skill vs Recipe vs Plugin

| 形态 | 适合 |
|------|------|
| **Skill** | 多步、易踩坑、需验收清单 |
| **Recipe** | 单参、幂等、高频 |
| **MCP 插件** | 稳定 API、可版本化（`cocosmcp_cc38x_*`）；非 Agent 编排 |

## Troubleshooting

| 现象 | 处理 |
|------|------|
| `Creator bridge not reachable` | 开 Creator、启用 cocos-meta-mcp |
| `Tool not found` cocosmcp_r_* | Reload MCP；确认已 promote |
| Recipe 落在用户目录 | 修正 MCP `cwd` 后重新 register |
| `genbot-runner not available` | 用 recipe 版 genbot 或 `plugin_enable`，勿混用旧插件 |

## 相关

- 上游文档：[`RECIPES.md`](https://github.com/shinjiyu/cocos_meta_mcp/blob/main/docs/RECIPES.md)、[`LAYERS.md`](https://github.com/shinjiyu/cocos_meta_mcp/blob/main/docs/LAYERS.md)
