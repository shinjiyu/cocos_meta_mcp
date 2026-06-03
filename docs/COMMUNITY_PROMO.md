# CocosMetaMCP · Cocos 社区宣传方案

> 主打：**会自进化的 Creator MCP** —— 用得越多，Tool 越准、越省 Token。

---

## 一、一句话定位

**CocosMetaMCP**：连接 Cursor 与 Cocos Creator 的 MCP 桥；默认只给 AI 一个入口，常用操作会在工程里**自动沉淀、升格为独立 Tool**，像「长肌肉」一样越用越强。

**Slogan 备选：**

| 方向 | 文案 |
|------|------|
| 自进化 | **用得越多，AI 越懂你的工程** |
| 极简入口 | **一个 exec 起步，常用脚本自动「毕业」成 Tool** |
| 工程资产 | **你的 Creator 工作流，可以进 Git、可以传承** |

推荐主 Slogan：**「会自进化的 Cocos Creator MCP」**

---

## 二、目标受众

| 人群 | 痛点 | 我们解决什么 |
|------|------|----------------|
| 独立 / 小团队开发者 | Cursor 写代码强，改场景/资源弱 | AI 直接在已打开的 Creator 里执行脚本 |
| 有固定工作流的项目 | 每次让 AI 重新猜 eval 脚本，费 Token | 高频脚本 promote 成 `cocosmcp_r_*`，一次注册长期复用 |
| 技术向主程 | 扩展 Editor API 成本高 | npm 一键装扩展 + MCP，Recipe 可团队共享 |
| AI 尝鲜用户 | MCP Tool 列表爆炸 | 默认 **1 个 Core Tool**，按需进化 |

---

## 三、核心卖点（按优先级）

### 1. 自进化 Recipe（差异化，重点讲）

```text
Day 1   只有 cocosmcp_exec → AI 在 Creator 里「探路」
Day N   exec 审计 → 发现高频脚本 → 注册 Recipe
        → promote 为 cocosmcp_r_xxx → Cursor Tool 列表自动刷新
```

- **不是**固定死的一百个 Tool，而是**跟着项目长出来**的能力
- Recipe / 审计日志在 `{工程}/.cocosmcp/`，**可提交 Git**，团队共用
- 不常用可 demote，避免 Tool 列表膨胀

### 2. 真·编辑器内执行

- Creator 扩展 **cocos-meta-mcp**（项目级，符合 3.8 官方路径）
- HTTP 桥 `127.0.0.1:3921`，主进程 / 场景进程 / 打开预览均可
- 不是外挂改文件，是**在你已打开的工程里**跑

### 3. 安装简单

```bash
npm install -g cocos-meta-mcp
cd 你的Cocos工程
cocos-meta-mcp setup
```

- 自动写 Cursor MCP 配置 + 装 Creator 扩展
- 默认带 **asset-meta / asset-sync** 资源插件

### 4. 开源 + npm

- GitHub：https://github.com/shinjiyu/cocos_meta_mcp  
- npm：`cocos-meta-mcp`  
- MIT，可二次开发

---

## 四、社区发帖模板（论坛 / /cocos 中文社区）

### 标题备选

1. **【开源】CocosMetaMCP：会自进化的 Creator MCP，常用脚本自动升格为 AI Tool**
2. **用 Cursor 驱动 Cocos Creator？这个 MCP 会跟着你的工程一起「长大」**
3. **从 1 个 Tool 到专属工作流：Cocos Creator + MCP 自进化实践**

### 正文（可直接发，约 800 字）

---

大家好，分享一个我们用在 Cocos Creator 3.8 上的 MCP 项目：**CocosMetaMCP**。

**它解决什么问题？**

很多同学习惯用 Cursor 写 TS，但改场景、刷 meta、跑 Editor 脚本还是要切回 Creator。通用 MCP 要么 Tool 太多 AI 选不准，要么只有几个固定接口不够用。

CocosMetaMCP 的思路是：**默认只暴露一个 `cocosmcp_exec`**，让 AI 在你**已经打开的 Creator 工程**里执行脚本（通过项目扩展 HTTP 桥）。用得多了，系统会根据审计日志发现高频操作，把脚本**注册成 Recipe**，再 **promote 成独立 MCP Tool**（`cocosmcp_r_xxx`），Cursor 会自动刷新 Tool 列表。

也就是说：**工作流是「长」在项目里的，不是写死在服务器上的。** Recipe 存在 `{工程}/.cocosmcp/`，可以进 Git，团队能共享。

**自进化流程示意：**

```
cocosmcp_exec 探索
    → exec 统计找高频脚本
    → register_recipe 保存
    → promote_recipe 升格为一级 Tool
```

**安装（3 步）：**

1. `npm install -g cocos-meta-mcp`
2. 在工程目录：`cocos-meta-mcp setup`
3. Creator 扩展管理器 → **项目** → 启用 **cocos-meta-mcp**，重启 Cursor

**还支持：**

- 资源插件：asset-meta、asset-sync（npm 自带）
- Recipe 层 + 插件管理（`COCOSMCP_RECIPE_LAYER=2`）
- 官方 3.8 项目扩展安装方式

仓库：https://github.com/shinjiyu/cocos_meta_mcp  
npm：`npm i -g cocos-meta-mcp`

