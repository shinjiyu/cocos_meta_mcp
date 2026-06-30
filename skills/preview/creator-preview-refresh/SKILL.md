---
name: creator-preview-refresh
description: >-
  Cocos Creator 预览热更：磁盘 TS 改完后强制编译进预览、reload-terminal、探针验证。
  使用时机：预览吃到旧脚本、改 TS 后验收失败、用户说预览不热更、跑浏览器/MCP 验收前。
---

# Creator 预览热更（TS → 预览）

## 问题

Creator **预览不会自动吃到磁盘上最新 TS**（尤其 Agent 在 IDE 外改文件）。只刷新浏览器 **不够** — 须 Editor 重新编译并 `reload-terminal`。

## 前置

1. Creator 已打开本工程，**cocos-meta-mcp** 已启用
2. `GET http://127.0.0.1:3921/health` → `{ "ok": true }`
3. 预览默认可能 paused；自动化须 `cc.game.resume()`（按工程脚本处理）

---

## 标准热更流程（Agent 必做）

改完 `assets/**/*.ts` 后，**在跑任何预览验收之前**：

### 1. 触发 Editor 编译

对**刚改的文件**或工程入口脚本做 refresh，再 reload 预览终端。

**MCP Recipe（推荐）**

- `cocosmcp_r_preview_refresh_scripts` — 默认 refresh 入口脚本 + reload（大改 TS 首选）
- `cocosmcp_r_refresh_asset` — 单文件，传 `assetUrl`（`db://assets/...`）
- `cocosmcp_r_preview_reload` — 仅 reload-terminal

**MCP `cocosmcp_exec`（等价 message）**

```json
{
  "mode": "message",
  "module": "asset-db",
  "method": "refresh-asset",
  "messageType": "request",
  "args": ["db://assets/scripts/YourEntry.ts"]
}
```

```json
{
  "mode": "message",
  "module": "preview",
  "method": "reload-terminal",
  "messageType": "request"
}
```

将 `args` 换成你工程实际改动的 `db://` 路径。

**HTTP 桥（无 MCP 时）**

```powershell
$body = '{"mode":"message","module":"asset-db","method":"refresh-asset","messageType":"request","args":["db://assets/scripts/YourEntry.ts"]}'
Invoke-RestMethod -Uri http://127.0.0.1:3921/exec -Method POST -ContentType application/json -Body $body
$body2 = '{"mode":"message","module":"preview","method":"reload-terminal","messageType":"request"}'
Invoke-RestMethod -Uri http://127.0.0.1:3921/exec -Method POST -ContentType application/json -Body $body2
```

### 2. 等待编译

`reload-terminal` 后 **等待 5–10 秒**；大改或多文件可 15s。

### 3. 浏览器硬刷新

自动化在 `goto` 后应 **`page.reload()`**；仍怀疑缓存时 URL 加 `&_t=<timestamp>`。

### 4. 验证「已吃到新代码」

在工程选一个**稳定探针**（任选其一）：

- 入口脚本里递增 `PROBE_VERSION` 常量，预览里读 `window.__PROBE__`
- 改过的函数打**唯一日志串**，用 `cocosmcp_r_tail_creator_console` grep
- 业务层已有 `__MCP_TEST__` / debug API 时读其状态

**失败特征**：日志文案不变、探针版本不对、行为与磁盘代码不一致。

---

## Agent 自检清单

```
- [ ] bridge /health ok
- [ ] refresh-asset（改动的 db:// 路径）
- [ ] preview.reload-terminal
- [ ] sleep 5–10s
- [ ] 打开/刷新预览页
- [ ] 探针确认新代码
- [ ] 再跑端到端验收
```

**禁止**：未热更就宣称验收通过；让用户「手动刷一下」代替 Agent 自检。

---

## 注意事项

1. **仅 refresh 不改盘** 不会变行为；验证要看**刚改的逻辑**或 bump 探针版本。
2. **`node_modules` / 外链包**：改依赖后除 refresh 外可能需 `npm install` + 重启 Creator。
3. **genbot / asset-meta 插件** 不能替代 TS 的 `refresh-asset` + `reload-terminal`。
4. **已在目标场景时** 避免反复 `loadScene` — 会重跑初始化、日志洪水。

---

## 相关

- Recipe 注册：Skill `cocos-meta-mcp-recipes`
- MCP exec 模式：[`docs/EXEC.md`](https://github.com/shinjiyu/cocos_meta_mcp/blob/main/docs/EXEC.md)
