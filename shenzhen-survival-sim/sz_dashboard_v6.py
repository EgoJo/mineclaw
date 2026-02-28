# -*- coding: utf-8 -*-
"""
深圳生存模拟 - Dashboard v6
===========================
v6 新增: 天气显示、朋友圈面板、情绪可视化、新闻/热搜、手机电量
"""
import os, json, logging
import requests
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
import uvicorn
from config import LOGS_DIR, SELFIES_DIR, AVATAR_DIRS

app = FastAPI()
ENGINE = "http://localhost:8000"
log = logging.getLogger("dashboard")

# ===== 代理API =====
@app.get("/api/world")
def api_world():
    try:
        r = requests.get(f"{ENGINE}/world", timeout=5)
        return r.json()
    except:
        return {"error": "engine offline"}

@app.get("/api/bot/{bot_id}/detail")
def api_detail(bot_id: str):
    try:
        return requests.get(f"{ENGINE}/bot/{bot_id}/detail", timeout=5).json()
    except:
        return {"error": "engine offline"}

@app.get("/api/logs/{name}")
def api_logs(name: str):
    path = os.path.join(LOGS_DIR, f"{name}.log")
    if not os.path.exists(path):
        return {"lines": []}
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    return {"lines": lines[-80:]}

@app.get("/api/messages/{bot_id}")
def api_messages(bot_id: str):
    try:
        return requests.get(f"{ENGINE}/messages/{bot_id}", timeout=5).json()
    except:
        return {"messages": []}

@app.get("/api/moments")
def api_moments():
    try:
        return requests.get(f"{ENGINE}/moments", timeout=5).json()
    except:
        return {"moments": []}

@app.get("/api/gallery")
def api_gallery():
    try:
        return requests.get(f"{ENGINE}/gallery", timeout=5).json()
    except:
        return {"photos": []}

@app.post("/api/send_message")
async def api_send_message(request: Request):
    data = await request.json()
    alias = data.get("sender_alias", "路人")
    priority = "high" if alias in ["父亲","母亲","爸爸","妈妈"] else "normal"
    try:
        return requests.post(f"{ENGINE}/admin/send_message", json={
            "from": alias, "to": data.get("target_id"),
            "message": data.get("message", ""), "priority": priority,
        }, timeout=5).json()
    except:
        return {"error": "failed"}

@app.post("/api/add_bot")
async def api_add_bot(request: Request):
    data = await request.json()
    try:
        return requests.post(f"{ENGINE}/bot/{data['bot_id']}/action", json={
            "plan": "join_world", "location": data.get("location", "宝安城中村")
        }, timeout=5).json()
    except:
        return {"error": "failed"}

# v9.0 进化引擎API代理
@app.get("/api/evolution")
def api_evolution():
    try:
        return requests.get(f"{ENGINE}/evolution", timeout=5).json()
    except:
        return {"error": "engine offline"}

@app.get("/api/reputation")
def api_reputation():
    try:
        return requests.get(f"{ENGINE}/reputation", timeout=5).json()
    except:
        return {"reputation_board": []}

@app.get("/api/graveyard")
def api_graveyard():
    try:
        return requests.get(f"{ENGINE}/graveyard", timeout=5).json()
    except:
        return {"graveyard": []}

@app.get("/api/legends")
def api_legends():
    try:
        return requests.get(f"{ENGINE}/legends", timeout=5).json()
    except:
        return {"urban_legends": []}

# ===== 静态文件 =====
@app.get("/avatars/{filename}")
def serve_avatar(filename: str):
    for d in AVATAR_DIRS:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            return FileResponse(p)
    return JSONResponse({"error": "not found"}, 404)

@app.get("/selfies/{filename}")
def serve_selfie(filename: str):
    p = os.path.join(SELFIES_DIR, filename)
    if os.path.exists(p):
        return FileResponse(p)
    return JSONResponse({"error": "not found"}, 404)

# ===== 主页 =====
BOTS_META = [
    {"id":"bot_1","name":"李浩然","role":"程序员","color":"#4d96ff","gender":"male"},
    {"id":"bot_2","name":"王雪","role":"HR","color":"#ff6b9d","gender":"female"},
    {"id":"bot_3","name":"张伟","role":"工厂工人","color":"#ffd93d","gender":"male"},
    {"id":"bot_4","name":"陈静","role":"设计师","color":"#6bcb77","gender":"female"},
    {"id":"bot_5","name":"赵磊","role":"富二代","color":"#9b59b6","gender":"male"},
    {"id":"bot_6","name":"刘悦","role":"护士","color":"#ff9ff3","gender":"female"},
    {"id":"bot_7","name":"黄强","role":"销售","color":"#ff6348","gender":"male"},
    {"id":"bot_8","name":"吴秀英","role":"餐馆老板娘","color":"#ffa502","gender":"female"},
    {"id":"bot_9","name":"林枫","role":"音乐人","color":"#1abc9c","gender":"male"},
    {"id":"bot_10","name":"苏小小","role":"网红","color":"#e040fb","gender":"female"},
    {"id":"bot_11","name":"周大海","role":"张伟的父亲","color":"#795548","gender":"male"},
    {"id":"bot_12","name":"郑美玲","role":"李浩然的母亲","color":"#e91e63","gender":"female"},
]

LOCATIONS_MAP = {
    "宝安城中村": {"x": 15, "y": 45, "icon": "🏚️", "type": "residential"},
    "南山科技园": {"x": 35, "y": 25, "icon": "🏢", "type": "business"},
    "福田CBD":   {"x": 60, "y": 20, "icon": "🏦", "type": "business"},
    "华强北":    {"x": 50, "y": 50, "icon": "📱", "type": "commercial"},
    "东门老街":  {"x": 70, "y": 55, "icon": "🏮", "type": "commercial"},
    "南山公寓":  {"x": 25, "y": 65, "icon": "🏠", "type": "residential"},
    "深圳湾公园": {"x": 40, "y": 80, "icon": "🌊", "type": "leisure"},
}

@app.get("/")
def dashboard():
    bots_json = json.dumps(BOTS_META, ensure_ascii=False)
    locations_json = json.dumps(LOCATIONS_MAP, ensure_ascii=False)
    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>深圳生存模拟 v9.0</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'SF Pro Display', -apple-system, 'PingFang SC', sans-serif; background: #0a0a0f; color: #e0e0e0; overflow: hidden; height: 100vh; }

