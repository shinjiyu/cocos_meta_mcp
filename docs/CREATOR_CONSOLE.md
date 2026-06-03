# Creator IDE 控制台日志 — 实现与提升指南

> 给另一个 Cursor Agent 的任务说明：在 **Cocos 工程**里用现有 MCP 能力实现「读 Creator 控制台」，验证后 **promote 为独立 tool**。

---

## 背景（必读）

| 事实 | 说明 |
|------|------|
| Creator **没有** Console 查询 API | `Editor.Message.request('console', 'query-log')` 等在 3.8.x **不存在** |
| `console.log()` **不会**回传 MCP | `cocosmcp_exec` eval 只返回 `return` 的值 |
| **可行方案** | 读工程日志 `{工程根}/temp/logs/project.log`（与 Console 面板内容一致） |
| 不是预览运行时 | 浏览器/模拟器 console 用 **remote-console** MCP，与本任务无关 |

---

## 前置条件

1. Cocos Creator 已打开目标工程（如 `D:/UGit/proj-l-client`）
2. 扩展 **cocos-meta-mcp** 已启用，控制台有 `MCP HTTP bridge http://127.0.0.1:3921`
3. Cursor 已连接 **cocosmcp** MCP（`cocos-meta-mcp@2.2.0+`）
4. `mcp.json` 中 `COCOSMCP_RECIPE_LAYER` 为 **`2`**（才能 promote；只要 run recipe 则 `1` 即可）
5. MCP `cwd` 指向该 Cocos 工程根目录

---

## 任务目标

1. 实现读取 Creator IDE 控制台日志（`project.log` 尾部）
2. 注册为 recipe：`tail_creator_console`
3. 验证可用后 **promote** 为独立 tool：`cocosmcp_r_tail_creator_console`
4. （可选）把 recipe 提交进工程 `.cocosmcp/`，团队共享

---

## 步骤 1：探测日志文件（cocosmcp_exec）

用 MCP tool **`cocosmcp_exec`**，`mode: eval`：

```javascript
const logPath = path.join(Editor.Project.path, 'temp', 'logs', 'project.log');
if (!fs.existsSync(logPath)) {
  return { ok: false, error: 'project.log not found', logPath, projectPath: Editor.Project.path };
}
const stat = fs.statSync(logPath);
return { ok: true, logPath, size: stat.size, mtime: stat.mtimeMs };
```

**期望：** `ok: true`，`logPath` 类似 `D:/UGit/proj-l-client/temp/logs/project.log`。

若失败：确认 Creator 已打开工程、扩展已启用，或先在 Creator 里随便 `console.log` 一次生成日志。

---

## 步骤 2：读尾部内容（cocosmcp_exec）

同一 tool，`mode: eval`（`bytes` 先写死 8000 验证）：

```javascript
const bytes = 8000;
const logPath = path.join(Editor.Project.path, 'temp', 'logs', 'project.log');
const stat = fs.statSync(logPath);
const size = Math.min(stat.size, bytes);
const buf = Buffer.alloc(size);
const fd = fs.openSync(logPath, 'r');
fs.readSync(fd, buf, 0, size, Math.max(0, stat.size - size));
fs.closeSync(fd);
return {
  logPath,
  totalBytes: stat.size,
  readBytes: size,
  tail: buf.toString('utf8'),
};
```

**期望：** `tail` 里能看到带时间戳的 `[log]` / `[warn]` / `[error]` 行。

---

## 步骤 3：注册 recipe（cocosmcp_register_recipe）

用 MCP tool **`cocosmcp_register_recipe`**，参数：

