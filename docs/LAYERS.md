# cocosmcp 分层架构

```text
L0 Core        cocosmcp_exec（默认）
L1 Recipe      COCOSMCP_RECIPE_LAYER=1|2
Plugins        全量安装到 {工程}/.cocosmcp/installed/{id}/
```

## 插件「全量安装」

启用/安装插件时会把 **整个插件目录** 复制到工程内，便于复用与进 git：

```text
{工程}/.cocosmcp/
  project.json              # 最近检测到的 Cocos 版本
  plugins.json                # 启用状态 + 版本元数据
  installed/
    genbot/
      manifest.json           # 含 cocosCreatorVersion、toolsVersioned
      index.mjs               # 从 mcp/plugins/ 复制的副本
    candystorm-ir/
  recipes/                    # 提升的 recipe 脚本
  registry.json
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
| `COCOSMCP_RECIPE_LAYER` | `0` | `1`=recipe+插件管理；`2`=+promote |
| `COCOSMCP_PLUGINS` | 空 | 启动时全量安装并加载 |
| `COCOSMCP_TOOL_PROFILE=full` | — | 全插件 + recipe L2 |

## Recipe 层工具（L1+）

- `cocosmcp_plugin_list` / `cocosmcp_plugin_install` / `cocosmcp_plugin_enable` / `cocosmcp_plugin_disable`
- `cocosmcp_register_recipe` / `cocosmcp_run_recipe` / …

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
