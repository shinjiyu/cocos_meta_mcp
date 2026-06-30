---
name: creator-console-log
description: >-
  读取 Cocos Creator IDE 控制台日志（project.log），与预览页 remote-console 区分。
  使用时机：Creator 编译报错、扩展桥异常、验收失败需看 Editor 侧日志、register
  tail_creator_console recipe 前。
---

# Creator IDE 控制台日志

## 三种日志来源（勿混淆）

| 来源 | 路径 / 工具 | 内容 |
|------|-------------|------|
| **Creator IDE** | `{工程}/temp/logs/project.log` | 编辑器 Console 面板同款 |
| **预览运行时** | remote-console MCP / 浏览器 DevTools | 游戏运行时 log |
| **MCP eval return** | `cocosmcp_exec` 返回值 | 仅 `return` 的对象，不含 `console.log` |

Creator **没有** `Editor.Message.request('console', 'query-log')` 之类 API（3.8.x）。读 IDE 控制台 = 读 **project.log**。

## 快速使用

已 promote recipe 时：

```text
cocosmcp_r_tail_creator_console
  bytes: 8000
  grep: "error"    # 可选
```

未注册时：按 [`docs/CREATOR_CONSOLE.md`](https://github.com/shinjiyu/cocos_meta_mcp/blob/main/docs/CREATOR_CONSOLE.md) 用 `cocosmcp_exec` 探测 → `register_recipe` → `promote_recipe`。

## 探测（cocosmcp_exec eval）

```javascript
const logPath = path.join(Editor.Project.path, 'temp', 'logs', 'project.log');
if (!fs.existsSync(logPath)) {
  return { ok: false, error: 'project.log not found', logPath };
}
const stat = fs.statSync(logPath);
return { ok: true, logPath, size: stat.size };
```

## 前置

- Creator 已打开目标工程
- cocos-meta-mcp 扩展已启用（`:3921/health` ok）
- MCP `cwd` 指向该工程根

## Troubleshooting

| 现象 | 处理 |
|------|------|
| `project.log not found` | 在 Creator 执行一次操作触发日志 |
| 需要预览页 console | 用 **remote-console**，不是本 skill |
| tail 为空 | 确认 `Editor.Project.path` 与 MCP cwd 一致 |

## 相关

- 完整注册步骤：[`docs/CREATOR_CONSOLE.md`](https://github.com/shinjiyu/cocos_meta_mcp/blob/main/docs/CREATOR_CONSOLE.md)
- Recipe 规范：Skill `cocos-meta-mcp-recipes`
