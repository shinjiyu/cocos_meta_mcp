# MCP eval 片段

通过 `cocosmcp_exec`，`mode: "eval"`，`code` 字段填入下列函数体（不含外层 async function）。

## 压缩脚本 uuid

```javascript
const metaPath = path.join(Editor.Project.path, 'assets/scripts/test/MyScript.ts.meta');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const compressed = Editor.Utils.UUID.compressUUID(meta.uuid, false);
return { uuid: meta.uuid, compressed };
```

## 刷新单个 scene 资源

```javascript
const url = 'db://assets/scene/test/MyTest.scene';
await Editor.Message.request('asset-db', 'refresh-asset', url);
return { refreshed: url };
```

## 查找节点 uuid

```javascript
const tree = await Editor.Message.request('scene', 'query-node-tree');
function find(node, name) {
  if (node.name === name) return node;
  for (const c of node.children || []) {
    const hit = find(c, name);
    if (hit) return hit;
  }
  return null;
}
const canvas = find(tree, 'Canvas');
return { canvasUuid: canvas?.uuid, names: (tree.children || []).map(n => n.name) };
```

## 安全切换场景

```javascript
const target = 'db://assets/scene/test/MyTest.scene';
try { await Editor.Message.request('scene', 'save-scene'); } catch (_) {}
const info = await Editor.Message.request('asset-db', 'query-asset-info', target);
await Editor.Message.request('scene', 'open-scene', info.uuid);
return { opened: target };
```

## 隐藏模板 UI

```javascript
const tree = await Editor.Message.request('scene', 'query-node-tree');
function find(node, name) {
  if (node.name === name) return node;
  for (const c of node.children || []) {
    const hit = find(c, name);
    if (hit) return hit;
  }
  return null;
}
const ui = find(tree, 'UI_root');
if (ui) {
  await Editor.Message.request('scene', 'set-property', {
    uuid: ui.uuid, path: 'active', dump: { value: false },
  });
}
await Editor.Message.request('scene', 'save-scene');
return { uiHidden: !!ui };
```

## 打开预览

`cocosmcp_exec` → `mode: "open-url"`（无需 code）。
