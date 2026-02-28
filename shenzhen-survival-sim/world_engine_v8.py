#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
深圳生存模拟 - 世界引擎 v9.0 (自我进化)
=========================
v9.0 新增 (三大进化引擎):
- 开放式行动后果: bot可以永久改变世界(开店/涂鸦/种树/创建设施)
- 地点公共记忆 + 声望系统: 每个地点有历史,每个bot有公众声望
- 代际传承: 死亡后财富转移/记忆变城市传说/新bot继承关系网
v8.4 原有:
- 场景感知/个人命运事件/对话后果系统
v8.3.2 原有:
- 动态经济/心流/无聊感/认知失调
v8.3 原有:
- 同步总线/双向对话/长期目标
v8.2 原有:
- 寿命系统/固定开销/欲望衰减/世界叙事
v8 原有:
- 天气/情绪/朋友圈/新闻/开放式行动/随机事件
"""

import os, sys, json, random, time, logging, subprocess, re
from datetime import datetime
from threading import Thread, Lock
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from world_rules_engine import tick_rules, generate_rules_from_action, get_rules_summary, get_attraction_signals
from config import get_openai_client, get_grok_api_key, LOGS_DIR, SELFIES_DIR, SNAPSHOT_PATH, BOT_AGENT_SCRIPT, PROJECT_ROOT, AVATAR_DIRS, OPENAI_MODEL_NANO, OPENAI_MODEL_MINI

# ============================================================
# 日志（使用 config 中的路径，兼容本机与服务器）
# ============================================================
os.makedirs(LOGS_DIR, exist_ok=True)
os.makedirs(SELFIES_DIR, exist_ok=True)

log = logging.getLogger("world")
log.setLevel(logging.DEBUG)
fh = logging.FileHandler(os.path.join(LOGS_DIR, "world_engine.log"), encoding="utf-8")
fh.setFormatter(logging.Formatter("%(asctime)s [WORLD] %(levelname)s %(message)s"))
sh = logging.StreamHandler()
sh.setFormatter(logging.Formatter("%(asctime)s [WORLD] %(levelname)s %(message)s"))
log.addHandler(fh)
log.addHandler(sh)

app = FastAPI(title="深圳生存模拟 v9.0 - 自我进化")

# CORS - 允许像素城市前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = get_openai_client()
lock = Lock()

# ============================================================
# Grok 图像生成（Key 来自 config.get_grok_api_key）
# ============================================================
def grok_generate(prompt: str, save_path: str) -> dict:
    import requests as req
    api_key = get_grok_api_key()
    if not api_key:
        return {"success": False, "error": "未配置 GROK_API_KEY，请在 .env 或环境变量中设置"}
    try:
        resp = req.post(
            "https://api.x.ai/v1/images/generations",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "grok-2-image", "prompt": prompt, "n": 1, "response_format": "url"},
            timeout=120,
        )
        data = resp.json()
        if "data" not in data or not data["data"]:
            return {"success": False, "error": f"API响应异常: {json.dumps(data, ensure_ascii=False)[:200]}"}
        url = data["data"][0]["url"]
        img = req.get(url, timeout=60)
        with open(save_path, "wb") as f:
            f.write(img.content)
        return {"success": True, "path": save_path}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# 常量与配置
# ============================================================

# --- 寿命系统 (HP→不可逆寿命) ---
AGING_BASE = 0.5               # 每tick基础衰老 (100寿命 / 0.5 = 200tick ≈ 加速模式约50分钟)
AGING_HUNGER_MULT = 5.0        # 饥饿时衰老加速倍率
AGING_OVERWORK_MULT = 3.0      # 过劳时衰老加速倍率
AGING_SICK_MULT = 2.0          # 生病时衰老加速倍率

# --- 固定开销 ---
DAILY_RENT = {
    "宝安城中村": 15,  # 城中村便宜
    "南山公寓": 50,    # 白领公寓贵
}
DAILY_MISC_COST = 5            # 每日杂费

# --- 数值衰减/恢复 ---
SATIETY_DECAY = 2
ENERGY_DAY_COST = 2
ENERGY_NIGHT_RECOVER = 5
ENERGY_SLEEP_RECOVER = 15
DESIRE_DECAY_ON_FULFILL = 30

# --- 天气系统 ---
WEATHER_TYPES = {
    "晴天": {"desc": "阳光明媚，适合外出", "mood_effect": {"happiness": 1, "sadness": -1}, "energy_mod": 0, "event_chance_mod": 0},
    "多云": {"desc": "天空灰蒙蒙的", "mood_effect": {"happiness": 0}, "energy_mod": 0, "event_chance_mod": 0},
    "小雨": {"desc": "淅淅沥沥的小雨", "mood_effect": {"sadness": 2, "loneliness": 2}, "energy_mod": -1, "event_chance_mod": 0.02},
    "暴雨": {"desc": "倾盆大雨，出行困难", "mood_effect": {"anxiety": 3, "sadness": 3}, "energy_mod": -3, "event_chance_mod": 0.05},
    "台风": {"desc": "台风来袭！所有人尽量待在室内", "mood_effect": {"anxiety": 8, "sadness": 2}, "energy_mod": -5, "event_chance_mod": 0.15},
    "闷热": {"desc": "又热又闷，让人烦躁", "mood_effect": {"anger": 3, "happiness": -2}, "energy_mod": -2, "event_chance_mod": 0.01},
    "凉爽": {"desc": "难得的凉爽天气", "mood_effect": {"happiness": 2, "anxiety": -2}, "energy_mod": 1, "event_chance_mod": 0},
}

WEATHER_TRANSITION = {
    "晴天": ["晴天", "晴天", "多云", "闷热", "凉爽"],
    "多云": ["多云", "晴天", "小雨", "闷热"],
    "小雨": ["小雨", "多云", "暴雨", "多云"],
    "暴雨": ["暴雨", "小雨", "多云", "台风"],
    "台风": ["台风", "暴雨", "小雨"],
    "闷热": ["闷热", "晴天", "暴雨", "多云"],
    "凉爽": ["凉爽", "晴天", "多云"],
}

# --- 情绪系统 ---
EMOTION_DIMS = ["happiness", "sadness", "anger", "anxiety", "loneliness"]
EMOTION_LABELS = {"happiness": "开心", "sadness": "难过", "anger": "愤怒", "anxiety": "焦虑", "loneliness": "孤独"}
EMOTION_DECAY = {"happiness": -0.5, "sadness": -1, "anger": -2, "anxiety": -0.5, "loneliness": 0.5}  # 每tick自然衰减/增长 (v8.3: 大幅降低happiness衰减，让快乐更持久)

# --- 食物菜单 ---
FOOD_MENU = {
    "城中村快餐": {"cost": 5, "satiety": 40, "mood": {"happiness": 1}},
    "路边摊炒粉": {"cost": 12, "satiety": 50, "mood": {"happiness": 5}},
    "便利店饭团": {"cost": 8, "satiety": 30, "mood": {"happiness": 1}},
    "麦当劳套餐": {"cost": 35, "satiety": 60, "mood": {"happiness": 8}},
    "火锅": {"cost": 80, "satiety": 90, "mood": {"happiness": 8, "loneliness": -5}},
    "泡面": {"cost": 3, "satiety": 25, "mood": {"sadness": 3}},
    "奶茶": {"cost": 15, "satiety": 10, "mood": {"happiness": 4, "anxiety": -2}},
}

# --- 欲望系统 ---
DESIRE_DIMS = ["lust", "power", "greed", "vanity", "security"]
DESIRE_GROWTH_PER_TICK = {"lust": 0.8, "power": 0.3, "greed": 0.5, "vanity": 0.4, "security": 0.2}

BOT_DESIRE_PROFILES = {
    "bot_1": {"lust_mult": 0.8, "power_mult": 0.5, "greed_mult": 0.6, "vanity_mult": 0.3, "security_mult": 1.2},
    "bot_2": {"lust_mult": 0.6, "power_mult": 1.5, "greed_mult": 1.8, "vanity_mult": 1.5, "security_mult": 0.8},
    "bot_3": {"lust_mult": 1.0, "power_mult": 0.3, "greed_mult": 0.8, "vanity_mult": 0.2, "security_mult": 1.5},
    "bot_4": {"lust_mult": 0.7, "power_mult": 0.2, "greed_mult": 0.3, "vanity_mult": 1.2, "security_mult": 0.9},
    "bot_5": {"lust_mult": 2.0, "power_mult": 0.8, "greed_mult": 1.5, "vanity_mult": 1.8, "security_mult": 0.3},
    "bot_6": {"lust_mult": 0.5, "power_mult": 1.8, "greed_mult": 1.2, "vanity_mult": 0.8, "security_mult": 1.0},
    "bot_7": {"lust_mult": 1.0, "power_mult": 1.5, "greed_mult": 2.0, "vanity_mult": 1.0, "security_mult": 1.3},
    "bot_8": {"lust_mult": 0.2, "power_mult": 0.3, "greed_mult": 0.5, "vanity_mult": 0.3, "security_mult": 2.0},
    "bot_9": {"lust_mult": 1.2, "power_mult": 0.2, "greed_mult": 0.3, "vanity_mult": 1.5, "security_mult": 0.7},
    "bot_10":{"lust_mult": 0.8, "power_mult": 0.5, "greed_mult": 1.0, "vanity_mult": 2.5, "security_mult": 0.5},
}
DEFAULT_DESIRE_PROFILE = {"lust_mult": 1.0, "power_mult": 1.0, "greed_mult": 1.0, "vanity_mult": 1.0, "security_mult": 1.0}

# --- 地点 ---
LOCATIONS = {
    "宝安城中村":  {"desc": "密密麻麻的握手楼，便宜但嘈杂", "type": "residential"},
    "南山科技园":  {"desc": "高新技术企业聚集地", "type": "business"},
    "福田CBD":     {"desc": "金融中心，高楼林立", "type": "business"},
    "华强北":      {"desc": "电子产品集散地，人流密集", "type": "commercial"},
    "东门老街":    {"desc": "传统商业街，日结工多", "type": "commercial"},
    "南山公寓":    {"desc": "白领合租公寓", "type": "residential"},
    "深圳湾公园":  {"desc": "海边公园，适合散步思考", "type": "leisure"},
}

# --- 工作 ---
JOBS = {
    "宝安城中村": [
        {"title": "外卖骑手", "skill": "none", "min_skill": 0, "pay": 35,
         "tasks": [
             {"name": "送3单外卖", "duration": 2, "difficulty": 0.2, "desc": "骑电动车穿梭在城中村小巷里送餐"},
             {"name": "送5单外卖(高峰)", "duration": 3, "difficulty": 0.4, "desc": "午高峰订单多，时间紧"},
         ]},
        {"title": "餐馆帮工", "skill": "none", "min_skill": 0, "pay": 30,
         "tasks": [
             {"name": "洗碗切菜", "duration": 2, "difficulty": 0.1, "desc": "在后厨帮忙洗碗切菜"},
             {"name": "端盘子招呼客人", "duration": 3, "difficulty": 0.2, "desc": "前厅服务，端菜收桌"},
         ]},
        {"title": "快递分拣", "skill": "none", "min_skill": 0, "pay": 28,
         "tasks": [
             {"name": "分拣100个包裹", "duration": 2, "difficulty": 0.15, "desc": "在快递站分拣包裹"},
         ]},
    ],
    "南山科技园": [
        {"title": "初级程序员", "skill": "tech", "min_skill": 20, "pay": 80,
         "tasks": [
             {"name": "修复登录页面Bug", "duration": 3, "difficulty": 0.3, "desc": "用户反馈登录页面偶尔白屏"},
             {"name": "写API接口", "duration": 4, "difficulty": 0.4, "desc": "按产品需求写一个新的REST API"},
             {"name": "做Code Review", "duration": 2, "difficulty": 0.25, "desc": "审查同事提交的代码"},
         ]},
        {"title": "产品助理", "skill": "social", "min_skill": 15, "pay": 60,
         "tasks": [
             {"name": "整理用户反馈", "duration": 2, "difficulty": 0.2, "desc": "从各渠道收集整理用户意见"},
             {"name": "画产品原型", "duration": 3, "difficulty": 0.35, "desc": "用Figma画新功能的原型图"},
         ]},
    ],
    "福田CBD": [
        {"title": "金融实习生", "skill": "social", "min_skill": 25, "pay": 70,
         "tasks": [
             {"name": "整理财报数据", "duration": 3, "difficulty": 0.3, "desc": "把上市公司财报数据录入Excel"},
             {"name": "陪客户开会", "duration": 2, "difficulty": 0.2, "desc": "跟着经理去见客户，做会议记录"},
         ]},
        {"title": "销售代表", "skill": "social", "min_skill": 20, "pay": 55,
         "tasks": [
             {"name": "打50个Cold Call", "duration": 3, "difficulty": 0.4, "desc": "给潜在客户打电话推销产品"},
             {"name": "跟进3个意向客户", "duration": 2, "difficulty": 0.3, "desc": "约客户见面谈合作"},
         ]},
    ],
    "华强北": [
        {"title": "电子产品销售", "skill": "social", "min_skill": 10, "pay": 45,
         "tasks": [
             {"name": "卖手机配件", "duration": 2, "difficulty": 0.2, "desc": "在柜台卖手机壳、充电线"},
             {"name": "组装电脑", "duration": 3, "difficulty": 0.35, "desc": "按客户需求组装一台台式机"},
         ]},
        {"title": "直播带货助手", "skill": "social", "min_skill": 15, "pay": 50,
         "tasks": [
             {"name": "准备直播间", "duration": 2, "difficulty": 0.15, "desc": "布置灯光、摆放产品、测试设备"},
             {"name": "协助主播卖货", "duration": 3, "difficulty": 0.3, "desc": "在直播间递产品、回复弹幕"},
         ]},
    ],
    "东门老街": [
        {"title": "日结搬运工", "skill": "none", "min_skill": 0, "pay": 40,
         "tasks": [
             {"name": "搬货卸车", "duration": 2, "difficulty": 0.25, "desc": "帮商家从货车上卸货搬进店里"},
             {"name": "仓库整理", "duration": 3, "difficulty": 0.15, "desc": "整理仓库货架，分类摆放"},
         ]},
        {"title": "街头传单", "skill": "none", "min_skill": 0, "pay": 25,
         "tasks": [
             {"name": "发2小时传单", "duration": 2, "difficulty": 0.1, "desc": "在人流密集处发宣传单"},
         ]},
    ],
    "南山公寓": [
        {"title": "家政保洁", "skill": "none", "min_skill": 0, "pay": 35,
         "tasks": [
             {"name": "打扫3间房", "duration": 2, "difficulty": 0.15, "desc": "帮租户打扫房间"},
         ]},
    ],
    "深圳湾公园": [
        {"title": "公园保洁", "skill": "none", "min_skill": 0, "pay": 25,
         "tasks": [
             {"name": "清扫步道", "duration": 2, "difficulty": 0.1, "desc": "清扫公园步道上的垃圾"},
         ]},
        {"title": "街头艺人", "skill": "social", "min_skill": 15, "pay": 30,
         "tasks": [
             {"name": "表演2小时", "duration": 2, "difficulty": 0.3, "desc": "在公园广场表演才艺赚打赏"},
         ]},
    ],
}

# --- 人设 ---
PERSONAS = {
    "bot_1":  {"name": "李浩然", "age": 24, "gender": "男", "origin": "湖南长沙", "edu": "计算机硕士",
               "home": "宝安城中村", "start_loc": "宝安城中村", "money": 800, "hp": 100},
    "bot_2":  {"name": "王雪",   "age": 26, "gender": "女", "origin": "上海", "edu": "金融学学士",
               "home": "南山公寓", "start_loc": "南山公寓", "money": 2000, "hp": 100},
    "bot_3":  {"name": "张伟",   "age": 28, "gender": "男", "origin": "河南周口", "edu": "高中",
               "home": "宝安城中村", "start_loc": "宝安城中村", "money": 300, "hp": 100},
    "bot_4":  {"name": "陈静",   "age": 22, "gender": "女", "origin": "四川成都", "edu": "艺术设计大专",
               "home": "宝安城中村", "start_loc": "宝安城中村", "money": 500, "hp": 100},
    "bot_5":  {"name": "赵磊",   "age": 25, "gender": "男", "origin": "深圳本地", "edu": "社区大学",
               "home": "南山公寓", "start_loc": "华强北", "money": 3000, "hp": 100},
    "bot_6":  {"name": "刘悦",   "age": 30, "gender": "女", "origin": "山东青岛", "edu": "MBA",
               "home": "南山公寓", "start_loc": "福田CBD", "money": 5000, "hp": 100},
    "bot_7":  {"name": "周建国", "age": 45, "gender": "男", "origin": "浙江温州", "edu": "小学",
               "home": "宝安城中村", "start_loc": "华强北", "money": 1500, "hp": 100},
    "bot_8":  {"name": "吴秀英", "age": 52, "gender": "女", "origin": "广东潮汕", "edu": "初中",
               "home": "宝安城中村", "start_loc": "宝安城中村", "money": 600, "hp": 100},
    "bot_9":  {"name": "林枫",   "age": 21, "gender": "男", "origin": "福建厦门", "edu": "音乐学院肄业",
               "home": "宝安城中村", "start_loc": "东门老街", "money": 200, "hp": 100},
    "bot_10": {"name": "苏小小", "age": 19, "gender": "女", "origin": "湖北武汉", "edu": "网红培训班",
               "home": "宝安城中村", "start_loc": "华强北", "money": 400, "hp": 100},
}

FAMILY_RELATIONS = {
    "bot_3": {"parents": ["bot_8"], "children": []},
    "bot_8": {"parents": [], "children": ["bot_3"]},
}

# --- 生活琐事 / 随机事件 ---
RANDOM_EVENTS = [
    # 天气/环境类
    {"name": "突然下雨", "desc": "天空突然下起大雨，没带伞的人都在找地方躲雨", "effect": "mood_sadness_up",
     "mood": {"sadness": 5, "anxiety": 3}},
    {"name": "看到美丽的晚霞", "desc": "天边出现了绝美的晚霞，很多人停下来拍照", "effect": "mood_happy",
     "mood": {"happiness": 8, "loneliness": -3}},
    {"name": "被蚊子咬了", "desc": "胳膊上被蚊子咬了好几个包", "effect": "mosquito",
     "mood": {"anger": 3}},
    {"name": "电梯坏了", "desc": "住的楼电梯又坏了，只能爬楼梯", "effect": "elevator_broken",
     "mood": {"anger": 4, "anxiety": 2}},
    # 人际互动类
    {"name": "路边有人吵架", "desc": "两个人因为停车问题在路边大吵，引来一圈围观的人", "effect": "mood_anxiety_up",
     "mood": {"anxiety": 3, "anger": 2}},
    {"name": "附近有免费试吃", "desc": "新开的店在搞免费试吃活动，排了好长的队", "effect": "free_food",
     "mood": {"happiness": 5}},
    {"name": "收到诈骗电话", "desc": "接到一个自称是公安局的电话，要求转账", "effect": "scam_call",
     "mood": {"anxiety": 8, "anger": 5}},
    {"name": "路上捡到50块钱", "desc": "在地上发现一张50元纸币", "effect": "found_money",
     "mood": {"happiness": 10}},
    {"name": "看到流浪猫", "desc": "路边有一只可怜的流浪猫在喵喵叫，看起来很饿", "effect": "stray_cat",
     "mood": {"sadness": 3, "loneliness": -2}},
    {"name": "听到好听的街头音乐", "desc": "有人在路边弹吉他唱歌，周围聚了一圈人", "effect": "street_music",
     "mood": {"happiness": 6, "loneliness": -4}},
    {"name": "收到家人的微信红包", "desc": "家人发了一个小红包过来，附带一句“注意身体”", "effect": "family_gift",
     "mood": {"happiness": 10, "loneliness": -8}},
    {"name": "看到有人在直播", "desc": "路边有网红在直播，围了一圈人，很热闹", "effect": "live_stream",
     "mood": {"happiness": 2}},
    {"name": "物价又涨了", "desc": "常去的快餐店涨价了2块钱，老板说是因为房租涨了", "effect": "price_up",
     "mood": {"anxiety": 4, "anger": 3}},
    # NPC主动互动类（新增）
    {"name": "房东来收租", "desc": "房东王姐来敲门收租了，还唠叨了几句“下个月要涨租”", "effect": "rent_due",
     "mood": {"anxiety": 8, "anger": 3}},
    {"name": "早餐摊老李多给了一个鸡蛋", "desc": "早餐摊老李今天心情好，多给了一个煎蛋，说“小伙子多吃点”", "effect": "npc_kind",
     "mood": {"happiness": 6, "loneliness": -3}},
    {"name": "保安查居住证", "desc": "保安老张来查居住证，没有的话要被赶出去", "effect": "id_check",
     "mood": {"anxiety": 10, "anger": 5}},
    {"name": "HR小陈主动联系你", "desc": "HR小陈发来消息：“我们公司在招人，你有兴趣吗？”", "effect": "job_offer",
     "mood": {"happiness": 5, "anxiety": -3}},
    {"name": "隔壁室友小刘邀请你吃饭", "desc": "室友小刘说今晚他做饭，问你要不要一起吃", "effect": "dinner_invite",
     "mood": {"happiness": 8, "loneliness": -10}},
    {"name": "手机贩子阿强发来一条货源信息", "desc": "阿强发来消息：“兄弟，新到一批货，价格美丽，要不要看看？”", "effect": "biz_opportunity",
     "mood": {"happiness": 3}},
    # 社会事件类（新增）
    {"name": "街头有人卖艺", "desc": "一个年轻人在街头表演魔术，引来一大群人围观", "effect": "street_show",
     "mood": {"happiness": 5, "loneliness": -3}},
    {"name": "附近开了一家新店", "desc": "街角新开了一家奶茶店，打折促销中，排队的人很多", "effect": "new_shop",
     "mood": {"happiness": 3}},
    {"name": "城管来了", "desc": "城管来清理路边摊贩，小贩们慢慢散去，气氛紧张", "effect": "chengguan",
     "mood": {"anxiety": 5, "anger": 3}},
    {"name": "有人在发传单", "desc": "一个大姐在发传单，上面写着“高薪招聘，日结200”", "effect": "flyer",
     "mood": {"happiness": 2}},
    {"name": "深夜有人在楼下吵架", "desc": "半夜被楼下的吵架声吵醒，一对情侣在大声争君", "effect": "night_fight",
     "mood": {"anger": 3, "anxiety": 4, "sadness": 2}},
    {"name": "快递到了", "desc": "之前网上买的东西到了，拆快递的快乐无与伦比", "effect": "package",
     "mood": {"happiness": 8}},
    {"name": "看到以前的同学发的朋友圈", "desc": "以前的同学在朋友圈晒了买车照，而你还在城中村挤公交", "effect": "social_compare",
     "mood": {"sadness": 8, "anxiety": 5, "happiness": -5}},
]

# --- 新闻模板（会被真实新闻替换） ---
NEWS_TEMPLATES = [
    "深圳今日新增3个地铁站开通，南山到宝安通勤时间缩短15分钟",
    "华强北商户反映今年电子产品出口订单增长20%",
    "深圳发布人才补贴新政：本科毕业生可领1.5万元",
    "福田CBD写字楼空置率创新高，租金下降10%",
    "深圳湾公园周末游客量突破5万人次",
    "城中村改造计划公布：宝安3个城中村将拆迁重建",
    "深圳最低工资标准调整为2460元/月",
    "南山科技园某公司裁员30%，员工在楼下拉横幅",
    "深圳地铁11号线早高峰故障，大量乘客滞留",
    "东门老街夜市回归，日均客流量超10万",
    "深圳房价连续3个月下跌，二手房成交量回暖",
    "华强北出现新型AI硬件创业潮，多家初创公司入驻",
    "深圳暑期气温破40度，多人中暑送医",
    "外卖骑手权益保障新规出台，平台需为骑手购买保险",
    "深圳某网红奶茶店被曝使用过期原料",
]


# ============================================================
# 世界状态
# ============================================================
world = {
    "time": {"tick": 0, "virtual_hour": 6, "virtual_day": 1, "virtual_datetime": "第1天 06:00"},
    "weather": {"current": "晴天", "desc": "阳光明媚，适合外出", "changed_at_tick": 0},
    "news_feed": [],       # 当前可见的新闻 (最近5条)
    "hot_topics": [],      # 热搜话题
    "bots": {},
    "locations": {},
    "events": [],          # 世界事件历史
    "active_effects": [],
    "world_narrative": "这座城市刚刚苏醒，故事还没有开始。",
    "message_board": [],   # 消息板
    "moments": [],         # 朋友圈 (所有帖子)
    "gallery": [],         # 照片墙
    "food_prices": {},      # v8.3.2: 动态食物价格
    # === v9.0: 三大进化引擎数据 ===
    "world_modifications": [],   # 永久世界改造列表 [{creator, type, name, desc, location, tick, effects}]
    "urban_legends": [],         # 城市传说 (死亡bot的核心记忆转化)
    "generation_count": 0,       # 当前代数
    "graveyard": [],             # 墓地 (死亡bot的记录)
    "reputation_board": {},      # 全局声望榜 {bot_id: {score, tags, deeds}}
    # === v10.1: 世界规则引擎 ===
    "active_rules": [],             # 活跃的世界运行规则
}


def create_bot(bot_id):
    p = PERSONAS[bot_id]
    family = FAMILY_RELATIONS.get(bot_id, {"parents": [], "children": []})
    profile = BOT_DESIRE_PROFILES.get(bot_id, DEFAULT_DESIRE_PROFILE)
    return {
        "id": bot_id,
        "name": p["name"],
        "age": p["age"],
        "gender": p["gender"],
        "origin": p["origin"],
        "edu": p["edu"],
        "home": p["home"],
        "location": p["start_loc"],
        "hp": p["hp"],
        "money": p["money"],
        "energy": 100,
        "satiety": 70,
        "status": "alive",
        "job": None,
        "skills": {"tech": random.randint(5, 30), "social": random.randint(5, 30),
                    "creative": random.randint(5, 30), "physical": random.randint(5, 30)},
        "inventory": [],
        "relationships": {},
        "family": family,
        "action_log": [],
        "is_sleeping": False,
        "current_task": None,
        "selfie_count": 0,
        # v8 新增
        "emotions": {"happiness": 50, "sadness": 10, "anger": 5, "anxiety": 20, "loneliness": 30},
        "desires": {
            "lust": random.randint(10, 30) * profile.get("lust_mult", 1.0),
            "power": random.randint(5, 20) * profile.get("power_mult", 1.0),
            "greed": random.randint(10, 30) * profile.get("greed_mult", 1.0),
            "vanity": random.randint(10, 25) * profile.get("vanity_mult", 1.0),
            "security": random.randint(5, 20) * profile.get("security_mult", 1.0),
        },
        "phone_battery": 100,  # 手机电量
        # 内心状态 (由Bot Agent同步过来)
        "values": {"original": "", "current": "", "shifts": []},
        "core_memories": [],
        "emotional_bonds": {},
        # v8.3 新增
        "long_term_goal": None,           # 长期目标
        "pending_reply_to": None,         # 待回应的对话 {"from": bot_id, "msg": "...", "tick": N}
        "recent_actions_synced": [],      # 由bot_agent同步过来的最近行动
        "current_activity": "",              # v8.4: 当前正在做的事（一句话描述，供其他bot观察）
        # v9.0: 进化引擎新字段
        "reputation": {"score": 0, "tags": [], "deeds": []},  # 公众声望
        "created_things": [],     # 这个bot创造的永久改变
        "generation": 0,          # 第几代bot
        "inherited_from": None,   # 继承自哪个死亡bot
        "known_legends": [],      # 知道的城市传说
    }


def init_world():
    # 初始化地点
    for loc_name, loc_data in LOCATIONS.items():
        world["locations"][loc_name] = {
            "desc": loc_data["desc"],
            "type": loc_data["type"],
            "bots": [],
            "npcs": generate_npcs(loc_name),
            "items": [],
            "jobs": JOBS.get(loc_name, []),
            # v9.0: 地点公共记忆
            "public_memory": [],       # 这个地点发生过的重要事件 [{event, actor, tick, impact}]
            "modifications": [],       # 这个地点的永久改造 [{name, creator, desc, tick}]
            "vibe": "普通",             # 地点氛围(由历史事件塾积而成)
        }

    # 尝试从快照恢复
    snapshot_path = SNAPSHOT_PATH
    if os.path.exists(snapshot_path):
        try:
            with open(snapshot_path, "r") as f:
                snap = json.load(f)
            world["time"] = snap["time"]
            world["events"] = snap.get("events", [])
            world["message_board"] = snap.get("message_board", [])
            world["moments"] = snap.get("moments", [])
            world["gallery"] = snap.get("gallery", [])
            world["world_narrative"] = snap.get("world_narrative", "")
            world["news_feed"] = snap.get("news_feed", [])
            world["hot_topics"] = snap.get("hot_topics", [])
            world["weather"] = snap.get("weather", world["weather"])
            world["food_prices"] = snap.get("food_prices", {})
            # v9.0: 恢复进化引擎数据
            world["world_modifications"] = snap.get("world_modifications", [])
            world["urban_legends"] = snap.get("urban_legends", [])
            world["generation_count"] = snap.get("generation_count", 0)
            world["graveyard"] = snap.get("graveyard", [])
            world["reputation_board"] = snap.get("reputation_board", {})
            world["active_rules"] = snap.get("active_rules", [])

            for bid, bdata in snap.get("bots", {}).items():
                bot = create_bot(bid)
                # 恢复数值
                for key in ["hp", "money", "energy", "satiety", "status", "job", "location",
                            "skills", "inventory", "relationships", "action_log", "is_sleeping",
                            "current_task", "selfie_count", "desires", "emotions",
                            "phone_battery", "values", "core_memories", "emotional_bonds",
                            "long_term_goal", "pending_reply_to", "recent_actions_synced",
                            "narrative_summary", "current_activity",
                            # v9.0
                            "reputation", "created_things", "generation",
                            "inherited_from", "known_legends"]:
                    if key in bdata:
                        bot[key] = bdata[key]
                # 家庭关系：如果快照中为空则用默认值
                family = bdata.get("family", {})
                if not family or (not family.get("parents") and not family.get("children")):
                    bot["family"] = FAMILY_RELATIONS.get(bid, {"parents": [], "children": []})
                else:
                    bot["family"] = family
                # 确保v8新字段存在
                if "emotions" not in bot or not bot["emotions"]:
                    bot["emotions"] = {"happiness": 50, "sadness": 10, "anger": 5, "anxiety": 20, "loneliness": 30}
                if "phone_battery" not in bot:
                    bot["phone_battery"] = 100
                world["bots"][bid] = bot
                loc = bot["location"]
                if loc in world["locations"] and bid not in world["locations"][loc]["bots"]:
                    world["locations"][loc]["bots"].append(bid)

            # v9.0: 恢复地点的公共记忆和改造
            for loc_name in world["locations"]:
                loc_snap = snap.get("locations", {}).get(loc_name, {})
                if loc_snap:
                    world["locations"][loc_name]["public_memory"] = loc_snap.get("public_memory", [])
                    world["locations"][loc_name]["modifications"] = loc_snap.get("modifications", [])
                    world["locations"][loc_name]["vibe"] = loc_snap.get("vibe", "普通")

            log.info(f"从快照恢复成功: tick={world['time']['tick']}, {len(world['bots'])}个Bot")
            return
        except Exception as e:
            log.error(f"快照恢复失败: {e}")

    # 全新世界
    for bid in PERSONAS:
        bot = create_bot(bid)
        world["bots"][bid] = bot
        loc = bot["location"]
        world["locations"][loc]["bots"].append(bid)

    # 初始新闻
    inject_news()

    # === v10.1: 注入种子规则（打破冷启动） ===
    from world_rules_engine import create_rule
    seed_rules = [
        create_rule(
            name="早餐摒老李的炒粉摒",
            creator_id="npc_vendor", creator_name="早餐摒老李",
            location="宝安城中村",
            trigger="every_tick",
            condition={"and": [{"time_between": [6, 22]}, {"random": 0.15}]},
            effects=[
                {"type": "modify_bot_attr", "attr": "satiety", "delta": 35, "cost_money": 12},
                {"type": "modify_bot_emotion", "emotion": "happiness", "delta": 3},
                {"type": "generate_income", "target": "creator", "amount": 0},
                {"type": "narrative", "text": "老李的炒粉摒飘来阵阵香气，有人忍不住停下脚步买了一份"},
            ],
            description="宝安城中村的早餐摒老李每天卖炒粉，香气四溢，经过的人忍不住买一份",
            durability=500, decay_rate=0.02,
        ),
        create_rule(
            name="华强北地摒经济",
            creator_id="system", creator_name="城市系统",
            location="华强北",
            trigger="every_tick",
            condition={"and": [{"time_between": [9, 21]}, {"random": 0.1}]},
            effects=[
                {"type": "modify_bot_emotion", "emotion": "vanity", "delta": 2},
                {"type": "narrative", "text": "华强北的商贩们在大声吾喝，各种电子产品的叫卖声此起彼伏"},
            ],
            description="华强北的地摒经济永远充满活力，各种商品交易和小生意在这里不断发生",
            durability=999, decay_rate=0.005,
        ),
        create_rule(
            name="深圳湾公园的宁静",
            creator_id="system", creator_name="城市系统",
            location="深圳湾公园",
            trigger="every_tick",
            condition={"random": 0.2},
            effects=[
                {"type": "modify_bot_attr", "attr": "energy", "delta": 5},
                {"type": "modify_bot_emotion", "emotion": "happiness", "delta": 5},
                {"type": "modify_bot_emotion", "emotion": "anxiety", "delta": -3},
                {"type": "attract_bot", "chance": 0.05, "location": "深圳湾公园", "message": "海风徐徐，公园里传来宁静的气息"},
            ],
            description="深圳湾公园的海风和绿地让人心旷神怡，恢复精力和快乐",
            durability=999, decay_rate=0.005,
        ),
        create_rule(
            name="福田CBD的压力",
            creator_id="system", creator_name="城市系统",
            location="福田CBD",
            trigger="every_tick",
            condition={"and": [{"time_between": [9, 18]}, {"random": 0.15}]},
            effects=[
                {"type": "modify_bot_emotion", "emotion": "anxiety", "delta": 3},
                {"type": "modify_bot_emotion", "emotion": "vanity", "delta": 2},
                {"type": "narrative", "text": "周围的白领们行色匹匹，每个人都在为生活拼命"},
            ],
            description="福田CBD的快节奏让人焦虑但也刺激野心",
            durability=999, decay_rate=0.005,
        ),
        create_rule(
            name="东门老街的日结工招募",
            creator_id="npc_boss", creator_name="包工头老陈",
            location="东门老街",
            trigger="every_tick",
            condition={"and": [{"time_between": [7, 17]}, {"random": 0.1}]},
            effects=[
                {"type": "modify_bot_attr", "attr": "money", "delta": 80, "cost_money": 0},
                {"type": "modify_bot_attr", "attr": "energy", "delta": -30},
                {"type": "narrative", "text": "包工头老陈在招日结工，干一天能拿80块"},
            ],
            description="东门老街的包工头老陈每天招日结工，辛苦但能赚钱",
            durability=800, decay_rate=0.01,
        ),
    ]
    for sr in seed_rules:
        sr["created_tick"] = 0
    world["active_rules"] = seed_rules
    log.info(f"v10.1: 注入{len(seed_rules)}条种子规则")

    log.info("全新世界初始化完成")


def generate_npcs(loc_name):
    npc_pool = {
        "宝安城中村": [
            {"id": "npc_landlord", "name": "房东王姐", "role": "房东", "personality": "精明但不坏"},
            {"id": "npc_vendor", "name": "早餐摊老李", "role": "小贩", "personality": "热情健谈"},
            {"id": "npc_guard", "name": "保安老张", "role": "保安", "personality": "沉默寡言"},
        ],
        "南山科技园": [
            {"id": "npc_hr", "name": "HR小陈", "role": "招聘", "personality": "职业微笑"},
            {"id": "npc_coder", "name": "秃头程序员", "role": "路人", "personality": "疲惫但友善"},
        ],
        "福田CBD": [
            {"id": "npc_banker", "name": "银行经理刘总", "role": "金融", "personality": "势利但专业"},
            {"id": "npc_intern", "name": "实习生小美", "role": "实习生", "personality": "紧张焦虑"},
        ],
        "华强北": [
            {"id": "npc_dealer", "name": "手机贩子阿强", "role": "商贩", "personality": "油嘴滑舌"},
            {"id": "npc_tourist", "name": "外国游客Tom", "role": "游客", "personality": "好奇友好"},
        ],
        "东门老街": [
            {"id": "npc_boss", "name": "包工头老陈", "role": "包工头", "personality": "粗犷直接"},
            {"id": "npc_oldlady", "name": "卖菜阿婆", "role": "小贩", "personality": "慈祥唠叨"},
        ],
        "南山公寓": [
            {"id": "npc_neighbor", "name": "隔壁室友小刘", "role": "邻居", "personality": "安静内向"},
        ],
        "深圳湾公园": [
            {"id": "npc_runner", "name": "跑步大叔", "role": "路人", "personality": "阳光积极"},
            {"id": "npc_couple", "name": "拍婚纱照的情侣", "role": "路人", "personality": "甜蜜幸福"},
        ],
    }
    return npc_pool.get(loc_name, [])


# ============================================================
# 天气系统
# ============================================================
def update_weather():
    """每个虚拟日的6:00更新天气"""
    current = world["weather"]["current"]
    candidates = WEATHER_TRANSITION.get(current, ["多云"])
    new_weather = random.choice(candidates)
    info = WEATHER_TYPES[new_weather]
    world["weather"] = {
        "current": new_weather,
        "desc": info["desc"],
        "changed_at_tick": world["time"]["tick"],
    }
    log.info(f"🌤️ 天气变化: {current} -> {new_weather} ({info['desc']})")


# ============================================================
# 新闻/信息注入
# ============================================================
def inject_news():
    """注入新闻到世界中"""
    # 先尝试从真实新闻API获取
    real_news = fetch_real_news()
    if real_news:
        world["news_feed"] = real_news[-5:]
    else:
        # 用模板新闻
        selected = random.sample(NEWS_TEMPLATES, min(3, len(NEWS_TEMPLATES)))
        world["news_feed"] = [
            {"headline": n, "source": "深圳晚报", "tick": world["time"]["tick"],
             "time": world["time"]["virtual_datetime"]}
            for n in selected
        ]

    # 生成热搜话题
    world["hot_topics"] = generate_hot_topics()
    log.info(f"📰 新闻注入: {len(world['news_feed'])}条新闻, {len(world['hot_topics'])}个热搜")


def fetch_real_news():
    """尝试从真实新闻源获取深圳相关新闻"""
    try:
        import requests as req
        # 使用LLM生成当日新闻（模拟真实新闻注入）
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_NANO,
            messages=[{"role": "user", "content": f"""生成3条虚构但真实感很强的深圳本地新闻标题。