```json
{
  "name": "tail_creator_console",
  "description": "读取 Cocos Creator IDE 控制台日志（project.log 尾部）。Creator 无 Console 查询 API，此为官方日志文件。",
  "mode": "eval",
  "params": {
    "bytes": {
      "type": "number",
      "default": 8000,
      "description": "最多读取的字节数（从文件末尾向前）"
    },
    "grep": {
      "type": "string",
      "default": "",
      "description": "可选：只返回包含该子串的行（空=不过滤）"
    }
  },
  "code": "const logPath = path.join(Editor.Project.path, 'temp', 'logs', 'project.log');\nif (!fs.existsSync(logPath)) {\n  return { ok: false, error: 'project.log not found', logPath };\n}\nconst stat = fs.statSync(logPath);\nconst maxBytes = Math.max(256, Math.min(bytes || 8000, 512000));\nconst readSize = Math.min(stat.size, maxBytes);\nconst buf = Buffer.alloc(readSize);\nconst fd = fs.openSync(logPath, 'r');\nfs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));\nfs.closeSync(fd);\nlet tail = buf.toString('utf8');\nconst lines = tail.split(/\\r?\\n/);\nif (grep && String(grep).trim()) {\n  const g = String(grep).trim();\n  const filtered = lines.filter((l) => l.includes(g));\n  tail = filtered.join('\\n');\n}\nreturn { ok: true, logPath, totalBytes: stat.size, readBytes: readSize, lineCount: lines.length, tail };",
  "promote": false
}
```

**说明：** 第一次先 **`promote: false`**，用 `cocosmcp_run_recipe` 验证后再提升。

验证：**`cocosmcp_run_recipe`**

```json
{
  "name": "tail_creator_console",
  "params": { "bytes": 4000, "grep": "error" }
}
```

---

## 步骤 4：提升为独立 tool（cocosmcp_promote_recipe）

验证通过后调用 **`cocosmcp_promote_recipe`**：

```json
{
  "name": "tail_creator_console",
  "description": "读取 Creator IDE 控制台 project.log 尾部（可选 grep 过滤）"
}
```

**期望：**

- 返回 `toolName: "cocosmcp_r_tail_creator_console"`
- Cursor MCP 列表出现新 tool（有时需 **disable/enable MCP** 刷新）
- 之后 Agent 可直接调用 **`cocosmcp_r_tail_creator_console`**，参数 `bytes`、`grep`

若 `RECIPE_LAYER=0` 或 `1`：promote 会失败 → 把 `mcp.json` 设为 `"COCOSMCP_RECIPE_LAYER": "2"` 并重载 MCP。

---

## 步骤 5：确认持久化

Recipe 落在工程内：

```text
{工程}/.cocosmcp/
  recipes/tail_creator_console.json
  registry.json          # promoted: true, toolName: cocosmcp_r_tail_creator_console
```

MCP **重启后**会自动恢复已 promote 的 tool（读 `registry.json`）。

可选：`cocosmcp_list_recipes` 检查状态。

---

## 验收清单

- [ ] Creator 开着，`/health` 正常（或 `cocosmcp_health` 若开启）
- [ ] `cocosmcp_exec` eval 能读到 `project.log` tail
- [ ] `cocosmcp_run_recipe` `tail_creator_console` 成功
- [ ] `cocosmcp_promote_recipe` 成功，出现 `cocosmcp_r_tail_creator_console`
- [ ] 新 tool 带参调用返回最新控制台内容
- [ ] `.cocosmcp/recipes/` 有文件（可选 commit 到 git）

---

## 常见问题

| 现象 | 处理 |
|------|------|
| `Creator bridge not reachable` | 开 Creator、启用 cocos-meta-mcp 扩展 |
| `project.log not found` | 在 Creator 执行一次操作触发日志；确认 `Editor.Project.path` 正确 |
| promote 失败 | `COCOSMCP_RECIPE_LAYER=2`，重载 MCP |
| 新 tool 列表里看不到 | MCP 设置里 disable → enable `cocosmcp` |
| 想要预览页 console | 用 **remote-console** 的 `get_logs`，不是本 recipe |

---

## 给执行 Agent 的一行 prompt（可复制）

```text
在已连接的 cocosmcp MCP 上，按 docs/CREATOR_CONSOLE.md 实现 tail_creator_console：
先用 cocosmcp_exec 验证 project.log，再 cocosmcp_register_recipe，cocosmcp_run_recipe 测试，
最后 cocosmcp_promote_recipe 提升为 cocosmcp_r_tail_creator_console。工程根目录是 D:/UGit/proj-l-client。
```

---

## 相关文档

- Recipe 机制：[`RECIPES.md`](RECIPES.md)
- exec 模式：[`EXEC.md`](EXEC.md)
- 分层 / RECIPE_LAYER：[`LAYERS.md`](LAYERS.md)
