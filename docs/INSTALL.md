# 安装指南

## 一键安装（推荐）

```powershell
cd D:\UGit\extension-tools\cocosmcp
.\scripts\install.ps1 -ProjectRoot D:\UGit\your-cocos-project
```

默认行为：

| 组件 | 目标 |
|------|------|
| **Cursor MCP** | `%USERPROFILE%\.cursor\mcp.json`（全局） |
| **Creator 扩展** | `%USERPROFILE%\.CocosCreator\extensions\fg-cocosmcp`（**全局，所有工程可用**） |

### 常用参数

```powershell
# 仅装 Cursor MCP
.\scripts\install.ps1 -ProjectRoot D:\proj -ExtensionOnly

# 仅装 Creator 扩展（全局）
.\scripts\install.ps1 -ProjectRoot D:\proj -CursorOnly -ExtensionMode global

# 扩展装到单个工程（非全局）
.\scripts\install.ps1 -ProjectRoot D:\proj -ExtensionMode project

# MCP 配置写到工程 .cursor/mcp.json
.\scripts\install.ps1 -ProjectRoot D:\proj -CursorTarget project

# 工作流 profile（asset 插件三件套）
.\scripts\install.ps1 -ProjectRoot D:\proj -CursorProfile workflow -IrRoot D:\export\ir

# 开发：扩展用目录联接，改仓库即生效
.\scripts\install.ps1 -ProjectRoot D:\proj -ExtensionLink
```

## 分步安装

### Cursor MCP

```powershell
node scripts/install-cursor.mjs --project-root D:\UGit\your-cocos-project
node scripts/install-cursor.mjs --project-root D:\proj --profile workflow --ir-root D:\export\ir
```

安装后 **重启 Cursor** 或重载 MCP。

### Creator 扩展（全局）

Cocos Creator 3.8 会在启动时扫描 [全局扩展目录](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/install.html)：

| 系统 | 路径 |
|------|------|
| Windows | `%USERPROFILE%\.CocosCreator\extensions\` |
| macOS | `~/.CocosCreator/extensions/` |

```powershell
node scripts/install-extension.mjs --mode global
```

然后在 Creator：**扩展 → 扩展管理器 → Global 标签 → 启用 fg-cocosmcp**。

控制台应出现：`MCP HTTP bridge http://127.0.0.1:3921`

### Creator 扩展（单工程）

```powershell
node scripts/install-extension.mjs --mode project --project-root D:\UGit\your-cocos-project
```

在 **Project** 标签启用。

## 全局 vs 工程扩展

| | 全局 | 工程 |
|--|------|------|
| 路径 | `~/.CocosCreator/extensions/fg-cocosmcp` | `{工程}/extensions/fg-cocosmcp` |
| 适用 | 所有 Creator 工程 | 仅当前工程 |
| 推荐 | 日常开发、MCP 桥接 | CI / 团队锁定版本 |

MCP 的 `cwd` 仍指向**当前 Cocos 工程根**（`--project-root`），与扩展安装位置无关。