要求：
- 涉及深圳的经济、生活、科技、社会等不同方面
- 有正面也有负面
- 像真实新闻标题一样简洁
- 当前虚拟时间: {world['time']['virtual_datetime']}

只输出3行新闻标题，不要编号，不要其他文字。"""}],
            temperature=0.9, max_tokens=200,
        )
        lines = [l.strip() for l in resp.choices[0].message.content.strip().split("\n") if l.strip()]
        return [
            {"headline": l, "source": "AI深圳日报", "tick": world["time"]["tick"],
             "time": world["time"]["virtual_datetime"]}
            for l in lines[:5]
        ]
    except:
        return []


def generate_hot_topics():
    """生成热搜话题"""
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_NANO,
            messages=[{"role": "user", "content": f"""生成5个当前深圳年轻人会讨论的热搜话题。
要求：包含社会话题、娱乐八卦、生活吐槽等。简短，像微博热搜。
当前虚拟时间: {world['time']['virtual_datetime']}
只输出5行话题，不要编号。"""}],
            temperature=0.9, max_tokens=150,
        )
        lines = [l.strip().lstrip("#").strip() for l in resp.choices[0].message.content.strip().split("\n") if l.strip()]
        return lines[:5]
    except:
        return ["深圳打工人的日常", "城中村美食推荐", "今天又加班了", "深圳租房太贵了", "周末去哪玩"]


# ============================================================
# 世界 Tick
# ============================================================
def world_tick():
    with lock:
        t = world["time"]
        t["tick"] += 1
        t["virtual_hour"] = (6 + t["tick"]) % 24
        t["virtual_day"] = 1 + t["tick"] // 24
        vd = t['virtual_day']; vh = t['virtual_hour']
        t['virtual_datetime'] = f'第{vd}天 {vh:02d}:00'

        log.info(f'===== TICK {t["tick"]} | {t["virtual_datetime"]} | 天气:{world["weather"]["current"]} =====')

        # 每日6:00更新天气和新闻
        if vh == 6 and t["tick"] > 1:
            update_weather()
            inject_news()
        # 每6个tick也刷新一次新闻和热搜，保持内容新鲜
        elif t["tick"] % 6 == 0:
            inject_news()

        # 天气效果
        weather_info = WEATHER_TYPES.get(world["weather"]["current"], {})
        weather_mood = weather_info.get("mood_effect", {})

        alive_count = 0
        for bid, bot in world["bots"].items():
            if bot["status"] != "alive":
                continue
            alive_count += 1

            h = t["virtual_hour"]
            emotions = bot.get("emotions", {})

            # === 睡眠系统 ===
            if bot.get("is_sleeping", False):
                bot["energy"] = min(100, bot["energy"] + ENERGY_SLEEP_RECOVER)
                bot["satiety"] = max(0, bot["satiety"] - 1)
                # 睡觉时情绪恢复
                emotions["anxiety"] = max(0, emotions.get("anxiety", 20) - 3)
                emotions["anger"] = max(0, emotions.get("anger", 5) - 2)
                emotions["loneliness"] = max(0, emotions.get("loneliness", 30) - 1)
                bot["emotions"] = emotions
                # 手机充电
                bot["phone_battery"] = min(100, bot.get("phone_battery", 50) + 15)
                # 自动起床
                if 7 <= h < 23 and bot["energy"] >= 80:
                    bot["is_sleeping"] = False
                    log.info(f"{bid} 自然醒了 (能量={bot['energy']})")
                continue

            # === 正常状态: 寿命衰老 ===
            aging_rate = AGING_BASE
            # 饥饿加速衰老
            if bot["satiety"] <= 10:
                aging_rate *= AGING_HUNGER_MULT
                if not bot.get("_hunger_warned"):
                    log.warning(f"⚠️ {bid} 饥饿加速衰老! (x{AGING_HUNGER_MULT})")
                    bot["_hunger_warned"] = True
            else:
                bot["_hunger_warned"] = False
            # 过劳加速衰老 (能量<10且没睡觉)
            if bot["energy"] < 10 and not bot.get("is_sleeping", False):
                aging_rate *= AGING_OVERWORK_MULT
                if not bot.get("_overwork_warned"):
                    log.warning(f"⚠️ {bid} 过劳加速衰老! (x{AGING_OVERWORK_MULT})")
                    bot["_overwork_warned"] = True
            else:
                bot["_overwork_warned"] = False
            bot["hp"] = max(0, round(bot["hp"] - aging_rate, 3))
            bot["aging_rate"] = round(aging_rate, 4)
            bot["satiety"] = max(0, bot["satiety"] - SATIETY_DECAY)

            # 能量
            if h >= 22 or h < 6:
                bot["energy"] = min(100, bot["energy"] + ENERGY_NIGHT_RECOVER)
            else:
                bot["energy"] = max(0, bot["energy"] - ENERGY_DAY_COST)

            # 手机电量：自动慢充，作为背景变量不影响决策
            if bot.get("phone_battery", 100) < 80:
                bot["phone_battery"] = min(100, bot.get("phone_battery", 100) + random.randint(3, 8))
            else:
                bot["phone_battery"] = max(30, bot.get("phone_battery", 100) - random.randint(0, 2))

            # 饥饿惩罚（寿命加速衰老已在上面处理，这里只加情绪影响）
            if bot["satiety"] <= 0:
                emotions["sadness"] = min(100, emotions.get("sadness", 10) + 3)
                emotions["anxiety"] = min(100, emotions.get("anxiety", 20) + 2)
                log.warning(f"{bid} 饥饿中，加速衰老中!")

            # === 情绪自然衰减/增长 ===
            for emo_key, decay in EMOTION_DECAY.items():
                old = emotions.get(emo_key, 0)
                emotions[emo_key] = max(0, min(100, old + decay))

            # 天气影响情绪
            for emo_key, delta in weather_mood.items():
                emotions[emo_key] = max(0, min(100, emotions.get(emo_key, 0) + delta))

            # v8.3: 孤独感重新平衡 - 降低增长速度，提高社交减少量
            loc = bot["location"]
            nearby = [b for b in world["locations"].get(loc, {}).get("bots", []) if b != bid]
            if not nearby:
                emotions["loneliness"] = min(100, emotions.get("loneliness", 30) + 0.5)
            else:
                emotions["loneliness"] = max(0, emotions.get("loneliness", 30) - 5)

            # 金钱焦虑
            if bot["money"] < 50:
                emotions["anxiety"] = min(100, emotions.get("anxiety", 20) + 3)
                emotions["sadness"] = min(100, emotions.get("sadness", 10) + 2)
            elif bot["money"] < 100:
                emotions["anxiety"] = min(100, emotions.get("anxiety", 20) + 1)

            # 能量低时疲惫感
            if bot["energy"] < 20:
                emotions["sadness"] = min(100, emotions.get("sadness", 10) + 2)
                emotions["happiness"] = max(0, emotions.get("happiness", 50) - 3)

            # 无聊/无事可做时happiness自然下降
            # （已经通过EMOTION_DECAY实现）

            bot["emotions"] = emotions

            # === 欲望自然增长 ===
            desires = bot.get("desires", {})
            profile = BOT_DESIRE_PROFILES.get(bid, DEFAULT_DESIRE_PROFILE)
            for d_key, base_growth in DESIRE_GROWTH_PER_TICK.items():
                mult = profile.get(f"{d_key}_mult", 1.0)
                if d_key == "security" and (bot["hp"] < 30 or bot["money"] < 50):
                    mult *= 1.5
                if d_key == "greed" and bot["money"] < 100:
                    mult *= 1.3
                if d_key == "lust" and bot["energy"] > 60 and bot["satiety"] > 30:
                    mult *= 1.2
                if d_key == "lust":
                    if vh >= 22 or vh <= 5:
                        mult *= 1.5
                    gender = bot.get("gender", "")
                    for ob in nearby:
                        other = world["bots"].get(ob, {})
                        if other.get("gender") and other.get("gender") != gender and other.get("status") == "alive":
                            mult *= 1.3
                            break
                old_val = desires.get(d_key, 20)
                # 欲望超90自动衰减，80-90增长变慢
                if old_val >= 90:
                    desires[d_key] = max(0, old_val - random.uniform(0.5, 1.5))
                elif old_val >= 80:
                    desires[d_key] = min(100, old_val + base_growth * mult * 0.3)
                else:
                    desires[d_key] = min(100, old_val + base_growth * mult)
            bot["desires"] = desires

            # 死亡检测
            if bot["hp"] <= 0:
                bot["status"] = "dead"
                log.error(f"!!! {bid} 已死亡 !!! HP归零")
                if bid in world["locations"].get(loc, {}).get("bots", []):
                    world["locations"][loc]["bots"].remove(bid)
                # v9.0: 触发代际传承机制
                Thread(target=handle_bot_death, args=(bid,), daemon=True).start()

            # === 工作进度推进 ===
            task = bot.get("current_task")
            if task and task.get("status") == "in_progress":
                task["progress"] = task.get("progress", 0) + 1
                # 随机难点
                if not task.get("challenge") and random.random() < task.get("difficulty", 0.2) * 0.5:
                    challenges = ["客户突然改需求", "工具出故障了", "同事请假要帮忙", "材料不够用",
                                  "被老板催进度", "遇到技术难题", "天气影响了工作"]
                    task["challenge"] = random.choice(challenges)
                    log.info(f"{bid} 工作遇到难点: {task['challenge']}")
                # 完成判断
                if task["progress"] >= task["duration"]:
                    skill_key = task.get("skill", "none")
                    skill_val = bot["skills"].get(skill_key, 0) if skill_key != "none" else 10
                    success_rate = min(0.95, 0.5 + skill_val / 200)
                    had_challenge = task.get("challenge") is not None
                    if had_challenge:
                        success_rate -= 0.15
                    base_pay = task.get("base_pay", 30)
                    if random.random() < success_rate:
                        bonus = random.randint(10, 30) if had_challenge else 0
                        pay = base_pay + bonus
                        bot["money"] += pay
                        if skill_key != "none" and skill_key in bot["skills"]:
                            bot["skills"][skill_key] = min(100, bot["skills"][skill_key] + random.randint(2, 4))
                        task["status"] = "completed"
                        task["result"] = f"成功完成! 赚了{pay}元" + (f"(含难点奖励{bonus}元)" if bonus else "")
                        # v8.3: 完成任务给予显著happiness奖励
                        emotions["happiness"] = min(100, emotions.get("happiness", 50) + 12)
                        emotions["anxiety"] = max(0, emotions.get("anxiety", 20) - 5)
                        emotions["sadness"] = max(0, emotions.get("sadness", 10) - 3)
                        log.info(f"{bid} 完成任务[{task['task_name']}]: 赚{pay}元")
                    else:
                        pay = max(10, base_pay // 3)
                        bot["money"] += pay
                        if skill_key != "none" and skill_key in bot["skills"]:
                            bot["skills"][skill_key] = min(100, bot["skills"][skill_key] + 1)
                        task["status"] = "failed"
                        task["result"] = f"任务失败了...只拿到{pay}元辛苦费"
                        emotions["sadness"] = min(100, emotions.get("sadness", 10) + 5)
                        emotions["anxiety"] = min(100, emotions.get("anxiety", 20) + 3)
                        log.warning(f"{bid} 任务失败[{task['task_name']}]: 只拿到{pay}元")
                else:
                    remaining = task["duration"] - task["progress"]
                    log.info(f"{bid} 工作中[{task['task_name']}]: 进度 {task['progress']}/{task['duration']}")

            # 自动入睡
            if (h >= 23 or h < 7) and bot["energy"] < 30 and bot["location"] == bot["home"]:
                bot["is_sleeping"] = True
                log.info(f"{bid} 太累了，在{bot['home']}睡着了")

        # 每日8:00扣除固定开销（房租+杂费）
        if vh == 8 and t["tick"] > 1:
            for bid2, bot2 in world["bots"].items():
                if bot2["status"] != "alive":
                    continue
                home = bot2.get("home", "宝安城中村")
                rent = DAILY_RENT.get(home, 15)
                total_cost = rent + DAILY_MISC_COST
                if bot2["money"] >= total_cost:
                    bot2["money"] -= total_cost
                    log.info(f"{bid2} 扣除固定开销: 房租{rent}+杂费{DAILY_MISC_COST}={total_cost}元")
                else:
                    # 钱不够交租，被驱逐到东门老街
                    bot2["money"] = 0
                    if bot2["location"] == home:
                        old_loc = bot2["location"]
                        if bid2 in world["locations"][old_loc]["bots"]:
                            world["locations"][old_loc]["bots"].remove(bid2)
                        bot2["location"] = "东门老街"
                        bot2["home"] = "东门老街"  # 无家可归
                        world["locations"]["东门老街"]["bots"].append(bid2)
                    log.warning(f"{bid2} 交不起房租，被驱逐到东门老街!")

            # v9.0: 年龄增长 (每虚拟1天 = 1岁)
            for bid_age, bot_age in world["bots"].items():
                if bot_age["status"] != "alive":
                    continue
                bot_age["age"] = bot_age.get("age", 25) + 1
                # 老年人衰老加速
                if bot_age["age"] >= 70:
                    bot_age["hp"] = max(0, bot_age["hp"] - 2.0)  # 老年额外扣HP
                    log.info(f"{bid_age} {bot_age['name']} 已{bot_age['age']}岁，衰老加速")
                elif bot_age["age"] >= 55:
                    bot_age["hp"] = max(0, bot_age["hp"] - 0.5)  # 中年额外扣HP
                if t["tick"] % 24 == 0:  # 每24tick(虚拟1天)记录一次
                    log.info(f"🎂 {bot_age['name']} 现在{bot_age['age']}岁 (HP:{bot_age['hp']:.1f})")

        # v8.3.2: 动态经济 - 每日6:00食物价格自然回落
        if vh == 6:
            dp = world.get("food_prices", {})
            for fname, base_food in FOOD_MENU.items():
                if fname in dp and dp[fname] > base_food["cost"]:
                    dp[fname] = max(base_food["cost"], dp[fname] - max(1, base_food["cost"] // 10))
            world["food_prices"] = dp

        # 随机事件（提高概率，让环境更活跃）
        event_chance = 0.20 + WEATHER_TYPES.get(world["weather"]["current"], {}).get("event_chance_mod", 0)
        if random.random() < event_chance:
            trigger_event()
        # 第二次事件机会（低概率，让世界更丰富）
        if random.random() < 0.08:
            trigger_event()

        # v8.4: 个人命运事件（每 tick 15% 概率对随机一个 bot 触发）
        if random.random() < 0.15:
            trigger_personal_fate()

        # === 被动朋友圈互动：每tick每个bot有概率刷朋友圈点赞 ===
        recent_moments = world.get("moments", [])[-10:]
        if recent_moments:
            for bid, bot in world["bots"].items():
                if bot["status"] != "alive" or bot.get("is_sleeping"):
                    continue
                if random.random() < 0.15:  # 15%概率刷朋友圈
                    for m in recent_moments:
                        if m["bot_id"] != bid and bid not in m.get("likes", []):
                            if random.random() < 0.4:  # 40%概率点赞
                                m["likes"].append(bid)

        # === v9.0: 每天传播城市传说 ===
        if vh == 20:
            spread_urban_legends()

        # === v9.0: 声望自然衰减 (每天向0回归一点) ===
        if vh == 6:
            for bid_r, bot_r in world["bots"].items():
                if bot_r["status"] != "alive":
                    continue
                rep = bot_r.get("reputation", {"score": 0})
                score = rep.get("score", 0)
                if score > 0:
                    rep["score"] = max(0, score - 1)
                elif score < 0:
                    rep["score"] = min(0, score + 1)

        # === 世界叙事摘要 (每天22:00生成) ===
        if vh == 22:
            _generate_world_narrative(t)

        # === NPC演化 ===
        for loc_name, loc_data in world["locations"].items():
            for npc in loc_data.get("npcs", []):
                interactions = npc.get("interaction_count", 0)
                if interactions >= 10:
                    npc["attitude"] = "跟这里的人都混熟了"
                elif interactions >= 5:
                    npc["attitude"] = "开始认识常客"

        # === v10.1: 执行世界规则引擎 ===
        try:
            rule_narratives = tick_rules(world)
            if rule_narratives:
                for rn in rule_narratives[:5]:
                    log.info(f"[RULES] {rn}")
        except Exception as e:
            log.error(f"[RULES] tick_rules失败: {e}")

        # 清理过期效果
        world["active_effects"] = [e for e in world["active_effects"] if e["expires_tick"] > t["tick"]]

        active_rule_count = sum(1 for r in world.get('active_rules', []) if r.get('active', True))
        log.info(f'存活Bot数: {alive_count}/{len(world["bots"])} | 活跃规则: {active_rule_count}')


# distribute_hp 已移除 - 寿命不可逆


def _generate_world_narrative(t):
    """每天22:00生成世界叙事摘要"""
    try:
        day = t["virtual_day"]
        events_today = [e for e in world["events"] if f"第{day}天" in e.get("time", "")]
        events_text = "; ".join([e["event"] for e in events_today[-5:]]) if events_today else "平静的一天"
        
        bot_summaries = []
        for bid, bot in world["bots"].items():
            if bot["status"] != "alive":
                continue
            recent = bot.get("action_log", [])[-3:]
            actions = "; ".join([a.get("plan", "")[:30] for a in recent]) if recent else "无"
            bot_summaries.append(f"{bot['name']}(HP:{bot['hp']:.1f},¥{bot['money']}): {actions}")
        
        prompt = f"""你是深圳这座城市的观察者。今天是模拟世界的第{day}天。
