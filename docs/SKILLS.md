# Cursor Agent Skills 扩展

CocosMetaMCP 的分层设计：**Creator 扩展 + MCP 只做薄桥接**，复杂工作流由 **Cursor Agent Skills** 承载。

## 三层分工

```text
┌─────────────────────────────────────────────────────────┐
│  L-Skills   skills/          多步流程、踩坑、验收策略     │  ← 本目录
├─────────────────────────────────────────────────────────┤
│  L1 Recipe  .cocosmcp/       单参数、幂等、可 promote     │
├─────────────────────────────────────────────────────────┤
│  L0 Core    cocosmcp_exec    eval / message / open-url   │
└─────────────────────────────────────────────────────────┘
         ▲ HTTP :3921
┌────────┴────────┐
│ cocos-meta-mcp  │  Creator 项目扩展（薄桥，无业务逻辑）
│   extension     │
└─────────────────┘
```

| 层 | 适合 | 不适合 |
|----|------|--------|
| **L0 exec** | 一次性探测、`Editor.*` 短脚本 | 多步编排、文档化坑点 |
| **L1 Recipe** | 高频一键（refresh asset、tail log） | 需分支判断的长流程 |
| **L-Skills** | Agent 须先读再做的流程、禁止项、验收清单 | 稳定单参 API（应 promote 为 recipe） |

与 [`LAYERS.md`](LAYERS.md)（MCP 插件 / Recipe 层）互补；Skills **不**增加 MCP tool，只指导 Agent 如何组合现有 tool。

## 安装

### 个人（全工程可用）

```powershell
# 克隆或 npm 包解压后
xcopy /E /I skills\core\cocos-meta-mcp-recipes %USERPROFILE%\.cursor\skills\cocos-meta-mcp-recipes
# 按需复制 preview/、diagnostics/、scene/ 下其它 skill
```

### 项目（团队共享）

```text
{你的 Cocos 工程}/
  .cursor/skills/cocos-meta-mcp-recipes/SKILL.md
  .cursor/skills/creator-preview-refresh/SKILL.md
```

或 symlink 到本仓库 `skills/` 子目录。

## 目录与分类

见 [`skills/registry.md`](../skills/registry.md)。

| 分类 | Skill | 说明 |
|------|-------|------|
| **core** | `cocos-meta-mcp-recipes` | MCP 连接、Recipe 注册/提升、禁止手改 mcp.json |
| **preview** | `creator-preview-refresh` | 改 TS 后进预览的热更流程 |
| **diagnostics** | `creator-console-log` | 读 Creator IDE 控制台（`project.log`） |
| **scene** | `creator-scene-editing` | 场景编辑原则与反模式（通用） |
| **scene** | `cocos-meta-mcp-scene` | 场景创建/复制、避免 dirty 弹窗、模板脚本 |

## 与 Recipe 文档的关系

- 注册 `tail_creator_console` 等 recipe 的步骤：[`CREATOR_CONSOLE.md`](CREATOR_CONSOLE.md)
- Recipe 机制：[`RECIPES.md`](RECIPES.md)
- Skill 教 Agent **何时、为何**；Recipe 文档教 **如何注册 eval 代码**

## 贡献

1. 新 Skill 放在 `skills/{category}/{name}/SKILL.md`
2. 更新 `skills/registry.md`
3. 去掉工程专有路径（具体 prefab 名、业务 manifest 等）；业务专有 workflow 留在业务仓库 `.agents/skills/`
