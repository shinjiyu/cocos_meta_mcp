# npm 发布

包名：**`cocos-meta-mcp`**（v2.1.1+）

包含：

| 内容 | 路径 |
|------|------|
| stdio MCP 服务 | `mcp/` + CLI `cocos-meta-mcp` |
| Creator 扩展（预编译 dist） | `extension/` |
| 安装脚本 | `scripts/` + `cocos-meta-mcp setup` |

## 内置 MCP 插件（随 npm 包发布）

| 插件 id | 说明 |
|---------|------|
| `asset-meta` | .meta 检查 / 导入 / 刷新 |
| `asset-sync` | 外部资源目录同步 |

`cocos-meta-mcp setup` **默认 profile=workflow**，会在 Cursor `mcp.json` 写入 `COCOSMCP_PLUGINS=asset-meta,asset-sync`。

仅要 `cocosmcp_exec` 时可：`cocos-meta-mcp setup --cursor-profile minimal`

**不包含**（私有/本地，不进 npm）：`genbot`、`ir-prefab`

插件安装详解：[`PLUGINS.md`](PLUGINS.md)

## 安装

```bash
npm install -g cocos-meta-mcp
# 或工程 devDependency
npm install -D cocos-meta-mcp
```

## 一键配置

```bash
# Cursor MCP + Creator 项目扩展
cocos-meta-mcp setup --project-root /path/to/cocos/project

# 分步（默认 workflow = 含插件）
cocos-meta-mcp setup cursor --project-root /path/to/cocos/project
```

## Cursor mcp.json 示例（npm 全局安装后）

```json
{
  "mcpServers": {
    "cocos-meta-mcp": {
      "command": "cocos-meta-mcp",
      "cwd": "/path/to/your/cocos/project",
      "env": {
        "COCOSMCP_PLUGINS": "asset-meta,asset-sync"
      }
    }
  }
}
```

`command` 使用全局 bin 即可，无需写 `node .../index.mjs` 绝对路径。

## 维护者：打包前

```bash
npm run prepack      # 编译 extension + MCP 语法检查
npm run pack:check   # 预览 tarball 文件列表
npm pack             # 生成本地 .tgz
npm publish          # 发布（需 npm login）
```

## 版本号

遵循 semver：`package.json` 的 `version` 字段。发布前更新版本并打 git tag：

```bash
npm version patch   # 或 minor / major
git push && git push --tags
npm publish
```