天气: {world['weather']['current']}
今天发生的事件: {events_text}
居民动态:
{chr(10).join(bot_summaries[:6])}

请用2-3句话写一段"城市日记"，像一个旁观者记录这座城市今天的故事。
要求：有文学感，关注人物命运，不要列举。只输出日记内容。"""
        
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_NANO,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8, max_tokens=150,
        )
        narrative = resp.choices[0].message.content.strip()
        world["world_narrative"] = narrative
        log.info(f"📖 世界叙事: {narrative}")
    except Exception as e:
        log.error(f"世界叙事生成失败: {e}")


def trigger_event():
    event = random.choice(RANDOM_EVENTS)
    world["events"].append({
        "tick": world["time"]["tick"],
        "time": world["time"]["virtual_datetime"],
        "event": event["name"],
        "desc": event["desc"],
    })
    world["active_effects"].append({
        "effect": event["effect"],
        "expires_tick": world["time"]["tick"] + 2,
        "mood": event.get("mood", {}),
    })
    # 对所有存活Bot施加情绪影响
    mood_effect = event.get("mood", {})
    for bid, bot in world["bots"].items():
        if bot["status"] != "alive" or bot.get("is_sleeping"):
            continue
        emotions = bot.get("emotions", {})
        for emo_key, delta in mood_effect.items():
            emotions[emo_key] = max(0, min(100, emotions.get(emo_key, 0) + delta))
        bot["emotions"] = emotions
    # 特殊效果
    if event["effect"] == "found_money":
        alive = [bid for bid, b in world["bots"].items() if b["status"] == "alive" and not b.get("is_sleeping")]
        if alive:
            lucky = random.choice(alive)
            world["bots"][lucky]["money"] += 50
            log.info(f"{lucky} 捡到了50块钱！")
    elif event["effect"] == "free_food":
        alive = [bid for bid, b in world["bots"].items() if b["status"] == "alive" and not b.get("is_sleeping")]
        for bid in alive:
            if random.random() < 0.3:
                world["bots"][bid]["satiety"] = min(100, world["bots"][bid]["satiety"] + 15)
                log.info(f"{bid} 吃到了免费试吃！")

    log.warning(f'!!! 随机事件: {event["name"]} - {event["desc"]}')


# ============================================================
# v8.4: 个人命运事件系统
# ============================================================
PERSONAL_FATE_EVENTS = [
    # 经济类（有实质后果）
    {"name": "手机被偷了", "desc": "你发现口袋里的手机不见了！可能是刚才挤公交的时候被偷的。",
     "effect": {"money": -200, "mood": {"anxiety": 20, "anger": 15, "sadness": 10}}},
    {"name": "在路上捜到一个钱包", "desc": "路边有一个钱包，里面有200块和一张身份证。你要怎么办？",
     "effect": {"money": 200, "mood": {"happiness": 5, "anxiety": 5}},
     "moral_dilemma": True},
    {"name": "房东通知下月涨租200", "desc": "房东发来消息：“下个月开始租金涨200，不接受的话可以找别的地方。”",
     "effect": {"mood": {"anxiety": 15, "anger": 10}}},
    {"name": "收到老家汇来的1000块", "desc": "父母给你转了1000块，附言“在外面别乱花钱，注意身体”。",
     "effect": {"money": 1000, "mood": {"happiness": 10, "sadness": 5, "loneliness": -10}}},
    # 工作类
    {"name": "被老板炒了", "desc": "老板说最近生意不好，要裁员，你被辞退了。",
     "effect": {"job_lost": True, "mood": {"sadness": 20, "anxiety": 15, "anger": 10}}},
    {"name": "有人给你介绍了一份好工作", "desc": "朋友说有个地方在招人，待遇不错，问你有没有兴趣。",
     "effect": {"mood": {"happiness": 8, "anxiety": -5}}},
    # 社交类（涉及其他bot）
    {"name": "有人在背后说你坏话", "desc": "你无意中听到有人在说你的坏话，说你“不靠谱”。",
     "effect": {"mood": {"anger": 15, "sadness": 10, "anxiety": 8}},
     "social": "gossip_victim"},
    {"name": "有人向你借钱", "desc": "附近的人过来说：“兄弟，能借我100块吗？我这个月实在周转不开。”",
     "effect": {"mood": {"anxiety": 5}},
     "social": "borrow_request"},
    {"name": "有人送了你一份礼物", "desc": "一个你认识的人送了你一份小礼物，说“上次谢谢你帮忙”。",
     "effect": {"mood": {"happiness": 12, "loneliness": -8}}},
    # 道德困境
    {"name": "看到有人在偷东西", "desc": "你看到一个人在偷超市的东西，他发现你看到了，用哀求的眼神看着你。",
     "effect": {"mood": {"anxiety": 10, "sadness": 5}},
     "moral_dilemma": True},
    {"name": "老人在路边摔倒了", "desc": "一个老人在你面前摘倒了，周围的人都在观望，没人上前。",
     "effect": {"mood": {"anxiety": 8, "sadness": 5}},
     "moral_dilemma": True},
    # 意外惊喜
    {"name": "买彩票中了200块", "desc": "你买的彩票居然中了200块！虽然不多，但心情很好。",
     "effect": {"money": 200, "mood": {"happiness": 15}}},
    {"name": "被狗追着跑了三条街", "desc": "一只没拴绳的大狗突然向你冲过来，你拔腿就跑。",
     "effect": {"energy": -15, "mood": {"anxiety": 12, "anger": 5}}},
    {"name": "在公园里遇到了老乡", "desc": "竟然在深圳遇到了老家的熟人！两人聊了很久，感觉很亲切。",
     "effect": {"mood": {"happiness": 15, "loneliness": -20, "sadness": 5}}},
    {"name": "食物中毒了", "desc": "吃了路边摆的东西后肠胃特别难受，可能不干净。",
     "effect": {"energy": -20, "satiety": -30, "mood": {"sadness": 10, "anger": 8}}},
]

def trigger_personal_fate(bot_id=None):
    """v8.4: 对单个随机bot触发个人命运事件，有实质后果"""
    alive = [bid for bid, b in world["bots"].items() if b["status"] == "alive" and not b.get("is_sleeping")]
    if not alive:
        return
    target = bot_id or random.choice(alive)
    bot = world["bots"][target]
    event = random.choice(PERSONAL_FATE_EVENTS)
    eff = event["effect"]

    # 应用金钱效果
    if "money" in eff:
        bot["money"] = max(0, bot["money"] + eff["money"])
    # 应用能量效果
    if "energy" in eff:
        bot["energy"] = max(0, min(100, bot["energy"] + eff["energy"]))
    # 应用饱腹度效果
    if "satiety" in eff:
        bot["satiety"] = max(0, min(100, bot["satiety"] + eff["satiety"]))
    # 应用情绪效果
    mood_eff = eff.get("mood", {})
    emotions = bot.get("emotions", {})
    for emo_key, delta in mood_eff.items():
        emotions[emo_key] = max(0, min(100, emotions.get(emo_key, 0) + delta))
    bot["emotions"] = emotions
    # 失去工作
    if eff.get("job_lost") and bot.get("job"):
        bot["job"] = None
        bot["current_task"] = None

    # 通过消息板发送给目标bot，让它在下一次心跳时感知到
    world["message_board"].append({
        "to": target,
        "from": "fate",
        "msg": f"【命运事件】{event['name']}: {event['desc']}",
        "tick": world["time"]["tick"],
        "priority": "high",
    })

    # 记录到世界事件
    world["events"].append({
        "tick": world["time"]["tick"],
        "time": world["time"]["virtual_datetime"],
        "event": f"{bot['name']}: {event['name']}",
        "desc": event["desc"],
    })

    # 如果涉及其他bot（借钱、八卦），随机选择一个附近的bot作为关联方
    if event.get("social"):
        loc = bot["location"]
        nearby = [b for b in world["locations"].get(loc, {}).get("bots", []) if b != target]
        if nearby:
            other = random.choice(nearby)
            other_name = world["bots"][other].get("name", "?")
            if event["social"] == "borrow_request":
                # 让目标bot知道是谁借钱
                world["message_board"][-1]["msg"] += f" (是{other_name}向你借钱)"
            elif event["social"] == "gossip_victim":
                world["message_board"][-1]["msg"] += f" (似乎是{other_name}在说)"

    log.warning(f'☄️ 命运事件: {bot["name"]}({target}) - {event["name"]}')


# ============================================================
# v9.0 进化引擎一: 开放式行动后果 - 永久世界改造
# ============================================================
WORLD_MOD_TYPES = {
    "open_shop": {"cost": 200, "desc": "开店/摆摊", "reputation": 5},
    "create_art": {"cost": 0, "desc": "创作艺术(涂鸦/壁画/雕塑)", "reputation": 3},
    "plant_tree": {"cost": 10, "desc": "种树/绿化", "reputation": 2},
    "build_facility": {"cost": 500, "desc": "建造设施(书屋/健身角/公告栏)", "reputation": 8},
    "organize_event": {"cost": 100, "desc": "组织活动(音乐会/市集/聚会)", "reputation": 6},
    "name_place": {"cost": 0, "desc": "给地方起名/留下标记", "reputation": 1},
    "teach_skill": {"cost": 0, "desc": "教别人技能", "reputation": 4},
    "start_business": {"cost": 1000, "desc": "创业/开公司", "reputation": 10},
}


def judge_world_modification(bot_id, bot, action_desc, result_narrative):
    """
    v9.0: 判断一个行动是否产生了永久的世界改变。
    在每次行动执行后调用，由LLM判断是否有永久改变。
    """
    try:
        loc = bot["location"]
        existing_mods = [m["name"] for m in world["locations"].get(loc, {}).get("modifications", [])]
        
        prompt = f"""一个角色刚刚执行了一个行动。请判断这个行动是否对世界产生了永久性的改变。

