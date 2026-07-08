---
name: cocos-meta-mcp-scene
description: >-
  通过 cocos-meta-mcp 在 Cocos Creator 中创建/修改 .scene，避免保存弹窗与 dirty 冲突。
  使用时机：MCP 创建场景、复制 scene 模板、对比测试场景、cocosmcp_exec、Editor.Message scene API、
  save-scene 无弹窗保存、磁盘写 scene、refresh-asset。
---

# Cocos Meta MCP — 场景创建

## 前置条件

1. 工程已安装 `extensions/cocos-meta-mcp/`（[cocos_meta_mcp](https://github.com/shinjiyu/cocos_meta_mcp)）
2. Creator 已打开**当前工程**，控制台有 `MCP HTTP bridge http://127.0.0.1:3921`
3. Cursor 已配置 `mcp.json` → `cocosmcp`，`cwd` 指向本工程

验证连接：`cocosmcp_exec` + `GET /health` 或 `mode: eval` 返回 `Editor.Project.path`。

**多开 Creator 的端口解析**：3921 只是**首个**实例的默认端口，多开工程时每个实例端口不同，硬编码 3921 会连错工程、混命令。

- **MCP 侧（首选）**：`cocosmcp_list_bridges` 列出所有实例；`cocosmcp_exec` / `cocosmcp_use_project` 传正确 `projectRoot`，校验失败会报 mismatch。
- **脚本侧（兜底）**：端口注册表 `%LOCALAPPDATA%/cocos-meta-mcp/instances.json`（Windows），键为工程根路径（小写、正斜杠归一），值含 `port` / `projectPath`。
- 连接后**务必**用 `/health` 的 `projectPath` 校验是不是目标工程。

```javascript
// Node 脚本侧：按工程路径解析端口（不经 MCP 时）
const reg = JSON.parse(fs.readFileSync(
  path.join(process.env.LOCALAPPDATA, 'cocos-meta-mcp', 'instances.json'), 'utf8'));
const key = path.resolve(project).replace(/\\/g, '/').toLowerCase();
const port = reg.instances?.[key]?.port ?? 3921;
```

---

## 核心原则（避免保存弹窗）

Creator 弹窗条件：**当前 scene 为 dirty 时切换/关闭**。

| 做法 | 说明 |
|------|------|
| **磁盘优先** | 用 `fs.copyFileSync` / PowerShell 复制 `.scene`，Editor 未参与 → 无 dirty |
| **API 静默保存** | 必须用 `Editor.Message.request('scene', 'save-scene')`，不依赖 UI |
| **改完即存** | 任何 `create-node` / `set-property` 后立刻 `save-scene` |
| **切换前存** | `open-scene` 前先对当前 scene 执行 `save-scene`（或确认无未保存修改） |
| **勿双写** | 不要在 Editor 已打开某 scene 时又从外部改同一份 `.scene` 文件 |

**禁止**：

- 仅 `open-scene` + 改节点但不 `save-scene`
- 在 dirty 的主场景上直接切场景
- **人工手改** `.scene` JSON（凭手感调 `__id__`/嵌套 → 错位 → `Open scene failed`）
- **message 模式** + 数组 args 调 `create-node` / `create-component`（常 200 但不生效，见 Skill `creator-scene-editing`）

> 例外：**程序化定向补丁**（按 `__id__` 索引解析后只改指定字段，如 SpriteFrame 引用、UITransform 尺寸）不在此列——它可控、幂等，是 Editor API 不落盘时的正当兜底。约束见下方「工作流 D」。人工凭手感改 JSON 才是被禁止的。

---

## 推荐工作流

### A. 新建测试场景（首选：纯磁盘）

适用：结构简单，逻辑在 TS 运行时构建。

```
1. 选工程内已有模板 scene（如 assets/scene/test/Template.scene）
2. 复制 + 文本替换（scene 名、资源路径、脚本 __type__）
3. 若目标无 .meta → 生成新 uuid 的 .meta
4. Creator 中 refresh-asset；手动 open 新 scene
```

本 skill 附带脚本（`-RepoRoot` 指向 Cocos 工程根）：

```powershell
skills/scene/cocos-meta-mcp-scene/scripts/new-scene-from-template.ps1 `
  -RepoRoot D:\path\to\your-cocos-project `
  -TemplateScene assets/scene/test/Template.scene `
  -DestScene assets/scene/test/MyTest.scene `
  -Replace @{ 'Template' = 'MyTest'; 'test/template/manifest' = 'test/my_test/manifest' }
```

可选脚本组件 uuid 替换：`-ScriptFromType <compressed>` `-ScriptToType <compressed>`。

### B. 需在 Editor 内挂节点/组件（MCP eval）

适用：首次从模板搭节点树、绑定 `@property`。

```javascript
// cocosmcp_exec mode: eval
const url = 'db://assets/scene/test/MyTest.scene';
const rel = 'assets/scene/test/MyTest.scene';
const abs = path.join(Editor.Project.path, rel);
const templateRel = 'assets/scene/test/Template.scene'; // 换成你的模板

// 1. 磁盘创建（若不存在）
if (!fs.existsSync(abs)) {
  fs.copyFileSync(path.join(Editor.Project.path, templateRel), abs);
  await Editor.Message.request('asset-db', 'refresh-asset', url);
}

// 2. 切换前保存当前 scene
try { await Editor.Message.request('scene', 'save-scene'); } catch (_) {}

// 3. 打开
const info = await Editor.Message.request('asset-db', 'query-asset-info', url);
await Editor.Message.request('scene', 'open-scene', info.uuid);

// 4. 查节点 → 创建 → 绑组件 → 设属性
const tree = await Editor.Message.request('scene', 'query-node-tree');
// ... find Canvas uuid ...
const node = await Editor.Message.request('scene', 'create-node', {
  parent: canvasUuid, name: 'MyRoot',
});
const comp = await Editor.Message.request('scene', 'create-component', {
  uuid: node,
  component: 'MyTestScript', // 或脚本 .meta 的压缩 uuid
});
await Editor.Message.request('scene', 'set-property', {
  uuid: comp, path: 'someProperty',
  dump: { type: 'cc.Node', value: { uuid: childUuid } },
});

// 5. 必须静默保存
await Editor.Message.request('scene', 'save-scene');
return { ok: true };
```

### C. 脚本组件 uuid

`.scene` 里 `__type__` 需**压缩 uuid**（非 .meta 里的标准 uuid）。

- 从 `assets/scripts/.../MyScript.ts.meta` 读取 `uuid`
- 在 Creator eval 中：`Editor.Utils.UUID.compressUUID(meta.uuid, false)`
- 或参考同工程已有 scene 中同类组件的 `__type__` 字符串

### D. 外部数据批量重建（大规模，eval + 磁盘补丁）

适用：从**外部数据源**（如运行时快照、导出的节点表）批量重建成百上千节点。
本工作流是 **P（本 skill）+ S（外部读取源）的编排**，不是「更强的建场景能力」；
外部读取（S）与快照格式属于**消费方工程**，本 skill 只沉淀 P 侧在大规模下暴露的
Editor API 约束与对策。

小规模用工作流 B 即可；下列约束**仅在批量场景下才明显**：

| 约束 | 现象 | 对策 |
|------|------|------|
| `set-property` 不落盘 | 绑 SpriteFrame / UITransform 后磁盘 `.scene` 里没写入 | 建树走 eval，**引用类字段用程序化定向补丁**写盘（见上方「例外」）|
| 重复挂 UITransform 报错 | `create-node` 已自带 `cc.UITransform`，再 `create-component cc.UITransform` 刷屏报错 | 只 `set-property` 改 `contentSize`/`anchorPoint`，**不要**再 create |
| 补丁被内存覆盖 | 补丁写盘后若在 Creator 内 `save-scene`，内存旧状态回写覆盖补丁 | 补丁阶段**故意不 `save-scene`**；完成后「关闭场景选**不保存**」→ 重新打开 |
| 零尺寸被吞 | `0×56`、`0×0` 是合法尺寸，`if (w && h)` 会漏写 | 判 `Number.isFinite`，不要用真值判断跳过 |

**反直觉但关键**：常规工作流「改完即存」；批量重建的**磁盘补丁阶段恰恰相反——先不存，靠「不保存关闭 + 重开」让 Editor 读磁盘**。二者不冲突，取决于当前是「Editor 内编辑」还是「外部补丁写盘」。

> S 侧读取、快照 schema、纹理导出/绑定等属于具体工程，应在**消费方工程自己的 skill**里描述（如「Inspector 快照 → Creator 场景」），本 skill 不纳入。

---

## 新 scene 的 .meta 模板

目标路径无 `.meta` 时必须新建（**不可复制模板 .meta**，uuid 会冲突）：

```json
{
  "ver": "1.1.50",
  "importer": "scene",
  "imported": true,
  "uuid": "<新生成的 guid>",
  "files": [".json"],
  "subMetas": {},
  "userData": {}
}
```

PowerShell：`[guid]::NewGuid().ToString()`。写入 UTF-8 无 BOM。

---

## 测试场景设计模式（通用）

1. **Scene 壳**：Canvas + 单脚本 + 空根节点；隐藏模板遗留 UI（如 `UI_root.active = false`）
2. **内容运行时加载**：`resources.load(...)` → 动态创建节点
3. **manifest 驱动**（可选）：`assets/resources/test/<name>/manifest.json`

业务专有对比场景（ASTC/Spine 等）留在工程 `.agents/skills/`。

---

## MCP 工具速查

| 工具 | 用途 |
|------|------|
| `cocosmcp_list_bridges` | 列出多开 Creator 实例与端口 |
| `cocosmcp_use_project` | 切换当前 MCP 目标工程 |
| `cocosmcp_exec` mode=`eval` | 主进程：fs、Editor.Message、open-scene、save-scene |
| `cocosmcp_exec` mode=`message` | 等价 `Editor.Message.request(module, method, ...args)` |
| `cocosmcp_exec` mode=`open-url` | 打开预览 |
| `cocosmcp_exec` mode=`scene-eval` | 场景进程脚本（改组件运行时逻辑时用） |

常用 scene API：`open-scene`、`save-scene`、`query-node-tree`、`create-node`、`create-component`、`set-property`、`remove-node`。

常用 asset API：`refresh-asset`、`query-asset-info`、`reimport-asset`。

---

## 排查清单

| 现象 | 检查 |
|------|------|
| 保存弹窗 | 当前 scene dirty？补 `save-scene` 或改用磁盘流程 |
| MCP 改错工程 | `cocosmcp_list_bridges` + 正确 `projectRoot`；脚本侧查 `instances.json`；校验 `/health` 的 projectPath |
| 场景黑屏 | 脚本 __type__ 错误；Camera/Layer 配置 |
| 组件未绑定 | scene 内 `@property` 未 set-property；批量时 set-property 可能不落盘 → 程序化定向补丁 |
| 磁盘补丁丢失 | 补丁后在 Creator `save-scene` 覆盖了磁盘 → 改为「不保存关闭 → 重开」 |
| 纹理被 re-trim | 补丁纹理 `.meta`（如 `trimType:none`）后又 `refresh-asset` → Creator 重新 auto-trim；补丁后勿 refresh 该 PNG |
| UITransform 报错刷屏 | 对 `create-node` 已自带的 `cc.UITransform` 重复 `create-component` → 改为只 set-property |
| uuid 冲突 | 复制 scene 时连同 .meta 一起复制 |

---

## 附加资源

- 模板复制脚本：[scripts/new-scene-from-template.ps1](scripts/new-scene-from-template.ps1)
- MCP eval 片段：[references/mcp-snippets.md](references/mcp-snippets.md)
- 编辑原则：Skill `creator-scene-editing`
