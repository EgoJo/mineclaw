# v10.0 设计：Generic 工具 + 反馈循环

## 核心理念
不限制 bot 能做什么，只提供 generic 工具让它们与世界交互。
做完之后世界给出真实的后果反馈，bot 在下一次决策时能感知到。

## 5 个 Generic 工具（替代原来十几种硬编码 action）

### 1. `use_resource(resource, amount, purpose)`
消耗资源做事。resource 可以是 money/energy/time/item。
- 花钱买东西、吃饭、投资、送礼、创业 → 都是 use_resource(money, X, "...")
- 消耗能量做体力活 → use_resource(energy, X, "...")
- 使用物品 → use_resource(item:吉他, 1, "街头卖艺")

### 2. `interact(target, manner, content)`
与任何实体交互。target 可以是人/NPC/物品/地点设施。
- 和人聊天 → interact("林枫", "friendly", "聊音乐")
- 和NPC交易 → interact("包工头老陈", "negotiate", "问有没有活干")
- 使用设施 → interact("陈静的涂鸦墙", "observe", "欣赏画作")

### 3. `move(destination, mode)`
移动到任何地方。
- move("华强北", "walk")
- mode: walk/bus/taxi（影响花费和时间）

### 4. `create(what, where, using)`
创造/改变世界中的东西。这是最关键的工具——任何永久性改变都通过它。
- create("炒粉摊", "宝安城中村", "money:200") → 开摊
- create("涂鸦:城市之光", "华强北", "energy:10") → 画画
- create("吉他教学班", "深圳湾公园", "energy:20") → 开班
- create("谣言:赵磊欠债跑路", "华强北", "energy:5") → 传播信息

### 5. `express(channel, content)`
表达/输出信息。
- express("朋友圈", "今天在深圳湾看到了最美的日落")
- express("自言自语", "我到底在追求什么...")
- express("大声喊", "有没有人要学吉他！")

## 反馈循环设计

### 行动 → 后果（World Engine 用 LLM 判断）
每个工具调用后，World Engine 用 LLM 生成：
```json
{
  "narrative": "发生了什么（叙事）",
  "world_changes": [
    {"type": "new_entity", "name": "陈静的炒粉摊", "location": "宝安城中村", "properties": {...}},
    {"type": "reputation_change", "bot": "bot_4", "delta": +3, "reason": "开了摊"},
    {"type": "relationship_change", "from": "bot_4", "to": "bot_8", "delta": +2}
  ],
  "resource_changes": {"money": -200, "energy": -10},
  "side_effects": ["附近的人闻到了炒粉的香味", "吴秀英注意到了新的竞争对手"]
}
```

### 后果 → 感知（下一次 heartbeat 时 bot 能看到）
- 地点描述中会出现新创建的东西
- 其他 bot 能看到 side_effects
- 声望变化会影响别人对你的态度
- 创造物会持续产生效果（炒粉摊每 tick 有概率赚钱）

### 感知 → 学习（reflect 时整合）
- reflect 时不只更新情绪和记忆，还要评估"我的行动有效吗"
- 如果开摊赚了钱 → 强化创业倾向
- 如果被忽视 → 可能换策略
- 如果看到别人的创造物 → 可能模仿或竞争

## Bot Agent 端改动
不再给 bot 一个固定的行动菜单，而是：
1. 告诉它有5个工具可用
2. 让它输出工具调用（而不是自然语言行动）
3. World Engine 执行工具调用并返回结果
4. 结果会出现在下一次的感知中

## 实现策略
由于改动量很大，采用增量策略：
1. 保留现有的 execute 函数作为 fallback
2. 新增 `execute_generic` 函数处理5个 generic 工具
3. 修改 bot_agent 的 prompt，让它优先用工具格式输出
4. process_action 先尝试解析为工具调用，失败则 fallback 到旧逻辑