角色: {bot.get('name', bot_id)}
地点: {loc}
行动: {action_desc}
结果: {result_narrative}
这个地点已有的改造: {existing_mods if existing_mods else '无'}

可能的永久改变类型:
- open_shop: 开店/摆摊(需要资金)
- create_art: 创作艺术作品(涂鸦/壁画/雕塑)
- plant_tree: 种树/绿化环境
- build_facility: 建造公共设施
- organize_event: 组织活动
- name_place: 给地方起名/留下标记
- teach_skill: 教别人技能
- start_business: 创业

请用JSON输出:
{{"has_modification": true/false, "type": "类型名", "name": "改变的名称(如'小林的炒粉摊')", "desc": "一句话描述", "impact": "对周围人的影响"}}

规则:
- 只有真正有创造性的、能留下永久痕迹的行动才算永久改变
- 吃饭/睡觉/聊天/散步等日常行为不算永久改变
- 不要重复已有的改造
- 大多数行动不会产生永久改变，请保守判断
只输出JSON。"""
        
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_NANO,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3, max_tokens=200,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"): raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            raw = raw[start:end]
        data = json.loads(raw)
        
        if not data.get("has_modification"):
            return None
        
        mod_type = data.get("type", "name_place")
        mod_info = WORLD_MOD_TYPES.get(mod_type, {"cost": 0, "desc": "改变", "reputation": 1})
        
        # 检查资金是否足够
        if bot["money"] < mod_info["cost"]:
            log.info(f"[v9.0] {bot_id} 想{data.get('name','')}但资金不足(需{mod_info['cost']}元)")
            return None
        
        # 扣除资金
        if mod_info["cost"] > 0:
            bot["money"] -= mod_info["cost"]
        
        # 创建永久改造记录
        modification = {
            "id": f"mod_{world['time']['tick']}_{bot_id}",
            "creator": bot_id,
            "creator_name": bot.get("name", bot_id),
            "type": mod_type,
            "name": data.get("name", "未命名"),
            "desc": data.get("desc", ""),
            "impact": data.get("impact", ""),
            "location": loc,
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "active": True,
        }
        
        # 添加到世界改造列表
        world["world_modifications"].append(modification)
        # 添加到地点改造
        if loc in world["locations"]:
            world["locations"][loc]["modifications"].append(modification)
        # 记录到bot的创造列表
        bot["created_things"].append(modification["id"])
        
        # 更新声望
        update_reputation(bot_id, mod_info["reputation"], f"创造了{data.get('name', '')}")
        
        # 记录到地点公共记忆
        add_public_memory(loc, f"{bot.get('name', bot_id)}在这里{data.get('desc', '')}", bot_id, "creation")
        
        # 广播给所有人
        world["events"].append({
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "event": f"🌟 {bot.get('name', bot_id)}创造了[{data.get('name', '')}]",
            "desc": data.get("desc", ""),
        })
        
        # 如果是开店/摆摊，添加新的工作机会
        if mod_type in ("open_shop", "start_business"):
            new_job = {
                "title": data.get("name", "新店员工"),
                "skill": "social",
                "min_skill": 5,
                "pay": 35 + random.randint(0, 20),
                "tasks": [{
                    "name": f"在{data.get('name', '店铺')}工作",
                    "duration": 2,
                    "difficulty": 0.2,
                    "desc": f"在{bot.get('name', bot_id)}开的{data.get('name', '店')}里帮忙"
                }],
            }
            if loc in JOBS:
                JOBS[loc].append(new_job)
            else:
                JOBS[loc] = [new_job]
            if loc in world["locations"]:
                world["locations"][loc]["jobs"] = JOBS.get(loc, [])
        
        log.warning(f"🌟 [v9.0 世界改造] {bot.get('name', bot_id)} 在{loc}创造了 [{data.get('name', '')}] (类型:{mod_type}, 花费:{mod_info['cost']}元)")
        return modification
        
    except Exception as e:
        log.error(f"[v9.0] 世界改造判断失败: {e}")
        return None


# ============================================================
# v9.0 进化引擎二: 地点公共记忆 + 声望系统
# ============================================================
def add_public_memory(location, event_desc, actor_id, impact_type="neutral"):
    """向地点添加公共记忆"""
    if location not in world["locations"]:
        return
    memory_entry = {
        "event": event_desc,
        "actor": actor_id,
        "actor_name": world["bots"].get(actor_id, {}).get("name", actor_id),
        "tick": world["time"]["tick"],
        "time": world["time"]["virtual_datetime"],
        "impact": impact_type,  # positive/negative/neutral/creation/conflict/death
    }
    loc = world["locations"][location]
    loc["public_memory"].append(memory_entry)
    # 保留最近30条
    if len(loc["public_memory"]) > 30:
        loc["public_memory"] = loc["public_memory"][-25:]
    
    # 每10条记忆更新一次地点氛围
    if len(loc["public_memory"]) % 10 == 0:
        _update_location_vibe(location)


def _update_location_vibe(location):
    """根据公共记忆更新地点氛围"""
    try:
        loc = world["locations"][location]
        memories = loc["public_memory"][-15:]
        mem_text = "\n".join([f"- {m['event']} ({m['impact']})" for m in memories])
        mods = loc.get("modifications", [])[-5:]
        mods_text = "\n".join([f"- {m['name']}: {m['desc']}" for m in mods]) if mods else "无"
        
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_NANO,
            messages=[{"role": "user", "content": f"""根据以下历史事件，用一个词或短语描述这个地点的氛围。

地点: {location}
原始描述: {loc['desc']}

最近发生的事:
{mem_text}

地点改造:
{mods_text}

请用一个词或短语描述氛围(如"温馨的"/"紧张的"/"充满创意的"/"冷漠的"/"热闹的"):
只输出氛围词，不要其他文字。"""}],
            temperature=0.5, max_tokens=20,
        )
        vibe = resp.choices[0].message.content.strip().strip('"').strip()
        loc["vibe"] = vibe[:10]  # 限制长度
        log.info(f"[v9.0] {location} 氛围更新为: {vibe}")
    except Exception as e:
        log.error(f"[v9.0] 氛围更新失败: {e}")


def update_reputation(bot_id, delta, deed_desc):
    """更新bot的公众声望"""
    bot = world["bots"].get(bot_id)
    if not bot:
        return
    rep = bot.get("reputation", {"score": 0, "tags": [], "deeds": []})
    rep["score"] = max(-100, min(100, rep.get("score", 0) + delta))
    rep["deeds"].append({
        "desc": deed_desc,
        "delta": delta,
        "tick": world["time"]["tick"],
    })
    if len(rep["deeds"]) > 20:
        rep["deeds"] = rep["deeds"][-15:]
    bot["reputation"] = rep
    
    # 同步到全局声望榜
    world["reputation_board"][bot_id] = {
        "name": bot.get("name", bot_id),
        "score": rep["score"],
        "tags": rep.get("tags", []),
        "latest_deed": deed_desc,
    }
    
    # 声望达到阈值时自动添加标签
    score = rep["score"]
    tags = rep.get("tags", [])
    if score >= 30 and "受人尊敬" not in tags:
        tags.append("受人尊敬")
    elif score >= 15 and "有口碑" not in tags:
        tags.append("有口碑")
    elif score <= -15 and "名声不好" not in tags:
        tags.append("名声不好")
    elif score <= -30 and "臭名昭著" not in tags:
        tags.append("臭名昭著")
    rep["tags"] = tags[-5:]  # 最多5个标签


def reputation_interaction_modifier(bot_id, target_id):
    """根据声望调整社交互动的基础友好度"""
    target_rep = world["bots"].get(target_id, {}).get("reputation", {}).get("score", 0)
    if target_rep >= 20:
        return 1.3  # 声望好的人更容易被接受
    elif target_rep <= -20:
        return 0.5  # 声望差的人会被排斥
    return 1.0


# ============================================================
# v9.0 进化引擎三: 代际传承机制
# ============================================================
NEW_BOT_TEMPLATES = [
    {"name": "孙明达", "age": 23, "gender": "男", "origin": "广东潮汕", "edu": "中专",
     "personality": "踏实肯干，话不多但很靠谱。喜欢研究各种小生意。",
     "values": "勤劳致富，实在做人，赚钱养家",
     "bg": "刚来深圳打拼的年轻人，听说这里机会多",
     "habits": "早起晚睡，爱吃路边摆，爱看财经新闻"},
    {"name": "林婷婷", "age": 20, "gender": "女", "origin": "江西南昌", "edu": "大专在读",
     "personality": "开朗乐观，爱笑爱闹。有点大大咧咧但很真诚。",
     "values": "快乐最重要，人生苦短要及时行乐",
     "bg": "来深圳实习的大学生，对一切都充满好奇",
     "habits": "拍照、发朋友圈、吃吃吃、交朋友"},
    {"name": "陈志强", "age": 35, "gender": "男", "origin": "湖南衡阳", "edu": "初中",
     "personality": "沉默対言，经历过很多事。外表冷漠但内心柔软。",
     "values": "生存第一，信任要经过考验，不轻易相信人",
     "bg": "在深圳漂泊多年的老打工人，见过太多世态炎凉",
     "habits": "独处、喝酒、看新闻、早起干活"},
    {"name": "周雨晴", "age": 27, "gender": "女", "origin": "浙江温州", "edu": "本科",
     "personality": "精明能干，有商业头脑。说话直接，不喜欢绕弯子。",
     "values": "效率为王，时间就是金钱，要做就做最好的",
     "bg": "温州商人家庭出身，来深圳寻找创业机会",
     "habits": "看财报、建人脉、健身、发精致朋友圈"},
    {"name": "刘小海", "age": 18, "gender": "男", "origin": "贵州遵义", "edu": "高中辍学",
     "personality": "叛逆但善良，有街头智慧。嘴硬心软。",
     "values": "自由最重要，不想被束缚，要活出自己的样子",
     "bg": "辍学后独自来深圳闯荡，什么都不怕",
     "habits": "游荡、听音乐、交朋友、吃路边摆"},
]


def handle_bot_death(bot_id):
    """
    v9.0: 处理bot死亡 - 触发代际传承机制
    1. 财富转移给最亲密的人
    2. 核心记忆变成城市传说
    3. 生成新bot继承关系网
    """
    bot = world["bots"].get(bot_id)
    if not bot:
        return
    
    bot_name = bot.get("name", bot_id)
    loc = bot["location"]
    
    log.warning(f"💀 [v9.0 代际传承] {bot_name}({bot_id}) 已死亡，触发传承机制...")
    
    # === 1. 财富转移 ===
    inheritance = bot.get("money", 0)
    closest_contact = None
    max_closeness = 0
    
    # 先查家人
    family = bot.get("family", {})
    family_members = family.get("parents", []) + family.get("children", [])
    for fm in family_members:
        if fm in world["bots"] and world["bots"][fm]["status"] == "alive":
            closest_contact = fm
            max_closeness = 999  # 家人优先
            break
    
    # 再查情感纽带
    if not closest_contact:
        bonds = bot.get("emotional_bonds", {})
        for target, bond in bonds.items():
            if target.startswith("bot_") and target in world["bots"]:
                if world["bots"][target]["status"] == "alive":
                    closeness = bond.get("closeness", 0)
                    if closeness > max_closeness:
                        max_closeness = closeness
                        closest_contact = target
    
    if closest_contact and inheritance > 0:
        world["bots"][closest_contact]["money"] += inheritance
        heir_name = world["bots"][closest_contact].get("name", closest_contact)
        world["message_board"].append({
            "to": closest_contact, "from": "system",
            "msg": f"【遗产】{bot_name}已经离开了这个世界。作为最亲近的人，你继承了{inheritance}元遗产。",
            "tick": world["time"]["tick"], "priority": "high",
        })
        log.info(f"  财富转移: {inheritance}元 -> {heir_name}({closest_contact})")
    
    # === 2. 核心记忆变城市传说 ===
    core_memories = bot.get("core_memories", [])
    if core_memories:
        # 选取最重要的记忆转化为传说
        best_memories = core_memories[-3:]  # 最近3条
        for mem in best_memories:
            summary = mem.get("summary", "") if isinstance(mem, dict) else str(mem)
            legend = {
                "id": f"legend_{world['time']['tick']}_{bot_id}",
                "original_bot": bot_id,
                "original_name": bot_name,
                "content": summary,
                "origin_tick": world["time"]["tick"],
                "origin_time": world["time"]["virtual_datetime"],
                "location": loc,
                "spread_count": 0,  # 传播次数
            }
            world["urban_legends"].append(legend)
        log.info(f"  {len(best_memories)}条核心记忆转化为城市传说")
    
    # === 3. 记录到墓地 ===
    grave = {
        "bot_id": bot_id,
        "name": bot_name,
        "age": bot.get("age", 0),
        "origin": bot.get("origin", ""),
        "death_tick": world["time"]["tick"],
        "death_time": world["time"]["virtual_datetime"],
        "death_location": loc,
        "final_money": bot.get("money", 0),
        "reputation_score": bot.get("reputation", {}).get("score", 0),
        "reputation_tags": bot.get("reputation", {}).get("tags", []),
        "created_things": bot.get("created_things", []),
        "long_term_goal": bot.get("long_term_goal", ""),
        "narrative_summary": bot.get("narrative_summary", ""),
    }
    world["graveyard"].append(grave)
    
    # === 4. 地点公共记忆 ===
    add_public_memory(loc, f"{bot_name}在这里离开了世界", bot_id, "death")
    
    # === 5. 通知所有认识的人 ===
    bonds = bot.get("emotional_bonds", {})
    for target_id in bonds:
        if target_id.startswith("bot_") and target_id in world["bots"]:
            if world["bots"][target_id]["status"] == "alive":
                world["message_board"].append({
                    "to": target_id, "from": "system",
                    "msg": f"【讣告】{bot_name}已经离开了这个世界。",
                    "tick": world["time"]["tick"], "priority": "high",
                })
    
    # === 6. 生成新bot替代死亡的bot ===
    _spawn_new_generation_bot(bot_id, bot)
    
    # 世界事件
    world["events"].append({
        "tick": world["time"]["tick"],
        "time": world["time"]["virtual_datetime"],
        "event": f"💀 {bot_name}离开了这个世界",
        "desc": f"{bot_name}的一生结束了。{bot.get('narrative_summary', '')}",
    })


def _spawn_new_generation_bot(dead_bot_id, dead_bot):
    """生成新一代bot替代死亡的bot"""
    # 选择一个新人设
    template = random.choice(NEW_BOT_TEMPLATES)
    
    world["generation_count"] = world.get("generation_count", 0) + 1
    gen = world["generation_count"]
    
    # 复用死亡bot的ID
    new_bot = create_bot(dead_bot_id)
    new_bot["name"] = template["name"]
    new_bot["age"] = template["age"]
    new_bot["gender"] = template["gender"]
    new_bot["origin"] = template["origin"]
    new_bot["edu"] = template["edu"]
    new_bot["hp"] = 100
    new_bot["money"] = random.randint(100, 500)
    new_bot["energy"] = 100
    new_bot["satiety"] = 70
    new_bot["status"] = "alive"
    new_bot["generation"] = gen
    new_bot["inherited_from"] = dead_bot.get("name", dead_bot_id)
    new_bot["location"] = random.choice(list(LOCATIONS.keys()))
    new_bot["home"] = random.choice(["宝安城中村", "南山公寓"])
    
    # 继承死亡bot的部分关系网络(作为"听说过")
    dead_bonds = dead_bot.get("emotional_bonds", {})
    inherited_bonds = {}
    for target, bond in dead_bonds.items():
        if target.startswith("bot_") and target in world["bots"]:
            if world["bots"][target]["status"] == "alive" and bond.get("closeness", 0) > 30:
                inherited_bonds[target] = {
                    "trust": 20,
                    "closeness": 5,
                    "hostility": 0,
                    "label": "听说过",
                    "impressions": [f"听说{dead_bot.get('name', '')}和这个人关系不错"]
                }
    new_bot["emotional_bonds"] = inherited_bonds
    
    # 继承城市传说作为初始记忆
    recent_legends = world.get("urban_legends", [])[-3:]
    new_bot["known_legends"] = [l["id"] for l in recent_legends]
    for legend in recent_legends:
        new_bot["core_memories"].append({
            "summary": f"[城市传说] 听说{legend['original_name']}的故事: {legend['content'][:50]}",
            "emotion": "neutral",
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "tag": "urban_legend",
        })
    
    # 更新PERSONAS以便 bot_agent能读取新人设
    PERSONAS[dead_bot_id] = {
        "name": template["name"],
        "age": template["age"],
        "gender": template["gender"],
        "origin": template["origin"],
        "edu": template["edu"],
        "home": new_bot["home"],
        "start_loc": new_bot["location"],
        "money": new_bot["money"],
        "hp": 100,
    }
    
    # 放入世界
    world["bots"][dead_bot_id] = new_bot
    loc = new_bot["location"]
    if loc in world["locations"] and dead_bot_id not in world["locations"][loc]["bots"]:
        world["locations"][loc]["bots"].append(dead_bot_id)
    
    # 启动新的bot_agent进程
    try:
        # 写入新人设到临时文件，供bot_agent读取
        persona_override = {
            "name": template["name"],
            "age": template["age"],
            "gender": template["gender"],
            "origin": template["origin"],
            "edu": template["edu"],
            "personality": template["personality"],
            "values": template["values"],
            "bg": template["bg"] + f" (第{gen}代新居民，继承了{dead_bot.get('name', '')}的一些关系)",
            "habits": template["habits"],
            "family_info": "",
        }
        with open(os.path.join(PROJECT_ROOT, f"persona_override_{dead_bot_id}.json"), "w") as f:
            json.dump(persona_override, f, ensure_ascii=False)
        
        subprocess.Popen(
["python3", BOT_AGENT_SCRIPT],
        env=dict(os.environ, BOT_ID=dead_bot_id)
        )
        log.info(f"  新bot {template['name']}({dead_bot_id}) 已生成并启动 (第{gen}代)")
    except Exception as e:
        log.error(f"  启动新bot失败: {e}")
    
    # 全局事件
    world["events"].append({
        "tick": world["time"]["tick"],
        "time": world["time"]["virtual_datetime"],
        "event": f"🌟 新居民{template['name']}来到了深圳",
        "desc": f"来自{template['origin']}的{template['name']}，{template['bg'][:30]}",
    })


def spread_urban_legends():
    """每天传播城市传说 - 让活着的bot随机听到传说"""
    legends = world.get("urban_legends", [])
    if not legends:
        return
    alive_bots = [bid for bid, b in world["bots"].items() if b["status"] == "alive"]
    for bot_id in alive_bots:
        if random.random() < 0.15:  # 15%概率听到传说
            legend = random.choice(legends)
            bot = world["bots"][bot_id]
            known = bot.get("known_legends", [])
            if legend["id"] not in known:
                known.append(legend["id"])
                bot["known_legends"] = known[-10:]  # 最多记住10个
                legend["spread_count"] = legend.get("spread_count", 0) + 1
                world["message_board"].append({
                    "to": bot_id, "from": "rumor",
                    "msg": f"【城市传说】听说{legend['original_name']}曾经: {legend['content'][:60]}",
                    "tick": world["time"]["tick"], "priority": "normal",
                })


# ============================================================
# 开放式动作解释与执行
# ============================================================
def process_action(bot_id, plan):
    """涌现友好架构：LLM解析为5大类 + 保留自然语言描述，世界引擎解释后果"""
    bot = world["bots"][bot_id]

    # v8.3.2: 硬编码起床动作，不经过LLM
    if plan.strip() in ("起床", "醒来", "起来"):
        action = {"category": "survive", "type": "wake_up", "desc": plan}
        result = execute(bot_id, action)
        bot["action_log"].append({
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "plan": plan, "action": action, "result": result
        })
        bot["current_activity"] = "刚刚醒来，正在伸懒腰"
        return {"action": action, "result": result}

    loc = bot["location"]
    loc_info = world["locations"][loc]

    nearby_bots = [b for b in loc_info["bots"] if b != bot_id]
    nearby_bot_info = []
    for nb in nearby_bots[:5]:
        ob = world["bots"].get(nb, {})
        nearby_bot_info.append(f"{nb}({ob.get('name','?')},{ob.get('gender','?')})")

    food_list = ', '.join([f'{k}({v["cost"]}元)' for k, v in FOOD_MENU.items()])
    job_list = ', '.join([j['title'] for j in JOBS.get(loc, [])])
    all_locs = list(LOCATIONS.keys())

    # 检查是否有进行中的任务
    current_task = bot.get("current_task")
    task_hint = ""
    if current_task and current_task.get("status") == "in_progress":
        task_hint = f"\n⭐ 当前有进行中的工作任务[{current_task.get('task_name','')}]，如果计划提到继续做/继续工作/继续任务，必须用survive类别的work。"

    prompt = f"""你是一个JSON转换器。将用户的自然语言计划转为一个JSON动作对象。只输出JSON，不要任何其他文字。

