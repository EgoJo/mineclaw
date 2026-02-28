"""
v10.1 世界规则引擎 (World Rules Engine)
======================================
核心思想: 世界的运行规则本身就是数据，bot 可以向世界注入新规则。

每条规则是一个字典:
{
    "id": "rule_xxx",
    "name": "吴秀英的炒粉摊",
    "creator": "bot_8",
    "created_tick": 50,
    "active": True,
    "location": "宝安城中村",       # 规则生效的地点(None=全局)
    "trigger": "every_tick",         # 触发时机
    "condition": {...},              # 条件表达式
    "effects": [...],                # 效果列表
    "description": "...",            # 人类可读描述
    "durability": 100,               # 耐久度(0=消失)
    "decay_rate": 0.1,               # 每tick衰减
}

trigger 类型:
- "every_tick"           每个tick都检查
- "on_enter"             有bot进入location时
- "on_time"              特定虚拟时间
- "on_interact"          有bot与之交互时

condition 表达式 (简单DSL，用dict表示):
- {"bot_at": "宝安城中村"}           bot在某地点
- {"bot_attr_lt": ["satiety", 30]}   bot的某属性小于某值
- {"bot_attr_gt": ["money", 100]}    bot的某属性大于某值
- {"random": 0.3}                    30%概率
- {"time_between": [8, 22]}          虚拟时间在8-22之间
- {"and": [cond1, cond2]}            多条件AND
- {"or": [cond1, cond2]}             多条件OR
- {"always": True}                   总是为真

effect 类型:
- {"type": "modify_bot_attr", "attr": "satiety", "delta": 20, "cost_money": 10}
- {"type": "modify_bot_emotion", "emotion": "happiness", "delta": 5}
- {"type": "add_public_memory", "location": "...", "content": "..."}
- {"type": "attract_bot", "chance": 0.1, "message": "..."}  # 吸引bot过来
- {"type": "generate_income", "target": "creator", "amount": 5}  # 给创造者产生收入
- {"type": "modify_location_desc", "append": "..."}
- {"type": "spawn_event", "event_name": "...", "event_desc": "..."}
- {"type": "modify_rule", "target_rule": "...", "changes": {...}}  # 规则修改规则
- {"type": "narrative", "text": "..."}  # 产生叙事文本
"""

import json
import logging
import random
import re
import uuid

try:
    from config import OPENAI_MODEL_MINI
except ImportError:
    OPENAI_MODEL_MINI = "gpt-4.1-mini"

log = logging.getLogger("world")


def create_rule(name, creator_id, creator_name, location, trigger, condition, effects, description, durability=100, decay_rate=0.1):
    """创建一条新的世界规则"""
    return {
        "id": f"rule_{uuid.uuid4().hex[:8]}",
        "name": name,
        "creator": creator_id,
        "creator_name": creator_name,
        "created_tick": 0,  # 由调用者设置
        "active": True,
        "location": location,
        "trigger": trigger,
        "condition": condition,
        "effects": effects,
        "description": description,
        "durability": durability,
        "decay_rate": decay_rate,
        "execution_count": 0,
        "last_triggered_tick": -1,
    }


def evaluate_condition(condition, context):
    """评估条件表达式。
    context = {
        "bot": bot_dict or None,
        "location": location_name,
        "world": world_dict,
        "tick": int,
        "virtual_hour": int,
    }
    """
    if not condition:
        return True
    
    if condition.get("always"):
        return True
    
    if "random" in condition:
        return random.random() < condition["random"]
    
    if "time_between" in condition:
        start, end = condition["time_between"]
        vh = context.get("virtual_hour", 12)
        if start <= end:
            return start <= vh <= end
        else:  # 跨午夜
            return vh >= start or vh <= end
    
    if "bot_at" in condition:
        bot = context.get("bot")
        if not bot:
            return False
        return bot.get("location") == condition["bot_at"]
    
    if "bot_attr_lt" in condition:
        bot = context.get("bot")
        if not bot:
            return False
        attr, val = condition["bot_attr_lt"]
        return bot.get(attr, 0) < val
    
    if "bot_attr_gt" in condition:
        bot = context.get("bot")
        if not bot:
            return False
        attr, val = condition["bot_attr_gt"]
        return bot.get(attr, 0) > val
    
    if "and" in condition:
        return all(evaluate_condition(c, context) for c in condition["and"])
    
    if "or" in condition:
        return any(evaluate_condition(c, context) for c in condition["or"])
    
    # 未知条件默认为True
    return True


