# Skills Registry

| 分类 | Skill | 路径 | 通用价值 | 来源 |
|------|-------|------|----------|------|
| core | cocos-meta-mcp-recipes | [core/cocos-meta-mcp-recipes](./core/cocos-meta-mcp-recipes/) | 高 — 所有 Cocos+MCP 工程 | 赛特2 演进提炼 |
| preview | creator-preview-refresh | [preview/creator-preview-refresh](./preview/creator-preview-refresh/) | 高 — 凡改 TS 需预览验收 | 赛特2 演进提炼 |
| diagnostics | creator-console-log | [diagnostics/creator-console-log](./diagnostics/creator-console-log/) | 高 — Creator IDE 排错 | 对齐 `docs/CREATOR_CONSOLE.md` |
| scene | creator-scene-editing | [scene/creator-scene-editing](./scene/creator-scene-editing/) | 中 — 场景 eval 通用原则 | 自 `creator-scene-bootstrap` 抽象 |
| scene | cocos-meta-mcp-scene | [scene/cocos-meta-mcp-scene](./scene/cocos-meta-mcp-scene/) | 高 — 创建/复制 scene、避免 dirty 弹窗 | proj-l 演进提炼 |

## 未纳入上游（业务专有）

以下 skill 留在业务仓库，不提交本仓库：

| Skill | 原因 |
|-------|------|
| storm-local-preview | Storm 协议 / demo-server 专有 |
| creator-scene-bootstrap | `game.scene` / dev-entry 模板专有 |
| presentation-ir / spin-plan-tdd | Slot IR 验收专有 |
| genbot_* recipe 组 | prefab 代码生成业务流 |
| ASTC/Spine 对比场景 | manifest 路径与 build 脚本专有 |