## 上下文
- 当前地点: {loc}
- 附近的人: {nearby_bot_info if nearby_bot_info else '无'}
- 附近的NPC: {[n['name'] for n in loc_info['npcs']]}
- 所有可去地点: {all_locs}
- 当前地点可用工作: {job_list if job_list else '无'}
- 可选食物: {food_list}
{task_hint}

## 5大行动类别

### 1. survive (生存类: 吃饭/工作/睡觉/休息)
- 吃东西: {{"category":"survive","type":"eat","food":"食物名","desc":"原始描述"}}
  食物名必须是: {list(FOOD_MENU.keys())}
- 工作: {{"category":"survive","type":"work","job":"职位名","desc":"原始描述"}}
- 睡觉: {{"category":"survive","type":"sleep","desc":"原始描述"}}
- 休息: {{"category":"survive","type":"rest","desc":"原始描述"}}

### 2. social (社交类: 聊天/亲密/交易)
- 聊天: {{"category":"social","type":"talk","target":"bot_X或npc名","message":"说的话","desc":"原始描述"}}
- 亲密: {{"category":"social","type":"intimate","target":"bot_X","desc":"原始描述"}}
- 交易: {{"category":"social","type":"trade","target":"bot_X","give_type":"money","give_amount":数字,"want_type":"money","want_amount":数字,"desc":"原始描述"}}

### 3. move (移动类)
{{"category":"move","to":"目的地","desc":"原始描述"}}
目的地必须是: {all_locs}

### 4. express (表达类: 发朋友圈/拍照/刷手机)
- 发朋友圈: {{"category":"express","type":"post_moment","content":"朋友圈内容","mood":"happy/sad/neutral/angry","desc":"原始描述"}}
- 刷手机: {{"category":"express","type":"browse_phone","focus":"news/moments/hot","desc":"原始描述"}}
- 拍照: {{"category":"express","type":"selfie","prompt":"英文拍照场景描述","desc":"原始描述"}}

### 5. free (自由行动: 以上都不匹配时，保留bot的原始描述)
{{"category":"free","desc":"完整保留bot的原始描述"}}

## 规则
- 只输出一个JSON对象，不要输出多个
- 如果计划包含多个动作（如"吃热粉然后拍照"），只取第一个动作
- 如果计划明确涉及吃/喝/工作/睡觉/休息，用survive
- 如果计划明确涉及和某人互动，用social
- 如果计划明确涉及去其他地点，用move
- 如果计划明确涉及发朋友圈/拍照/刷手机，用express
- 其他一切行为（画画/弹吉他/健身/逛街/思考/写代码/喝酒/看电影/散步...）用free
- desc字段始终完整保留用户的原始计划文本

## 计划
"{plan}"

## JSON
"""

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_MINI,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0, max_tokens=200,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        # 提取第一个JSON对象（处理LLM返回多个JSON的情况）
        start = raw.find("{")
        if start >= 0:
            depth = 0
            end = start
            for i in range(start, len(raw)):
                if raw[i] == "{":
                    depth += 1
                elif raw[i] == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            raw = raw[start:end]
        action = json.loads(raw)
    except Exception as e:
        log.error(f"LLM解析 {bot_id} 动作失败: {e}")
        action = {"category": "free", "desc": plan}

    result = execute(bot_id, action)
    bot["action_log"].append({
        "tick": world["time"]["tick"],
        "time": world["time"]["virtual_datetime"],
        "plan": plan,
        "action": action,
        "result": result
    })
    if len(bot["action_log"]) > 50:
        bot["action_log"] = bot["action_log"][-30:]

    # v8.4: 更新当前活动描述（供其他bot观察）
    activity_desc = action.get("desc", "")[:40] if action.get("desc") else plan[:40]
    bot["current_activity"] = activity_desc

    # v9.0: 判断行动是否产生永久世界改变
    result_str = json.dumps(result, ensure_ascii=False) if isinstance(result, dict) else str(result)
    if action.get("category") in ("free", "social") or "开" in plan or "创" in plan or "建" in plan or "摆" in plan:
        try:
            mod = judge_world_modification(bot_id, bot, plan, result_str)
            if mod:
                result_str += f" | 🌟永久改变: 创造了[{mod['name']}]"
        except Exception as e:
            log.error(f"[v9.0] 世界改造判断异常: {e}")

    # v9.0: 记录重要行动到地点公共记忆
    if action.get("category") in ("social", "free") and len(plan) > 5:
        # 只记录有意义的行动
        interesting_keywords = ["吵架", "打架", "帮助", "救", "表白", "分手", "结婚", "创业", "开店", "演出", "比赛", "教", "学"]
        if any(kw in plan for kw in interesting_keywords):
            add_public_memory(bot["location"], f"{bot.get('name', bot_id)}{plan[:30]}", bot_id, "notable")

    return {"action": action, "result": result}


def execute(bot_id, action):
    bot = world["bots"][bot_id]
    cat = action.get("category", "free")
    act = action.get("type", action.get("action", ""))  # 兼容新旧格式
    desc = action.get("desc", "")
    emotions = bot.get("emotions", {})

    # === 移动类 ===
    if cat == "move" or act == "move":
        dest = action.get("to", "")
        if dest in LOCATIONS:
            if dest == bot["location"]:
                # 目的地=当前位置，转为自由行动
                return interpret_free_action(bot_id, bot, desc or f"在{dest}随便逛逛")
        if dest in LOCATIONS and dest != bot["location"]:
            old_loc = bot["location"]
            if bot_id in world["locations"][old_loc]["bots"]:
                world["locations"][old_loc]["bots"].remove(bot_id)
            bot["location"] = dest
            world["locations"][dest]["bots"].append(bot_id)
            bot["energy"] = max(0, bot["energy"] - 5)
            # 台风天移动有风险
            if world["weather"]["current"] == "台风":
                if random.random() < 0.3:
                    bot["hp"] = max(0, bot["hp"] - 5)
                    return f"冒着台风从 {old_loc} 移动到 {dest}，被风吹得东倒西歪，受了点伤(HP-5)"
            msg = f"从 {old_loc} 移动到 {dest}"
            log.info(f"{bot_id}: {msg}")
            return msg
        return f"无法移动到 {dest}"

    elif act == "work":
        task = bot.get("current_task")
        if task and task.get("status") == "in_progress":
            remaining = task["duration"] - task.get("progress", 0)
            challenge_text = f" [难点: {task['challenge']}]" if task.get("challenge") else ""
            bot["energy"] = max(0, bot["energy"] - 8)
            msg = f'继续做[{task["task_name"]}]: {task["task_desc"]} | 进度{task.get("progress",0)}/{task["duration"]}{challenge_text}'
            log.info(f"{bot_id}: {msg}")
            return msg

        if task and task.get("status") in ["completed", "failed"]:
            bot["current_task"] = None

        job_title = action.get("job", "")
        loc = bot["location"]
        available = JOBS.get(loc, [])
        job = next((j for j in available if j["title"] == job_title), None)
        if not job:
            job = next((j for j in available if job_title in j["title"] or j["title"] in job_title), None)
        if not job and available:
            job = available[0]
        if job:
            skill_key = job["skill"]
            skill_val = bot["skills"].get(skill_key, 0) if skill_key != "none" else 10
            if skill_val >= job["min_skill"]:
                task_template = random.choice(job.get("tasks", [{"name": "工作", "duration": 2, "difficulty": 0.2, "desc": "日常工作"}]))
                new_task = {
                    "job_title": job["title"],
                    "task_name": task_template["name"],
                    "task_desc": task_template["desc"],
                    "duration": task_template["duration"],
                    "difficulty": task_template["difficulty"],
                    "skill": skill_key,
                    "base_pay": job["pay"] + random.randint(-10, 10),
                    "progress": 0,
                    "status": "in_progress",
                    "challenge": None,
                    "result": None,
                    "started_tick": world["time"]["tick"],
                }
                bot["current_task"] = new_task
                bot["energy"] = max(0, bot["energy"] - 8)
                bot["job"] = job["title"]
                msg = f'开始任务[{task_template["name"]}]: {task_template["desc"]} | 预计{task_template["duration"]}小时'
                log.info(f"{bot_id}: {msg}")
                return msg
            return f'技能不足，无法胜任 {job["title"]}'
        return f"{loc} 没有可用工作"

    elif act == "eat":
        food_name = action.get("food", "")
        food = FOOD_MENU.get(food_name)
        if not food:
            food_name = next((k for k in FOOD_MENU if food_name in k or k in food_name), None)
            food = FOOD_MENU.get(food_name) if food_name else None
        if not food:
            food_name = "城中村快餐"
            food = FOOD_MENU[food_name]
        # v8.3.2: 动态价格 - 用当前动态价格而非基础价格
        dynamic_prices = world.get("food_prices", {})
        current_cost = dynamic_prices.get(food_name, food["cost"])
        if bot["money"] >= current_cost:
            bot["money"] -= current_cost
            bot["satiety"] = min(100, bot["satiety"] + food["satiety"])
            # 食物影响情绪
            for emo_key, delta in food.get("mood", {}).items():
                emotions[emo_key] = max(0, min(100, emotions.get(emo_key, 0) + delta))
            bot["emotions"] = emotions
            # 动态经济：购买后微幅涨价
            base_cost = food["cost"]
            new_price = min(int(base_cost * 1.5), current_cost + max(1, base_cost // 10))
            dynamic_prices[food_name] = new_price
            world["food_prices"] = dynamic_prices
            msg = f'吃了{food_name}，花费{current_cost}元，饱腹度+{food["satiety"]}'
            log.info(f"{bot_id}: {msg}")
            return msg
        return f"钱不够买{food_name}(需要{current_cost}元，只有{bot['money']}元)"

    elif act == "talk":
        target = action.get("target", "")
        message = action.get("message", "你好")
        world["message_board"].append({
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "from": bot_id,
            "to": target,
            "msg": message,
            "priority": "normal"
        })
        if target.startswith("bot_"):
            bot["relationships"][target] = bot["relationships"].get(target, 0) + 1
            if target in world["bots"] and world["bots"][target]["status"] == "alive":
                target_bot = world["bots"][target]
                target_bot["relationships"][bot_id] = target_bot["relationships"].get(bot_id, 0) + 1
                # v8.3: 双向对话机制 - 设置对方的pending_reply_to
                target_bot["pending_reply_to"] = {
                    "from": bot_id,
                    "from_name": bot.get("name", bot_id),
                    "msg": message,
                    "tick": world["time"]["tick"]
                }
        bot["skills"]["social"] = min(100, bot["skills"]["social"] + 1)
        # v8.3: 社交给予更强的正面情绪反馈
        emotions["loneliness"] = max(0, emotions.get("loneliness", 30) - 8)
        emotions["happiness"] = min(100, emotions.get("happiness", 50) + 5)
        bot["emotions"] = emotions
        msg = f"对{target}说: {message}"
        log.info(f"{bot_id}: {msg}")

        # === 互动后更新双方关系记忆 ===
        def _update_bonds_after_talk():
            try:
                bot_name = bot.get("name", bot_id)
                # 确定对方信息
                if target.startswith("bot_") and target in world["bots"]:
                    target_bot = world["bots"][target]
                    target_name = target_bot.get("name", target)
                    target_personality = target_bot.get("personality", "")
                else:
                    # NPC
                    target_name = target
                    target_personality = ""
                    for loc_data in world["locations"].values():
                        for npc in loc_data.get("npcs", []):
                            if npc.get("name") == target:
                                target_personality = npc.get("personality", npc.get("desc", ""))
                                break

                # 获取双方之前的互动历史
                prev_interactions = []
                for entry in bot.get("action_log", [])[-20:]:
                    entry_str = str(entry.get("result", "")) + str(entry.get("plan", ""))
                    if target_name in entry_str or target in entry_str:
                        prev_interactions.append(entry_str[:80])
                history_text = "\n".join(prev_interactions[-5:]) if prev_interactions else "这是第一次互动"

                bond_prompt = f"""两个人刚刚进行了一次对话。请判断这次互动给双方留下了什么印象。

{bot_name}对{target_name}说: "{message}"

{bot_name}的性格: {bot.get('personality', '未知')}
{target_name}的性格: {target_personality or '未知'}

之前的互动历史:
{history_text}

请用JSON格式输出双方的印象变化:
{{
  "initiator_impression": "一句话描述{bot_name}对{target_name}的新印象(自然语言，像日记一样)",
  "target_impression": "一句话描述{target_name}对{bot_name}的新印象",
  "relationship_type": "朋友/同事/合作伙伴/竞争对手/暧昧/陌生人/家人/师徒/邻居",
  "warmth_delta": 0
}}

warmth_delta范围-10到+10，正数表示关系升温，负数表示关系降温。
只输出JSON。"""

                resp = client.chat.completions.create(
                    model=OPENAI_MODEL_NANO,
                    messages=[{"role": "user", "content": bond_prompt}],
                    temperature=0.4, max_tokens=200,
                )
                raw = resp.choices[0].message.content.strip()
                if raw.startswith("```"): raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                start = raw.find("{")
                end = raw.rfind("}") + 1
                if start >= 0 and end > start:
                    raw = raw[start:end]
                bond_data = json.loads(raw)

                # 更新发起者的bonds
                if "emotional_bonds" not in bot:
                    bot["emotional_bonds"] = {}
                bond_key = target if target.startswith("bot_") else target_name
                if bond_key not in bot["emotional_bonds"]:
                    bot["emotional_bonds"][bond_key] = {"trust": 50, "closeness": 0, "hostility": 0, "label": "陌生人", "impressions": []}
                b = bot["emotional_bonds"][bond_key]
                impression = bond_data.get("initiator_impression", "")
                if impression:
                    b["impressions"] = (b.get("impressions", []) + [impression])[-5:]  # 保留最近5条印象
                b["label"] = bond_data.get("relationship_type", b.get("label", "陌生人"))
                warmth = bond_data.get("warmth_delta", 0)
                b["closeness"] = max(0, min(100, b.get("closeness", 0) + max(0, warmth)))
                b["hostility"] = max(0, min(100, b.get("hostility", 0) + max(0, -warmth)))
                b["trust"] = max(0, min(100, b.get("trust", 50) + warmth // 2))
                log.info(f"[关系更新] {bot_id}->{bond_key}: {impression} (warmth={warmth}, label={b['label']})")

                # 更新对方的bonds（如果是bot）
                if target.startswith("bot_") and target in world["bots"]:
                    target_bot = world["bots"][target]
                    if "emotional_bonds" not in target_bot:
                        target_bot["emotional_bonds"] = {}
                    if bot_id not in target_bot["emotional_bonds"]:
                        target_bot["emotional_bonds"][bot_id] = {"trust": 50, "closeness": 0, "hostility": 0, "label": "陌生人", "impressions": []}
                    tb = target_bot["emotional_bonds"][bot_id]
                    t_impression = bond_data.get("target_impression", "")
                    if t_impression:
                        tb["impressions"] = (tb.get("impressions", []) + [t_impression])[-5:]
                    tb["label"] = bond_data.get("relationship_type", tb.get("label", "陌生人"))
                    tb["closeness"] = max(0, min(100, tb.get("closeness", 0) + max(0, warmth)))
                    tb["hostility"] = max(0, min(100, tb.get("hostility", 0) + max(0, -warmth)))
                    tb["trust"] = max(0, min(100, tb.get("trust", 50) + warmth // 2))
                    log.info(f"[关系更新] {target}->{bot_id}: {t_impression}")

            except Exception as e:
                log.error(f"[关系更新失败] {bot_id}->{target}: {e}")

        Thread(target=_update_bonds_after_talk, daemon=True).start()

        # === v8.4: 对话后果判定 — 让说话有重量 ===
        def _judge_talk_consequences():
            try:
                consequence_prompt = f"""两个人刚刚进行了一次对话。请判断这次对话是否产生了以下任何一种社会后果。