欢迎 Star、Issue 和 PR。如果你也在用 Cursor + Creator，想一起打磨「AI 原生工作流」，很期待交流。

---

## 五、短视频 / 直播脚本（3～5 分钟）

| 时间 | 画面 | 旁白要点 |
|------|------|----------|
| 0:00 | Cursor + Creator 同屏 | 「AI 能写代码，为什么不能直接帮你点 Creator？」 |
| 0:30 | 终端 `cocos-meta-mcp setup` | 「一行命令，MCP + 扩展都装好」 |
| 1:00 | Creator 启用扩展，控制台 3921 | 「桥接就绪，AI 可以 exec 了」 |
| 1:30 | Cursor 调 `cocosmcp_exec` 改场景/刷资源 | 「默认只有一个入口，先探路」 |
| 2:30 | 展示 `.cocosmcp/recipes/`、promote 后 Tool 列表变长 | 「常用脚本自动『毕业』，不用每次重新描述」 |
| 3:30 | Git 提交 `.cocosmcp` | 「工作流跟着工程走，团队能复用」 |
| 4:00 | GitHub + npm 二维码/链接 | 「开源 MIT，欢迎试用」 |

**结尾金句：**「不是给 AI 一百个按钮，而是让 AI 在你的项目里，自己长出最需要的那几个。」

---

## 六、图文长文提纲（公众号 / 知乎）

1. **引子**：MCP 火了，游戏引擎为什么还「接不上」？  
2. **痛点**：Tool 爆炸 vs 只有 exec 太裸  
3. **方案**：分层架构 L0 Core → L1 Recipe → L2 Promote  
4. **自进化案例**（虚构但可信）：  
   - 例：每天查 project.log 尾部 → 注册 `tail_console_log` → promote  
   - 例：批量刷新 IR meta → 先用 exec 试，稳定后 promote  
5. **安装与插件**（链到 PLUGINS.md）  
6. **与 DaxianLee 等通用方案的差异**（可选，一句：专注 Creator 工程内执行 + 自进化，不是通用编辑器替代）  
7. **展望**：Recipe 市场、团队模板库  
8. **链接 + 呼吁反馈**

---

## 七、视觉 / 素材建议

| 素材 | 说明 |
|------|------|
| 架构图 | Creator ↔ HTTP 桥 ↔ MCP ↔ Cursor；旁路 `.cocosmcp` 自进化环 |
| 对比表 | 传统 MCP（固定 Tool） vs CocosMetaMCP（自进化） |
| 终端录屏 | setup 30 秒 + exec 成功 |
| Tool 列表前后对比 | promote 前 1 个 / 后 N 个 |
| README 小猫鱼 ASCII | 社区帖头图可做成简单 banner（可选） |

---

## 八、发布渠道与节奏

| 渠道 | 形式 | 建议时间 |
|------|------|----------|
| Cocos 中文社区 / 论坛 | 发帖模板第四节 | 首周 |
| GitHub Release Note | v2.1.x 亮点 + 自进化 | 与版本同步 |
| npm 包描述 | 首段写自进化 + 安装命令 | 已发布可更新 readme |
| 技术 QQ / 微信群 | 短文案 + 链接 | 配合发帖 |
| B站 / 抖音 | 第五节脚本 | 有二测稳定录屏后 |
| 知乎 / 公众号 | 第六节长文 | 积累 2～3 个真实 Recipe 案例后 |

**首周 KPI（可自评）：** Star 数、Issue 数、npm 周下载、社区帖回复质量。

---

## 九、FAQ（评论区预埋）

**Q：和直接用 Cursor 改工程文件有什么区别？**  
A：走 Creator 进程，资源 DB、场景、扩展 API 行为与手动操作一致，适合 meta、刷新、场景脚本。

**Q：Tool 会不会越来越多？**  
A：可以 demote / unregister；设计上是「先一个 exec，按需长大」，不是一次性灌满。

**Q：3.7 / 3.8 都支持吗？**  
A：扩展按 3.8 项目扩展方式安装；插件 tool 名带版本 slug，见文档。

**Q：不用 Cursor 行吗？**  
A：任意支持 MCP stdio 的客户端均可，Cursor 配置最省事。

**Q：安全吗？**  
A：桥接默认本机 127.0.0.1；exec 权限等于你在 Creator 里跑脚本，生产环境自行评估。

---

## 十、链接清单（发布时统一带上）

- 仓库：https://github.com/shinjiyu/cocos_meta_mcp  
- npm：https://www.npmjs.com/package/cocos-meta-mcp  
- 安装：`npm i -g cocos-meta-mcp && cocos-meta-mcp setup`  
- 插件文档：仓库内 `docs/PLUGINS.md`  
- Recipe / 自进化：`docs/RECIPES.md`

---

## 十一、后续可做的「自进化」故事线（续更用）

1. **Week 2**：晒第一个 promote 的真实 Recipe（脱敏）  
2. **Week 3**：团队把 `.cocosmcp` 进 Git 的协作体验  
3. **Week 4**：对比 promote 前后 Token / 任务成功率（若有数据）  

用连续叙事强化「自进化」不是 PPT 概念，是日常开发里长出来的。
