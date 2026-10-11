# 交接工作约定

- 本仓库为「津门风云」第二版：现场接话与自动讨论。先读 README.md、docs/AGENT-HANDOFF.md、docs/CONFIGURATION.md。
- npm start 进入 REALTIME_ONLY 模式；show/script.json 的 script 保持 null。不要为旧剧本测试恢复固定台词。
- 保留场景、人物位置、大小、裁剪和气泡配置。气泡及长尾继续避开其他人物脸部。
- 密钥只保存在本机环境变量或 .runtime；真实对话、数据库和日志不得提交。
- 外部 Agent 的内部思考不能进入公开台词，未确认呈现的草稿不写成事实，新参与者不继承旧组私聊。
- npm test 使用模拟响应，不调用付费模型。新适配器先验证取消、超时、错误 ID 与记忆隔离。
- 二维兰亭、三维、固定剧本演讲版及旧庭院不在此任务范围。