{bot.get('name', bot_id)}对{target}说: "{message}"

请用JSON输出:
{{{{
  "has_consequence": true/false,
  "type": "gossip/promise/request/conflict/none",
  "detail": "一句话描述后果",
  "gossip_about": "如果是八卦，说的是谁",
  "promise_content": "如果是承诺，承诺了什么"
}}}}
只输出JSON。"""
                resp = client.chat.completions.create(
                    model=OPENAI_MODEL_NANO,
                    messages=[{"role": "user", "content": consequence_prompt}],
                    temperature=0.3, max_tokens=150,
                )
                raw = resp.choices[0].message.content.strip()
                if raw.startswith("```"): raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                start = raw.find("{")
                end = raw.rfind("}") + 1
                if start >= 0 and end > start:
                    raw = raw[start:end]
                cdata = json.loads(raw)

                if not cdata.get("has_consequence"):
                    return

                ctype = cdata.get("type", "none")
                detail = cdata.get("detail", "")

                if ctype == "gossip" and cdata.get("gossip_about"):
                    # 八卦传播：将信息传递给第三方
                    gossip_target = cdata["gossip_about"]
                    # 找到被八卦的bot
                    for bid2, b2 in world["bots"].items():
                        if b2.get("name") == gossip_target and bid2 != bot_id and bid2 != target:
                            world["message_board"].append({
                                "to": bid2, "from": "rumor",
                                "msg": f"【流言】有人在背后议论你: {detail}",
                                "tick": world["time"]["tick"], "priority": "normal",
                            })
                            log.info(f"[八卦传播] {bot_id}和{target}在议论{gossip_target}: {detail}")
                            break

                elif ctype == "promise":
                    # 记录承诺，待实现
                    promise = cdata.get("promise_content", detail)
                    bot["action_log"].append({
                        "tick": world["time"]["tick"],
                        "time": world["time"]["virtual_datetime"],
                        "plan": f"承诺: {promise}",
                        "action": {"category": "social", "type": "promise"},
                        "result": f"对{target}做出了承诺: {promise}"
                    })
                    log.info(f"[承诺] {bot_id}对{target}: {promise}")

                elif ctype == "conflict":
                    # 冲突大幅影响关系
                    emotions["anger"] = min(100, emotions.get("anger", 0) + 10)
                    emotions["sadness"] = min(100, emotions.get("sadness", 0) + 5)
                    bot["emotions"] = emotions
                    if target.startswith("bot_") and target in world["bots"]:
                        tb = world["bots"][target]
                        te = tb.get("emotions", {})
                        te["anger"] = min(100, te.get("anger", 0) + 10)
                        tb["emotions"] = te
                        # 降低双方信任
                        if bot_id in tb.get("emotional_bonds", {}):
                            tb["emotional_bonds"][bot_id]["trust"] = max(0, tb["emotional_bonds"][bot_id].get("trust", 50) - 10)
                            tb["emotional_bonds"][bot_id]["hostility"] = min(100, tb["emotional_bonds"][bot_id].get("hostility", 0) + 10)
                    log.info(f"[冲突] {bot_id}和{target}发生了冲突: {detail}")

                elif ctype == "request":
                    # 请求帮助，通知对方
                    if target.startswith("bot_") and target in world["bots"]:
                        world["message_board"].append({
                            "to": target, "from": bot_id,
                            "msg": f"【请求】{bot.get('name', bot_id)}向你提出了请求: {detail}",
                            "tick": world["time"]["tick"], "priority": "high",
                        })
                    log.info(f"[请求] {bot_id}向{target}: {detail}")

            except Exception as e:
                log.error(f"[对话后果判定失败] {bot_id}->{target}: {e}")

        Thread(target=_judge_talk_consequences, daemon=True).start()

        # === NPC会“回嘴”：用LLM生成NPC的回应 ===
        # NPC互动计数（用于NPC演化）
        if not target.startswith("bot_"):
            for loc_data in world["locations"].values():
                for npc in loc_data.get("npcs", []):
                    if npc.get("name") == target:
                        npc["interaction_count"] = npc.get("interaction_count", 0) + 1
        npc_reply = ""
        if not target.startswith("bot_"):
            def _generate_npc_reply():
                try:
                    # 找到NPC信息
                    npc_info = None
                    for loc_data in world["locations"].values():
                        for npc in loc_data.get("npcs", []):
                            if npc.get("name") == target:
                                npc_info = npc
                                break
                    npc_desc = npc_info.get("desc", "") if npc_info else ""
                    npc_personality = npc_info.get("personality", npc_desc) if npc_info else target

                    # 获取之前的互动历史
                    prev = []
                    for entry in bot.get("action_log", [])[-20:]:
                        r = str(entry.get("result", ""))
                        if target in r:
                            prev.append(r[:80])
                    history = "\n".join(prev[-5:]) if prev else "这是他们第一次聊天"

                    npc_prompt = f"""你是{target}，一个深圳的NPC。
你的身份: {npc_personality}

有人对你说: "{message}"
说话的人是{bot.get('name', bot_id)}。

你们之前的互动:
{history}

请用一句话回应，符合你的身份和性格。考虑之前的互动历史，不要每次都像第一次见面。
只输出回应内容，不要加任何前缀。"""

                    resp = client.chat.completions.create(
                        model=OPENAI_MODEL_NANO,
                        messages=[{"role": "user", "content": npc_prompt}],
                        temperature=0.7, max_tokens=80,
                    )
                    reply = resp.choices[0].message.content.strip().strip('"')
                    # 把NPC回应写入消息板
                    world["message_board"].append({
                        "tick": world["time"]["tick"],
                        "time": world["time"]["virtual_datetime"],
                        "from": target,
                        "to": bot_id,
                        "msg": reply,
                        "priority": "normal"
                    })
                    log.info(f"[NPC回应] {target}对{bot_id}说: {reply}")
                except Exception as e:
                    log.error(f"[NPC回应失败] {target}: {e}")

            Thread(target=_generate_npc_reply, daemon=True).start()

        return msg

    elif act == "rest":
        recover = random.randint(10, 20)
        bot["energy"] = min(100, bot["energy"] + recover)
        emotions["anxiety"] = max(0, emotions.get("anxiety", 20) - 3)
        bot["emotions"] = emotions
        msg = f"休息了一会，能量恢复{recover}"
        log.info(f"{bot_id}: {msg}")
        return msg


    elif act == "trade":
        target = action.get("target", "")
        give_type = action.get("give_type", "money")
        give_amt = int(action.get("give_amount", 0))
        want_type = action.get("want_type", "money")
        want_amt = int(action.get("want_amount", 0))
        if target in world["bots"] and world["bots"][target]["status"] == "alive":
            if give_type == "money" and bot["money"] >= give_amt:
                bot["money"] -= give_amt
                world["bots"][target]["money"] += give_amt
                if want_type == "hp" and world["bots"][target]["hp"] >= want_amt:
                    world["bots"][target]["hp"] -= want_amt
                    bot["hp"] = min(100, bot["hp"] + want_amt)
                msg = f"与{target}交易: 给出{give_amt}{give_type}, 获得{want_amt}{want_type}"
                log.info(f"{bot_id}: {msg}")
                return msg
            elif give_type == "hp" and bot["hp"] >= give_amt:
                bot["hp"] -= give_amt
                world["bots"][target]["hp"] = min(100, world["bots"][target]["hp"] + give_amt)
                if want_type == "money" and world["bots"][target]["money"] >= want_amt:
                    world["bots"][target]["money"] -= want_amt
                    bot["money"] += want_amt
                msg = f"与{target}交易: 给出{give_amt}HP, 获得{want_amt}元"
                log.info(f"{bot_id}: {msg}")
                return msg
        return "交易失败"

    elif act == "post_moment":
        content = action.get("content", "")
        mood = action.get("mood", "neutral")
        # 基于最近的实际行动生成朋友圈内容，避免LLM幻觉
        recent_actions = bot.get("action_log", [])[-5:]
        if recent_actions:
            action_summaries = [a.get("plan", "") for a in recent_actions if a.get("plan")]
            if action_summaries:
                try:
                    gen_resp = client.chat.completions.create(
                        model=OPENAI_MODEL_NANO,
                        messages=[{"role": "user", "content": f"""你是{bot.get('name', bot_id)}，根据你最近的真实经历写一条朋友圈。
你最近做了: {'; '.join(action_summaries[-3:])}
当前位置: {bot['location']}
当前心情: {mood}

要求：只基于以上真实经历写，不要编造没发生的事。像真人发朋友圈一样，简短自然，1-2句话。
只输出朋友圈内容，不要其他文字。"""}],
                        temperature=0.8, max_tokens=100,
                    )
                    content = gen_resp.choices[0].message.content.strip().strip('"')
                except:
                    pass  # 失败时用原始 content
        moment = {
            "id": f"m_{world['time']['tick']}_{bot_id}",
            "bot_id": bot_id,
            "bot_name": bot.get("name", bot_id),
            "content": content,
            "mood": mood,
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "weather": world["weather"]["current"],
            "location": bot["location"],
            "likes": [],
            "comments": [],
        }
        world["moments"].append(moment)
        if len(world["moments"]) > 200:
            world["moments"] = world["moments"][-150:]
        # 发朋友圈满足虚荣心，降低孤独感
        desires = bot.get("desires", {})
        desires["vanity"] = max(0, desires.get("vanity", 20) - 5)
        bot["desires"] = desires
        emotions["loneliness"] = max(0, emotions.get("loneliness", 30) - 3)
        bot["emotions"] = emotions
        bot["phone_battery"] = max(0, bot.get("phone_battery", 100) - 3)
        msg = f"发了条朋友圈: {content[:50]}..."
        log.info(f"{bot_id}: {msg}")
        return msg

    elif act == "browse_phone":
        focus = action.get("focus", "moments")
        bot["phone_battery"] = max(0, bot.get("phone_battery", 100) - 5)
        if bot.get("phone_battery", 0) <= 0:
            return "手机没电了，无法刷手机"

        info_gathered = []
        if focus == "news":
            news = world.get("news_feed", [])[:3]
            info_gathered = [n["headline"] for n in news]
            msg = f"刷了会新闻: {'; '.join(info_gathered[:2])}"
        elif focus == "moments":
            recent_moments = world.get("moments", [])[-5:]
            info_gathered = [f"{m['bot_name']}: {m['content'][:30]}" for m in recent_moments if m["bot_id"] != bot_id]
            msg = f"刷了会朋友圈，看到{len(info_gathered)}条动态"
            # 可能点赞
            for m in recent_moments:
                if m["bot_id"] != bot_id and bot_id not in m.get("likes", []) and random.random() < 0.3:
                    m["likes"].append(bot_id)
        else:
            topics = world.get("hot_topics", [])[:3]
            info_gathered = topics
            msg = f"刷了会热搜: {'; '.join(topics[:2])}"

        emotions["loneliness"] = max(0, emotions.get("loneliness", 30) - 2)
        if random.random() < 0.3:
            emotions["anxiety"] = min(100, emotions.get("anxiety", 20) + 2)  # 信息焦虑
        bot["emotions"] = emotions
        bot["energy"] = max(0, bot["energy"] - 2)
        log.info(f"{bot_id}: {msg}")
        return json.dumps({"msg": msg, "info": info_gathered}, ensure_ascii=False)

    elif act == "sleep":
        bot["is_sleeping"] = True
        emotions["anxiety"] = max(0, emotions.get("anxiety", 20) - 5)
        bot["emotions"] = emotions
        msg = "躺下睡觉了，能量开始恢复..."
        log.info(f"{bot_id}: {msg}")
        return msg

    elif act == "wake_up":
        bot["is_sleeping"] = False
        msg = "醒了！新的一天开始了"
        log.info(f"{bot_id}: {msg}")
        return msg

    elif act == "sell_body":
        desires = bot.get("desires", {})
        want = action.get("want", "money")
        vanity = desires.get("vanity", 20)
        base_pay = random.randint(50, 150)
        pay = int(base_pay * (0.5 + vanity / 200))
        hp_cost = random.randint(3, 8)
        energy_cost = random.randint(15, 30)
        bot["hp"] = max(0, bot["hp"] - hp_cost)
        bot["energy"] = max(0, bot["energy"] - energy_cost)
        if want == "food":
            bot["satiety"] = min(100, bot["satiety"] + 60)
            msg = f"为了填饱肚子，出卖了自己的身体。得到了一顿饱饭。(HP-{hp_cost}, 能量-{energy_cost})"
        else:
            bot["money"] += pay
            msg = f"为了生存，出卖了自己的身体。获得{pay}元。(HP-{hp_cost}, 能量-{energy_cost})"
        desires["lust"] = max(0, desires.get("lust", 50) - DESIRE_DECAY_ON_FULFILL)
        desires["security"] = min(100, desires.get("security", 50) + 15)
        bot["desires"] = desires
        emotions["sadness"] = min(100, emotions.get("sadness", 10) + 15)
        emotions["anxiety"] = min(100, emotions.get("anxiety", 20) + 10)
        bot["emotions"] = emotions
        log.warning(f"{bot_id}: {msg}")
        return msg

    elif act == "seek_pleasure":
        desires = bot.get("desires", {})
        cost = random.randint(100, 300)
        if bot["money"] < cost:
            return f"想寻欢作乐，但钱不够(需要{cost}元，只有{bot['money']}元)"
        bot["money"] -= cost
        bot["energy"] = max(0, bot["energy"] - 20)
        desires["lust"] = max(0, desires.get("lust", 50) - DESIRE_DECAY_ON_FULFILL)
        desires["vanity"] = min(100, desires.get("vanity", 20) + 5)
        bot["desires"] = desires
        emotions["happiness"] = min(100, emotions.get("happiness", 50) + 5)
        bot["emotions"] = emotions
        msg = f"花了{cost}元寻欢作乐。欲望得到了暂时的满足。(能量-20)"
        log.warning(f"{bot_id}: {msg}")
        return msg

    elif act == "intimate":
        target_id = action.get("target", "")
        desires = bot.get("desires", {})
        loc = bot["location"]
        loc_bots = world["locations"][loc]["bots"]

        if target_id not in loc_bots or target_id == bot_id:
            return "想找人发展亲密关系，但附近没有合适的对象"

        target = world["bots"].get(target_id)
        if not target or target.get("status") == "dead" or target.get("is_sleeping"):
            return "对方不在或无法回应"

        desires["lust"] = max(0, desires.get("lust", 50) - DESIRE_DECAY_ON_FULFILL)
        bot["energy"] = max(0, bot["energy"] - 10)
        emotions["happiness"] = min(100, emotions.get("happiness", 50) + 5)
        emotions["loneliness"] = max(0, emotions.get("loneliness", 30) - 15)
        bot["desires"] = desires
        bot["emotions"] = emotions

        t_desires = target.get("desires", {})
        t_desires["lust"] = max(0, t_desires.get("lust", 50) - DESIRE_DECAY_ON_FULFILL * 0.7)
        target["desires"] = t_desires
        t_emotions = target.get("emotions", {})
        t_emotions["happiness"] = min(100, t_emotions.get("happiness", 50) + 4)
        t_emotions["loneliness"] = max(0, t_emotions.get("loneliness", 30) - 10)
        target["emotions"] = t_emotions

        # 双方亲密度提升
        for a, b in [(bot_id, target_id), (target_id, bot_id)]:
            src = world["bots"][a]
            rels = src.get("relationships", {})
            if b not in rels or not isinstance(rels[b], dict):
                rels[b] = {"trust": 0, "intimacy": 0, "hostility": 0}
            rels[b]["intimacy"] = min(100, rels[b].get("intimacy", 0) + 25)
            rels[b]["trust"] = min(100, rels[b].get("trust", 0) + 10)
            src["relationships"] = rels

        target_name = target.get("name", target_id)
        msg = f"和{target_name}发展了亲密关系。双方感情升温，欲望得到释放。(能量-10)"
        log.warning(f"{bot_id}: {msg}")
        target["action_log"].append({
            "tick": world["time"]["tick"],
            "action": f"{bot.get('name', bot_id)}与你发展了亲密关系",
            "result": "感情升温，欲望释放"
        })
        return msg

    elif act == "selfie":
        selfie_prompt = action.get("prompt", "")
        if not selfie_prompt:
            selfie_prompt = f"A person taking a selfie at {bot['location']} in Shenzhen, China"
        bot["selfie_count"] = bot.get("selfie_count", 0) + 1
        tick = world["time"]["tick"]
        filename = f"{bot_id}_day{world['time']['virtual_day']}_{tick}.jpg"
        save_path = os.path.join(SELFIES_DIR, filename)
        bot["phone_battery"] = max(0, bot.get("phone_battery", 100) - 5)
        emotions["happiness"] = min(100, emotions.get("happiness", 50) + 2)
        desires = bot.get("desires", {})
        desires["vanity"] = max(0, desires.get("vanity", 20) - 8)
        bot["desires"] = desires
        bot["emotions"] = emotions

        def _gen():
            result = grok_generate(selfie_prompt, save_path)
            if result["success"]:
                with lock:
                    world["gallery"].append({
                        "bot_id": bot_id,
                        "bot_name": bot.get("name", bot_id),
                        "filename": filename,
                        "prompt": selfie_prompt,
                        "time": world["time"]["virtual_datetime"],
                        "tick": tick,
                        "url": f"/selfies/{filename}"
                    })
                log.info(f"{bot_id} 拍照成功: {filename}")
            else:
                err = result.get('error', '未知错误')
                log.error(f"{bot_id} 拍照失败: {err}")
                # v8.3.2: 优雅降级 - 记录失败体验而不是静默失败
                with lock:
                    world["events"].append({
                        "tick": tick,
                        "time": world["time"]["virtual_datetime"],
                        "desc": f"{bot.get('name', bot_id)}想拍照但手机信号不好，没拍成"
                    })

        Thread(target=_gen, daemon=True).start()
        msg = f"📸 正在拍照: {selfie_prompt[:60]}..."
        log.info(f"{bot_id}: {msg}")
        return msg

    elif act == "free_action" or cat == "free":
        desc = action.get("desc", "做了点事情")
        # 用LLM解释自由行动的后果，让世界更加丰富
        consequence = interpret_free_action(bot_id, bot, desc)
        log.info(f"{bot_id}: [自由行动] {desc} -> {consequence}")
        return consequence

    else:
        # 其他未识别的行动也走自由解释
        desc = action.get("desc", str(action))
        consequence = interpret_free_action(bot_id, bot, desc)
        log.info(f"{bot_id}: [未分类行动] {desc} -> {consequence}")
        return consequence


def interpret_free_action(bot_id, bot, desc):
    """LLM解释自由行动的后果，返回叙事性结果并应用数值变化"""
    emotions = bot.get("emotions", {})
    loc = bot["location"]

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_NANO,
            messages=[{"role": "user", "content": f"""你是深圳生存模拟的世界引擎。一个角色正在执行以下行动，请解释后果。

角色: {bot.get('name', bot_id)}
地点: {loc}
行动: {desc}
当前钱: {bot['money']}元
当前能量: {bot['energy']}

请输出一个JSON：
{{
  "narrative": "一句话描述发生了什么（第三人称，生动具体）",
  "money_delta": 0,
  "energy_delta": -3,
  "happiness_delta": 0,
  "skill_up": null,
  "found_item": null
}}

