# 津门风云 · 现场接话自动讨论版

这是「境界计划」的**第二版现场演示工程**，快照日期 **2026-10-11**。观众通过语音或文字提出话题，画面中的角色自动接话并延续讨论，导演台协调选角、场景和大屏气泡。

默认运行实时模式，没有预先准备好的台词或固定讲稿时间线。二维兰亭和三维工程不在本仓库。

**交接给 Agent 开发者，请先读：[Agent 接入交接](docs/AGENT-HANDOFF.md)。**

## 启动

需要 Node.js **24+**（使用内置 SQLite）与 npm。仓库包含图片、人物和场景素材，首次下载需要一些时间。

```sh
git clone https://github.com/sibolees-jpg/jinmen-fengyun-live.git
cd jinmen-fengyun-live
npm ci
npm start
```

- 导演台：<http://127.0.0.1:8899/director.html>
- 大屏：<http://127.0.0.1:8899/index.html>
- macOS 安装 Node 和依赖后，也可双击 `启动实时知识版.command`。
- 端口被其他版本占用时，启动器可能使用相邻端口，以终端打印地址为准。

在导演台「连接与资料」填写自己的 API 凭据，再点击「开始自动讨论」。也可先用文字话题验证回复，再开启麦克风。

## 原有 API

| 用途 | 服务 | 当前接入 |
| --- | --- | --- |
| 观众语音识别 | 豆包 / 火山引擎 Seed ASR | 双向流式 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel` |
| 选角与角色回复 | DeepSeek | `https://api.deepseek.com/chat/completions`，默认模型 `deepseek-flash` |
| 场景、展示、确认记忆 | 本机 Node 服务 | 浏览器不直接持有上游 API 密钥 |

详见 [配置与运行](docs/CONFIGURATION.md)。仓库不含真实密钥、正式对话数据库、日志或本机 Node 二进制；首次运行在被 Git 忽略的 `.runtime/` 建立独立配置与记忆。

## 当前能力

- 全场景选角、两人接话、话题续聊，新现场发言可以替换尚未上屏的旧回复。
- 八角色各自的资料检索、参与者记忆隔离；只有实际呈现的台词写入确认记忆。
- 豆包流式收音，macOS 系统识别作为可选路径。
- 最新气泡避脸：优先放在人物侧边，气泡与长尾避让其他人物脸部。
- 保留场景图片、人物位置、大小、裁剪与气泡编辑配置。

当前由临时 DeepSeek 适配器驱动，尚未接入接手方的独立 Agent。已有接口和待接入的建议在交接文档中分开标明。

## 验证与目录

```sh
npm test
```

默认运行实时讨论、资料/记忆隔离、语音协议、取消旧请求、场景与气泡避脸测试，使用模拟响应，不需真实密钥。2 项需要固定讲稿的气泡测试在实时版明确跳过。详见 [本次交接验证](docs/VALIDATION.md)。

| 路径 | 内容 |
| --- | --- |
| `server.mjs` | HTTP 回复入口、场景与记忆边界 |
| `backend/grounded-reply.mjs` | 选角、逐角色上下文、主要 Agent 接入点 |
| `backend/doubao-speech.mjs` | 豆包流式识别 |
| `live-director.js` / `auto-discussion.js` | 导演台与自动讨论调度 |
| `stage.js` / `dialogue-overlay.js` | 人物、场景和气泡 |
| `show/` | 当前 25 个场景与素材快照，script 为 null |
| `knowledge/` | 角色资料、索引与来源 |

这是源码和素材交接仓库，克隆后本机运行；此次没有部署公网演示服务。第三方资料出处见 `knowledge/sources.json`，图片和资料不因仓库公开而自动获得额外授权。