def apply_effect(effect, context, world):
    """应用一条效果。返回 (affected_bot_ids, narrative_text)"""
    etype = effect.get("type", "")
    affected = []
    narrative = ""
    
    try:
        if etype == "modify_bot_attr":
            # 修改bot的某个属性
            bot = context.get("bot")
            if bot:
                attr = effect["attr"]
                delta = effect.get("delta", 0)
                cost_money = effect.get("cost_money", 0)
                
                # 检查是否付得起
                if cost_money > 0 and bot.get("money", 0) < cost_money:
                    return affected, ""
                
                if cost_money > 0:
                    bot["money"] -= cost_money
                
                old_val = bot.get(attr, 0)
                if isinstance(old_val, (int, float)):
                    bot[attr] = max(0, min(100, old_val + delta))
                    affected.append(context.get("bot_id", ""))
                    narrative = effect.get("narrative", "")
                    
        elif etype == "modify_bot_emotion":
            bot = context.get("bot")
            if bot:
                emotions = bot.get("emotions", {})
                emo = effect.get("emotion", "happiness")
                delta = effect.get("delta", 0)
                emotions[emo] = max(0, min(100, emotions.get(emo, 0) + delta))
                bot["emotions"] = emotions
                affected.append(context.get("bot_id", ""))
                
        elif etype == "attract_bot":
            # 吸引附近的bot到某个地点
            chance = effect.get("chance", 0.1)
            target_loc = effect.get("location", context.get("rule_location", ""))
            message = effect.get("message", "")
            if target_loc and random.random() < chance:
                # 找一个不在该地点的随机bot
                for bid, bot in world["bots"].items():
                    if bot["status"] == "alive" and not bot.get("is_sleeping") and bot["location"] != target_loc:
                        if random.random() < 0.3:  # 不是每个人都会被吸引
                            # 不直接移动bot，而是给bot一个"吸引信号"
                            if "attraction_signals" not in bot:
                                bot["attraction_signals"] = []
                            bot["attraction_signals"].append({
                                "location": target_loc,
                                "reason": message,
                                "tick": context.get("tick", 0),
                            })
                            # 只保留最近3个信号
                            bot["attraction_signals"] = bot["attraction_signals"][-3:]
                            affected.append(bid)
                            break
                            
        elif etype == "generate_income":
            # 给创造者产生收入
            target = effect.get("target", "creator")
            amount = effect.get("amount", 1)
            if target == "creator":
                creator_id = context.get("rule_creator", "")
                creator_bot = world["bots"].get(creator_id)
                if creator_bot and creator_bot["status"] == "alive":
                    creator_bot["money"] += amount
                    affected.append(creator_id)
                    narrative = f"收入+{amount}元"
                    
        elif etype == "add_public_memory":
            loc_name = effect.get("location", context.get("rule_location", ""))
            content = effect.get("content", "")
            loc = world["locations"].get(loc_name)
            if loc and content:
                if "public_memory" not in loc:
                    loc["public_memory"] = []
                loc["public_memory"].append({
                    "event": content,
                    "actor": context.get("rule_creator", "system"),
                    "tick": context.get("tick", 0),
                    "impact": "rule_effect",
                })
                if len(loc["public_memory"]) > 30:
                    loc["public_memory"] = loc["public_memory"][-25:]
                    
        elif etype == "spawn_event":
            # 产生一个事件
            world["events"].append({
                "tick": context.get("tick", 0),
                "time": world["time"]["virtual_datetime"],
                "event": effect.get("event_name", "未知事件"),
                "desc": effect.get("event_desc", ""),
            })
            
        elif etype == "modify_location_desc":
            loc_name = effect.get("location", context.get("rule_location", ""))
            loc = world["locations"].get(loc_name)
            if loc:
                append_text = effect.get("append", "")
                if append_text and append_text not in loc.get("desc", ""):
                    loc["desc"] = loc["desc"].rstrip() + "。" + append_text
                    
        elif etype == "narrative":
            narrative = effect.get("text", "")
            
        elif etype == "modify_rule":
            # 规则修改规则——元编程
            target_rule_id = effect.get("target_rule", "")
            changes = effect.get("changes", {})
            rules = world.get("active_rules", [])
            for r in rules:
                if r["id"] == target_rule_id:
                    for k, v in changes.items():
                        if k in ("durability", "decay_rate", "active"):
                            r[k] = v
                    break
                    
    except Exception as e:
        log.error(f"[RULES] apply_effect 失败: {etype} - {e}")
    
    return affected, narrative