规则：
- narrative要生动具体，像小说叙述
- money_delta通常为0或负数（花钱），不要随便给钱
- energy_delta通常为-2到-5（做事消耗能量）
- happiness_delta范围-5到+5
- skill_up可以是"creative"/"tech"/"social"/"physical"或null
- found_item可以是一个物品名或null（小概率发现东西）
- 只输出JSON"""}],
            temperature=0.7, max_tokens=200,
        )
        raw = resp.choices[0].message.content.strip()
        # v8.3: 更强力的JSON提取
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        # 用正则贪婪匹配第一个完整JSON对象
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw, re.DOTALL)
        if json_match:
            raw = json_match.group(0)
        else:
            # fallback: 用旧方法
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                raw = raw[start:end]
        # v8.3.2: 增强JSON清洗 - 处理LLM常见的非法字符
        raw = re.sub(r':\s*(-?\d+)\s*[+\-]', r': \1', raw)  # 数值后的+/-
        raw = re.sub(r',\s*}', '}', raw)  # 尾部多余逗号
        raw = re.sub(r',\s*]', ']', raw)  # 数组尾部多余逗号
        raw = raw.replace('\n', ' ')  # 去掉字符串中的换行
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            # 再次尝试：去掉所有控制字符
            cleaned = re.sub(r'[\x00-\x1f]', ' ', raw)
            result = json.loads(cleaned)

        # 应用数值变化
        narrative = result.get("narrative", desc)
        bot["money"] = max(0, bot["money"] + int(result.get("money_delta", 0)))
        bot["energy"] = max(0, min(100, bot["energy"] + int(result.get("energy_delta", -3))))
        h_delta = int(result.get("happiness_delta", 0))
        emotions["happiness"] = max(0, min(100, emotions.get("happiness", 50) + h_delta))
        bot["emotions"] = emotions

        skill = result.get("skill_up")
        if skill and skill in bot["skills"]:
            bot["skills"][skill] = min(100, bot["skills"][skill] + 1)

        item = result.get("found_item")
        if item:
            bot["inventory"].append(item)
            narrative += f"（发现了{item}）"

        return narrative

    except Exception as e:
        log.error(f"interpret_free_action失败: {e} | raw={raw[:200] if 'raw' in dir() else 'N/A'}")
        # fallback: 简单处理
        bot["energy"] = max(0, bot["energy"] - 3)
        return desc


# ============================================================
# v10.0: Generic 工具系统 + 反馈循环
# ============================================================

def execute_generic(bot_id, tool_call):
    """v10.0 核心：执行 generic 工具调用，返回丰富的后果反馈。
    5个工具: use_resource / interact / move / create / express
    所有后果由 LLM 判断，不再硬编码。"""
    bot = world["bots"][bot_id]
    tool = tool_call.get("tool", "")
    args = tool_call.get("args", {})
    desc = tool_call.get("desc", "")
    loc = bot["location"]
    loc_info = world["locations"].get(loc, {})

    # 构建世界上下文给 LLM
    nearby_bots_info = []
    for nb in loc_info.get("bots", []):
        if nb != bot_id:
            ob = world["bots"].get(nb, {})
            nearby_bots_info.append(f"{ob.get('name','?')}({nb}): {ob.get('current_activity','闲着')}")

    existing_creations = [m for m in world.get("world_modifications", []) if m.get("location") == loc]
    creations_text = ", ".join([f"{c['name']}(by {c.get('creator_name','?')})" for c in existing_creations[:5]]) if existing_creations else "无"

    npcs_text = ", ".join([n.get("name","?") for n in loc_info.get("npcs", [])]) if loc_info.get("npcs") else "无"

    context = f"""角色: {bot.get('name', bot_id)} ({bot.get('age','?')}岁{bot.get('gender','?')})
性格: {bot.get('personality','')[:60]}
地点: {loc}
金钱: {bot['money']}元 | 能量: {bot['energy']}/100 | 饱腹: {bot['satiety']}/100 | HP: {bot['hp']:.0f}/100
技能: {json.dumps(bot.get('skills',{}), ensure_ascii=False)}
物品: {bot.get('inventory', [])}
附近的人: {chr(10).join(nearby_bots_info) if nearby_bots_info else '无'}
NPC: {npcs_text}
这里已有的创造物: {creations_text}
天气: {world['weather'].get('condition','晴天')}
时间: {world['time']['virtual_datetime']}"""

    consequence_prompt = f"""你是深圳生存模拟的世界引擎。一个角色使用了工具，请判断后果。

{context}

== 工具调用 ==
工具: {tool}
参数: {json.dumps(args, ensure_ascii=False)}
描述: {desc}

请输出一个JSON，判断这个行动在真实世界中会产生什么后果：

{{
  "narrative": "2-3句生动的第三人称叙述，描述发生了什么，要具体、有画面感",
  "success": true或false,
  "money_delta": 金钱变化(整数，花钱为负，赚钱为正，要合理),
  "energy_delta": 能量变化(通常-2到-10，休息为正),
  "satiety_delta": 饱腹变化(吃东西为正，否则0),
  "happiness_delta": 快乐变化(-10到+10),
  "skill_up": "提升的技能名(creative/tech/social/physical)或null",
  "world_change": {{
    "type": "new_entity/modify_entity/destroy_entity/reputation/information/null",
    "name": "创造物/变化的名称",
    "description": "这个变化的描述",
    "permanent": true或false,
    "cost_money": 创建花费(0如果不花钱),
    "cost_energy": 创建消耗能量
  }} 或 null,
  "social_effects": [
    {{
      "target": "受影响的人的bot_id或名字",
      "effect": "对这个人产生了什么影响",
      "warmth_delta": 关系温度变化(-5到+5)
    }}
  ],
  "side_effects": ["附近的人能观察到的现象(1-2条)"],
  "feedback_to_actor": "给行动者的直接反馈(他能看到/听到/感受到什么)"
}}

规则：
- 要符合现实逻辑，不要魔法
- 花钱的事情必须检查够不够钱(当前{bot['money']}元)，不够就失败
- 能量不够(当前{bot['energy']})也会影响结果
- 创业/开店至少需要100-500元，不能空手套白狼
- 和人互动时，对方的反应要符合对方的性格和当前状态
- world_change只在真正产生持久影响时才填(画画、开店、种树、建东西等)，普通聊天/吃饭不算
- social_effects只在有社交互动时才填
- 只输出JSON"""

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_MINI,
            messages=[{"role": "user", "content": consequence_prompt}],
            temperature=0.7, max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            raw = json_match.group(0)
        raw = re.sub(r',\s*}', '}', raw)
        raw = re.sub(r',\s*]', ']', raw)
        result = json.loads(raw)
    except Exception as e:
        log.error(f"[v10] execute_generic LLM失败: {e}")
        result = {
            "narrative": f"{bot.get('name', bot_id)}尝试{desc}，但没什么特别的事发生。",
            "success": True, "money_delta": 0, "energy_delta": -3,
            "satiety_delta": 0, "happiness_delta": 0,
            "world_change": None, "social_effects": [], "side_effects": [],
            "feedback_to_actor": "一切如常。"
        }

    # === 应用后果 ===
    narrative = result.get("narrative", desc)

    # 资源变化
    money_d = int(result.get("money_delta", 0))
    energy_d = int(result.get("energy_delta", -3))
    satiety_d = int(result.get("satiety_delta", 0))
    happiness_d = int(result.get("happiness_delta", 0))

    bot["money"] = max(0, bot["money"] + money_d)
    bot["energy"] = max(0, min(100, bot["energy"] + energy_d))
    bot["satiety"] = max(0, min(100, bot["satiety"] + satiety_d))
    emotions = bot.get("emotions", {})
    emotions["happiness"] = max(0, min(100, emotions.get("happiness", 50) + happiness_d))
    bot["emotions"] = emotions

    # 技能提升
    skill = result.get("skill_up")
    if skill and skill in bot.get("skills", {}):
        bot["skills"][skill] = min(100, bot["skills"][skill] + 1)

    # === 世界改变 ===
    wc = result.get("world_change")
    if wc and wc.get("type") and wc["type"] != "null":
        cost_m = int(wc.get("cost_money", 0))
        cost_e = int(wc.get("cost_energy", 0))

        # 检查资源是否足够
        if bot["money"] >= cost_m and bot["energy"] >= cost_e:
            bot["money"] -= cost_m
            bot["energy"] = max(0, bot["energy"] - cost_e)

            if wc.get("permanent", False):
                mod = {
                    "name": wc.get("name", "未知创造"),
                    "description": wc.get("description", ""),
                    "type": wc["type"],
                    "creator": bot_id,
                    "creator_name": bot.get("name", bot_id),
                    "location": loc,
                    "tick": world["time"]["tick"],
                    "time": world["time"]["virtual_datetime"],
                }
                world["world_modifications"].append(mod)
                log.warning(f"[v10 WORLD_CHANGE] {bot.get('name',bot_id)} 创造了 [{wc['name']}] @ {loc}")

                # 声望奖励
                rep = bot.get("reputation", {"score": 0, "tags": []})
                rep["score"] = rep.get("score", 0) + 3
                bot["reputation"] = rep

                # 地点公共记忆
                add_public_memory(loc, f"{bot.get('name',bot_id)}创造了{wc['name']}: {wc.get('description','')[:40]}", bot_id, "creation")

            elif wc["type"] == "reputation":
                rep = bot.get("reputation", {"score": 0, "tags": []})
                rep["score"] = rep.get("score", 0) + 1
                bot["reputation"] = rep

            elif wc["type"] == "information":
                # 信息传播——添加到地点记忆
                add_public_memory(loc, f"{bot.get('name',bot_id)}: {wc.get('description','')[:50]}", bot_id, "information")

            narrative += f" [世界变化: {wc.get('name','')}]"
        else:
            narrative += f" (想创造{wc.get('name','')}, 但资源不够)"

    # === 社交效果 ===
    social_fx = result.get("social_effects", [])
    for fx in social_fx:
        target_id = fx.get("target", "")
        warmth_d = int(fx.get("warmth_delta", 0))
        effect_desc = fx.get("effect", "")

        # 尝试匹配 target 到 bot_id
        resolved_target = None
        for bid, bdata in world["bots"].items():
            if bid == target_id or bdata.get("name") == target_id:
                resolved_target = bid
                break

        if resolved_target and resolved_target != bot_id:
            # 更新关系
            rels = bot.get("relationships", {})
            if resolved_target not in rels:
                rels[resolved_target] = {"label": "认识的人", "warmth": 0}
            rels[resolved_target]["warmth"] = max(-10, min(10, rels[resolved_target].get("warmth", 0) + warmth_d))
            bot["relationships"] = rels

            # 对方也感知到
            target_bot = world["bots"].get(resolved_target, {})
            target_rels = target_bot.get("relationships", {})
            if bot_id not in target_rels:
                target_rels[bot_id] = {"label": "认识的人", "warmth": 0}
            # 对方的感受是行动者的一半
            target_rels[bot_id]["warmth"] = max(-10, min(10, target_rels[bot_id].get("warmth", 0) + warmth_d // 2))
            target_bot["relationships"] = target_rels

            log.info(f"[v10 SOCIAL] {bot.get('name',bot_id)}->{world['bots'].get(resolved_target,{}).get('name','?')}: {effect_desc} (warmth {warmth_d:+d})")

            # 记录到地点记忆（如果是显著互动）
            if abs(warmth_d) >= 3:
                add_public_memory(loc, f"{bot.get('name',bot_id)}和{target_bot.get('name','?')}: {effect_desc[:30]}", bot_id, "social")

    # === 侧面效果（供其他bot感知） ===
    side_effects = result.get("side_effects", [])
    if side_effects:
        # 存储为地点的临时事件，其他bot下次heartbeat时能看到
        if "recent_events" not in loc_info:
            loc_info["recent_events"] = []
        for se in side_effects[:3]:
            loc_info["recent_events"].append({
                "event": se,
                "source": bot_id,
                "tick": world["time"]["tick"]
            })
        # 只保留最近10条
        loc_info["recent_events"] = loc_info["recent_events"][-10:]

    # === 构建反馈结果 ===
    feedback = {
        "narrative": narrative,
        "success": result.get("success", True),
        "feedback": result.get("feedback_to_actor", ""),
        "resource_changes": {
            "money": money_d - int(wc.get("cost_money", 0) if wc and wc.get("type") != "null" else 0),
            "energy": energy_d - int(wc.get("cost_energy", 0) if wc and wc.get("type") != "null" else 0),
            "satiety": satiety_d,
            "happiness": happiness_d,
        },
        "world_change": wc.get("name") if wc and wc.get("type") != "null" else None,
        "social_effects": [f"{fx.get('target','?')}: {fx.get('effect','')}" for fx in social_fx],
    }

    log.info(f"[v10] {bot.get('name',bot_id)} | {tool}({json.dumps(args, ensure_ascii=False)[:60]}) -> {narrative[:80]}")

    return feedback


def process_action_v10(bot_id, plan):
    """v10.0: 新的行动处理入口。
    接受 bot 的自然语言计划，用 LLM 转换为 generic 工具调用，然后执行。
    如果无法解析为工具调用，fallback 到旧的 process_action。"""
    bot = world["bots"][bot_id]
    loc = bot["location"]
    loc_info = world["locations"].get(loc, {})

    # 硬编码起床
    if plan.strip() in ("起床", "醒来", "起来"):
        action = {"category": "survive", "type": "wake_up", "desc": plan}
        result = execute(bot_id, action)
        bot["action_log"].append({
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "plan": plan, "action": action, "result": result
        })
        bot["current_activity"] = "刚刚醒来"
        return {"action": action, "result": result}

    # 硬编码睡觉
    if any(kw in plan for kw in ["睡觉", "睡了", "入睡", "躺下睡"]):
        action = {"category": "survive", "type": "sleep", "desc": plan}
        result = execute(bot_id, action)
        bot["action_log"].append({
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "plan": plan, "action": action, "result": result
        })
        bot["current_activity"] = "睡觉中"
        return {"action": action, "result": result}

    # 用 LLM 将自然语言转为 generic 工具调用
    nearby_bots = [b for b in loc_info.get("bots",[]) if b != bot_id]
    nearby_info = []
    for nb in nearby_bots[:5]:
        ob = world["bots"].get(nb, {})
        nearby_info.append(f"{nb}({ob.get('name','?')})")

    all_locs = list(LOCATIONS.keys())
    existing_things = [m["name"] for m in world.get("world_modifications", []) if m.get("location") == loc]

    tool_prompt = f"""你是一个JSON转换器。将用户的自然语言计划转为一个工具调用JSON。只输出JSON。

## 上下文
- 角色: {bot.get('name', bot_id)} (钱:{bot['money']}元, 能量:{bot['energy']}, 饱腹:{bot['satiety']})
- 地点: {loc}
- 附近的人: {nearby_info if nearby_info else '无'}
- NPC: {[n['name'] for n in loc_info.get('npcs',[])]}
- 所有地点: {all_locs}
- 这里已有的东西: {existing_things if existing_things else '无'}

## 5个工具

### use_resource - 消耗资源做任何事
用途: 吃饭、买东西、工作赚钱、学习、锻炼、休息、娱乐...
{{"tool":"use_resource", "args":{{"resource":"money/energy/item", "amount":数字, "purpose":"做什么"}}, "desc":"原始描述"}}

### interact - 与人/NPC/物品/设施交互
用途: 聊天、交易、合作、争吵、求助、使用设施...
{{"tool":"interact", "args":{{"target":"对象名或bot_id", "manner":"friendly/hostile/business/romantic/casual", "content":"具体内容"}}, "desc":"原始描述"}}

### move - 移动到其他地点
{{"tool":"move", "args":{{"destination":"地点名", "mode":"walk/bus/taxi"}}, "desc":"原始描述"}}
目的地必须是: {all_locs}

### create - 创造/建造/改变世界中的东西
用途: 开店、摆摊、画画、种树、写歌、组织活动、传播消息...
{{"tool":"create", "args":{{"what":"创造什么", "where":"{loc}", "using":"需要的资源描述"}}, "desc":"原始描述"}}

### express - 表达/输出信息
用途: 发朋友圈、自言自语、大声呼喊、唱歌、演讲...
{{"tool":"express", "args":{{"channel":"朋友圈/自言自语/大声说/唱歌/表演", "content":"内容"}}, "desc":"原始描述"}}

## 规则
- 只输出一个JSON
- 如果计划包含多个动作，只取最主要的一个
- 吃饭/买东西/工作/休息/学习/锻炼 -> use_resource
- 和人说话/交易/合作 -> interact
- 去其他地方 -> move
- 创造新东西/永久改变环境 -> create
- 发朋友圈/唱歌/喊话 -> express
- desc字段完整保留原始计划

## 计划
"{plan}"

## JSON"""

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL_NANO,
            messages=[{"role": "user", "content": tool_prompt}],
            temperature=0.0, max_tokens=200,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        start = raw.find("{")
        if start >= 0:
            depth = 0
            end = start
            for i in range(start, len(raw)):
                if raw[i] == "{":
                    depth += 1
                elif raw[i] == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            raw = raw[start:end]
        tool_call = json.loads(raw)
    except Exception as e:
        log.error(f"[v10] LLM工具解析失败: {e}, fallback到旧逻辑")
        return process_action(bot_id, plan)

    tool_name = tool_call.get("tool", "")

    # move 特殊处理（直接执行，不需要LLM判断后果）
    if tool_name == "move":
        dest = tool_call.get("args", {}).get("destination", "")
        mode = tool_call.get("args", {}).get("mode", "walk")
        if dest == bot["location"]:
            # 同地移动 = 就地探索，转为 generic 执行
            tool_call["tool"] = "use_resource"
            tool_call["args"] = {"resource": "energy", "amount": 3, "purpose": f"在{loc}附近闲逛探索"}
            tool_call["desc"] = f"在{loc}附近闲逛探索"
            feedback = execute_generic(bot_id, tool_call)
        elif dest in LOCATIONS:
            old_loc = bot["location"]
            if old_loc in world["locations"] and bot_id in world["locations"][old_loc]["bots"]:
                world["locations"][old_loc]["bots"].remove(bot_id)
            bot["location"] = dest
            if bot_id not in world["locations"][dest]["bots"]:
                world["locations"][dest]["bots"].append(bot_id)
            cost = {"walk": 0, "bus": 3, "taxi": 15}.get(mode, 0)
            bot["money"] = max(0, bot["money"] - cost)
            bot["energy"] = max(0, bot["energy"] - 5)
            narrative = f"{bot.get('name',bot_id)}从{old_loc}{'走路' if mode=='walk' else '坐'+mode}到了{dest}"
            if cost > 0:
                narrative += f"(花了{cost}元)"
            log.info(f"[v10] {bot.get('name',bot_id)} 移动: {old_loc} -> {dest} ({mode})")
            feedback = {"narrative": narrative, "success": True, "feedback": f"你到了{dest}"}
        else:
            feedback = {"narrative": f"找不到{dest}这个地方", "success": False, "feedback": "目的地不存在"}

    # express 中的朋友圈特殊处理
    elif tool_name == "express" and tool_call.get("args", {}).get("channel") == "朋友圈":
        content = tool_call.get("args", {}).get("content", "")
        moment = {
            "author": bot_id,
            "author_name": bot.get("name", bot_id),
            "content": content,
            "time": world["time"]["virtual_datetime"],
            "tick": world["time"]["tick"],
            "likes": [],
            "comments": [],
        }
        world["moments"].append(moment)
        if len(world["moments"]) > 100:
            world["moments"] = world["moments"][-80:]
        log.info(f"[v10] {bot.get('name',bot_id)} 发朋友圈: {content[:40]}")
        feedback = {"narrative": f"{bot.get('name',bot_id)}发了一条朋友圈: {content[:30]}...", "success": True, "feedback": "朋友圈发送成功"}

    else:
        # 所有其他工具调用走 generic 执行引擎
        feedback = execute_generic(bot_id, tool_call)

    # 记录行动日志
    bot["action_log"].append({
        "tick": world["time"]["tick"],
        "time": world["time"]["virtual_datetime"],
        "plan": plan,
        "tool_call": tool_call,
        "result": feedback,
    })
    if len(bot["action_log"]) > 50:
        bot["action_log"] = bot["action_log"][-30:]

    # 更新当前活动
    bot["current_activity"] = (tool_call.get("desc", "") or plan)[:40]

    # 存储反馈供 bot 下次感知
    bot["last_action_feedback"] = {
        "plan": plan,
        "narrative": feedback.get("narrative", ""),
        "feedback": feedback.get("feedback", ""),
        "success": feedback.get("success", True),
        "world_change": feedback.get("world_change"),
        "social_effects": feedback.get("social_effects", []),
    }

    # === v10.1: 判断是否应该产生新的世界运行规则 ===
    log.info(f"[RULES-DEBUG] 准备判断规则: {bot.get('name',bot_id)} @ {loc}, success={feedback.get('success', True)}, plan={plan[:50]}")
    if feedback.get("success", True):
        try:
            new_rules = generate_rules_from_action(
                world, bot_id, bot.get("name", bot_id), loc,
                plan, feedback.get("narrative", ""), client
            )
            log.info(f"[RULES-DEBUG] 规则判断结果: {len(new_rules) if new_rules else 0}条")
            if new_rules:
                for nr in new_rules:
                    world["active_rules"].append(nr)
                    log.warning(f"[RULES] 新规则注入! [{nr['name']}] by {bot.get('name',bot_id)} @ {loc}: {nr['description'][:60]}")
                    # 同时记录到反馈中，让bot知道自己改变了世界
                    bot["last_action_feedback"]["rules_created"] = [
                        {"name": nr["name"], "desc": nr["description"]} for nr in new_rules
                    ]
                    # 声望奖励
                    rep = bot.get("reputation", {"score": 0, "tags": [], "deeds": []})
                    rep["score"] = rep.get("score", 0) + 5
                    rep["deeds"].append(f"创建规则[{nr['name']}]")
                    bot["reputation"] = rep
        except Exception as e:
            log.error(f"[RULES] generate_rules_from_action失败: {e}")

    return {"action": tool_call, "result": feedback}


