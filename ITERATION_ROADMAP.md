# 深圳生存模拟 — 迭代与优化路线图

本文档记录工程/架构优化项与玩法/机制/研究方向的迭代清单，后续可逐项推进。

---

## 一、工程与架构优化

| # | 项 | 说明 |
|---|----|------|
| 1 | **拆分巨型文件，模块化** | `world_engine_v8.py` ~3700 行、`bot_agent_v8.py` ~1200 行，难以维护。建议按领域拆成 `time_and_tick`、`locations`、`economy`、`emotions`、`actions`、`rules_engine` 等模块，并用 dataclass/Pydantic 统一状态结构。 |
| 2 | **Prompt 与配置外置** | 将各类 prompt 抽到 `prompts/*.md` 或 yaml，代码只做变量填充；便于版本管理和 A/B 测试。 |
| 3 | **LLM 调用鲁棒性与可观测** | 在已有 JSON 清洗/ try-except 基础上：关键请求/响应写结构化日志、对关键字段做 schema 校验与默认值修复。 |
| 4 | **性能与成本** | 考虑「计划-执行多步」减少调用频率、对低优先级 Bot 抽帧更新、简单决策用本地小模型、大模型留给关键抉择与反思。 |
| 5 | **测试与 CI** | 为 `world_rules_engine` 写 condition/effect 单测；状态同步、情绪衰减、反重复逻辑的测试；固定 seed 的短仿真回归（如 N tick 内不饿死、活跃规则数合理）。 |

---

## 二、玩法、机制与研究方向的迭代

| # | 项 | 说明 |
|---|----|------|
| 1 | **落地 Generic 工具，替代旧 action 菜单** | 按 `v10_design.md`：Bot 只使用 5 个工具（use_resource / interact / move / create / express），world 实现 `execute_generic`，旧 eat/work/talk 等逐步收口为工具调用的封装；与规则引擎结合，让 create/interact 自动生成持久规则。 |
| 2 | **「手机 + 信息世界」** | 参考 `real_person_analysis.md`：新闻/热搜流、朋友圈时间线（发帖/看帖/点赞/评论）、异地私聊；信息暴露 → 情绪与行为变化。 |
| 3 | **社交网络与派系** | 显式社交图（friend/mentor/敌对等），观察小圈子与孤立个体演化；规则可基于社交图影响行为或价格。 |
| 4 | **经济与物品系统** | 物品所有权与交易（手机、电脑、吉他等）、更多消费场景（娱乐、租房、医疗）、简单供需（岗位/摊位拥挤导致报酬变化、商品涨价或缺货）。 |
| 5 | **长期运行与数据分析** | 虚拟长时间（如一个月）运行；抽取人生轨迹、贫富与社交结构；Dashboard 增加时间轴回放与统计面板。 |
| 6 | **抉择事件系统（Dilemma）** | 统一事件格式与配置库，按条件（极端贫困、重病等）投放；抉择后果模板（欲望/价值观/关系/公共记忆）；与规则引擎结合产生新规则或社会标签。 |

---

## 当前保留的单一版本（清理后）

- **世界引擎**: `world_engine_v8.py`
- **Bot Agent**: `bot_agent_v8.py`
- **Dashboard**: `sz_dashboard_v6.py`
- **规则引擎**: `world_rules_engine.py`
- **启动**: `run.sh`（启动 world_engine_v8 + sz_dashboard_v6，Bot 由世界引擎拉起）

旧版本已删除：`bot_agent_v7.py`、`world_engine_v7.py`、`sz_dashboard_v4.py`、`sz_dashboard_v5.py`、`run_v7.sh`。
