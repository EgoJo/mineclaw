# 深圳生存模拟 · 前后端工程说明

本仓库包含**后端模拟引擎**与**前端像素城市 Dashboard** 两套工程，共同构成「深圳生存模拟」的完整系统。下文分别介绍两套工程的职责、技术栈、数据流与运行方式。

---

## 快速启动（项目是否可启动？如何启动？）

**可以启动。** 满足依赖并配置 API Key 后，按下列步骤即可在本机运行。

### 1. 后端（世界引擎 + Bot + Python Dashboard）

```bash
cd shenzhen-survival-sim

# 安装依赖（首次）
pip install -r requirements.txt

# 配置 API Key（首次）：复制 env.example 为 .env，填入 OPENAI_API_KEY（必填）
# 若只有 DeepSeek：在 .env 中再设置 OPENAI_BASE_URL=https://api.deepseek.com、OPENAI_MODEL_NANO=deepseek-chat、OPENAI_MODEL_MINI=deepseek-chat
cp env.example .env
# 编辑 .env，至少填写: OPENAI_API_KEY=sk-...（或 DeepSeek 的 Key）

# 启动
./run.sh
```

- 世界引擎：http://localhost:8000  
- Python Dashboard：http://localhost:9000  
- 日志与自拍等文件写在项目下的 `logs/`、`selfies/`（已改为项目相对路径，任意机器可跑）

### 2. 前端（像素城市可视化，可选）

```bash
cd shenzhen-pixel-city
pnpm install
pnpm dev
```

浏览器打开 http://localhost:3000，页面会轮询 http://localhost:8000 获取世界数据；若后端未启动则显示「连接失败」并使用 Mock 数据。

### 3. 启动顺序建议

先启动后端（`./run.sh`），确认 8000 端口可访问后，再启动前端（`pnpm dev`）。

---

## 一、仓库结构

```
mineclaw/
├── README.md                 # 本说明
├── ITERATION_ROADMAP.md      # 迭代与优化路线图
├── shenzhen-survival-sim/   # 后端：世界引擎 + Bot Agent + Python Dashboard
│   ├── world_engine_v8.py    # 世界引擎（FastAPI，端口 8000）
│   ├── bot_agent_v8.py       # Bot 智能体进程（每个 Bot 一个进程）
│   ├── world_rules_engine.py # 世界规则引擎（被 world_engine 调用）
│   ├── config.py             # API Key 与项目路径统一配置
│   ├── env.example           # 环境变量模板（复制为 .env 并填入 Key）
│   ├── requirements.txt      # Python 依赖（fastapi / uvicorn / openai / requests / python-dotenv）
│   ├── sz_dashboard_v6.py    # 旧版 Python Dashboard（FastAPI，端口 9000）
│   ├── soul.md               # 10 个 Bot 的人设定义
│   ├── run.sh                # 统一启动脚本（引擎 + Python Dashboard）
│   └── LLM_AND_API_KEYS.md   # LLM 调用位置与 Key 配置说明
│
└── shenzhen-pixel-city/      # 前端：像素城市可视化 Dashboard
    ├── client/               # React 前端（Vite）
    ├── server/               # 生产态静态文件服务（Express）
    ├── shared/                # 前后端共享常量
    ├── DESIGN_SYSTEM.md       # 像素城市 UI 设计规范
    └── ideas.md               # 设计理念（赛博/复古/监控中心风）
```

- **前端（shenzhen-pixel-city）** 与 **世界引擎（world_engine_v8）** 直接通信，是当前主用的可视化界面。
- **sz_dashboard_v6** 是旧版 Python 版 Dashboard，可作备用或对比；`run.sh` 会同时启动引擎与 sz_dashboard_v6。

---

## 二、后端工程：shenzhen-survival-sim

### 2.1 定位与职责

模拟一个**以深圳为背景的多智能体城市**：世界引擎维护时间、地点、天气、经济与事件；多个 Bot 作为独立进程，通过 LLM 做决策并在世界中执行行动（移动、工作、吃饭、社交等），形成叙事与社交网络。

### 2.2 核心组件