def tick_rules(world):
    """每个 tick 执行所有活跃规则。这是规则引擎的心脏。"""
    if "active_rules" not in world:
        world["active_rules"] = []
    
    rules = world["active_rules"]
    tick = world["time"]["tick"]
    vh = world["time"]["virtual_hour"]
    
    tick_narratives = []  # 本tick产生的叙事
    
    for rule in rules:
        if not rule.get("active", True):
            continue
            
        # 耐久度衰减
        rule["durability"] = rule.get("durability", 100) - rule.get("decay_rate", 0.1)
        if rule["durability"] <= 0:
            rule["active"] = False
            log.warning(f"[RULES] 规则[{rule['name']}]耐久度归零，已失效")
            tick_narratives.append(f"{rule['name']}已经消失了")
            continue
        
        trigger = rule.get("trigger", "every_tick")
        rule_loc = rule.get("location")
        
        if trigger == "every_tick":
            # 对规则所在地点的每个bot检查条件并应用效果
            if rule_loc:
                loc_data = world["locations"].get(rule_loc, {})
                bot_ids = loc_data.get("bots", [])
            else:
                # 全局规则，对所有存活bot
                bot_ids = [bid for bid, b in world["bots"].items() if b["status"] == "alive"]
            
            for bid in bot_ids:
                bot = world["bots"].get(bid)
                if not bot or bot["status"] != "alive" or bot.get("is_sleeping"):
                    continue
                
                ctx = {
                    "bot": bot,
                    "bot_id": bid,
                    "location": bot.get("location", ""),
                    "world": world,
                    "tick": tick,
                    "virtual_hour": vh,
                    "rule_location": rule_loc,
                    "rule_creator": rule.get("creator", ""),
                }
                
                if evaluate_condition(rule.get("condition", {}), ctx):
                    for eff in rule.get("effects", []):
                        affected, narr = apply_effect(eff, ctx, world)
                        if narr:
                            tick_narratives.append(narr)
                    rule["execution_count"] = rule.get("execution_count", 0) + 1
                    rule["last_triggered_tick"] = tick
                    
        elif trigger == "on_enter":
            # 检查是否有新bot进入该地点（通过比较上一tick的bot列表）
            # 简化处理：每tick只对在该地点的bot执行一次，通过execution记录避免重复
            if rule_loc:
                loc_data = world["locations"].get(rule_loc, {})
                for bid in loc_data.get("bots", []):
                    bot = world["bots"].get(bid)
                    if not bot or bot["status"] != "alive":
                        continue
                    # 用一个set记录已经触发过的bot
                    triggered_bots = rule.get("_triggered_bots", set())
                    if isinstance(triggered_bots, list):
                        triggered_bots = set(triggered_bots)
                    if bid not in triggered_bots:
                        ctx = {
                            "bot": bot, "bot_id": bid,
                            "location": rule_loc, "world": world,
                            "tick": tick, "virtual_hour": vh,
                            "rule_location": rule_loc,
                            "rule_creator": rule.get("creator", ""),
                        }
                        if evaluate_condition(rule.get("condition", {}), ctx):
                            for eff in rule.get("effects", []):
                                apply_effect(eff, ctx, world)
                            triggered_bots.add(bid)
                            rule["execution_count"] = rule.get("execution_count", 0) + 1
                    rule["_triggered_bots"] = triggered_bots
                    
                # 清理已离开的bot
                current_bots = set(loc_data.get("bots", []))
                rule["_triggered_bots"] = rule.get("_triggered_bots", set()) & current_bots
                
        elif trigger == "on_time":
            # 特定时间触发
            target_hour = rule.get("trigger_hour", 12)
            if vh == target_hour and rule.get("last_triggered_tick", -1) < tick - 1:
                ctx = {
                    "bot": None, "bot_id": None,
                    "location": rule_loc, "world": world,
                    "tick": tick, "virtual_hour": vh,
                    "rule_location": rule_loc,
                    "rule_creator": rule.get("creator", ""),
                }
                if evaluate_condition(rule.get("condition", {}), ctx):
                    for eff in rule.get("effects", []):
                        apply_effect(eff, ctx, world)
                    rule["execution_count"] = rule.get("execution_count", 0) + 1
                    rule["last_triggered_tick"] = tick
    
    # 清理失效规则（保留在列表中但标记为inactive，用于历史记录）
    active_count = sum(1 for r in rules if r.get("active", True))
    total_count = len(rules)
    
    if tick_narratives:
        log.info(f"[RULES] Tick {tick}: {active_count}/{total_count}条规则活跃, 产生{len(tick_narratives)}条叙事")
    
    return tick_narratives


