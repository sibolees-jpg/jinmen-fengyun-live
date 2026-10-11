# 八角色资料库 · knowledge-20260927-v1

用户已授权由项目选材并直接接入。此目录是独立实时知识版的可搬运资料包，不修改已封存的演讲终版。

- `profiles.json`：8 位人物的视角、口吻、边界和经典归属，保留原 actor ID；不含伽利略。
- `sources.json`：已入库来源、作者/编译者、选取范围、URL、日期、正文 SHA-256。
- `texts/`：公版经典原文或选章；4 份当代材料是标明身份的项目摘要，非原报告全文。
- `study-cards.json`：与原文绑定的项目解读及中英主题词；不是历史引语。
- `index.json`：1,926 个正文片段，含来源 ID 与原文本字符偏移。`manifest.json` 保存版本及索引校验值。
- `candidates.json`：原候选与实际接入状态。未核定的书信、现代版权书全文和新艺科资料未混入。

接话链路：当前发言 → 点名或模型选角 → 本人资料检索 → 本人独立短答 → 校验 → 现有气泡。

检索采用本地词项匹配、主题卡与中英查询扩展，不调用在线向量服务。参考段落属于非指令数据。每次只发送少量相关资料，返回的 `knowledge.roles` 记录给过哪些段落、模型报告引用哪些段落。引用 ID 校验只保证来源归属，不能自动证明生成句子的每个事实；上线排练仍须人工评阅。

资料加入方法：

1. 确定作者、版本、访问来源及实际入库范围，写入 `sources.json`。角色经典填写唯一 `actorId`；现代资料使用 `scope: shared` 并明确为摘要。
2. 经典下载用 `HTTPS_PROXY=... node scripts/import-classics.mjs`（可不设置代理）。不在演出中自动下载。缓存位于忽略目录 `tmp/knowledge-import/`；更换来源时先移除相应缓存。导入必须检查输出开头、末尾和抽样段落，剔除网站导航、编者导言及乱码。
3. 项目自写摘要直接写入 `texts/`，同时更新该来源的 `characters` 和 `sha256`。新增主题卡必须关联已启用来源，不得把解读标成作者原话。
4. 运行 `node scripts/build-knowledge.mjs`，检查作者覆盖、校验值和生成统计；再运行 `node --test tests/character-knowledge.test.mjs tests/deepseek.test.mjs tests/response-client.test.cjs tests/live-scene-server-v37.test.mjs tests/live-scope-v38.test.cjs`。
5. 重启独立知识版服务后 `/api/knowledge` 应报告新版本和来源。只重启对应 `.runtime/server.pid`，不得误停演讲终版。

材料全文不作为静态网页公开；API 密钥位于忽略的 `.runtime/`，不进入资料包。每轮最多两位，采用独立上下文，同伴已说的话只作为对话信息。上下文只读取允许复述的本人记忆；当前已确认的经历由本机 SQLite 保存，规则见 `../docs/AGENT-HANDOFF.md`，没有进行模型微调。
