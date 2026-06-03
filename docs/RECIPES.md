# CocosMetaMCP Recipe（Agent 自控注册/提升）

> 需 `COCOSMCP_RECIPE_LAYER>=1`。promote 需 `=2`。分层说明见 `LAYERS.md`。

数据目录（相对工程根）：

```text
.cocosmcp/
  exec-audit.jsonl    # 每次 exec/recipe 调用审计
  registry.json       # recipe 元数据（含 promoted 状态）
  recipes/
    my_script.json    # recipe 定义
```

## 工具

| 工具 | 作用 |
|------|------|
| `cocosmcp_exec_stats` | 分析审计日志，找高频脚本 |
| `cocosmcp_register_recipe` | Agent 注册 recipe；可选 `promote=true` |
| `cocosmcp_list_recipes` | 列出已注册 recipe |
| `cocosmcp_run_recipe` | 运行 recipe（未提升也可用） |
| `cocosmcp_promote_recipe` | 提升为独立 tool（`cocosmcp_r_<name>`） |
| `cocosmcp_demote_recipe` | 取消提升（保留 recipe） |
| `cocosmcp_unregister_recipe` | 删除 recipe |

## Agent 推荐流程

1. 用 `cocosmcp_exec` 探索脚本
2. `cocosmcp_exec_stats` 查看高频/高成功率模式
3. `cocosmcp_register_recipe` 注册（常用脚本）
4. 需要减少 token / 提高选型准确率时 → `cocosmcp_promote_recipe`
5. 不再常用 → `cocosmcp_demote_recipe` 或 `cocosmcp_unregister_recipe`

## register_recipe 示例

```json
{
  "name": "tail_console_log",
  "description": "读取 Creator 控制台 project.log 尾部",
  "mode": "eval",
  "params": {
    "bytes": { "type": "number", "default": 8000, "description": "读取字节数" }
  },
  "code": "const logPath = path.join(Editor.Project.path, 'temp', 'logs', 'project.log');\nconst stat = fs.statSync(logPath);\nconst size = Math.min(stat.size, bytes);\nconst buf = Buffer.alloc(size);\nconst fd = fs.openSync(logPath, 'r');\nfs.readSync(fd, buf, 0, size, Math.max(0, stat.size - size));\nfs.closeSync(fd);\nreturn { logPath, size: stat.size, tail: buf.toString('utf8') };",
  "promote": true
}
```

提升后的 tool 名默认为 `cocosmcp_r_tail_console_log`，并会 `sendToolListChanged` 通知 Cursor。
