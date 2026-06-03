# 安装指南

参考 [Cocos Creator 3.8 — 安装与分享](https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/install.html)：**扩展安装在工程内** `{工程}/extensions/`，在 **扩展管理器 → 项目** 标签启用。

## 一键安装（推荐）

```bash
cd D:/UGit/extension-tools/cocosmcp

# 在 Cocos 工程目录执行，或自动探测工程根
node scripts/install.mjs

# 显式指定工程
node scripts/install.mjs --project-root D:/UGit/your-cocos-project
npm run setup
```

npm 全局包：

```bash
cocos-meta-mcp setup --project-root D:/你的工程
# 或在工程目录下
cd D:/你的工程 && cocos-meta-mcp setup
```

## 默认行为

| 组件 | 目标 |
|------|------|
| **Cursor MCP** | `%USERPROFILE%\.cursor\mcp.json` |
| **Creator 扩展** | `{工程}/extensions/cocos-meta-mcp`（**项目扩展**） |

安装后：**打开该工程** → **扩展 → 扩展管理器 → 项目** → 启用 **cocos-meta-mcp**。

## 工程根自动探测

1. `--project-root`
2. `COCOSMCP_PROJECT_ROOT` / `COCOS_PROJECT_ROOT`
3. 从 cwd 向上找 `assets/` + `project.json`（或 `settings/`）
4. Cursor `mcp.json` 里 cocos server 的 `cwd`
5. Creator 配置中的最近工程

## 常用参数

```bash
# 仅 Cursor MCP
node scripts/install.mjs --cursor-only

# 仅 Creator 扩展（装到当前/指定工程）
node scripts/install.mjs --extension-only --project-root D:/proj

# 不装扩展
node scripts/install.mjs --extension-mode none --project-root D:/proj

# MCP 写到工程 .cursor/mcp.json
node scripts/install.mjs --cursor-target project --project-root D:/proj

# 工作流 profile
node scripts/install.mjs --cursor-profile workflow --ir-root D:/export/ir
```

## 分步安装

### Cursor MCP

```bash
node scripts/install-cursor.mjs --project-root D:/proj
```

### Creator 扩展（官方方式）

```bash
node scripts/install-extension.mjs --mode project --project-root D:/proj
```

目录结构（与官方打包要求一致）：

```text
{工程}/extensions/cocos-meta-mcp/
  dist/
  package.json
```

## 关于「全局扩展」

[Cocos 3.8 中文安装文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/install.html) **只描述项目路径** `${工程}/extensions`，扩展管理器示例也在 **项目** 标签。

旧版英文文档曾提到 `~/.CocosCreator/extensions`；若你环境仍支持，可用（不推荐）：

```bash
node scripts/install-extension.mjs --mode global-legacy
```

**每个 Cocos 工程需各自安装一次**，或把 `extensions/cocos-meta-mcp` 提交进 Git 供团队共用。

MCP 的 `cwd` 始终指向**当前打开的 Cocos 工程根**，与你在哪个工程里安装了扩展一致。
