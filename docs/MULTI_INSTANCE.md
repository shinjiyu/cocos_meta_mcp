# Cocos Creator 多开

> 分支：`feat/cocos-multi-instance`  
> 状态：**已实现**（registry + 路由 + 校验）

## 已实现能力

| 组件 | 行为 |
|------|------|
| **Creator 扩展** | 优先 `3921`；`EADDRINUSE` 时自动动态端口；`load` 写入 registry，`unload` 注销 |
| **Registry** | `%LOCALAPPDATA%/cocos-meta-mcp/instances.json`（Win）；`~/.cocos-meta-mcp/`（其他） |
| **MCP** | `cocosmcp_list_bridges`；`cocosmcp_exec` / `cocosmcp_run_recipe` 可选 `projectRoot` |
| **校验** | 每次 exec 前 `health.projectPath` 必须匹配目标工程 |

### Agent 跨工程用法

```text
1. cocosmcp_list_bridges
2. cocosmcp_exec({ projectRoot: "D:/proj-A", mode: "eval", code: "..." })
3. cocosmcp_exec({ projectRoot: "D:/proj-B", mode: "eval", code: "..." })
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `COCOSMCP_HTTP_PORT` | 首选端口（默认 3921） |
| `COCOSMCP_HTTP_REGISTRY=0` | 禁用 registry 写入（旧行为） |
| `COCOSMCP_REGISTRY_HOME` | 自定义 registry 目录 |

---

## 1. 现象与用户诉求（历史背景）

同时打开多个 Cocos Creator 工程（多开）时，Cursor Agent 通过 `cocosmcp_exec` 发出的命令可能：

- 落到**错误的工程**（A 工程的 MCP `cwd` 指向 A，但 HTTP 桥实际连的是 B 的 Creator）
- **第二个 Creator 扩展无法监听 3921**（端口被第一个占用），控制台无 bridge 或行为异常
- Agent **无感知**：`executeCreatorBody` 只检查 `/health` 可达，**不校验** `health.projectPath === MCP PROJECT_ROOT`

Skills 中已文档化该限制（`cocos-meta-mcp-scene`：「单端口限制」），但架构层未解决。

---

## 2. 当前架构（单实例假设）

```text
Cursor MCP (stdio)
  cwd = {一个 Cocos 工程}
  COCOSMCP_PROJECT_ROOT / process.cwd → PROJECT_ROOT
  CREATOR_BRIDGE = http://127.0.0.1:3921  （固定，可 env 覆盖）
        │
        │  HTTP GET /health, POST /exec
        ▼
Creator 实例 #?  （extension/main.ts）
  listen(127.0.0.1, COCOSMCP_HTTP_PORT || 3921)
  /health → { projectPath: Editor.Project.path, ... }
```

### 2.1 Creator 扩展侧

| 点 | 现状 | 文件 |
|----|------|------|
| 默认端口 | `3921`，env `COCOSMCP_HTTP_PORT` | `extension/source/main.ts` |
| 绑定地址 | `127.0.0.1` 单端口 | 同上 |
| 端口冲突 | **无** `EADDRINUSE` 处理；`if (httpServer) return` 仅防同进程重复 listen | 同上 |
| 工程标识 | `/health` 返回 `projectPath` | 同上 |
| 预览端口 | 每实例 `Editor.Message.request('server', 'query-port')` | 已动态 |

### 2.2 MCP stdio 侧

| 点 | 现状 | 文件 |
|----|------|------|
| 桥 URL | 固定 `http://127.0.0.1:3921` 或 `COCOSMCP_HTTP_URL` | `mcp/context.mjs` |
| 工程根 | 单值 `PROJECT_ROOT`（env 或 `cwd`） | 同上 |
| 执行前校验 | 仅 `health.ok`，**不比对** `projectPath` | `mcp/recipe-registry.mjs` `executeCreatorBody` |
| Cursor 配置 | **一个** `cocosmcp` server，`cwd` 指向**一个**工程 | `scripts/install-cursor.mjs` |
| Recipe/插件数据 | `{工程}/.cocosmcp/` 按 `PROJECT_ROOT` 隔离 | 正确，但桥连错工程时数据与执行不一致 |

### 2.3 配置层

- 全局 `~/.cursor/mcp.json` 通常只有 **一条** `cocosmcp` 条目
- `setup --project-root` 每次安装会 **merge 覆盖** 同一 key，无法「多工程多 server」除非手改
- 无「实例发现」：MCP 不会扫描本机已注册的多个 bridge

---

## 3. 多开时的失败模式

### 模式 A：后开的 Creator 抢不到 3921

1. Creator-A 先启动 → `listen(3921)` 成功，日志 `MCP HTTP bridge http://127.0.0.1:3921`
2. Creator-B 后启动 → `listen(3921)` **失败**（Node 默认 throw，扩展可能静默或报错）
3. MCP 连 3921 → 永远是 **A**；用户在 B 的 Creator 里操作，Agent 改的是 **A 的工程**

### 模式 B：MCP cwd 与「占 3921 的 Creator」不一致

1. `mcp.json` 的 `cwd` = `D:/proj-l-client-new`
2. 实际只有 `D:/proj-l-client` 的 Creator 开着且占了 3921
3. `/health.projectPath` = `D:/proj-l-client`，但 `.cocosmcp/recipes` 读写 `proj-l-client-new`
4. **静默错工程**：exec 在 A 执行，recipe 审计/registry 写在 B 的目录

