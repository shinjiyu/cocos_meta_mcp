# 应用 Skills 部署规范（App Skills Deployment Spec）

> 状态：设计稿，待实现。
> 本文定义 **第三方应用**（基于 meta-mcp 平台的 Creator 扩展，如 viewweaver）
> 如何声明、打包、部署自己的 Cursor Agent Skills。
> 规范刻意写成**宿主无关**：cocos-meta-mcp 是参考实现，
> ae-meta-mcp / ps-meta-mcp 等平台实例可原样采用。

## 1. 背景与目标

平台哲学：**功能成长由 skill 实现**。平台（meta-mcp）只提供 eval 通道 +
自带一组宿主通用 skill；应用的领域能力通过"宿主侧扩展 + 一份 skill"接入，
skill 就是应用对平台的**适配层**。

本规范要解决的问题：

1. 应用的 skill 放在哪、长什么样（存放格式）；
2. 应用如何声明自己依赖的平台版本（声明规范）；
3. skill 如何安装进 Cursor、如何卸载、如何升级（部署协议）；
4. 如何防止"skill 引用了应用内部实现，应用一重构 skill 就烂掉"（内容红线）。

依赖方向必须是单向无环的：

```text
应用 SKILL.md ──只引用──▶ 应用自己的宿主侧 API + 平台通道 ABI（版本化）
应用 extension ──注册到──▶ 平台（平台对应用零感知）
```

## 2. 术语

| 术语 | 含义 |
|------|------|
| **平台** | meta-mcp 实例（cocos-meta-mcp / ae-meta-mcp / …），提供 exec 通道 + 平台 skill |
| **应用（App）** | 基于平台的领域能力包：宿主侧扩展 + agent 资产（skills、recipes） |
| **通道 ABI** | 平台对下游承诺的稳定面：exec 各模式语义、health 字段、recipe 机制。以 semver 版本化 |
| **agent 资产** | 应用仓库中面向 Cursor Agent 的部分：`agent-manifest.json` + `skills/` |

## 3. 应用仓库目录约定

```text
<app-repo>/
  agent-manifest.json        # 必须：应用向平台的自我声明（见 §4）
  skills/                    # 必须：应用的 skill，一个子目录一个 skill
    <skill-name>/
      SKILL.md               # 必须：主文档（front-matter 见 §5）
      reference.md           # 可选：边角案例
      scripts/               # 可选：skill 引用的辅助脚本
  extension/                 # 应用的 Creator（宿主）扩展本体，结构不限
```

约束：

- `skill-name` 必须以应用名为前缀（如 `viewweaver-generate`、`viewweaver-bind-audit`），
  避免安装进 `~/.cursor/skills/` 后与其它来源撞名。
- 一个应用可以带多份 skill；建议一份"主 workflow"+ 若干专题。

## 4. agent-manifest.json

应用仓库根目录，声明"我是谁、我带哪些 skill、我需要什么平台"。

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/shinjiyu/cocos_meta_mcp/main/docs/schema/agent-manifest.schema.json",
  "manifestVersion": 1,
  "provider": "viewweaver",            // 应用 id（唯一，小写 kebab-case）
  "version": "0.2.0",                  // 应用版本（与 extension 同步）
  "host": "cocos",                     // 宿主：cocos | ae | ps …
  "requires": {
    "channelAbi": ">=2.0 <3.0",        // 平台通道 ABI 版本（semver range）
    "hostVersion": ">=3.8"             // 可选：宿主 App 版本约束
  },
  "skills": [
    {
      "name": "viewweaver-generate",   // 与 skills/ 子目录同名
      "path": "skills/viewweaver-generate",
      "description": "prefab → 强类型 View 绑定代码生成工作流"
    }
  ]
}
```

实现要求：

- 平台仓库提供 JSON Schema（`docs/schema/agent-manifest.schema.json`），
  安装器校验 manifest 合法性后才执行安装。
- `provider` 是卸载/升级的主键。

## 5. SKILL.md front-matter 扩展字段

在 Cursor 标准字段（`name`、`description`）之上，应用 skill 必须补充：

```yaml
---
name: viewweaver-generate
description: >-
  （照 Cursor 惯例写触发词导向的描述）
# ↓ 平台扩展字段
provider: viewweaver          # 归属应用，与 manifest.provider 一致
host: cocos                   # 宿主
requires:
  channelAbi: ">=2.0 <3.0"    # 与 manifest 一致（skill 单独被人工拷贝时仍可自描述）
uses-skills:                  # 依赖的平台通用 skill（引用而非复述）
  - cocos-meta-mcp-recipes