def generate_rules_from_action(world, bot_id, bot_name, location, action_desc, narrative, client):
    """让 LLM 判断一个行动是否应该产生新的世界规则。
    返回规则列表（可能为空）。
    
    这是最关键的函数——它让 LLM 把 bot 的行动翻译成世界运行规则。
    """
    
    bot = world["bots"].get(bot_id, {})
    loc = world["locations"].get(location, {})
    
    # 快速过滤：只过滤最简单的行动
    trivial_keywords = ["睡觉", "入睡", "躺下睡"]
    if any(k in action_desc for k in trivial_keywords):
        return []
    
    # 收集当前活跃规则的摘要（显示更多信息用于去重）
    existing_rules = [f"- [{r['name']}] by {r.get('creator_name','?')} @ {r.get('location','?')}: {r['description'][:60]}" for r in world.get("active_rules", []) if r.get("active")]
    existing_rules_text = "\n".join(existing_rules[-20:]) if existing_rules else "暂无"
    
    # 去重：如果已经有太多规则，提高门槛
    active_count = len([r for r in world.get("active_rules", []) if r.get("active")])
    if active_count > 50:
        if random.random() > 0.15:
            return []
    elif active_count > 30:
        if random.random() > 0.4:
            return []
    
    prompt = f"""你是深圳生存模拟的世界规则引擎。一个角色刚完成了一个行动，请判断这个行动是否应该向世界注入新的**运行规则**。

角色: {bot_name} ({bot.get('age','?')}岁, ¥{bot.get('money',0)}, 技能:{json.dumps(bot.get('skills',{}), ensure_ascii=False)})
地点: {location} - {loc.get('desc','')}
行动: {action_desc}
结果: {narrative[:200]}

当前活跃的世界规则:
{existing_rules_text}

**什么是世界规则？** 规则是每个tick都会被执行的逻辑，它会真正改变世界的运行方式。例如：
- 开了炒粉摊 → 每tick，在该地点且饿了的bot有概率花钱吃炒粉(satiety+40, money-12)，摊主获得收入
- 街头弹吉他 → 每tick，该地点的bot happiness+2，有概率吸引新bot过来
- 开了直播间 → 每天20-22点，该地点的bot vanity+3，直播者获得收入
- 传播谣言 → 该信息扩散到多个地点的公共记忆
- 建了公告栏 → 进入该地点的bot会看到公告信息

**判断标准：**
行动是否对这个地点或世界产生了某种“持久的痕迹”？如果是，就应该产生规则。例如：
- 拍了短视频并发布 → 该地点获得线上曝光，吸引更多人来
- 找到了工作/接了活 → 该工作岗位被占用，其他人看到“有人已经在这里干活”
- 和某人深入交流 → 这里形成了一个社交圈子
- 创作了作品（音乐/画/文章） → 作品留在这里影响后来的人
- 开店/摒摊/做生意 → 新的经济活动点
- 帮助/伤害了某人 → 该地点的氛围变化
- 传播信息/谣言 → 信息在地点间扩散

**不产生规则的情况：** 纯粹的内心活动、睡觉、发呆、无目的闲逛。

**最重要的规则：不要重复！**
仔细看上面的已有规则列表。如果已经有任何关于同一主题的规则（即使名字不同），就返回 []。
例如：已有"老李早餐摒临时搬运工"，就不要再生成"老李搬货活儿招募"。
如果不确定，返回空数组 []

如果不产生规则，返回: []

如果产生规则，返回JSON数组，每条规则格式:
[{{
  "name": "规则名称(简短)",
  "description": "人类可读的描述",
  "location": "{location}或null(全局)",
  "trigger": "every_tick/on_enter/on_time",
  "trigger_hour": 只有on_time时需要(0-23),
  "condition": 条件表达式,
  "effects": [效果列表],
  "durability": 1-1000(越持久越大),
  "decay_rate": 0.01-1.0(每tick衰减)
}}]

条件表达式:
- {{"always": true}}
- {{"random": 0.3}}  (30%概率)
- {{"bot_attr_lt": ["satiety", 30]}}  (饱腹<30)
- {{"bot_attr_gt": ["money", 50]}}  (钱>50)
- {{"time_between": [20, 22]}}  (20-22点)
- {{"and": [cond1, cond2]}}
- {{"or": [cond1, cond2]}}

效果类型:
- {{"type": "modify_bot_attr", "attr": "satiety/energy/hp", "delta": 数值, "cost_money": 花费}}
- {{"type": "modify_bot_emotion", "emotion": "happiness/sadness/anxiety", "delta": 数值}}
- {{"type": "attract_bot", "chance": 0.1, "location": "地点", "message": "吸引原因"}}
- {{"type": "generate_income", "target": "creator", "amount": 金额}}
- {{"type": "add_public_memory", "location": "地点", "content": "内容"}}
- {{"type": "narrative", "text": "叙事文本"}}

规则:
- 要符合现实逻辑（开店需要钱，当前{bot.get('money',0)}元）
- 不要创造太强的效果（单次delta不超过20）
- durability和decay_rate要合理（临时表演decay快，开店decay慢）
- 只输出JSON数组，不要其他文字"""

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_MINI,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        # 清理
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        raw = re.sub(r',\s*}', '}', raw)
        raw = re.sub(r',\s*]', ']', raw)
        json_match = re.search(r'\[[\s\S]*\]', raw)
        if json_match:
            raw = json_match.group(0)
        
        rule_defs = json.loads(raw)
        if not isinstance(rule_defs, list):
            return []
        
        # 转换为标准规则格式（带代码层去重）
        existing_names = [r.get("name","") for r in world.get("active_rules", []) if r.get("active")]
        existing_descs = [r.get("description","") for r in world.get("active_rules", []) if r.get("active")]
        
        def is_duplicate(new_name, new_desc):
            """检查新规则是否和已有规则语义重复"""
            for en in existing_names:
                # 名称相似度检查：共享超过50%的字符
                common = set(new_name) & set(en)
                if len(common) > max(len(new_name), len(en)) * 0.5:
                    return True
            for ed in existing_descs:
                # 描述相似度检查：共享超过40%的关键词
                new_words = set(new_desc)
                old_words = set(ed)
                common = new_words & old_words
                if len(common) > max(len(new_words), len(old_words)) * 0.4:
                    return True
            return False
        
        rules = []
        for rd in rule_defs:
            if not rd.get("name"):
                continue
            # 代码层去重
            if is_duplicate(rd["name"], rd.get("description", "")):
                log.info(f"[RULES] 去重跳过: [{rd['name']}] 与已有规则太相似")
                continue
            rule = create_rule(
                name=rd["name"],
                creator_id=bot_id,
                creator_name=bot_name,
                location=rd.get("location", location),
                trigger=rd.get("trigger", "every_tick"),
                condition=rd.get("condition", {"always": True}),
                effects=rd.get("effects", []),
                description=rd.get("description", rd["name"]),
                durability=min(1000, max(1, rd.get("durability", 100))),
                decay_rate=max(0.01, min(1.0, rd.get("decay_rate", 0.1))),
            )
            rule["created_tick"] = world["time"]["tick"]
            if rd.get("trigger") == "on_time" and "trigger_hour" in rd:
                rule["trigger_hour"] = rd["trigger_hour"]
            rules.append(rule)
            
        return rules
        
    except Exception as e:
        log.error(f"[RULES] generate_rules_from_action LLM失败: {e}")
        return []


def get_rules_summary(world, location=None):
    """获取规则摘要，供 bot 感知。"""
    rules = world.get("active_rules", [])
    active = [r for r in rules if r.get("active", True)]
    
    if location:
        # 该地点的规则 + 全局规则
        relevant = [r for r in active if r.get("location") == location or r.get("location") is None]
    else:
        relevant = active
    
    summaries = []
    for r in relevant[-10:]:
        creator = r.get("creator_name", "?")
        dur_pct = int(r.get("durability", 0))
        summaries.append(f"[{r['name']}] by {creator} (耐久:{dur_pct}%): {r['description'][:50]}")
    
    return summaries


def get_attraction_signals(bot):
    """获取bot收到的吸引信号"""
    signals = bot.get("attraction_signals", [])
    if signals:
        # 清除已处理的信号
        bot["attraction_signals"] = []
    return signals