# ============================================================
# API 端点
# ============================================================
@app.get("/world")
def get_world():
    with lock:
        safe = {
            "time": world["time"],
            "weather": world["weather"],
            "news_feed": world["news_feed"],
            "hot_topics": world["hot_topics"],
            "bots": {},
            "locations": {},
            "events": world["events"][-10:],
            "active_effects": world["active_effects"],
            "moments": world["moments"][-20:],
            "food_prices": world.get("food_prices", {}),
        }
        for bid, bot in world["bots"].items():
            safe["bots"][bid] = {
                "id": bid, "name": bot["name"], "age": bot["age"], "gender": bot["gender"],
                "location": bot["location"], "hp": bot["hp"], "money": bot["money"],
                "energy": bot["energy"], "satiety": bot["satiety"], "status": bot["status"],
                "job": bot["job"], "skills": bot["skills"], "inventory": bot["inventory"],
                "is_sleeping": bot.get("is_sleeping", False),
                "current_task": bot.get("current_task"),
                "emotions": bot.get("emotions", {}),
                "desires": bot.get("desires", {}),
                "phone_battery": bot.get("phone_battery", 100),
                "family": bot.get("family", {}),
                "selfie_count": bot.get("selfie_count", 0),
                "aging_rate": bot.get("aging_rate", AGING_BASE),
                "emotional_bonds_summary": {k: {"label": v.get("label", ""), "closeness": v.get("closeness", 0), "latest_impression": (v.get("impressions", []) or [""])[-1]} for k, v in bot.get("emotional_bonds", {}).items()},
                "long_term_goal": bot.get("long_term_goal"),
                "narrative_summary": bot.get("narrative_summary"),
                "pending_reply_to": bot.get("pending_reply_to"),
                "core_memories": bot.get("core_memories", []),
                "recent_actions_synced": bot.get("recent_actions_synced", []),
                "current_activity": bot.get("current_activity", ""),
                # v9.0
                "reputation": bot.get("reputation", {"score": 0, "tags": [], "deeds": []}),
                "created_things": bot.get("created_things", []),
                "generation": bot.get("generation", 0),
                "inherited_from": bot.get("inherited_from"),
                # v10.0
                "last_action_feedback": bot.get("last_action_feedback", {}),
                "action_log": bot.get("action_log", [])[-10:],
            }
        for loc_name, loc_data in world["locations"].items():
            safe["locations"][loc_name] = {
                "desc": loc_data["desc"],
                "type": loc_data["type"],
                "bots": loc_data["bots"],
                "npcs": [{"name": n["name"], "role": n["role"]} for n in loc_data["npcs"]],
                "jobs": [{"title": j["title"], "pay": j["pay"]} for j in loc_data.get("jobs", [])],
                # v9.0
                "public_memory": loc_data.get("public_memory", [])[-5:],
                "modifications": loc_data.get("modifications", []),
                "vibe": loc_data.get("vibe", "普通"),
            }
        # v9.0: 添加进化引擎数据
        safe["world_modifications"] = world.get("world_modifications", [])[-20:]
        safe["urban_legends"] = world.get("urban_legends", [])[-10:]
        safe["graveyard"] = world.get("graveyard", [])
        safe["generation_count"] = world.get("generation_count", 0)
        safe["reputation_board"] = world.get("reputation_board", {})
        # v10.1: 保存活跃规则
        rules_to_save = []
        for r in world.get("active_rules", []):
            r_copy = {k: v for k, v in r.items() if k != "_triggered_bots"}
            rules_to_save.append(r_copy)
        safe["active_rules"] = rules_to_save[-50:]
        return safe


@app.get("/bot/{bot_id}/detail")
def get_bot_detail(bot_id: str):
    with lock:
        bot = world["bots"].get(bot_id)
        if not bot:
            return JSONResponse({"error": "not found"}, 404)
        return {
            "id": bot_id,
            "name": bot["name"],
            "age": bot["age"],
            "gender": bot["gender"],
            "origin": bot.get("origin", ""),
            "edu": bot.get("edu", ""),
            "home": bot["home"],
            "location": bot["location"],
            "hp": bot["hp"],
            "money": bot["money"],
            "energy": bot["energy"],
            "satiety": bot["satiety"],
            "status": bot["status"],
            "job": bot["job"],
            "skills": bot["skills"],
            "inventory": bot["inventory"],
            "relationships": bot["relationships"],
            "family": bot.get("family", {}),
            "is_sleeping": bot.get("is_sleeping", False),
            "current_task": bot.get("current_task"),
            "selfie_count": bot.get("selfie_count", 0),
            "aging_rate": bot.get("aging_rate", AGING_BASE),
            "emotions": bot.get("emotions", {}),
            "desires": bot.get("desires", {}),
            "phone_battery": bot.get("phone_battery", 100),
            "values": bot.get("values", {}),
            "core_memories": bot.get("core_memories", []),
            "emotional_bonds": bot.get("emotional_bonds", {}),
            "action_log": bot.get("action_log", [])[-15:],
            "long_term_goal": bot.get("long_term_goal"),
            "narrative_summary": bot.get("narrative_summary"),
            "recent_actions_synced": bot.get("recent_actions_synced", []),
            "pending_reply_to": bot.get("pending_reply_to"),
            # v9.0
            "reputation": bot.get("reputation", {"score": 0, "tags": [], "deeds": []}),
            "created_things": bot.get("created_things", []),
            "generation": bot.get("generation", 0),
            "inherited_from": bot.get("inherited_from"),
            "known_legends": bot.get("known_legends", []),
        }


@app.post("/bot/{bot_id}/action")
async def bot_action(bot_id: str, request: Request):
    data = await request.json()
    plan = data.get("plan", "idle")
    with lock:
        bot = world["bots"].get(bot_id)
        if not bot or bot["status"] != "alive":
            return {"error": "bot not available"}
        result = process_action_v10(bot_id, plan)
    return result


@app.post("/bot/{bot_id}/update_inner")
async def update_inner(bot_id: str, request: Request):
    """v8.2兼容端点"""
    data = await request.json()
    with lock:
        bot = world["bots"].get(bot_id)
        if not bot:
            return {"error": "not found"}
        if "values" in data:
            bot["values"] = data["values"]
        if "new_core_memory" in data:
            bot["core_memories"].append(data["new_core_memory"])
            if len(bot["core_memories"]) > 20:
                bot["core_memories"] = bot["core_memories"][-15:]
        if "emotional_bonds" in data:
            bot["emotional_bonds"] = data["emotional_bonds"]
        if "emotions" in data:
            bot["emotions"] = data["emotions"]
    return {"ok": True}


@app.post("/bot/{bot_id}/sync_state")
async def sync_state(bot_id: str, request: Request):
    """v8.3: 统一状态同步总线 - bot_agent每次心跳后同步完整状态"""
    data = await request.json()
    with lock:
        bot = world["bots"].get(bot_id)
        if not bot:
            return {"error": "not found"}
        # 同步核心记忆
        if "core_memories" in data and data["core_memories"]:
            bot["core_memories"] = data["core_memories"][-20:]
        # 同步价值观
        if "values" in data and data["values"]:
            bot["values"] = data["values"]
        # 同步情感纽带
        if "emotional_bonds" in data and data["emotional_bonds"]:
            bot["emotional_bonds"] = data["emotional_bonds"]
        # 同步最近行动
        if "recent_actions" in data:
            bot["recent_actions_synced"] = data["recent_actions"][-10:]
        # 同步长期目标
        if "long_term_goal" in data and data["long_term_goal"]:
            bot["long_term_goal"] = data["long_term_goal"]
        # 同步内心状态叙事摘要
        if "narrative_summary" in data and data["narrative_summary"]:
            bot["narrative_summary"] = data["narrative_summary"]
        # 清除已回应的pending_reply
        if data.get("clear_pending_reply"):
            bot["pending_reply_to"] = None
    return {"ok": True}


@app.get("/messages/{bot_id}")
def get_messages(bot_id: str):
    with lock:
        msgs = [m for m in world["message_board"] if m.get("to") == bot_id or m.get("to") == "public"]
        bot = world["bots"].get(bot_id, {})
        return {
            "messages": msgs[-20:],
            "pending_reply_to": bot.get("pending_reply_to"),
        }


@app.post("/admin/send_message")
async def admin_send_message(request: Request):
    data = await request.json()
    with lock:
        world["message_board"].append({
            "tick": world["time"]["tick"],
            "time": world["time"]["virtual_datetime"],
            "from": data.get("from", "系统"),
            "to": data.get("to", "public"),
            "msg": data.get("message", ""),
            "priority": data.get("priority", "normal"),
        })
    return {"ok": True}


@app.get("/moments")
def get_moments():
    with lock:
        return {"moments": world["moments"][-50:]}


@app.post("/moments/{moment_id}/like")
async def like_moment(moment_id: str, request: Request):
    data = await request.json()
    bot_id = data.get("bot_id", "")
    with lock:
        for m in world["moments"]:
            if m["id"] == moment_id:
                if bot_id not in m["likes"]:
                    m["likes"].append(bot_id)
                return {"ok": True}
    return {"error": "moment not found"}


@app.post("/moments/{moment_id}/comment")
async def comment_moment(moment_id: str, request: Request):
    data = await request.json()
    with lock:
        for m in world["moments"]:
            if m["id"] == moment_id:
                m["comments"].append({
                    "bot_id": data.get("bot_id", ""),
                    "bot_name": data.get("bot_name", ""),
                    "content": data.get("content", ""),
                    "tick": world["time"]["tick"],
                })
                return {"ok": True}
    return {"error": "moment not found"}


@app.get("/gallery")
def get_gallery():
    with lock:
        return {"photos": world["gallery"][-30:]}


@app.get("/world_narrative")
def get_world_narrative():
    with lock:
        return {"narrative": world.get("world_narrative", "这座城市刚刚苏醒，故事还没有开始。")}


# === v9.0 进化引擎专用端点 ===
@app.get("/evolution")
def get_evolution_data():
    """v9.0: 获取所有进化引擎数据"""
    with lock:
        return {
            "world_modifications": world.get("world_modifications", []),
            "urban_legends": world.get("urban_legends", []),
            "graveyard": world.get("graveyard", []),
            "generation_count": world.get("generation_count", 0),
            "reputation_board": world.get("reputation_board", {}),
            "location_vibes": {loc: data.get("vibe", "普通") for loc, data in world["locations"].items()},
            "location_memories": {loc: data.get("public_memory", [])[-10:] for loc, data in world["locations"].items()},
            "location_modifications": {loc: data.get("modifications", []) for loc, data in world["locations"].items()},
            # v10.1: 规则引擎数据
            "active_rules": [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "creator_name": r.get("creator_name", "?"),
                    "location": r.get("location"),
                    "description": r.get("description", ""),
                    "durability": round(r.get("durability", 0), 1),
                    "execution_count": r.get("execution_count", 0),
                    "active": r.get("active", True),
                }
                for r in world.get("active_rules", [])
            ],
            "active_rules_count": sum(1 for r in world.get("active_rules", []) if r.get("active", True)),
        }


@app.get("/rules")
def get_rules():
    """v10.1: 获取所有世界规则"""
    with lock:
        rules = []
        for r in world.get("active_rules", []):
            rules.append({
                "id": r["id"],
                "name": r["name"],
                "creator": r.get("creator", ""),
                "creator_name": r.get("creator_name", "?"),
                "location": r.get("location"),
                "trigger": r.get("trigger", "every_tick"),
                "description": r.get("description", ""),
                "durability": round(r.get("durability", 0), 1),
                "decay_rate": r.get("decay_rate", 0.1),
                "execution_count": r.get("execution_count", 0),
                "active": r.get("active", True),
                "created_tick": r.get("created_tick", 0),
                "effects_summary": str(r.get("effects", []))[:100],
            })
        return {"rules": rules, "active_count": sum(1 for r in rules if r.get("active", True))}


@app.get("/rules/{location}")
def get_location_rules(location: str):
    """v10.1: 获取某地点的活跃规则摘要"""
    with lock:
        summaries = get_rules_summary(world, location)
        return {"location": location, "rules": summaries}


@app.get("/location/{loc_name}/history")
def get_location_history(loc_name: str):
    """v9.0: 获取地点历史"""
    with lock:
        loc = world["locations"].get(loc_name)
        if not loc:
            return JSONResponse({"error": "location not found"}, 404)
        return {
            "name": loc_name,
            "desc": loc["desc"],
            "vibe": loc.get("vibe", "普通"),
            "public_memory": loc.get("public_memory", []),
            "modifications": loc.get("modifications", []),
            "current_bots": loc["bots"],
        }


@app.get("/reputation")
def get_reputation_board():
    """v9.0: 获取声望榜"""
    with lock:
        board = []
        for bid, bot in world["bots"].items():
            rep = bot.get("reputation", {"score": 0, "tags": [], "deeds": []})
            board.append({
                "bot_id": bid,
                "name": bot.get("name", bid),
                "score": rep.get("score", 0),
                "tags": rep.get("tags", []),
                "deeds": rep.get("deeds", [])[-5:],
                "generation": bot.get("generation", 0),
                "status": bot.get("status", "alive"),
            })
        board.sort(key=lambda x: x["score"], reverse=True)
        return {"reputation_board": board}


@app.get("/graveyard")
def get_graveyard():
    """v9.0: 获取墓地记录"""
    with lock:
        return {"graveyard": world.get("graveyard", [])}


@app.get("/legends")
def get_urban_legends():
    """v9.0: 获取城市传说"""
    with lock:
        return {"urban_legends": world.get("urban_legends", [])}


@app.post("/admin/save_snapshot")
async def save_snapshot():
    with lock:
        snapshot = {
            "time": world["time"],
            "weather": world["weather"],
            "news_feed": world["news_feed"],
            "hot_topics": world["hot_topics"],
            "bots": {},
            "locations": {},
            "events": world["events"][-50:],
            "message_board": world["message_board"][-100:],
            "moments": world["moments"][-100:],
            "gallery": world["gallery"],
            "world_narrative": world.get("world_narrative", ""),
            # v9.0
            "world_modifications": world.get("world_modifications", []),
            "urban_legends": world.get("urban_legends", []),
            "generation_count": world.get("generation_count", 0),
            "graveyard": world.get("graveyard", []),
            "reputation_board": world.get("reputation_board", {}),
        }
        for bid, bot in world["bots"].items():
            snapshot["bots"][bid] = dict(bot)
            snapshot["bots"][bid]["action_log"] = bot["action_log"][-20:]
            snapshot["bots"][bid]["long_term_goal"] = bot.get("long_term_goal")
            snapshot["bots"][bid]["pending_reply_to"] = bot.get("pending_reply_to")
            snapshot["bots"][bid]["recent_actions_synced"] = bot.get("recent_actions_synced", [])
        # v9.0: 保存地点公共记忆
        for loc_name, loc_data in world["locations"].items():
            snapshot["locations"][loc_name] = {
                "public_memory": loc_data.get("public_memory", []),
                "modifications": loc_data.get("modifications", []),
                "vibe": loc_data.get("vibe", "普通"),
            }
        with open(SNAPSHOT_PATH, "w") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)
    return {"ok": True, "tick": world["time"]["tick"]}


# 静态文件服务
if os.path.exists(SELFIES_DIR):
    app.mount("/selfies", StaticFiles(directory=SELFIES_DIR), name="selfies")

avatar_dir = AVATAR_DIRS[0]
if not os.path.exists(avatar_dir):
    avatar_dir = AVATAR_DIRS[1]
if os.path.exists(avatar_dir):
    app.mount("/avatars", StaticFiles(directory=avatar_dir), name="avatars")


# ============================================================
# 启动
# ============================================================
def _do_auto_save():
    """自动保存快照（非async版本，供tick循环调用）"""
    try:
        with lock:
            snapshot = {
                "time": world["time"],
                "weather": world["weather"],
                "news_feed": world["news_feed"],
                "hot_topics": world["hot_topics"],
                "bots": {},
                "locations": {},
                "events": world["events"][-50:],
                "message_board": world["message_board"][-100:],
                "moments": world["moments"][-100:],
                "gallery": world["gallery"],
                "world_narrative": world.get("world_narrative", ""),
                "food_prices": world.get("food_prices", {}),
                # v9.0
                "world_modifications": world.get("world_modifications", []),
                "urban_legends": world.get("urban_legends", []),
                "generation_count": world.get("generation_count", 0),
                "graveyard": world.get("graveyard", []),
                "reputation_board": world.get("reputation_board", {}),
            }
            for bid, bot in world["bots"].items():
                snapshot["bots"][bid] = dict(bot)
                snapshot["bots"][bid]["action_log"] = bot["action_log"][-20:]
                snapshot["bots"][bid]["long_term_goal"] = bot.get("long_term_goal")
                snapshot["bots"][bid]["pending_reply_to"] = bot.get("pending_reply_to")
                snapshot["bots"][bid]["recent_actions_synced"] = bot.get("recent_actions_synced", [])
                snapshot["bots"][bid]["narrative_summary"] = bot.get("narrative_summary")
            # v9.0: 保存地点公共记忆
            for loc_name, loc_data in world["locations"].items():
                snapshot["locations"][loc_name] = {
                    "public_memory": loc_data.get("public_memory", []),
                    "modifications": loc_data.get("modifications", []),
                    "vibe": loc_data.get("vibe", "普通"),
                }
            with open(SNAPSHOT_PATH, "w") as f:
                json.dump(snapshot, f, ensure_ascii=False)
        log.info(f"自动快照已保存 (tick={world['time']['tick']})")
        log.info(f"  v9.0: {len(world.get('world_modifications',[]))}个世界改造, {len(world.get('urban_legends',[]))}个城市传说, {len(world.get('graveyard',[]))}个墓地记录")
    except Exception as e:
        log.error(f"自动快照保存失败: {e}")


def start_tick_loop():
    """用简单的线程循环代替APScheduler"""
    import time as _time
    def _loop():
        while True:
            try:
                world_tick()
                # 每10个tick自动保存一次快照
                if world["time"]["tick"] % 10 == 0:
                    _do_auto_save()
            except Exception as e:
                log.error(f"Tick异常: {e}")
            _time.sleep(15)  # 每15秒一个tick (加速模式)
    t = Thread(target=_loop, daemon=True)
    t.start()
    log.info("Tick循环已启动 (15秒/tick 加速模式, 每10tick自动保存快照)")


@app.on_event("startup")
def on_startup():
    init_world()
    start_tick_loop()
    log.info("=== 深圳生存模拟 v9.0 世界引擎启动 (自我进化: 世界改造/地点记忆+声望/代际传承) ===")
    # 启动Bot进程
    for bot_id in PERSONAS:
        bot = world["bots"].get(bot_id)
        if bot and bot["status"] == "alive":
            try:
                subprocess.Popen(
                    ["python3", BOT_AGENT_SCRIPT],
                    env=dict(os.environ, BOT_ID=bot_id)
                )
                log.info(f"Bot {bot_id} 进程已启动")
            except Exception as e:
                log.error(f"启动Bot {bot_id} 进程失败: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")