### 模式 C：两个工程都试图用 3921 + 用户改 env

若用户给 B 设 `COCOSMCP_HTTP_PORT=3922`，但 MCP 仍指向 `3921` → 连不上或连错。  
若 MCP 也改 `COCOSMCP_HTTP_URL` → 需要 **每个 Cursor 窗口/每个 MCP server** 不同配置，运维成本高。

### 模式 D：多 Cursor 工作区

工作区 A、B 各打开不同 Cocos 工程，共享全局 `mcp.json` 的一条 `cocosmcp` → **必然**只有一个 `cwd` 生效。

---

## 4. 根因归纳

| 根因 | 说明 |
|------|------|
| **R1 单端口全局约定** | 3921 作为「本机唯一 Creator 桥」，多实例互斥 |
| **R2 无实例注册/发现** | 没有 registry 记录 `{port, projectPath, pid}` |
| **R3 无路由层** | MCP 不根据目标工程选择 bridge URL |
| **R4 无执行前校验** | 未强制 `normalize(projectPath) === normalize(PROJECT_ROOT)` |
| **R5 单 MCP server 配置** | install 脚本与 Cursor 模型假设 1:1:1（一个 Agent 通道 : 一个工程 : 一个 Creator） |

---

## 5. 约束与参考

- Creator **允许多进程多开**（每个工程独立 Electron 主进程）
- 预览端口在 3.8+ 已是**工程级本地配置**（非全局），说明官方认可「每实例不同端口」
- 扩展 HTTP 桥是我们自定义的，**官方无**「MCP bridge 多开」标准
- `127.0.0.1` 本机 loopback，端口空间充足（3921–3999 等）

---

## 6. 可选方案（待选型）

### 方案 1：每工程固定偏移端口（简单）

- 扩展：`port = base + hash(projectPath) % N` 或读工程 `.cocosmcp/project.json` 里配置的 `httpPort`
- MCP：`COCOSMCP_HTTP_URL` 与工程 `cwd` 绑定（project-level `mcp.json` 或 env）
- 优点：实现快；缺点：端口冲突仍需处理 hash 碰撞，多 Cursor 需多个 MCP server 条目

### 方案 2：动态端口 + 本机 registry（推荐方向）

- 扩展：listen `0` 得空闲端口，写入 `%TEMP%/cocos-meta-mcp/instances.json` 或工程 `.cocosmcp/bridge.json`（含 `port`, `projectPath`, `startedAt`）
- MCP：启动或每次 exec 前读 registry，按 `PROJECT_ROOT` 匹配 URL；无匹配则明确报错
- 优点：可发现、可校验；缺点：需处理 Creator 崩溃残留、unload 时注销

### 方案 3：多 MCP server（Cursor 层）

- `mcp.json`：`cocosmcp-proj-a`、`cocosmcp-proj-b`，各不同 `cwd` + `COCOSMCP_HTTP_URL`
- 扩展：各实例不同 `COCOSMCP_HTTP_PORT`（手动或方案 1/2）
- 优点：与 Cursor 多工作区自然对齐；缺点：配置膨胀，Agent 要选哪个 server

### 方案 4：统一路由 MCP（单 stdio，多 bridge）

- 一个 MCP 进程，`cocosmcp_exec` 增加 `projectRoot` 或自动用 `PROJECT_ROOT`，内部查 registry 路由到正确 port
- 配合方案 2；对 Agent 透明
- 优点：用户体验最好；缺点：MCP 改动面最大

### 方案 5：执行前硬校验（最小补丁，不解决多开）

- `executeCreatorBody`：若 `health.projectPath` 与 `PROJECT_ROOT` 不一致 → **拒绝执行**并提示
- 不解决 B 无 bridge，但消除**静默错工程**
- 应作为任意方案的 **baseline**

---

## 7. 建议实施顺序

1. **P0** — `executeCreatorBody` + `cocosmcp_health` 增加 `projectPath` 与 `PROJECT_ROOT` 一致性校验（快速止血）
2. **P1** — 扩展动态端口 + 实例 registry + unload 清理
3. **P2** — MCP 按 registry 解析 `CREATOR_BRIDGE`（替代写死 3921）
4. **P3** — `setup`/文档：多工程 `mcp.json` 模板或 `cocosmcp_list_instances` tool
5. **P4** — Skills 更新：去掉「只能单开」作为永久限制，改为「多开需匹配 bridge」

---

## 8. 验收标准（实现后）

- [ ] 同时打开工程 A、B，各自扩展均注册 bridge，端口不同
- [ ] MCP `cwd`/env 指向 A 时，exec 仅在 A 生效；指向 B 时仅在 B 生效
- [ ] `projectPath` 不匹配时返回明确错误，不静默执行
- [ ] 关闭 Creator 后 registry 移除或标记 stale；MCP 报错可理解
- [ ] 单开场景行为与现网兼容（默认仍可用 3921 或等价）

---

## 9. 相关代码索引

| 组件 | 路径 |
|------|------|
| HTTP bridge | `extension/source/main.ts` `startHttpBridge`, `httpPort` |
| MCP 桥 URL | `mcp/context.mjs` `CREATOR_BRIDGE` |
| 执行入口 | `mcp/recipe-registry.mjs` `executeCreatorBody` |
| Health tool | `mcp/core.mjs` `cocosmcp_health` |
| Cursor 安装 | `scripts/install-cursor.mjs` |
| 已知文档 | `skills/scene/cocos-meta-mcp-scene/SKILL.md` |
