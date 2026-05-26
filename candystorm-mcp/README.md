# candystorm-mcp

糖果风暴专用 MCP，**8 个工具**（不引入通用 Cocos 50+ tools）。

| 工具 | 作用 |
|------|------|
| `candystorm_meta_status` | 检查关键 `.meta` 是否齐全 |
| `candystorm_sync_ir` | IR → `ab/candystorm` 复制资源 |
| `candystorm_import_meta` | 拉起 Creator 并等待 meta |
| `candystorm_refresh_meta_in_editor` | Creator 已开时走 HTTP 刷新（需 `fg-candystorm-ir`） |
| `candystorm_genbot_generate` | prefab → genbot 生成 bind / `.gen.ts` / `.view.ts` |
| `candystorm_genbot_status` | 查看 `_genbot` 登记与输出文件是否存在 |
| `candystorm_generate_prefabs` | IR → 写出 `ab/candystorm/prefab/*.prefab` |
| `candystorm_exec` | **仅 Creator**：`Editor.Message` 或 eval 函数体（HTTP `POST /exec`） |

## 安装依赖

```powershell
cd tools/candystorm-mcp
npm install
```

## Cursor 配置

**Settings → MCP → Add server**（或合并到用户 `~/.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "candystorm": {
      "command": "node",
      "args": ["D:/UGit/proj-l-client-candy/tools/candystorm-mcp/index.mjs"],
      "cwd": "D:/UGit/proj-l-client-candy",
      "env": {
        "CANDYSTORM_IR_ROOT": "D:/svn/new_game/糖果风暴客户端资源/export/candystorm_ir"
      }
    }
  }
}
```

路径按本机修改。保存后 **Reload MCP**。

## 推荐流水线（对话里让 AI 顺序调用）

1. `candystorm_sync_ir`（默认 smoke：icon + kuang）
2. 打开 Creator + 启用 `fg-candystorm-ir`
3. `candystorm_refresh_meta_in_editor`（或 `candystorm_import_meta`）
4. `candystorm_meta_status` 确认 `allPresent: true`
5. 在 Creator 保存 prefab 后 → `candystorm_genbot_generate`（见下）

## genbot 绑定生成（prefab 搭好后）

genbot 已作为工程 **git submodule** 安装在 `extensions/genbot`（与 Creator 扩展同源）。首次克隆后执行：

```powershell
git submodule update --init extensions/genbot
```

在 Creator **扩展管理器** 启用 **genbot**（可选，供 `preferEditor` 走编辑器内生成）。

```text
candystorm_genbot_generate
  prefab: db://assets/prefab/candystorm/candystorm_shell.prefab
  regenBind: true   # 首次或节点树大改时
```

输出目录（固定）：

```text
assets/scripts/_genbot/<prefabName>/
  <name>.bind.json
  <name>.gen.ts      # 自动生成，勿手改
  <name>.view.ts     # 仅首次生成，业务可改
```

- **CLI（默认）**：不依赖 Creator，适合 Cursor 刚写完 prefab 文件。
- **preferEditor=true**：Creator 已开且工程已安装 **genbot** 扩展时，走 `POST /genbot-generate`。
- `regenBind` 仅 CLI 支持（覆盖已有 bind 为默认契约）。

## HTTP 桥（Creator 扩展）

`fg-candystorm-ir` 在 `127.0.0.1:3921` 提供：

- `GET /health`
- `POST /refresh-ir-meta`
- `POST /genbot-generate`
- `POST /exec` — `candystorm_exec`（见下）

### candystorm_exec（Creator 内执行，无白名单）

需 Creator 已开且启用 `fg-candystorm-ir`（含 `scene` 脚本）。**不启动子进程、不负责构建**。

| mode | 进程 | 用途 |
|------|------|------|
| `message` | 扩展主进程 | `Editor.Message.request/send` |
| `eval` | 扩展主进程 | 函数体，`Editor` / `path` / `fs` |
| `scene-script` | 场景 | `execute-scene-script`，指定扩展 `name` + `method` |
| `scene-eval` | 场景 | 本扩展 `scene.eval`，函数体可用 `cc` |
| `open-url` | 主进程 | 系统浏览器打开预览 URL（预览服需已开） |

**场景 — 查节点树：**

```json
{ "mode": "scene-eval", "code": "const cc = require('cc'); return cc.director.getScene()?.name" }
```

**场景 — 调其他扩展 scene 方法：**

```json
{
  "mode": "scene-script",
  "name": "fg-tool-man",
  "method": "switch",
  "args": ["<atlas-uuid>", "nodeName"]
}
```

**浏览器预览**（Creator 已开预览服时）：

```json
{ "mode": "open-url" }
```

或指定 `{ "mode": "open-url", "url": "http://127.0.0.1:7456/" }`。

也可用 `message` 调 `server` / `preview` 相关 IPC；`open-url` 只是方便打开系统浏览器。

⚠️ 无白名单，权限等同编辑器 + 场景脚本，仅建议在受信环境使用。

设置 `CANDYSTORM_IR_HTTP=0` 可关闭。