/* ===== HEADER ===== */
.header { height: 48px; background: linear-gradient(180deg, rgba(15,15,25,0.98), rgba(10,10,18,0.95)); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 16px; gap: 12px; z-index: 100; position: relative; }
.header h1 { font-size: 14px; font-weight: 600; letter-spacing: 1px; }
.header .city { background: linear-gradient(135deg, #4d96ff, #6bcb77); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.header .ver { font-size: 10px; color: #555; }
.clock { font-size: 12px; color: #888; font-variant-numeric: tabular-nums; }
.weather-badge { font-size: 11px; padding: 3px 10px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
.news-ticker { flex: 1; overflow: hidden; height: 20px; position: relative; margin: 0 8px; }
.news-ticker-inner { display: flex; animation: tickerScroll 30s linear infinite; white-space: nowrap; }
.news-ticker-inner span { font-size: 11px; color: #666; padding: 0 24px; }
@keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.controls { display: flex; gap: 6px; }
.btn { padding: 4px 12px; font-size: 11px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #aaa; cursor: pointer; transition: all 0.2s; }
.btn:hover { background: rgba(77,150,255,0.15); color: #4d96ff; border-color: rgba(77,150,255,0.3); }

/* ===== MAIN LAYOUT ===== */
.main { display: flex; height: calc(100vh - 48px); }
.left-panel { width: 55%; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.06); }
.right-panel { width: 45%; display: flex; flex-direction: column; }

/* ===== MAP ===== */
.map-container { flex: 1; position: relative; overflow: hidden; min-height: 200px; }
.map-bg { width: 100%; height: 100%; position: relative; transition: background 3s ease; }
.map-bg.day { background: linear-gradient(180deg, #87CEEB 0%, #98d8c8 40%, #7fb069 100%); }
.map-bg.night { background: linear-gradient(180deg, #0c1445 0%, #1a1a3e 40%, #1e2d3d 100%); }
.map-bg.sunset { background: linear-gradient(180deg, #ff6b6b 0%, #ffa07a 30%, #4a6fa5 100%); }
.map-bg.dawn { background: linear-gradient(180deg, #2c3e6b 0%, #e8a87c 40%, #87CEEB 100%); }
.map-bg.rain { background: linear-gradient(180deg, #3d4f5f 0%, #4a5568 40%, #2d3748 100%); }
.map-bg.storm { background: linear-gradient(180deg, #1a1a2e 0%, #2d2d44 40%, #1a1a2e 100%); }

.star { position: absolute; background: #fff; border-radius: 50%; animation: twinkle 2s ease-in-out infinite; opacity: 0.6; }
@keyframes twinkle { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }

.rain-drop { position: absolute; width: 1px; height: 15px; background: rgba(174,194,224,0.4); animation: rainFall 0.8s linear infinite; }
@keyframes rainFall { 0% { transform: translateY(-20px); opacity: 1; } 100% { transform: translateY(400px); opacity: 0; } }

.weather-overlay { position: absolute; top: 8px; right: 8px; padding: 4px 10px; border-radius: 8px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); font-size: 11px; color: #ddd; z-index: 10; }

.loc-zone { position: absolute; transform: translate(-50%, -50%); text-align: center; cursor: default; z-index: 5; }
.loc-icon { font-size: 22px; display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
.loc-name { font-size: 9px; color: rgba(255,255,255,0.7); text-shadow: 0 1px 3px rgba(0,0,0,0.8); white-space: nowrap; }
.loc-count { font-size: 8px; color: rgba(255,200,50,0.9); display: block; }

.map-road { position: absolute; background: rgba(255,255,255,0.08); border-radius: 1px; }
.map-road.h { height: 2px; }
.map-road.v { width: 2px; }

.bot-avatar-map { position: absolute; width: 32px; height: 32px; border-radius: 50%; border: 2px solid; object-fit: cover; transform: translate(-50%, -50%); cursor: pointer; transition: all 0.8s ease; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.bot-avatar-map:hover { transform: translate(-50%, -50%) scale(1.3); z-index: 20; }
.bot-avatar-map.dead { filter: grayscale(1) brightness(0.4); pointer-events: none; }
.bot-avatar-map.sleeping { animation: sleepBob 2s ease-in-out infinite; opacity: 0.7; }
@keyframes sleepBob { 0%,100% { transform: translate(-50%, -50%); } 50% { transform: translate(-50%, -55%); } }
.sleep-zzz { position: absolute; font-size: 14px; z-index: 15; animation: zzzFloat 2s ease-in-out infinite; pointer-events: none; }
@keyframes zzzFloat { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }

/* ===== CARDS ===== */
.cards-container { height: 160px; display: flex; gap: 6px; padding: 8px; overflow-x: auto; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.bot-card { min-width: 110px; max-width: 110px; background: rgba(20,20,30,0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 8px; cursor: pointer; transition: all 0.2s; position: relative; flex-shrink: 0; }
.bot-card:hover { border-color: rgba(77,150,255,0.3); transform: translateY(-2px); }
.bot-card.active { border-color: rgba(77,150,255,0.5); background: rgba(77,150,255,0.05); }
.bot-card img { width: 36px; height: 36px; border-radius: 50%; border: 2px solid; object-fit: cover; display: block; margin: 0 auto 4px; }
.bot-card .name { font-size: 11px; font-weight: 600; text-align: center; margin-bottom: 2px; }
.bot-card .role { font-size: 9px; color: #666; text-align: center; margin-bottom: 4px; }
.bot-card .stats { font-size: 9px; }
.bot-card .stat-row { display: flex; justify-content: space-between; margin: 1px 0; }
.bot-card .hp-bar { height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-bottom: 3px; }
.bot-card .hp-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }
.bot-card .emotion-badge { position: absolute; top: 4px; right: 4px; font-size: 12px; }
.bot-card .sleep-badge { position: absolute; top: 4px; left: 4px; font-size: 10px; }
.bot-card .task-badge { font-size: 8px; color: #ffd93d; text-align: center; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== RIGHT PANEL TABS ===== */
.log-tabs { display: flex; gap: 2px; padding: 6px 8px; overflow-x: auto; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.log-tab { padding: 4px 10px; font-size: 10px; border-radius: 6px; cursor: pointer; color: #555; transition: all 0.2s; white-space: nowrap; }
.log-tab:hover { color: #aaa; background: rgba(255,255,255,0.03); }
.log-tab.active { color: #4d96ff; background: rgba(77,150,255,0.1); }

.view-toggle { display: none; padding: 4px 8px; gap: 4px; background: rgba(0,0,0,0.15); }
.view-toggle.visible { display: flex; }
.view-btn { padding: 3px 10px; font-size: 10px; background: transparent; border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; color: #555; cursor: pointer; }
.view-btn.active { color: #4d96ff; border-color: rgba(77,150,255,0.3); background: rgba(77,150,255,0.08); }

/* ===== CONTENT AREAS ===== */
.log-content, .chat-content, .moments-content, .gallery-content { flex: 1; overflow-y: auto; padding: 8px; font-size: 11px; line-height: 1.6; display: none; }
.log-content { display: block; }
.log-line { padding: 2px 6px; border-radius: 3px; margin: 1px 0; word-break: break-all; }
.log-line.inner { color: #9b59b6; }
.log-line.action { color: #4d96ff; }
.log-line.result { color: #6bcb77; }
.log-line.message { color: #ffd93d; }
.log-line.death { color: #ff4444; background: rgba(255,0,0,0.05); }
.log-line.error { color: #ff6b6b; }
.log-line.values { color: #e040fb; }
.log-line.memory { color: #ff9800; }
.log-line.bond { color: #4d96ff; }
.log-line.task { color: #1abc9c; }
.log-line.emotion { color: #ff6b9d; }
.log-line.moment { color: #ffa502; }

/* Chat bubbles */
.chat-bubble { max-width: 80%; padding: 8px 12px; border-radius: 12px; margin: 6px 0; font-size: 12px; line-height: 1.5; }
.chat-bubble.incoming { background: rgba(30,30,45,0.8); border: 1px solid rgba(255,255,255,0.06); margin-right: auto; border-bottom-left-radius: 4px; }
.chat-bubble.outgoing { background: rgba(77,150,255,0.15); border: 1px solid rgba(77,150,255,0.2); margin-left: auto; border-bottom-right-radius: 4px; }
.chat-bubble.god { border-color: rgba(255,215,0,0.3); background: rgba(255,215,0,0.05); }
.chat-bubble .sender { font-size: 10px; color: #666; margin-bottom: 3px; }
.chat-bubble .time { font-size: 9px; color: #444; margin-top: 3px; }

/* ===== MOMENTS (朋友圈) ===== */
.moments-content { display: none; }
.moment-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
.moment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.moment-header img { width: 32px; height: 32px; border-radius: 50%; border: 2px solid; object-fit: cover; }
.moment-header .name { font-size: 12px; font-weight: 600; }
.moment-header .time { font-size: 10px; color: #555; }
.moment-header .location { font-size: 10px; color: #4d96ff; }
.moment-body { font-size: 12px; line-height: 1.6; color: #ccc; margin-bottom: 8px; padding: 0 4px; }
.moment-mood { font-size: 10px; color: #888; margin-bottom: 6px; }
.moment-footer { display: flex; gap: 16px; font-size: 10px; color: #555; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.04); }
.moment-footer span { cursor: pointer; }
.moment-footer span:hover { color: #4d96ff; }
.moment-comments { margin-top: 6px; padding: 6px 8px; background: rgba(0,0,0,0.2); border-radius: 6px; }
.moment-comment { font-size: 10px; color: #888; margin: 3px 0; }
.moment-comment .commenter { color: #4d96ff; font-weight: 600; }

/* ===== GALLERY ===== */
.gallery-content { flex-wrap: wrap; gap: 8px; align-content: flex-start; }
.gallery-content.visible { display: flex; }
.gallery-item { width: calc(50% - 4px); border-radius: 8px; overflow: hidden; background: rgba(20,20,30,0.6); border: 1px solid rgba(255,255,255,0.06); }
.gallery-item img { width: 100%; aspect-ratio: 1; object-fit: cover; cursor: pointer; }
.gallery-item .caption { padding: 6px 8px; font-size: 10px; color: #888; }
.gallery-item .bot-name { color: #4d96ff; font-weight: 600; }

/* ===== EVOLUTION PANEL (v9.0) ===== */
.evolution-panel { display: none; padding: 12px; overflow-y: auto; flex: 1; }
.evolution-panel.visible { display: block; }
.evo-section { margin-bottom: 16px; }
.evo-section h3 { font-size: 13px; color: #4d96ff; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(77,150,255,0.2); }
.evo-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; margin-bottom: 8px; }
.evo-card .title { font-size: 12px; font-weight: 600; color: #e0e0e0; margin-bottom: 4px; }
.evo-card .desc { font-size: 11px; color: #888; line-height: 1.5; }
.evo-card .meta { font-size: 10px; color: #555; margin-top: 4px; }
.evo-card.legend { border-left: 3px solid rgba(255,152,0,0.5); }
.evo-card.modification { border-left: 3px solid rgba(107,203,119,0.5); }
.evo-card.graveyard { border-left: 3px solid rgba(136,136,136,0.5); }
.evo-card.reputation { border-left: 3px solid rgba(77,150,255,0.5); }
.rep-score { font-size: 16px; font-weight: 700; }
.rep-score.positive { color: #6bcb77; }
.rep-score.negative { color: #ff4444; }
.rep-score.neutral { color: #888; }
.rep-tag { display: inline-block; font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(77,150,255,0.1); color: #4d96ff; margin: 2px; }
.gen-badge { display: inline-block; font-size: 9px; padding: 1px 5px; border-radius: 3px; background: rgba(255,215,0,0.15); color: #ffd93d; margin-left: 4px; }

/* ===== MSG BAR ===== */
.msg-bar { display: none; padding: 8px; gap: 6px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.06); align-items: center; flex-shrink: 0; }
.msg-bar.visible { display: flex; }
.sender-select { padding: 6px; font-size: 11px; background: rgba(20,20,30,0.8); color: #aaa; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none; }
.msg-bar input { flex: 1; padding: 6px 10px; font-size: 12px; background: rgba(20,20,30,0.8); color: #e0e0e0; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none; }
.msg-bar input:focus { border-color: rgba(77,150,255,0.4); }
.send-btn { padding: 6px 14px; font-size: 11px; background: linear-gradient(135deg, #4d96ff, #3a7bd5); color: #fff; border: none; border-radius: 6px; cursor: pointer; }

/* ===== DETAIL OVERLAY ===== */
.detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); z-index: 200; display: none; justify-content: center; align-items: center; }
.detail-overlay.visible { display: flex; }
.detail-panel { width: 480px; max-height: 85vh; overflow-y: auto; background: linear-gradient(180deg, rgba(20,20,35,0.98), rgba(15,15,25,0.98)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; }
.detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; position: relative; }
.detail-header img { width: 56px; height: 56px; border-radius: 50%; border: 3px solid; object-fit: cover; }
.detail-header .info h2 { font-size: 16px; margin-bottom: 2px; }
.detail-header .sub { font-size: 11px; color: #666; }
.close-btn { position: absolute; top: 0; right: 0; font-size: 20px; color: #555; cursor: pointer; }
.close-btn:hover { color: #fff; }

.detail-section { margin-bottom: 14px; }
.detail-section h3 { font-size: 12px; color: #888; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.detail-stat { background: rgba(0,0,0,0.2); border-radius: 6px; padding: 6px 8px; }
.detail-stat .label { font-size: 10px; color: #666; margin-bottom: 2px; }
.detail-stat .value { font-size: 13px; font-weight: 600; }
.detail-stat .bar { height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 3px; }
.detail-stat .bar-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }

.detail-values { font-size: 11px; color: #aaa; line-height: 1.6; padding: 8px; background: rgba(0,0,0,0.15); border-radius: 6px; }
.detail-values .original { font-size: 10px; color: #555; margin-top: 4px; }

.detail-memory { font-size: 11px; color: #ccc; padding: 6px 8px; background: rgba(0,0,0,0.15); border-radius: 6px; margin-bottom: 4px; border-left: 3px solid rgba(255,152,0,0.4); }
.detail-memory .emotion { font-size: 9px; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
.detail-memory .emotion.positive { background: rgba(107,203,119,0.15); color: #6bcb77; }
.detail-memory .emotion.negative { background: rgba(255,68,68,0.15); color: #ff4444; }
.detail-memory .emotion.neutral { background: rgba(136,136,136,0.15); color: #888; }

.detail-bond { display: flex; gap: 8px; align-items: center; padding: 6px 8px; background: rgba(0,0,0,0.15); border-radius: 6px; margin-bottom: 4px; }
.bond-bars { flex: 1; }
.bond-bar { display: flex; align-items: center; gap: 4px; font-size: 9px; margin: 2px 0; }
.bond-bar .bar { flex: 1; height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; }
.bond-bar .bar-fill { height: 100%; border-radius: 2px; }

/* Emotion radar (simplified as bars) */
.emotion-bars { display: flex; gap: 4px; align-items: flex-end; height: 40px; padding: 4px; }
.emotion-bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.emotion-bar-item .ebar { width: 100%; border-radius: 2px 2px 0 0; transition: height 0.5s; min-height: 2px; }
.emotion-bar-item .elabel { font-size: 8px; color: #555; }

/* Action log */
.action-log-item { font-size: 10px; color: #888; padding: 3px 6px; border-left: 2px solid rgba(77,150,255,0.2); margin: 3px 0; }
.action-log-item .plan { color: #4d96ff; }
.action-log-item .result { color: #6bcb77; }
.action-log-item .time { color: #555; font-size: 9px; }

/* Event stream */
.event-stream { flex: 1; overflow-y: auto; padding: 8px; display: none; }
.event-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; margin-bottom: 8px; }
.event-card.relationship { border-left: 3px solid #ff6b9d; }
.event-card.npc-reply { border-left: 3px solid #ffd93d; }
.event-card.world-event { border-left: 3px solid #4d96ff; }
.event-card.moment { border-left: 3px solid #e040fb; }
.event-card .event-type { font-size: 9px; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
.event-card .event-body { font-size: 12px; color: #ccc; line-height: 1.6; }
.event-card .event-time { font-size: 9px; color: #444; margin-top: 4px; }

/* Bond impression in detail */
.bond-impression { font-size: 10px; color: #aaa; font-style: italic; padding: 4px 8px; background: rgba(0,0,0,0.1); border-radius: 4px; margin-top: 4px; }

/* Bot card relationship tags */
.bot-card .bond-tags { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 3px; }
.bot-card .bond-tag { font-size: 7px; padding: 1px 4px; border-radius: 3px; background: rgba(255,107,157,0.15); color: #ff6b9d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }

/* ===== TOAST ===== */
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(80px); padding: 10px 24px; border-radius: 8px; font-size: 12px; background: rgba(30,30,45,0.95); border: 1px solid rgba(255,255,255,0.1); color: #e0e0e0; transition: transform 0.3s; z-index: 300; pointer-events: none; }
.toast.show { transform: translateX(-50%) translateY(0); }

/* ===== MODAL ===== */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 250; display: none; justify-content: center; align-items: center; }
.modal-overlay.visible { display: flex; }
.modal { background: rgba(25,25,40,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; width: 380px; }
.modal h2 { font-size: 16px; margin-bottom: 16px; }
.modal label { display: block; font-size: 11px; color: #666; margin-top: 12px; margin-bottom: 4px; }
.modal input, .modal select, .modal textarea { width: 100%; padding: 8px 12px; font-size: 12px; background: rgba(13,17,23,0.8); color: #e0e0e0; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; outline: none; }
.modal textarea { height: 80px; resize: vertical; }
.modal .modal-btns { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
.modal .modal-btn { padding: 8px 20px; font-size: 12px; border-radius: 8px; cursor: pointer; border: none; transition: all 0.2s; }
.modal .modal-btn.cancel { background: rgba(51,51,51,0.5); color: #aaa; }
.modal .modal-btn.confirm { background: linear-gradient(135deg, #4d96ff, #3a7bd5); color: #fff; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
</style>
</head>
<body>

<div class="header">
    <h1><span class="city">SHENZHEN SURVIVAL</span> <span class="ver">v8</span></h1>
    <div class="clock" id="clock">Loading...</div>
    <div class="weather-badge" id="weatherBadge">--</div>
    <div class="news-ticker" id="newsTicker"><div class="news-ticker-inner" id="newsTickerInner"></div></div>
    <div class="controls">
        <button class="btn" onclick="showAddBotModal()">+ 新居民</button>
        <button class="btn" onclick="switchView('moments')">💬 朋友圈</button>
        <button class="btn" onclick="switchView('gallery')">📸 照片墙</button>
    </div>
</div>

<div class="main">
    <div class="left-panel">
        <div class="map-container">
            <div class="map-bg night" id="map">
                <div class="weather-overlay" id="mapWeather"></div>
            </div>
        </div>
        <div class="cards-container" id="cards"></div>
    </div>
    <div class="right-panel">
        <div class="log-tabs" id="logTabs">
            <div class="log-tab active" data-log="world_engine" onclick="switchLog('world_engine', this)">🌍 世界</div>
            <div class="log-tab" onclick="switchView('events')">📖 事件流</div>
            <div class="log-tab" onclick="switchView('evolution')">🧬 进化</div>
        </div>
        <div class="view-toggle" id="viewToggle">
            <button class="view-btn active" id="btnLogView" onclick="setContentView('log')">📋 日志</button>
            <button class="view-btn" id="btnChatView" onclick="setContentView('chat')">💬 对话</button>
        </div>
        <div class="log-content" id="logContent"></div>
        <div class="chat-content" id="chatContent"></div>
        <div class="moments-content" id="momentsContent"></div>
        <div class="gallery-content" id="galleryContent"></div>
        <div class="event-stream" id="eventStream"></div>
        <div class="evolution-panel" id="evolutionPanel" style="display:none;"></div>
        <div class="msg-bar" id="msgBar">
            <select class="sender-select" id="senderAlias">
                <option value="一个路人">路人</option>
                <option value="隔壁邻居">邻居</option>
                <option value="微信好友">微信好友</option>
                <option value="同事">同事</option>
                <option value="老同学">老同学</option>
                <option value="快递小哥">快递</option>
                <option value="房东">房东</option>
                <option value="父亲">父亲 🔴</option>
                <option value="母亲">母亲 🔴</option>
                <option value="老板">老板</option>
                <option value="一个神秘的声音">神秘声音</option>
            </select>
            <input type="text" id="msgInput" placeholder="以伪装身份给TA发消息..." onkeydown="if(event.key==='Enter')sendMsg()">
            <button class="send-btn" onclick="sendMsg()">发送</button>
        </div>
    </div>
</div>

<div class="toast" id="toast"></div>
<div class="detail-overlay" id="detailOverlay" onclick="if(event.target===this)hideDetail()">
    <div class="detail-panel" id="detailPanel"></div>
</div>
<div class="modal-overlay" id="addBotModal">
    <div class="modal">
        <h2>🚌 新居民来深圳了！</h2>
        <label>Bot ID</label><input type="text" id="newBotId" placeholder="bot_13">
        <label>落脚点</label>
        <select id="newBotLocation">
            <option value="宝安城中村">宝安城中村</option>
            <option value="南山科技园">南山科技园</option>
            <option value="华强北">华强北</option>
            <option value="东门老街">东门老街</option>
            <option value="福田CBD">福田CBD</option>
            <option value="南山公寓">南山公寓</option>
            <option value="深圳湾公园">深圳湾公园</option>
        </select>
        <label>姓名</label><input type="text" id="newBotName" placeholder="角色名字">
        <label>角色</label><input type="text" id="newBotRole" placeholder="如：外卖骑手">
        <label>人设</label><textarea id="newBotSoul" placeholder="性格、背景、来深圳的原因..."></textarea>
        <div class="modal-btns">
            <button class="modal-btn cancel" onclick="hideAddBotModal()">取消</button>
            <button class="modal-btn confirm" onclick="addBot()">创建</button>
        </div>
    </div>
</div>
"""
    return HTMLResponse(content=html + r"""
<script>
const BOTS_INIT = """ + bots_json + r""";
const LOCATIONS = """ + locations_json + r""";
let BOTS = [...BOTS_INIT];
let currentLog = 'world_engine';
let currentBotId = null;
let currentView = 'log'; // log, chat, moments, gallery
let worldState = null;
let godMessages = [];

// ===== UTILS =====
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show';
    setTimeout(() => t.classList.remove('show'), 3000);
}
function getBotName(botId) {
    const bot = BOTS.find(b => b.id === botId);
    return bot ? bot.name : botId;
}
function getBotColor(botId) {
    const bot = BOTS.find(b => b.id === botId);
    return bot ? bot.color : '#888';
}
function getAvatarUrl(botId) { return '/avatars/' + botId + '.jpg'; }

function getEmotionEmoji(emotions) {
    if (!emotions) return '';
    const sorted = Object.entries(emotions).sort((a,b) => b[1] - a[1]);
    if (sorted.length === 0 || sorted[0][1] < 10) return '';
    const map = { happiness: '😊', sadness: '😢', anger: '😠', anxiety: '😰', loneliness: '🥺' };
    return map[sorted[0][0]] || '';
}

// ===== MAP =====
function initMap() {
    const map = document.getElementById('map');
    // Roads
    [{x:10,y:40,w:80,h:2,c:'h'},{x:30,y:20,w:2,h:60,c:'v'},{x:55,y:15,w:2,h:70,c:'v'},{x:10,y:60,w:70,h:2,c:'h'},{x:70,y:20,w:2,h:50,c:'v'}].forEach(r => {
        const el = document.createElement('div');
        el.className = 'map-road ' + r.c;
        el.style.left = r.x+'%'; el.style.top = r.y+'%';
        if (r.c==='h') el.style.width = r.w+'%'; else el.style.height = r.h+'%';
        map.appendChild(el);
    });
    // Stars
    for (let i=0;i<30;i++) {
        const s = document.createElement('div');
        s.className = 'star';
        s.style.left = Math.random()*100+'%'; s.style.top = Math.random()*40+'%';
        s.style.animationDelay = Math.random()*3+'s';
        s.style.width = (1+Math.random()*2)+'px'; s.style.height = s.style.width;
        map.appendChild(s);
    }
    // Locations
    for (const [name, pos] of Object.entries(LOCATIONS)) {
        const zone = document.createElement('div');
        zone.className = 'loc-zone';
        zone.style.left = pos.x+'%'; zone.style.top = pos.y+'%';
        zone.innerHTML = '<span class="loc-icon">'+pos.icon+'</span><span class="loc-name">'+name+'</span><span class="loc-count" id="loccount-'+name+'"></span>';
        map.appendChild(zone);
    }
    BOTS.forEach(b => addBotToMap(b));
}

function addBotToMap(bot) {
    const map = document.getElementById('map');
    if (document.getElementById('map-'+bot.id)) return;
    const img = document.createElement('img');
    img.className = 'bot-avatar-map'; img.id = 'map-'+bot.id;
    img.src = getAvatarUrl(bot.id);
    img.style.borderColor = bot.color;
    img.title = bot.name;
    img.onclick = () => showDetail(bot.id);
    img.onerror = function(){ this.style.background=bot.color; this.src=''; };
    const dp = LOCATIONS['宝安城中村'];
    img.style.left = dp.x+'%'; img.style.top = dp.y+'%';
    map.appendChild(img);
}

function updateMapWeather(weather, hour) {
    const map = document.getElementById('map');
    map.classList.remove('day','night','sunset','dawn','rain','storm');
    
    const wt = weather ? (weather.current || weather.type || '') : '';
    if (wt === '暴雨' || wt === '台风') map.classList.add('storm');
    else if (wt === '小雨') map.classList.add('rain');
    else if (hour >= 7 && hour < 17) map.classList.add('day');
    else if (hour >= 17 && hour < 20) map.classList.add('sunset');
    else if (hour >= 20 || hour < 5) map.classList.add('night');
    else map.classList.add('dawn');

    // Stars
    const showStars = (hour >= 20 || hour < 5) && !['暴雨','台风','小雨'].includes(wt);
    map.querySelectorAll('.star').forEach(s => s.style.display = showStars?'block':'none');

    // Rain drops
    map.querySelectorAll('.rain-drop').forEach(r => r.remove());
    if (['小雨','暴雨','台风'].includes(wt)) {
        const count = wt === '小雨' ? 20 : wt === '暴雨' ? 60 : 100;
        for (let i=0;i<count;i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = Math.random()*100+'%';
            drop.style.animationDelay = Math.random()*0.8+'s';
            drop.style.animationDuration = (0.5+Math.random()*0.5)+'s';
            map.appendChild(drop);
        }
    }

    // Weather overlay
    const wo = document.getElementById('mapWeather');
    if (weather) wo.textContent = (weather.current||weather.type||'') + ' ' + (weather.desc||'');
}

// ===== CARDS =====
function initCards() {
    document.getElementById('cards').innerHTML = '';
    BOTS.forEach(b => addBotCard(b));
}
function addBotCard(bot) {
    const c = document.getElementById('cards');
    if (document.getElementById('card-'+bot.id)) return;
    const card = document.createElement('div');
    card.className = 'bot-card'; card.id = 'card-'+bot.id;
    card.onclick = () => showDetail(bot.id);
    card.innerHTML = '<span class="sleep-badge" id="sleepbadge-'+bot.id+'"></span>' +
        '<span class="emotion-badge" id="emobadge-'+bot.id+'"></span>' +
        '<img src="'+getAvatarUrl(bot.id)+'" style="border-color:'+bot.color+'" onerror="this.style.background=\''+bot.color+'\';this.src=\'\';">' +
        '<div class="name" style="color:'+bot.color+'">'+bot.name+'</div>' +
        '<div class="role">'+bot.role+'</div>' +
        '<div class="stats">' +
        '<div class="hp-bar"><div class="hp-fill" id="hp-'+bot.id+'" style="width:100%;background:'+bot.color+'"></div></div>' +
        '<div class="stat-row"><span>❤️</span><span id="hpval-'+bot.id+'">100</span></div>' +
        '<div class="stat-row"><span>💰</span><span id="money-'+bot.id+'">500</span></div>' +
        '<div class="stat-row"><span>📍</span><span id="loc-'+bot.id+'" style="font-size:9px">...</span></div>' +
        '</div>' +
        '<div class="task-badge" id="task-'+bot.id+'"></div>';
    c.appendChild(card);
}

function initTabs() {
    BOTS.forEach(bot => {
        const tabs = document.getElementById('logTabs');
        if (tabs.querySelector('[data-log="'+bot.id+'"]')) return;
        const tab = document.createElement('div');
        tab.className = 'log-tab'; tab.dataset.log = bot.id;
        tab.textContent = bot.name; tab.style.color = bot.color;
        tab.onclick = function(){ switchLog(bot.id, this); };
        tabs.appendChild(tab);
    });
}

// ===== VIEW SWITCHING =====
function hideAllContent() {
    ['logContent','chatContent','momentsContent','galleryContent','eventStream','evolutionPanel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.classList.remove('visible'); }
    });
}

function switchView(view) {
    currentView = view;
    hideAllContent();
    document.getElementById('viewToggle').classList.remove('visible');
    document.getElementById('msgBar').classList.remove('visible');
    document.querySelectorAll('.log-tab').forEach(t => t.classList.remove('active'));
    
    if (view === 'moments') {
        document.getElementById('momentsContent').style.display = 'block';
        fetchMoments();
    } else if (view === 'gallery') {
        const g = document.getElementById('galleryContent');
        g.style.display = 'flex';
        g.classList.add('visible');
        fetchGallery();
    } else if (view === 'events') {
        document.getElementById('eventStream').style.display = 'block';
        fetchEvents();
    } else if (view === 'evolution') {
        document.getElementById('evolutionPanel').style.display = 'block';
        document.getElementById('evolutionPanel').classList.add('visible');
        fetchEvolution();
    }
}

function setContentView(view) {
    currentView = view;
    hideAllContent();
    document.getElementById('btnLogView').classList.toggle('active', view==='log');
    document.getElementById('btnChatView').classList.toggle('active', view==='chat');
    if (view === 'log') { document.getElementById('logContent').style.display = 'block'; fetchLog(); }
    else if (view === 'chat') { document.getElementById('chatContent').style.display = 'block'; fetchChat(); }
}

function switchLog(logName, tabEl) {
    currentLog = logName;
    currentBotId = logName.startsWith('bot_') ? logName : null;
    document.querySelectorAll('.log-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    else document.querySelectorAll('.log-tab').forEach(t => { if(t.dataset.log===logName) t.classList.add('active'); });
    document.querySelectorAll('.bot-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById('card-'+logName);
    if (card) card.classList.add('active');
    
    hideAllContent();
    if (currentBotId) {
        document.getElementById('msgBar').classList.add('visible');
        document.getElementById('viewToggle').classList.add('visible');
    } else {
        document.getElementById('msgBar').classList.remove('visible');
        document.getElementById('viewToggle').classList.remove('visible');
    }
    currentView = 'log';
    document.getElementById('logContent').style.display = 'block';
    document.getElementById('btnLogView').classList.add('active');
    document.getElementById('btnChatView').classList.remove('active');
    fetchLog();
}

// ===== DATA FETCHING =====
function classifyLine(line) {
    if (line.includes('[内心独白]') || line.includes('THINK')) return 'inner';
    if (line.includes('[决策]') || line.includes('[行动]')) return 'action';
    if (line.includes('[结果]') || line.includes('成功') || line.includes('赚了')) return 'result';
    if (line.includes('[消息]') || line.includes('说:')) return 'message';
    if (line.includes('死亡') || line.includes('DEAD')) return 'death';
    if (line.includes('ERROR') || line.includes('失败')) return 'error';
    if (line.includes('[价值观')) return 'values';
    if (line.includes('[核心记忆]') || line.includes('⭐')) return 'memory';
    if (line.includes('[关系')) return 'bond';
    if (line.includes('任务') || line.includes('工作中')) return 'task';
    if (line.includes('[情绪') || line.includes('心情')) return 'emotion';
    if (line.includes('[朋友圈]') || line.includes('发了一条')) return 'moment';
    return '';
}

async function fetchLog() {
    if (currentView !== 'log') return;
    try {
        const resp = await fetch('/api/logs/'+currentLog);
        const data = await resp.json();
        const c = document.getElementById('logContent');
        c.innerHTML = data.lines.map(l => '<div class="log-line '+classifyLine(l)+'">'+l.replace(/</g,'&lt;').trim()+'</div>').join('');
        c.scrollTop = c.scrollHeight;
    } catch(e){}
}

async function fetchChat() {
    if (!currentBotId || currentView !== 'chat') return;
    try {
        const resp = await fetch('/api/messages/'+currentBotId);
        const data = await resp.json();
        const c = document.getElementById('chatContent');
        const msgs = data.messages || [];
        let html = '';
        if (msgs.length === 0) {
            html = '<div style="text-align:center;color:#444;padding:40px;font-size:12px;">暂无对话记录</div>';
        } else {
            msgs.forEach(m => {
                const isFromMe = m.from === currentBotId;
                const isGod = godMessages.some(g => g.msg === m.msg);
                if (isFromMe) {
                    html += '<div class="chat-bubble outgoing"><div class="sender">'+getBotName(currentBotId)+' → '+(m.to==='public'?'公告板':getBotName(m.to))+'</div><div>'+m.msg+'</div><div class="time">tick '+m.tick+'</div></div>';
                } else {
                    const cls = isGod ? 'incoming god' : 'incoming';
                    const pri = m.priority==='high' ? ' 🔴' : '';
                    html += '<div class="chat-bubble '+cls+'"><div class="sender">'+m.from+(isGod?' 👁️':'')+pri+'</div><div>'+m.msg+'</div><div class="time">tick '+m.tick+'</div></div>';
                }
            });
        }
        c.innerHTML = html;
        c.scrollTop = c.scrollHeight;
    } catch(e){}
}

async function fetchMoments() {
    try {
        const resp = await fetch('/api/moments');
        const data = await resp.json();
        const c = document.getElementById('momentsContent');
        const moments = (data.moments || []).reverse();
        if (moments.length === 0) {
            c.innerHTML = '<div style="text-align:center;color:#444;padding:40px;font-size:12px;">还没有人发过朋友圈</div>';
            return;
        }
        c.innerHTML = moments.map(m => {
            const botColor = getBotColor(m.bot_id);
            const likesHtml = m.likes && m.likes.length > 0 ? '❤️ '+m.likes.map(l=>getBotName(l)).join(', ') : '';
            let commentsHtml = '';
            if (m.comments && m.comments.length > 0) {
                commentsHtml = '<div class="moment-comments">' + m.comments.map(c =>
                    '<div class="moment-comment"><span class="commenter">'+getBotName(c.bot_id)+'</span>: '+c.content+'</div>'
                ).join('') + '</div>';
            }
            return '<div class="moment-card">' +
                '<div class="moment-header">' +
                '<img src="'+getAvatarUrl(m.bot_id)+'" style="border-color:'+botColor+'" onerror="this.style.background=\''+botColor+'\'">' +
                '<div><div class="name" style="color:'+botColor+'">'+getBotName(m.bot_id)+'</div>' +
                '<div class="time">'+(m.time||'')+(m.location?' · '+m.location:'')+'</div></div></div>' +
                (m.mood ? '<div class="moment-mood">心情: '+m.mood+'</div>' : '') +
                '<div class="moment-body">'+m.content+'</div>' +
                '<div class="moment-footer">' +
                '<span>'+likesHtml+'</span>' +
                '</div>' +
                commentsHtml +
                '</div>';
        }).join('');
    } catch(e){}
}

async function fetchGallery() {
    try {
        const resp = await fetch('/api/gallery');
        const data = await resp.json();
        const c = document.getElementById('galleryContent');
        const items = (data.photos || []).reverse();
        if (items.length === 0) {
            c.innerHTML = '<div style="text-align:center;color:#444;padding:40px;font-size:12px;width:100%;">📸 还没有人拍过照片</div>';
            return;
        }
        c.innerHTML = items.map(item =>
            '<div class="gallery-item"><img src="/selfies/'+item.filename+'" onerror="this.src=\''+getAvatarUrl(item.bot_id)+'\'" onclick="window.open(\'/selfies/'+item.filename+'\')"><div class="caption"><span class="bot-name">'+getBotName(item.bot_id)+'</span> '+(item.prompt||'').substring(0,40)+'<br><span class="time">'+(item.time||'')+'</span></div></div>'
        ).join('');
    } catch(e){}
}

async function fetchEvents() {
    try {
        const resp = await fetch('/api/logs/world_engine');
        const data = await resp.json();
        const lines = data.lines || [];
        const events = [];
        for (const line of lines) {
            const l = line.trim();
            if (l.includes('关系更新') || l.includes('印象')) {
                events.push({type:'relationship', icon:'💕', label:'关系变化', body:l});
            } else if (l.includes('回应') || l.includes('NPC')) {
                events.push({type:'npc-reply', icon:'🗣️', label:'NPC回应', body:l});
            } else if (l.includes('发了条朋友圈') || l.includes('[朋友圈]')) {
                events.push({type:'moment', icon:'💬', label:'朋友圈', body:l});
            } else if (l.includes('随机事件') || l.includes('突发') || l.includes('发现了')) {
                events.push({type:'world-event', icon:'🎲', label:'世界事件', body:l});
            } else if (l.includes('对') && l.includes('说:')) {
                events.push({type:'npc-reply', icon:'💬', label:'对话', body:l});
            }
        }
        const c = document.getElementById('eventStream');
        if (events.length === 0) {
            c.innerHTML = '<div style="text-align:center;color:#444;padding:40px;font-size:12px;">📖 还没有发生有趣的事件</div>';
            return;
        }
        c.innerHTML = events.reverse().slice(0, 50).map(e =>
            '<div class="event-card '+e.type+'"><div class="event-type">'+e.icon+' '+e.label+'</div><div class="event-body">'+e.body.replace(/</g,'&lt;')+'</div></div>'
        ).join('');
    } catch(e){}
}

// ===== v9.0: EVOLUTION PANEL =====
async function fetchEvolution() {
    try {
        const [evoResp, repResp, legResp, graveResp] = await Promise.all([
            fetch('/api/evolution'),
            fetch('/api/reputation'),
            fetch('/api/legends'),
            fetch('/api/graveyard')
        ]);
        const evo = await evoResp.json();
        const rep = await repResp.json();
        const leg = await legResp.json();
        const grave = await graveResp.json();
        
        const panel = document.getElementById('evolutionPanel');
        let html = '';
        
        // 声望榜
        html += '<div class="evo-section"><h3>\ud83c\udfc6 声望榜</h3>';
        const board = (rep.reputation_board || []).filter(b => b.status === 'alive').slice(0, 8);
        if (board.length > 0) {
            board.forEach(b => {
                const scoreClass = b.score > 0 ? 'positive' : b.score < 0 ? 'negative' : 'neutral';
                const tags = (b.tags || []).map(t => '<span class="rep-tag">'+t+'</span>').join('');
                const gen = b.generation > 0 ? '<span class="gen-badge">第'+b.generation+'代</span>' : '';
                html += '<div class="evo-card reputation"><div class="title">'+b.name+gen+' <span class="rep-score '+scoreClass+'">'+b.score+'</span></div><div class="desc">'+tags+'</div>';
                if (b.deeds && b.deeds.length > 0) {
                    html += '<div class="meta">最近: '+b.deeds[b.deeds.length-1]+'</div>';
                }
                html += '</div>';
            });
        } else {
            html += '<div class="evo-card"><div class="desc">还没有人建立声望</div></div>';
        }
        html += '</div>';
        
        // 世界改造
        html += '<div class="evo-section"><h3>\ud83c\udf1f 世界改造</h3>';
        const mods = evo.world_modifications || [];
        if (mods.length > 0) {
            mods.slice(-8).reverse().forEach(m => {
                html += '<div class="evo-card modification"><div class="title">'+m.name+'</div><div class="desc">'+m.description+'</div><div class="meta">创建者: '+(m.creator_name||'?')+' | 地点: '+(m.location||'?')+'</div></div>';
            });
        } else {
            html += '<div class="evo-card"><div class="desc">还没有人改变这个世界</div></div>';
        }
        html += '</div>';
        
        // 城市传说
        html += '<div class="evo-section"><h3>\ud83d\udcdc 城市传说</h3>';
        const legends = leg.urban_legends || [];
        if (legends.length > 0) {
            legends.slice(-6).reverse().forEach(l => {
                html += '<div class="evo-card legend"><div class="title">关于'+l.original_name+'的传说</div><div class="desc">'+l.content+'</div><div class="meta">传播次数: '+l.spread_count+' | 发源: '+l.location+'</div></div>';
            });
        } else {
            html += '<div class="evo-card"><div class="desc">还没有城市传说诞生</div></div>';
        }
        html += '</div>';
        
        // 墓地
        html += '<div class="evo-section"><h3>\ud83e\udea6 墓地</h3>';
        const graves = grave.graveyard || [];
        if (graves.length > 0) {
            graves.forEach(g => {
                html += '<div class="evo-card graveyard"><div class="title">'+g.name+' ('+g.age+'岁)</div><div class="desc">死因: '+(g.cause_of_death||'未知')+'</div><div class="meta">第'+(g.generation||0)+'代 | 财富: '+g.money+'元 | 关系数: '+g.relationship_count+'</div></div>';
            });
        } else {
            html += '<div class="evo-card"><div class="desc">还没有人离开这个世界</div></div>';
        }
        html += '</div>';
        
        // 地点氛围
        html += '<div class="evo-section"><h3>\ud83c\udfaf 地点氛围</h3>';
        const vibes = evo.location_vibes || {};
        Object.entries(vibes).forEach(([loc, vibe]) => {
            const mems = (evo.location_memories || {})[loc] || [];
            const locMods = (evo.location_modifications || {})[loc] || [];
            html += '<div class="evo-card"><div class="title">'+loc+' - '+vibe+'</div>';
            if (locMods.length > 0) {
                html += '<div class="desc">设施: '+locMods.map(m => m.name).join(', ')+'</div>';
            }
            if (mems.length > 0) {
                html += '<div class="meta">近期: '+mems.slice(-2).map(m => m.event).join('; ')+'</div>';
            }
            html += '</div>';
        });
        html += '</div>';
        
        panel.innerHTML = html;
    } catch(e) {
        document.getElementById('evolutionPanel').innerHTML = '<div style="text-align:center;color:#444;padding:40px;font-size:12px;">进化数据加载失败</div>';
    }
}

async function fetchWorld() {
    try {
        const resp = await fetch('/api/world');
        worldState = await resp.json();
        if (worldState.error) return;

        // Clock
        if (worldState.time) {
            const h = worldState.time.virtual_hour;
            let icon = '☀️';
            if (h>=22||h<6) icon='🌙'; else if(h>=18) icon='🌆'; else if(h<8) icon='🌅';
            document.getElementById('clock').textContent = icon+' '+worldState.time.virtual_datetime+' | Day '+worldState.time.virtual_day+' | Tick '+worldState.time.tick;
            updateMapWeather(worldState.weather, h);
        }

        // Weather badge
        if (worldState.weather) {
            const w = worldState.weather;
            const wIcons = {'晴天':'☀️','多云':'⛅','小雨':'🌧️','暴雨':'⛈️','台风':'🌀','闷热':'🥵','凉爽':'🍃'};
            const wType = w.current || w.type || '';
            document.getElementById('weatherBadge').textContent = (wIcons[wType]||'')+' '+wType;
        }

        // News ticker
        const topics = worldState.hot_topics || [];
        const news = worldState.news_feed || [];
        const allNews = [...topics.map(t=>'🔥 '+(typeof t==='object'?t.title||t.headline||JSON.stringify(t):t)), ...news.map(n=>'📰 '+(typeof n==='object'?n.headline||n.title||JSON.stringify(n):n))];
        if (allNews.length > 0) {
            const inner = document.getElementById('newsTickerInner');
            const doubled = [...allNews, ...allNews];
            inner.innerHTML = doubled.map(n => '<span>'+n+'</span>').join('');
        }

        // Location counts
        if (worldState.locations) {
            for (const [name, loc] of Object.entries(worldState.locations)) {
                const el = document.getElementById('loccount-'+name);
                if (el) { const n=(loc.bots||[]).length; el.textContent = n>0?n+'人':''; }
            }
        }

        // Bots
        if (worldState.bots) {
            for (const botId of Object.keys(worldState.bots)) {
                if (!BOTS.find(b=>b.id===botId)) {
                    const nb = {id:botId, name:worldState.bots[botId].name||botId, role:'新居民', color:'#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')};
                    BOTS.push(nb); addBotToMap(nb); addBotCard(nb);
                    const tabs = document.getElementById('logTabs');
                    const tab = document.createElement('div');
                    tab.className='log-tab'; tab.dataset.log=nb.id; tab.textContent=nb.name; tab.style.color=nb.color;
                    tab.onclick=function(){switchLog(nb.id,this);}; tabs.appendChild(tab);
                }
            }
            for (const [botId, bot] of Object.entries(worldState.bots)) {
                // Map position
                const avatar = document.getElementById('map-'+botId);
                if (avatar && bot.location && LOCATIONS[bot.location]) {
                    const pos = LOCATIONS[bot.location];
                    const botsAtLoc = Object.entries(worldState.bots).filter(([_,b])=>b.location===bot.location);
                    const idx = botsAtLoc.findIndex(([id])=>id===botId);
                    const angle = (idx/Math.max(botsAtLoc.length,1))*Math.PI*2;
                    const radius = botsAtLoc.length>1?3.5:0;
                    avatar.style.left = (pos.x+Math.cos(angle)*radius)+'%';
                    avatar.style.top = (pos.y+6+Math.sin(angle)*radius)+'%';
                    avatar.classList.remove('dead','sleeping','working');
                    if (bot.status==='dead') avatar.classList.add('dead');
                    else if (bot.is_sleeping) avatar.classList.add('sleeping');
                    // Zzz
                    const oldZ = document.getElementById('zzz-'+botId);
                    if (oldZ) oldZ.remove();
                    if (bot.is_sleeping && bot.status==='alive') {
                        const zzz = document.createElement('span');
                        zzz.className='sleep-zzz'; zzz.id='zzz-'+botId; zzz.textContent='💤';
                        zzz.style.left=avatar.style.left; zzz.style.top=(parseFloat(avatar.style.top)-4)+'%';
                        document.getElementById('map').appendChild(zzz);
                    }
                }
                // Card stats
                const hpBar = document.getElementById('hp-'+botId);
                const hpVal = document.getElementById('hpval-'+botId);
                const moneyVal = document.getElementById('money-'+botId);
                const locVal = document.getElementById('loc-'+botId);
                const sleepBadge = document.getElementById('sleepbadge-'+botId);
                const emoBadge = document.getElementById('emobadge-'+botId);
                const taskBadge = document.getElementById('task-'+botId);
                if (hpBar) { hpBar.style.width=bot.hp+'%'; hpBar.style.background=bot.hp<30?'#ff4444':bot.hp<60?'#ffd93d':getBotColor(botId); }
                if (hpVal) hpVal.textContent = bot.hp;
                if (moneyVal) moneyVal.textContent = '¥'+bot.money;
                if (locVal) locVal.textContent = bot.location||'...';
                if (sleepBadge) sleepBadge.textContent = bot.is_sleeping?'💤':(bot.status==='dead'?'💀':'');
                if (emoBadge) emoBadge.textContent = getEmotionEmoji(bot.emotions);
                if (taskBadge) {
                    const task = bot.current_task;
                    if (task && task.status==='in_progress') {
                        const pct = Math.round((task.progress||0)/task.duration*100);
                        taskBadge.textContent = '🔨 '+task.task_name+' '+pct+'%';
                        taskBadge.style.color = task.challenge?'#ff6b6b':'#ffd93d';
                    } else if (task && task.status==='completed') {
                        taskBadge.textContent = '✅'; taskBadge.style.color='#6bcb77';
                    } else { taskBadge.textContent = ''; }
                }
            }
        }
        // Update bond tags on cards from each bot's emotional_bonds_summary
        if (worldState.bots) {
            for (const [botId, bot] of Object.entries(worldState.bots)) {
                const bonds = bot.emotional_bonds_summary || {};
                const card = document.getElementById('card-'+botId);
                if (!card) continue;
                let tagsEl = card.querySelector('.bond-tags');
                if (!tagsEl) { tagsEl = document.createElement('div'); tagsEl.className='bond-tags'; card.appendChild(tagsEl); }
                const entries = Object.entries(bonds);
                if (entries.length > 0) {
                    tagsEl.innerHTML = entries.slice(0,3).map(([target, info]) => {
                        const name = getBotName(target) || target;
                        const label = info.label || '认识';
                        return '<span class="bond-tag">'+name+': '+label+'</span>';
                    }).join('');
                } else {
                    tagsEl.innerHTML = '';
                }
            }
        }
    } catch(e){}
}

// ===== DETAIL PANEL =====
async function showDetail(botId) {
    const panel = document.getElementById('detailPanel');
    const overlay = document.getElementById('detailOverlay');
    const bot = BOTS.find(b=>b.id===botId) || {id:botId,name:botId,role:'?',color:'#888'};
    panel.innerHTML = '<div style="padding:40px;text-align:center;color:#555;">加载中...</div>';
    overlay.classList.add('visible');
    try {
        const resp = await fetch('/api/bot/'+botId+'/detail');
        const d = await resp.json();
        if (d.error) { panel.innerHTML='<div style="padding:40px;text-align:center;color:#ff4444;">'+d.error+'</div>'; return; }
        let html = '';
        // Header
        html += '<div class="detail-header"><img src="'+getAvatarUrl(botId)+'" style="border-color:'+bot.color+'" onerror="this.style.background=\''+bot.color+'\'">';
        html += '<div class="info"><h2 style="color:'+bot.color+'">'+bot.name+'</h2>';
        html += '<div class="sub">'+bot.role+' | '+d.location+(d.is_sleeping?' 💤':'')+(d.status==='dead'?' 💀':'');
        if (d.phone_battery !== undefined) html += ' | 📱'+d.phone_battery+'%';
        html += '</div></div><span class="close-btn" onclick="hideDetail()">&times;</span></div>';

        // Emotions
        const emos = d.emotions || {};
        const emoNames = {happiness:'😊开心',sadness:'😢难过',anger:'😠愤怒',anxiety:'😰焦虑',loneliness:'🥺孤独'};
        const emoColors = {happiness:'#6bcb77',sadness:'#4d96ff',anger:'#ff4444',anxiety:'#ffd93d',loneliness:'#9b59b6'};
        html += '<div class="detail-section"><h3>🎭 情绪状态</h3><div class="emotion-bars">';
        for (const [k,label] of Object.entries(emoNames)) {
            const val = Math.round(emos[k]||0);
            const h = Math.max(2, val*0.4);
            html += '<div class="emotion-bar-item"><div class="ebar" style="height:'+h+'px;background:'+(emoColors[k]||'#888')+'"></div><div class="elabel">'+label+'</div><div class="elabel">'+val+'</div></div>';
        }
        html += '</div></div>';

        // Current Task
        const task = d.current_task;
        if (task && task.status==='in_progress') {
            const pct = Math.round((task.progress||0)/task.duration*100);
            html += '<div class="detail-section"><h3>🔨 当前任务</h3><div style="padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;">';
            html += '<div style="font-size:12px;font-weight:600;">'+task.job_title+' → '+task.task_name+'</div>';
            html += '<div style="font-size:10px;color:#888;margin:4px 0;">'+task.task_desc+'</div>';
            html += '<div class="bar" style="margin:6px 0;"><div class="bar-fill" style="width:'+pct+'%;background:#4d96ff;height:4px;border-radius:2px;"></div></div>';
            html += '<div style="font-size:10px;color:#666;">进度: '+(task.progress||0)+'/'+task.duration+' ('+pct+'%) | 难度: '+'⭐'.repeat(Math.max(1,Math.round(task.difficulty*5)))+'</div>';
            if (task.challenge) html += '<div style="font-size:10px;color:#ff6b6b;margin-top:4px;">⚠️ '+task.challenge+'</div>';
            html += '</div></div>';
        }

        // Stats
        html += '<div class="detail-section"><h3>📊 基础数值</h3><div class="detail-grid">';
        [{l:'❤️ HP',v:d.hp,m:100,c:d.hp<30?'#ff4444':d.hp<60?'#ffd93d':'#6bcb77'},
         {l:'⚡ 能量',v:d.energy,m:100,c:'#4d96ff'},
         {l:'🍚 饱腹度',v:d.satiety,m:100,c:'#ff9800'},
         {l:'💰 金钱',v:'¥'+d.money,c:'#ffd93d'}].forEach(s => {
            html += '<div class="detail-stat"><div class="label">'+s.l+'</div><div class="value" style="color:'+s.c+'">'+s.v+(s.m?'/'+s.m:'')+'</div>';
            if (s.m) html += '<div class="bar"><div class="bar-fill" style="width:'+(typeof s.v==='number'?s.v:0)+'%;background:'+s.c+'"></div></div>';
            html += '</div>';
        });
        html += '</div></div>';

        // Skills
        html += '<div class="detail-section"><h3>🎯 技能</h3><div class="detail-grid">';
        const sn = {programming:'💻 编程',social:'🤝 社交',hardware:'🔧 硬件',analysis:'📈 分析',art:'🎨 艺术'};
        for (const [k,v] of Object.entries(d.skills||{})) {
            html += '<div class="detail-stat"><div class="label">'+(sn[k]||k)+'</div><div class="value">'+v+'</div><div class="bar"><div class="bar-fill" style="width:'+v+'%;background:#4d96ff"></div></div></div>';
        }
        html += '</div></div>';

        // Desires
        const desires = d.desires||{};
        const dn = {lust:'🔥 性欲',power:'👑 权力欲',greed:'💰 物欲',vanity:'🪞 虚荣心',security:'🛡️ 安全感'};
        const dc = {lust:'#ff4d6d',power:'#9b59b6',greed:'#f39c12',vanity:'#e91e63',security:'#3498db'};
        html += '<div class="detail-section"><h3>🔥 内心欲望</h3><div class="detail-grid">';
        for (const [k,v] of Object.entries(desires)) {
            const val = Math.round(v);
            const lvl = val>70?' (强烈!)':val>40?' (中等)':' (微弱)';
            html += '<div class="detail-stat"><div class="label">'+(dn[k]||k)+lvl+'</div><div class="value">'+val+'</div><div class="bar"><div class="bar-fill" style="width:'+val+'%;background:'+(dc[k]||'#888')+'"></div></div></div>';
        }
        html += '</div></div>';

        // Values
        const values = d.values||{};
        html += '<div class="detail-section"><h3>💭 价值观</h3><div class="detail-values">'+(values.current||'(尚未形成)');
        if (values.original && values.original!==values.current) html += '<div class="original">初始: '+values.original+'</div>';
        if (values.shifts && values.shifts.length>0) html += '<div style="margin-top:6px;font-size:10px;color:#e040fb;">已经历 '+values.shifts.length+' 次价值观变化</div>';
        html += '</div></div>';

        // Core Memories
        const mems = d.core_memories||[];
        html += '<div class="detail-section"><h3>⭐ 核心记忆 ('+mems.length+')</h3>';
        if (mems.length===0) html += '<div style="color:#444;font-size:11px;">还没有形成核心记忆</div>';
        else mems.forEach(m => {
            const el = {positive:'😊 积极',negative:'😢 消极',neutral:'😐 中性'}[m.emotion||'neutral']||m.emotion;
            html += '<div class="detail-memory">'+m.summary+'<span class="emotion '+(m.emotion||'neutral')+'">'+el+'</span></div>';
        });
        html += '</div>';

        // Emotional Bonds
        const bonds = d.emotional_bonds||{};
        const bk = Object.keys(bonds);
        html += '<div class="detail-section"><h3>💕 情感关系 ('+bk.length+')</h3>';
        if (bk.length===0) html += '<div style="color:#444;font-size:11px;">还没有建立深层关系</div>';
        else bk.forEach(target => {
            const b = bonds[target];
            html += '<div class="detail-bond"><div style="min-width:60px;"><div style="font-size:11px;">'+getBotName(target)+'</div><div style="font-size:9px;color:#666;">'+(b.label||'?')+'</div></div><div class="bond-bars">';
            html += '<div class="bond-bar"><span style="min-width:30px;color:#6bcb77;">信任</span><div class="bar"><div class="bar-fill" style="width:'+(b.trust||0)+'%;background:#6bcb77"></div></div><span>'+(b.trust||0)+'</span></div>';
            html += '<div class="bond-bar"><span style="min-width:30px;color:#4d96ff;">亲密</span><div class="bar"><div class="bar-fill" style="width:'+(b.closeness||0)+'%;background:#4d96ff"></div></div><span>'+(b.closeness||0)+'</span></div>';
            html += '<div class="bond-bar"><span style="min-width:30px;color:#ff4444;">敌意</span><div class="bar"><div class="bar-fill" style="width:'+(b.hostility||0)+'%;background:#ff4444"></div></div><span>'+(b.hostility||0)+'</span></div>';
            html += '</div></div>';
            // Show impressions
            const imps = b.impressions || [];
            if (imps.length > 0) {
                html += '<div class="bond-impression">💭 ' + imps.slice(-2).join(' → ') + '</div>';
            }
        });
        html += '</div>';

        // v9.0: Reputation
        const rep = d.reputation || {score:0, tags:[], deeds:[]};
        html += '<div class="detail-section"><h3>\ud83c\udfc6 声望</h3><div class="detail-values">';
        const repClass = rep.score > 0 ? 'positive' : rep.score < 0 ? 'negative' : 'neutral';
        html += '声望分: <span class="rep-score '+repClass+'">'+rep.score+'</span>';
        if (rep.tags && rep.tags.length > 0) html += '<br>标签: '+rep.tags.map(t => '<span class="rep-tag">'+t+'</span>').join('');
        if (d.generation > 0) html += '<br><span class="gen-badge">第'+d.generation+'代居民</span>';
        if (d.inherited_from) html += ' (继承自 '+getBotName(d.inherited_from)+')';
        if (rep.deeds && rep.deeds.length > 0) {
            html += '<br>事迹: ';
            rep.deeds.slice(-3).forEach(deed => { html += '<div style="font-size:10px;color:#888;margin:2px 0;">- '+deed+'</div>'; });
        }
        html += '</div></div>';

        // v9.0: Created Things
        const created = d.created_things || [];
        if (created.length > 0) {
            html += '<div class="detail-section"><h3>\ud83c\udf1f 创造物</h3>';
            created.forEach(c => { html += '<div class="detail-memory">'+c.name+' @ '+c.location+'</div>'; });
            html += '</div>';
        }

        // Family
        const fam = d.family||{};
        if (Object.keys(fam).length>0) {
            html += '<div class="detail-section"><h3>👨‍👩‍👧 家庭</h3><div class="detail-values">';
            if (fam.role) html += '角色: '+fam.role+'<br>';
            if (fam.parents) html += '父母: '+fam.parents.map(p=>getBotName(p)).join(', ')+'<br>';
            if (fam.children) html += '子女: '+fam.children.map(c=>getBotName(c)).join(', ')+'<br>';
            html += '</div></div>';
        }

        // Inventory
        if (d.inventory && d.inventory.length>0) {
            html += '<div class="detail-section"><h3>🎒 物品</h3><div class="detail-values">'+d.inventory.join(', ')+'</div></div>';
        }

        // Recent actions
        const actions = d.action_log || [];
        if (actions.length > 0) {
            html += '<div class="detail-section"><h3>📝 最近行动</h3>';
            actions.slice(-8).forEach(a => {
                html += '<div class="action-log-item">'+a+'</div>';
            });
            html += '</div>';
        }

        panel.innerHTML = html;
    } catch(e) {
        panel.innerHTML = '<div style="padding:40px;text-align:center;color:#ff4444;">加载失败</div>';
    }
}

function hideDetail() { document.getElementById('detailOverlay').classList.remove('visible'); }

// ===== MESSAGING =====
async function sendMsg() {
    if (!currentBotId) return;
    const input = document.getElementById('msgInput');
    const alias = document.getElementById('senderAlias').value;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    try {
        const resp = await fetch('/api/send_message', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({target_id:currentBotId, message:msg, sender_alias:alias})
        });
        const result = await resp.json();
        if (result.error) { showToast('发送失败'); return; }
        godMessages.push({msg, to:currentBotId, alias});
        const pri = ['父亲','母亲','爸爸','妈妈'].includes(alias) ? ' (高优先级🔴)' : '';
        showToast('✅ 已发送给 '+getBotName(currentBotId)+'（'+alias+'）'+pri);
        if (currentView==='chat') {
            const c = document.getElementById('chatContent');
            const b = document.createElement('div');
            b.className = 'chat-bubble incoming god';
            b.innerHTML = '<div class="sender">'+alias+' 👁️'+pri+'</div><div>'+msg+'</div><div class="time">刚刚</div>';
            c.appendChild(b); c.scrollTop = c.scrollHeight;
        }
        if (currentView==='log') setContentView('chat');
    } catch(e){ showToast('发送失败'); }
}

// ===== ADD BOT =====
function showAddBotModal() {
    document.getElementById('addBotModal').classList.add('visible');
    const maxId = BOTS.reduce((max,b)=>{const n=parseInt(b.id.replace('bot_',''));return isNaN(n)?max:Math.max(max,n);},0);
    document.getElementById('newBotId').value = 'bot_'+(maxId+1);
}
function hideAddBotModal() { document.getElementById('addBotModal').classList.remove('visible'); }

async function addBot() {
    const botId = document.getElementById('newBotId').value.trim();
    const location = document.getElementById('newBotLocation').value;
    const name = document.getElementById('newBotName').value.trim()||botId;
    const role = document.getElementById('newBotRole').value.trim()||'新居民';
    if (!botId) { alert('请输入Bot ID'); return; }
    try {
        const resp = await fetch('/api/add_bot', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bot_id:botId,location})});
        const result = await resp.json();
        if (result.error) { showToast('创建失败'); return; }
        const color = '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
        const nb = {id:botId,name,role,color};
        BOTS.push(nb); addBotToMap(nb); addBotCard(nb);
        hideAddBotModal();
        showToast('🎉 '+name+' 已抵达 '+location);
    } catch(e){ showToast('创建失败'); }
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.key==='Escape') { hideDetail(); hideAddBotModal(); return; }
    const num = parseInt(e.key);
    if (num===0) switchLog('world_engine',null);
    else if (num>=1&&num<=9) switchLog('bot_'+num,null);
});

// Init
initMap(); initCards(); initTabs();
setInterval(() => {
    if (currentView==='log') fetchLog();
    else if (currentView==='chat') fetchChat();
    else if (currentView==='moments') fetchMoments();
    else if (currentView==='gallery') fetchGallery();
    else if (currentView==='events') fetchEvents();
}, 3000);
setInterval(fetchWorld, 3000);
fetchLog(); fetchWorld();
</script>
</body>
</html>""")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9000)