| 组件 | 文件 | 职责 |
|------|------|------|
| **世界引擎** | `world_engine_v8.py` | FastAPI 服务（端口 **8000**）。维护全局状态 `world`（时间、天气、地点、Bot 状态、事件、朋友圈、新闻等）；每 tick 推进时间、执行规则引擎、处理 Bot 行动、计算情绪/经济/寿命等。 |
| **Bot Agent** | `bot_agent_v8.py` | 每个 Bot 一个进程，由环境变量 `BOT_ID` 区分。循环：拉取世界状态 → LLM 思考与规划 → 提交行动 → 同步内心状态（记忆、目标、情绪等）到引擎。 |
| **规则引擎** | `world_rules_engine.py` | 定义「世界规则」的创建、条件与效果（如开炒粉摊后每 tick 给路过的人加饱腹、给摊主收入）。世界引擎每 tick 调用 `tick_rules(world)`；Bot 的某些行动可通过 LLM 生成新规则（`generate_rules_from_action`）。 |
| **Python Dashboard** | `sz_dashboard_v6.py` | FastAPI 服务（端口 **9000**）。提供 HTML 大屏与代理接口，将 `/api/*` 转发到世界引擎 `http://localhost:8000`，适合服务器环境或不需要像素前端的场景。 |

### 2.3 世界引擎主要 API（供前端使用）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/world` | 完整世界状态（时间、天气、新闻、所有 Bot、地点、事件、朋友圈、世界改造、规则等） |
| GET | `/moments` | 朋友圈动态列表 `{ moments: [...] }` |
| GET | `/bot/{bot_id}/detail` | 单个 Bot 详情（含行动日志、关系、记忆等） |
| POST | `/bot/{bot_id}/action` | Bot 提交行动（由 bot_agent 调用） |
| POST | `/bot/{bot_id}/sync_state` | Bot 同步内心状态（记忆、目标、近期行动等） |
| GET | `/messages/{bot_id}` | Bot 收到的消息列表 |
| POST | `/admin/send_message` | 管理员/观察者向某 Bot 发送消息（前端「发消息」功能） |
| GET | `/world_narrative` | 当前世界叙事摘要 |
| GET | `/evolution` | 进化相关数据（世界改造、传说、墓地、规则等） |
| GET | `/rules`、`/rules/{location}` | 世界规则列表、按地点筛选 |

世界引擎已配置 CORS，允许前端跨域访问。

### 2.4 Bot 与引擎的协作方式

1. **启动**：`run.sh` 只启动世界引擎（及可选 sz_dashboard_v6）；世界引擎在启动或恢复时，会为每个存活的 Bot 拉起子进程：`python3 bot_agent_v8.py`，并注入 `BOT_ID`。
2. **心跳**：Bot 进程定期向 `WORLD_ENGINE_URL`（默认 `http://localhost:8000`）请求自己可见的世界状态，调用 LLM 生成当步计划与行动，再 POST 到 `/bot/{bot_id}/action`。
3. **行动处理**：世界引擎解析行动类型（移动、吃饭、工作、对话、自由行动等），更新世界状态并返回结果；部分行动会触发规则引擎生成新规则。
4. **状态同步**：Bot 将核心记忆、近期行动、长期目标、叙事摘要等 POST 到 `/bot/{bot_id}/sync_state`，保证引擎侧与 Bot 侧状态一致。

### 2.5 人设与数据

- **soul.md**：定义 10 个 Bot 的姓名、年龄、籍贯、学历、性格、价值观、背景与初始记忆；与 `bot_agent_v8.py` 中的 `PERSONAS` 以及世界引擎中的初始化逻辑对应。
- 世界内地点包括：宝安城中村、南山科技园、福田 CBD、华强北、东门老街、南山公寓、深圳湾公园等。

### 2.6 环境与 API Key 配置

后端所有 LLM 调用（世界引擎、Bot Agent、规则引擎）及 Grok 图像 API 的 Key 已统一由 **`config.py`** 读取，便于在一处配置/替换。

**配置步骤：**

