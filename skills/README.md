# CocosMetaMCP — Cursor Agent Skills

官方 Skills 扩展，配合 [cocos-meta-mcp](https://github.com/shinjiyu/cocos_meta_mcp) 使用。

**设计原则**：Creator 扩展 + `cocosmcp_exec` 只提供 eval/message 桥接；复杂流程、禁止项、验收清单写在本目录的 Skill 里，而不是堆进 MCP 插件。

## 快速安装

```bash
# 推荐：全局 npm 后从包目录复制（路径因安装而异）
npm root -g   # 例如 .../npm/node_modules/cocos-meta-mcp/skills

# 或克隆仓库
git clone https://github.com/shinjiyu/cocos_meta_mcp.git
```

复制到 Cursor skills 目录（任选）：

| 目标 | 作用域 |
|------|--------|
| `~/.cursor/skills/<skill-name>/` | 本机所有工程 |
| `{工程}/.cursor/skills/<skill-name>/` | 仅该 Cocos 工程 |

**建议最少安装**：`core/cocos-meta-mcp-recipes` + `preview/creator-preview-refresh`。

## 分类索引

完整列表见 [registry.md](./registry.md)。

## 文档

- 架构说明：[`docs/SKILLS.md`](../docs/SKILLS.md)
- MCP 分层：[`docs/LAYERS.md`](../docs/LAYERS.md)
