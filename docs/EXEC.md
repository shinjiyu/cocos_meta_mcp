# cocosmcp_exec

经 `fg-cocosmcp` → `POST http://127.0.0.1:3921/exec`。

| mode | 进程 |
|------|------|
| `message` / `eval` | 扩展主进程 |
| `scene-script` / `scene-eval` | 场景进程（`scene-eval` → `fg-cocosmcp` / `eval`） |
| `open-url` | 系统浏览器（预览服需已开，默认端口 7456 或 `server.query-port`） |

无白名单。不包含构建、不包含启动 Creator。