1. 进入后端目录：`cd shenzhen-survival-sim`
2. 复制模板：`cp env.example .env`（`.env` 已被 `.gitignore`，不会提交）
3. 编辑 `.env`，填入必填项：
   - **`OPENAI_API_KEY`**：OpenAI 或 **DeepSeek** 的 API Key（必填，用于所有对话/推理）
   - **使用 DeepSeek 时** 再增加三行：`OPENAI_BASE_URL=https://api.deepseek.com`、`OPENAI_MODEL_NANO=deepseek-chat`、`OPENAI_MODEL_MINI=deepseek-chat`
   - **`GROK_API_KEY`**：（可选）X.AI Grok 图像 API，用于 Bot 自拍、头像生成等；不填则自拍功能会报「未配置」错误
4. 可选：`pip install python-dotenv`，启动时会自动从 `.env` 加载；未安装则需在 shell 中 `export OPENAI_API_KEY=...` 等

也可不创建 `.env`，直接设置环境变量后运行。详见 **`LLM_AND_API_KEYS.md`**。

### 2.7 运行方式

```bash
cd shenzhen-survival-sim
pip install -r requirements.txt   # 首次
# 确保已配置 API Key（见 2.6）
./run.sh
```

- 世界引擎：http://localhost:8000  
- Python Dashboard（若启动）：http://localhost:9000  
- 日志与自拍目录：项目下的 `logs/`、`selfies/`（使用 config 中的项目相对路径，本机与服务器均可运行）

---

## 三、前端工程：shenzhen-pixel-city

### 3.1 定位与职责

基于 **pixel-agents 风格** 的「深圳像素城市」可视化 Dashboard，设计成**城市运营中心 / 监控大屏**风格：高信息密度、深色主题、像素地图为核心，实时展示世界状态与 Bot 动态。

### 3.2 技术栈

| 类别 | 技术 |
|------|------|
| 构建/开发 | Vite 7、React 19、TypeScript |
| 路由 | wouter |
| 样式 | Tailwind CSS 4 |
| UI 组件 | Radix UI、shadcn/ui 风格组件（见 `client/src/components/ui/`） |
| 图表/数据 | Recharts |
| 动效 | Framer Motion |
| 生产服务 | Express 提供静态资源（`server/index.ts`），端口默认 3000 |

### 3.3 目录与入口

