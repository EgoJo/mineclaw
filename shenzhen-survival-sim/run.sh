#!/bin/bash
# 深圳生存模拟 — 统一启动脚本（世界引擎 v8 + Dashboard v6，Bot 由世界引擎自动启动）

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p logs

echo "=== 启动深圳生存模拟 ==="
echo "世界引擎 v8 | Dashboard v6 | Bot Agent v8"

# 1. 启动世界引擎 v8
echo "[1/3] 启动世界引擎..."
nohup python3 world_engine_v8.py > logs/world_engine.log 2>&1 &
echo "世界引擎 PID: $!"

# 等待世界引擎就绪
sleep 5
for i in {1..10}; do
    if curl -s http://localhost:8000/world > /dev/null 2>&1; then
        echo "世界引擎已就绪"
        break
    fi
    echo "等待世界引擎... ($i/10)"
    sleep 2
done

# 2. 启动 Dashboard v6
echo "[2/3] 启动 Dashboard..."
nohup python3 sz_dashboard_v6.py > logs/dashboard.log 2>&1 &
echo "Dashboard PID: $!"

echo ""
echo "[3/3] Bot 进程由世界引擎自动启动"
echo ""
echo "=== 启动完成 ==="
echo "Dashboard: http://localhost:9000"
echo "世界引擎:  http://localhost:8000"
