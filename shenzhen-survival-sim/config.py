#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API Key 与 LLM 配置（统一入口）
================================
所有 LLM/图像 API 的 Key 在此通过环境变量或 .env 文件读取，便于在一处配置/替换。

使用方式：
  1. 复制 env.example 为 .env，填入你的 Key（.env 已被 .gitignore，不会提交）
  2. 或直接设置环境变量：export OPENAI_API_KEY=... GROK_API_KEY=...
  3. 若已安装 python-dotenv，会自动从项目目录下的 .env 加载

本模块提供的变量/函数：
  - get_openai_client()  返回 OpenAI 客户端（用于 chat completions）
  - get_grok_api_key()   返回 Grok 图像 API Key（用于自拍、头像生成等）
  - OPENAI_MODEL_NANO    轻量模型（新闻、叙事、关系、反思等）
  - OPENAI_MODEL_MINI    推理模型（计划解析、规则生成、Bot 思考等）
"""

import os

# 项目根目录（与 config.py 同目录），用于日志、selfies、快照等，便于在任意机器上运行
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR = os.path.join(PROJECT_ROOT, "logs")
SELFIES_DIR = os.path.join(PROJECT_ROOT, "selfies")
SNAPSHOT_PATH = os.path.join(PROJECT_ROOT, "world_state_snapshot.json")
BOT_AGENT_SCRIPT = os.path.join(PROJECT_ROOT, "bot_agent_v8.py")
AVATAR_DIRS = [
    os.path.join(PROJECT_ROOT, "bot_avatars_v2"),
    os.path.join(PROJECT_ROOT, "bot_avatars"),
]

# 优先从 .env 加载（需 pip install python-dotenv）
try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    load_dotenv(_env_path)
except ImportError:
    pass

# -----------------------------------------------------------------------------
# API Keys（从环境变量读取，未设置时为空字符串，调用时会报错）
# -----------------------------------------------------------------------------
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
GROK_API_KEY = os.environ.get("GROK_API_KEY", "").strip()

# 可选：OpenAI 兼容 API 的 base_url。使用 DeepSeek 时设为 https://api.deepseek.com
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "").strip()


def get_openai_client():
    """返回 OpenAI 兼容的客户端。支持 OpenAI / DeepSeek 等（通过 OPENAI_BASE_URL 切换）。"""
    from openai import OpenAI
    if not OPENAI_API_KEY:
        raise ValueError(
            "未配置 OPENAI_API_KEY。请在 .env 中填写或设置环境变量，参见 env.example。"
        )
    if OPENAI_BASE_URL:
        return OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    return OpenAI(api_key=OPENAI_API_KEY)


def get_grok_api_key():
    """返回 Grok 图像 API Key（X.AI），用于自拍、头像生成等。未配置时返回空字符串。"""
    return GROK_API_KEY


# -----------------------------------------------------------------------------
# 模型名称（使用 DeepSeek 时在 .env 中设为 deepseek-chat 等）
# -----------------------------------------------------------------------------
OPENAI_MODEL_NANO = os.environ.get("OPENAI_MODEL_NANO", "gpt-4.1-nano")
OPENAI_MODEL_MINI = os.environ.get("OPENAI_MODEL_MINI", "gpt-4.1-mini")
