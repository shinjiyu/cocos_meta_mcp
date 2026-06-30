# CocosMetaMCP 分层架构

```text
L-Skills       skills/（Cursor Agent Skills，非 MCP tool）
L0 Core        cocosmcp_exec（默认）
L1 Recipe      COCOSMCP_RECIPE_LAYER=1|2
Plugins        全量安装到 {工程}/.cocosmcp/installed/{id}/
```

**L-Skills** 与 MCP 层互补：扩展 + exec 只做 eval/message 桥接；多步流程、禁止项、验收清单写在 [`skills/`](../skills/)（见 [`SKILLS.md`](SKILLS.md)）。不要把复杂 Agent 编排塞进 Creator 扩展或 MCP 插件。

## 插件「全量安装」

启用/安装插件时会把 **整个插件目录** 复制到工程内，便于复用与进 git：

```text
{工程}/.cocosmcp/
  project.json
  plugins.json              # 工程级启用（可选，与 load.json 合并）
  installed/
    asset-meta/
      manifest.json
      index.mjs
  recipes/
  registry.json

{cocos-meta-mcp 包}/mcp/plugins/   # 仅 npm 内置 asset-meta、asset-sync

{tmpdir}/cocos-meta-mcp/           # 自研插件（plugin install）
  load.json
  plugins/my-plugin/
```

`plugin_disable` **只卸 MCP tool**，**不删** `installed/` 目录。

## Tool 命名（仅插件）

**插件** tool 前缀由 manifest 的 **版本声明** 决定（非精确 patch 号）：

| manifest `cocosVersion` | tool slug 示例 | tool 名示例 |
|-------------------------|----------------|-------------|
| `3.8.*` | `cc38x` | `cocosmcp_cc38x_genbot_generate` |
| `3.8.8`（精确） | `cc388` | `cocosmcp_cc388_genbot_generate` |
| `3.*` | `cc3x` | `cocosmcp_cc3x_...` |
| `*` | `ccany` | `cocosmcp_ccany_...` |
| `>=3.8.0 <3.9.0` | `cc38` | `cocosmcp_cc38_...` |
| `["3.8.*", "3.7.*"]` | 取首个声明 | — |

支持写法：`3.8.x` ≡ `3.8.*`，`any` ≡ `*`，可选 `cocosVersionRange` 写范围。

安装时会检测当前 Creator 是否 **match** 声明；`3.8.8` → `3.8.9` 在 `3.8.*` 下 **无需重装**（slug 仍为 `cc38x`）。

**Recipe 提升**（不带版本）：`cocosmcp_r_{recipe_name}`

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `COCOSMCP_RECIPE_LAYER` | `2` | `0`=仅 exec；`1`=+recipe/插件管理；`2`=+promote（**默认**） |
| `COCOSMCP_PLUGINS` | — | **已废弃**；用 `mcp/plugins/load.json` |
| `COCOSMCP_TOOL_PROFILE=full` | — | 全插件 + recipe L2 |

## Recipe 层工具（L1+）

- `cocosmcp_plugin_list` / `cocosmcp_plugin_install` / `cocosmcp_plugin_enable` / `cocosmcp_plugin_disable`
- `cocosmcp_register_recipe` / `cocosmcp_run_recipe` / …

插件安装步骤见 [`PLUGINS.md`](PLUGINS.md)。

## plugins.json v2 示例

```json
{
  "version": 2,
  "cocosCreatorVersion": "3.8.8",
  "cocosVersionSlug": "cc388",
  "plugins": {
    "genbot": {
      "enabled": true,
      "installedAt": "2026-06-03T12:00:00.000Z",
      "cocosCreatorVersion": "3.8.8",
      "cocosVersionSlug": "cc388",
      "installPath": ".cocosmcp/installed/genbot",
      "toolsVersioned": [
        "cocosmcp_cc388_genbot_generate",
        "cocosmcp_cc388_genbot_status"
      ]
    }
  }
}
```
