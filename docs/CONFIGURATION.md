# 配置与运行

## 启动方式

安装 Node.js 24+，执行 `npm ci`、`npm start`，打开 8899 端口的 `/director.html` 和 `/index.html`。

`npm start` → `scripts/start-knowledge.mjs`，自动设置 `REALTIME_ONLY=1`、`CHARACTER_KNOWLEDGE=1`、`DISCUSSION_TEST_MODE=0`。不要直接运行 `node server.mjs` 代替，否则未设置模式会进入旧运行路径。独立预览可用 `PORT=18999 npm start`。

服务绑定 `127.0.0.1` 并检查同源请求。当前没有公网用户账号/权限部署方案；远端 Agent 应由本机后端调用。

## DeepSeek

- 原有模型服务：`https://api.deepseek.com/chat/completions`。
- 默认模型 `deepseek-flash`，接手者应使用自己账户可用的模型。
- JSON 输出、`thinking: {type: "disabled"}`、非流式角色回复；与豆包音频流是独立链路。
- 在导演台「连接与资料」填写自己的 API Key，保存在 `.runtime/config.json`。
- 支持环境变量 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`。程序不自动读取 `.env`，请先设置终端环境再启动。

## 豆包 / 火山引擎语音识别

- 双向流式地址：`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`。
- 默认资源：`volc.seedasr.sauc.duration`，需要自己的账户开通相应权限。
- 新认证为 `X-Api-Key`，同时发送资源 ID 和每次独立的 `X-Api-Connect-Id`；兼容旧 App ID / Access Token 认证。
- 上游音频为单声道 16 kHz、16 位 PCM；协议封装在 `backend/doubao-protocol.mjs`。
- 导演台配置存到 `.runtime/doubao.json`；环境变量支持 `DOUBAO_ASR_API_KEY`、`DOUBAO_ASR_RESOURCE_ID`，旧认证为 `DOUBAO_ASR_APP_ID`、`DOUBAO_ASR_ACCESS_TOKEN`。
- 浏览器首次收音需要麦克风授权。这是识别观众说话，不是人物语音合成。

历史的 `/api/v3/auc/bigmodel/submit` 是录音文件识别，不是当前现场收音入口；不要把 `volc.seedasr.auc` 用于上述流式连接。

## 配置与记忆

首次运行复制 `show/scenes.json`、`show/script.json` 和 `show/scene-assets/` 到 `.runtime/`；密钥和 `discussion-memory.sqlite` 留在本机。此仓库没有正式对话记录。

后续协作保存场景可执行 `npm run show:save`，检查后提交 `show/`，不要提交 `.runtime/`。记忆库迁移应使用 SQLite backup 保持一致性，运行时不能只拷主文件而漏掉 WAL。

`npm test` 使用模拟模型/语音响应，不调用付费 API。正式演示前需在实际电脑确认收音权限、API 账户权限与延迟。没有密钥时网页和素材仍可启动，但不会有真实模型回复。