---
```

Agent 侧约定：skill 正文开头应指示"先调 health 确认平台在线且版本满足
`requires.channelAbi`；通道未就绪时按 `uses-skills` 列出的平台 skill 排障"。

## 6. 内容红线（规范中最重要的部分）

应用 skill 的正文必须遵守：

1. **eval 片段只准调用应用自己的宿主侧 API**
   （如 `Editor.Message.request('viewweaver', 'generate', …)`），
   禁止直接够平台内部对象或宿主未公开接口。
   目的：应用内部重构时，message handler、recipe、SKILL.md 在同一仓库同一 PR
   内原子更新，skill 永不与实现失配。
2. **通道知识一律引用平台 skill，不得复述**（连接、注册 recipe、排障
   属于 `cocos-meta-mcp-recipes` 等平台 skill 的职责），避免双份文档漂移。
3. 必须包含 **验收清单** 与 **Troubleshooting** 段（对齐平台现有 skill 风格）。
4. 不得包含使用方工程的专有路径/资产名（业务专有 workflow 留在业务仓库
   `.cursor/skills/` 或 `.agents/skills/`，参见 `skills/registry.md` 的排除表）。
5. **必须引用平台的 git 与文档**：使用 meta-mcp 的项目（应用仓库 README 及主 SKILL.md）
   必须标注所依赖的平台 git 仓库与文档入口——
   cocos-meta-mcp 为 <https://github.com/shinjiyu/cocos_meta_mcp>（文档在 `docs/`，
   通道 ABI 见 `docs/CHANNEL_ABI.md`，安装见 `docs/INSTALL.md`）。
   禁止把平台文档复制进应用仓库维护副本；一律链接引用，随平台版本升级只改 semver 声明。

## 7. 安装 / 卸载 / 升级协议

平台以 CLI 子命令交付（建议挂在现有 bin 下）：

```bash
# 从本地目录 / npm 包 / git url 安装应用的 agent 资产
cocosmcp-skills install <dir|package|git-url> [--scope user|project]

# 卸载（按 provider 清理）
cocosmcp-skills uninstall <provider> [--scope user|project]

# 列出已安装应用及版本
cocosmcp-skills list
```

行为定义：

| 步骤 | 要求 |
|------|------|
| 解析 | 读 `agent-manifest.json`，Schema 校验失败即中止 |
| 版本检查 | 对当前平台版本（`health.channelAbi`，见 §8）跑 semver 匹配；不满足时警告并要求 `--force` |
| 落盘 | `--scope user` → `~/.cursor/skills/<skill-name>/`；`--scope project` → `<工程>/.cursor/skills/<skill-name>/` |
| 记账 | 写 `~/.cursor/skills/.meta-mcp-apps.json`（lockfile）：provider → { version, skills[], installedAt, scope }，卸载/升级据此清理 |
| 升级 | 同 provider 再次 install：比较 version，覆盖旧 skill，清理 lockfile 中已不存在的 skill |
| 卸载 | 按 lockfile 删除该 provider 的全部 skill 目录及记账条目 |

注意：安装器**只管 skill 落盘**。应用的宿主侧扩展安装、recipe 注册由应用自己的
安装文档/脚本负责（通常在 skill 正文里指导 Agent 用 `register_recipe` 完成）。

## 8. 平台侧配套改动

1. **health 增加 `channelAbi` 字段**（semver 字符串）。现有 health 已回报
   `cocosCreatorVersion` 等，补一个通道 ABI 版本作为下游 skill 的匹配锚点。
2. **通道 ABI 文档化**：`docs/CHANNEL_ABI.md`，明确对下游承诺哪些东西
   （exec 各模式语义与沙箱内容、health 字段、recipe 注册协议），
   破坏性变更须升主版本。
3. `skills/registry.md` 增加"应用 skills"一节，登记已知第三方应用
   （名字 + 仓库链接即可，不收内容）。
4. 提供 `docs/schema/agent-manifest.schema.json`。

## 9. 参考接入示例（viewweaver）

```text
viewweaver/
  agent-manifest.json                    # provider=viewweaver, requires.channelAbi >=2.0
  extension/                             # Creator 扩展：contributions.messages 暴露
    package.json                         #   generate / status / check 三个 message
  skills/
    viewweaver-generate/SKILL.md         # 工作流：bind.json → gen.ts → view.ts → 运行时 bind
```

接入动作（应用作者视角）：

1. 照 §3 摆目录、照 §4 写 manifest、照 §5/§6 写 skill；
2. 用户侧执行 `cocosmcp-skills install viewweaver`（或本地目录）；
3. Cursor Agent 在下次会话中即可按 skill 驱动应用。

平台零改动——这是本规范的验收标准之一。

## 10. 实现验收清单

- [ ] `agent-manifest.schema.json` 落库，schema 校验有单测
- [ ] `cocosmcp-skills install/uninstall/list` 三命令可用（user/project 两 scope）
- [ ] lockfile 记账正确：重复安装幂等、升级清孤儿、卸载不误删他人 skill
- [ ] health 回报 `channelAbi`；`docs/CHANNEL_ABI.md` 成文
- [ ] 用一个最小示例应用（可用 `examples/` 下造一个假 app）走通 install → list → uninstall
- [ ] README / SKILLS.md 交叉链接本文档