- **client/**：前端源码  
  - `client/src/main.tsx` → `App.tsx` → 路由到 `Home.tsx`  
  - `client/index.html` 为 Vite 入口。
- **server/index.ts**：生产环境时提供 `dist/public` 下的静态文件，并做 SPA fallback（所有路由返回 `index.html`）。开发时由 Vite dev server 直接提供页面，无需经过该 Express。
- **shared/**：共享常量（如 `const.ts`），通过 Vite alias `@shared` 引用。

### 3.4 与后端的数据流

- **引擎地址**：通过环境变量 `VITE_ENGINE_URL` 配置，默认 `http://localhost:8000`。页面顶部可修改引擎地址并生效。
- **轮询**：`useWorldData`（`client/src/hooks/useWorldData.ts`）每 3 秒请求：
  - `GET {engineUrl}/world` → 整世界状态
  - `GET {engineUrl}/moments` → 朋友圈
- **类型**：`client/src/types/world.ts` 中定义了与 `world_engine_v8` 的 `/world`、Bot、地点、情绪、欲望、朋友圈等对应的 TypeScript 类型（如 `WorldState`、`BotState`、`Moment` 等）。
- **离线/演示**：当连接失败时，前端会使用 `client/src/lib/mockData.ts` 中的 Mock 数据，保证界面可展示。
- **其他接口**：
  - 发送消息：`POST {engineUrl}/admin/send_message`（`sendMessage`）
  - Bot 详情：`GET {engineUrl}/bot/{bot_id}/detail`（`fetchBotDetail`）

### 3.5 主要页面与组件

- **Home**（`client/src/pages/Home.tsx`）：主界面。  
  - 顶部：`TopHeader`（时间、天气、连接状态、引擎地址切换）。  
  - 左侧约 60%：地图区域。  
    - **全景**：`CityOverviewMap` — 深圳鸟瞰图，点击地点进入场景。  
    - **场景**：`PixelCityMap` — 单场景像素地图，显示 Bot、车辆/船只精灵与 UI 层。  
  - 右侧约 40%：上半为 Bot 状态卡片网格（`BotCard`），点击某 Bot 展开 `BotDetailPanel`（详情、发消息）；下半为 `RightPanel`（事件流/朋友圈等标签页）。

### 3.6 像素与场景资源

- **设计规范**：见 `DESIGN_SYSTEM.md`（俯视像素风、场景色调、精灵尺寸、地图层次等）。  
- **设计理念**：见 `ideas.md`（赛博/复古/监控中心风选型说明）。  
- **场景图与精灵**：`PixelCityMap` 使用 CDN 上的场景背景图、角色精灵表（chars）、车辆与船只精灵表；`CityOverviewMap` 使用全城鸟瞰图。  
- **精灵系统**：`client/src/engine/spriteSystem.ts` 提供像素点阵缓存、缩放与描边等；`sceneTiles.ts` 与地图渲染相关。

### 3.7 运行方式

```bash
cd shenzhen-pixel-city
pnpm install
pnpm dev
```

- 开发：Vite 默认 `http://localhost:3000`（或下一可用端口）。  
- 生产构建与启动：`pnpm build` 后 `pnpm start`（Node 运行 `dist/index.js`，静态资源由 Express 提供）。

---

## 四、前后端联调与部署要点

1. **端口**  
   - 世界引擎：**8000**  
   - 像素前端开发：**3000**  
   - Python Dashboard：**9000**（可选）

2. **跨域**  
   - 前端在浏览器中直接请求 `http://localhost:8000`，世界引擎已开启 CORS，无需额外代理。  
   - 若前端与引擎域名/端口不同，保持引擎 CORS 配置即可。

3. **启动顺序**  
   - 先启动世界引擎（`./run.sh` 或单独 `python3 world_engine_v8.py`），再打开前端；否则首屏会显示「连接失败」并回退到 Mock 数据。

4. **环境变量**  
   - **后端 LLM**：在 `shenzhen-survival-sim` 下用 `env.example` 复制为 `.env`，填写 `OPENAI_API_KEY`（必填）、`GROK_API_KEY`（可选），见上文 2.6。  
   - **前端**：`.env` 或 `.env.local` 中可设 `VITE_ENGINE_URL=http://localhost:8000`（或你的引擎地址）。  
   - **Bot**：`WORLD_ENGINE_URL` 默认 `http://localhost:8000`，部署时可按需改为实际引擎地址。

5. **本机路径与日志**  
   - 世界引擎与 Bot 中有部分写死路径（如 `/home/ubuntu/logs`、`/home/ubuntu/shenzhen-survival-sim/bot_agent_v8.py`）。本机开发时若目录不同，需修改为当前项目路径或通过环境变量/配置统一管理（可参考根目录 `ITERATION_ROADMAP.md` 中的工程优化项）。

---

## 五、相关文档索引

| 文档 | 位置 | 内容 |
|------|------|------|
| LLM 与 API Key | `shenzhen-survival-sim/LLM_AND_API_KEYS.md` | LLM 调用位置、所用模型、Key 统一配置说明 |
| 迭代路线图 | `ITERATION_ROADMAP.md` | 工程/架构优化与玩法/机制迭代清单 |
| v8.3 改进计划 | `shenzhen-survival-sim/v8.3_improvement_plan.md` | 状态同步、情绪、对话、长期目标等设计 |
| v8.3 升级报告 | `shenzhen-survival-sim/v8.3_upgrade_report.md` | 实际修复与验证结果 |
| v10 设计 | `shenzhen-survival-sim/v10_design.md` | Generic 工具与反馈循环设计 |
| 像素城市设计规范 | `shenzhen-pixel-city/DESIGN_SYSTEM.md` | 像素风 UI、精灵、地图规范 |
| 设计理念 | `shenzhen-pixel-city/ideas.md` | 监控中心风等方案说明 |
| Bot 人设 | `shenzhen-survival-sim/soul.md` | 10 个 Bot 的完整人设与初始记忆 |

以上为当前前后端工程的完整介绍，便于新成员上手与后续按路线图迭代。
