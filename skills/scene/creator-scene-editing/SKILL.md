---
name: creator-scene-editing
description: >-
  Cocos Creator 场景编辑通用原则：用 cocosmcp_exec eval 操作场景，禁止手改 .scene
  JSON 与 message 模式 create-node。使用时机：Agent 需增删节点/组件、修 scene、
  bootstrap 场景前。工程专有 bootstrap 流程应另建项目 skill。
---

# Creator 场景编辑（通用原则）

复杂场景 bootstrap（克隆模板 scene、固定组件 cid 等）见 Skill **`cocos-meta-mcp-scene`**。本 skill 只沉淀 **任何 Cocos + cocosmcp 工程都适用** 的规则。

## Skill vs Recipe

| 形态 | 适合 | 场景编辑 |
|------|------|----------|
| **Skill** | 多步、易踩坑、须先读 | **首选** — 删节点、绑组件、save-scene |
| **Recipe** | 单参幂等一键 | 仅当「一键重建」需求稳定后再 promote |
| **MCP 插件** | 稳定 API | 不适合编排多步 scene 流程 |

## 禁止

1. **手改** `assets/scene/*.scene` JSON（`__id__` 错位 → `Open scene failed`）
2. **`cocosmcp_exec` message 模式** + 数组 args 调 `create-node` / `remove-node` / `create-component` — 常返回 200 但**不生效**，误调会生出嵌套 `New Node`
3. 在未 `query-node-tree` / `query-current-scene` 的情况下假设节点 uuid

## 推荐路径

1. **eval** 调用 Editor 场景 API（`Editor.Message.request('scene', ...)` 或工程封装脚本）
2. 大段逻辑：工程内 `tools/scripts/*.mjs` 生成 eval 代码 → Agent 粘贴到 `cocosmcp_exec` eval
3. 改完后 **`save-scene`**（eval 或 message，按工程脚本）
4. 验收：`query-current-scene` / `query-node-tree`；失败时 `cocosmcp_r_tail_creator_console` grep scene 相关 error

## eval 示例模式

```javascript
// 查询当前场景根（示意，以 Creator 3.8 API 为准）
const tree = await Editor.Message.request('scene', 'query-node-tree');
return { ok: true, rootUuid: tree?.uuid, childCount: tree?.children?.length };
```

具体 API 以当前 Creator 版本文档为准；Agent 应先用短 eval **探测**再写 destructive 操作。

## Troubleshooting

| 现象 | 处理 |
|------|------|
| 根下多层 `New Node` 套娃 | eval 递归删 `name==='New Node'` → save-scene |
| message create-node 200 但树不变 | 改 eval，显式 `{ parent, name }` |
| save 后磁盘与 Editor 不一致 | 以 Editor `query-node-tree` 为准；必要时重建后 save |

## 相关

- 场景创建/复制/避免 dirty 弹窗：Skill `cocos-meta-mcp-scene`
- MCP 桥与 Recipe：Skill `cocos-meta-mcp-recipes`
- 改 TS 后预览：Skill `creator-preview-refresh`

**业务示例**（不纳入上游）：某工程的 `creator-scene-bootstrap`（dev-entry → game.scene）留在该工程仓库。
