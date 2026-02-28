# LLM 调用位置与 API Key 配置说明

本文档列出当前工程中所有涉及 LLM/图像 API 的调用位置、使用的模型，以及 API Key 的配置方式。

---

## 一、API Key 配置汇总（统一入口）

**所有 Key 已统一由 `config.py` 读取，配置方式二选一：**

1. **推荐**：在项目根目录复制 `env.example` 为 `.env`，填入你的 Key（`.env` 已被 `.gitignore`）。
2. 或设置环境变量：`export OPENAI_API_KEY=...`、`export GROK_API_KEY=...`。

若已安装 `python-dotenv`（`pip install python-dotenv`），启动时会自动从 `.env` 加载。

| 用途 | 变量名 | 说明 |
|------|--------|------|
| **OpenAI 兼容 API（对话）** | `OPENAI_API_KEY` | 世界引擎、Bot Agent、规则引擎的 chat 调用均通过 `config.get_openai_client()` 使用此 Key。必填。**可用 OpenAI 或 DeepSeek**（见下方）。 |
| **API 基地址（DeepSeek）** | `OPENAI_BASE_URL` | 使用 DeepSeek 时设为 `https://api.deepseek.com`，并设置 `OPENAI_MODEL_NANO` / `OPENAI_MODEL_MINI` 为 `deepseek-chat`。 |
| **Grok 图像生成** | `GROK_API_KEY` | Bot 自拍、头像生成等 X.AI `grok-2-image` 调用。不填则自拍会返回“未配置”错误。 |
| **头像生成脚本** | 同上 `GROK_API_KEY` | `generate_avatars.py` 若改用本仓库的 config，可从同一 `.env` 读取；当前仍可能使用外部脚本内配置。 |

**仅使用 DeepSeek 时**：在 `.env` 中设置 `OPENAI_BASE_URL=https://api.deepseek.com`、`OPENAI_MODEL_NANO=deepseek-chat`、`OPENAI_MODEL_MINI=deepseek-chat`，再填入你的 DeepSeek API Key 到 `OPENAI_API_KEY` 即可正常启动和使用。

---

## 二、世界引擎 `world_engine_v8.py` 中的 LLM 调用

全部使用 **OpenAI 兼容客户端** `client = OpenAI()`（即 `OPENAI_API_KEY`），模型为 **gpt-4.1-nano** 或 **gpt-4.1-mini**。

| 行号 | 函数/场景 | 模型 | 用途 |
|------|-----------|------|------|
| 712 | `fetch_real_news()` | gpt-4.1-nano | 生成当日 3 条虚构深圳本地新闻标题 |
| 737 | `generate_hot_topics()` | gpt-4.1-nano | 生成 5 个热搜话题 |
| 1108 | `_generate_world_narrative()` | gpt-4.1-nano | 根据当日事件与居民动态生成「城市日记」叙事 |
| 1320 | 开放式行动永久改变判定 | gpt-4.1-nano | 判断一次行动是否产生世界改造（如开店、涂鸦），输出 JSON |
| 1449 | `_update_location_vibe()` | gpt-4.1-nano | 根据地点公共记忆与改造，用一词/短语描述地点氛围 |
| 1888 | `process_action()` 内计划→工具解析 | gpt-4.1-mini | 将 Bot 的文本计划解析为结构化 action（eat/move/talk/free 等），输出 JSON |
| 2138 | `process_action()` 内 talk 关系更新 | gpt-4.1-nano | 对话后更新双方情感关系（印象、关系类型、warmth_delta），输出 JSON |
| 2206 | `process_action()` 内对话后果判定 | gpt-4.1-nano | 判断一次对话是否产生社会后果（八卦/承诺/冲突等），输出 JSON |
| 2323 | `process_action()` 内 NPC 回应 | gpt-4.1-nano | Bot 对 NPC 说话时，生成 NPC 的一句回复 |
| 2392 | `process_action()` 内 post_moment | gpt-4.1-nano | 根据 Bot 近期真实经历生成朋友圈文案 |
| 2584 | 自拍（selfie） | **Grok API** | `grok_generate()`：调用 X.AI `grok-2-image` 生成图片并保存到 `/home/ubuntu/selfies/`，**使用硬编码 GROK_API_KEY** |
| 2634 | `interpret_free_action()` | gpt-4.1-nano | 解释「自由行动」的后果（叙事 + 数值变化），输出 JSON |
| 2804 | `execute_generic()` 后果生成 | gpt-4.1-mini | v10 Generic 工具执行后，根据行动生成完整后果（narrative、资源变化、世界改变、社交效果等），输出 JSON |
| 3057 | `process_action()` 内 v10 工具解析 | gpt-4.1-nano | 将 Bot 计划解析为 generic 工具调用（use_resource/interact/move/create/express），输出 JSON |

---

## 三、规则引擎 `world_rules_engine.py` 中的 LLM 调用

| 行号 | 函数 | 模型 | 用途 |
|------|------|------|------|
| 483 | `generate_rules_from_action()` | gpt-4.1-mini | 根据一次行动（如开摊、涂鸦）判断是否生成新的**世界规则**，输出规则 JSON 数组。`client` 由调用方 `world_engine_v8.py` 传入（即同一 `OpenAI()` 实例，**OPENAI_API_KEY**）。 |

---

## 四、Bot Agent `bot_agent_v8.py` 中的 LLM 调用

全部使用 **OpenAI 兼容客户端** `client = OpenAI()`（即 **OPENAI_API_KEY**）。

| 行号 | 函数/场景 | 模型 | 用途 |
|------|-----------|------|------|
| 933 | `think_and_plan()` | gpt-4.1-mini | 根据当前状态、地点、消息、长期目标等生成「内心独白」和下一步「行动」文本 |
| 1040 | `reflect()` | gpt-4.1-nano | 反思：更新行动评价、策略领悟、价值观、核心记忆、情绪、情感关系、长期目标、叙事摘要等，输出 JSON |

---

## 五、其他脚本

| 文件 | LLM/API | 说明 |
|------|---------|------|
| `generate_avatars.py` | Grok 图像（通过外部脚本） | 调用 `/home/ubuntu/skills/grok-image-generator/scripts/generate_image.py` 为 10 个 Bot 生成头像；API Key 在该脚本或其配置中，不在本仓库。 |

---

## 六、模型使用小结

| 模型 | 使用场景 |
|------|----------|
| **gpt-4.1-nano** | 新闻/热搜、世界叙事、地点氛围、关系更新、对话后果、NPC 回应、朋友圈文案、自由行动解释、工具解析、Bot 反思等（轻量、高频率） |
| **gpt-4.1-mini** | 计划→行动解析、Generic 工具后果、规则生成、Bot 思考与规划（需要更强推理/结构化） |
| **grok-2-image** | Bot 自拍、头像生成（图像生成，走 X.AI API） |

---

## 七、配置步骤

1. 在 `shenzhen-survival-sim` 目录下：`cp env.example .env`
2. 编辑 `.env`，填入 `OPENAI_API_KEY` 和（可选）`GROK_API_KEY`
3. 可选：`pip install python-dotenv`，以便自动从 `.env` 加载
4. 运行 `./run.sh` 或单独启动引擎/Bot 即可

模型名可通过环境变量 `OPENAI_MODEL_NANO`、`OPENAI_MODEL_MINI` 覆盖，见 `config.py`。
