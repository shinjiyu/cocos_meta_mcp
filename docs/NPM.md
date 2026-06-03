# npm 发布

包名：**`cocos-meta-mcp`**（v2.1.0+）

包含：

| 内容 | 路径 |
|------|------|
| stdio MCP 服务 | `mcp/` + CLI `cocos-meta-mcp` |
| Creator 扩展（预编译 dist） | `extension/` |
| 安装脚本 | `scripts/` + CLI `cocos-meta-mcp-setup` |

**不包含**：`genbot` 插件、`genbot-runner.mjs`（私有/本地）

## 安装

```bash
npm install -g cocos-meta-mcp
# 或工程 devDependency
npm install -D cocos-meta-mcp
```

## 一键配置

```bash
# Cursor MCP + Creator 全局扩展
cocos-meta-mcp-setup all --project-root /path/to/cocos/project

# 分步
cocos-meta-mcp-setup extension --mode global
cocos-meta-mcp-setup cursor --project-root /path/to/cocos/project --profile workflow
```

## Cursor mcp.json 示例（npm 全局安装后）

```json
{
  "mcpServers": {
    "cocos-meta-mcp": {
      "command": "cocos-meta-mcp",
      "cwd": "/path/to/your/cocos/project",
      "env": {
        "COCOSMCP_PLUGINS": "asset-meta,asset-sync,ir-prefab"
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
