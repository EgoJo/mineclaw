#!/usr/bin/env python3
"""批量用Grok API生成10个Bot的真人风格头像"""

import os
import sys
sys.path.insert(0, "/home/ubuntu")

import importlib.util
_spec = importlib.util.spec_from_file_location("generate_image", "/home/ubuntu/skills/grok-image-generator/scripts/generate_image.py")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
generate_image = _mod.generate_image

AVATAR_DIR = "/home/ubuntu/bot_avatars_v2"
os.makedirs(AVATAR_DIR, exist_ok=True)

# 每个Bot的真人头像prompt - 基于人设精心设计
AVATAR_PROMPTS = {
    "bot_1": "Professional headshot portrait of a 24-year-old Chinese male software engineer, wearing glasses and a blue hoodie, short neat black hair, slightly introverted expression, warm indoor lighting, clean background, high quality photo, realistic",
    "bot_2": "Professional headshot portrait of a 26-year-old Chinese female finance professional, elegant appearance, light makeup, wearing a white blouse, confident smile, pearl earrings, shoulder-length straight black hair, studio lighting, clean background, high quality photo, realistic",
    "bot_3": "Headshot portrait of a 28-year-old Chinese male migrant worker, tanned skin, honest and hardworking expression, short buzz cut hair, wearing a simple dark t-shirt, warm natural lighting, clean background, high quality photo, realistic",
    "bot_4": "Headshot portrait of a 22-year-old Chinese female art student, creative and dreamy expression, messy bun hairstyle with a paint-stained apron, artistic vibe, soft natural lighting, clean background, high quality photo, realistic",
    "bot_5": "Headshot portrait of a 25-year-old Chinese male from Shenzhen, trendy streetwear style, dyed brown hair, wearing designer sunglasses on head, confident casual smile, urban background blur, clean background, high quality photo, realistic",
    "bot_6": "Professional headshot portrait of a 30-year-old Chinese female entrepreneur, sharp intelligent eyes, wearing a dark blazer, hair tied back neatly, determined expression, professional studio lighting, clean background, high quality photo, realistic",
    "bot_7": "Headshot portrait of a 45-year-old Chinese male businessman from Wenzhou, weathered but shrewd face, receding hairline, wearing a polo shirt, experienced and wise expression, warm lighting, clean background, high quality photo, realistic",
    "bot_8": "Headshot portrait of a 52-year-old Chinese female restaurant owner from Chaoshan, kind motherly face, slightly wrinkled, wearing a simple floral blouse, warm gentle smile, natural lighting, clean background, high quality photo, realistic",
    "bot_9": "Headshot portrait of a 21-year-old Chinese male indie musician, artistic and rebellious look, messy long hair, wearing a vintage band t-shirt, silver ear piercing, moody lighting, clean background, high quality photo, realistic",
    "bot_10": "Headshot portrait of a 19-year-old Chinese female aspiring influencer, cute youthful face, big eyes, light pink makeup, wearing a trendy crop top, bright cheerful smile, ring light reflection in eyes, clean background, high quality photo, realistic",
}

def main():
    for bot_id, prompt in AVATAR_PROMPTS.items():
        save_path = os.path.join(AVATAR_DIR, f"{bot_id}.jpg")
        if os.path.exists(save_path):
            print(f"[SKIP] {bot_id} already exists")
            continue
        print(f"[GEN] Generating avatar for {bot_id}...")
        result = generate_image(prompt, save_path)
        if result["success"]:
            print(f"[OK] {bot_id} saved to {save_path}")
        else:
            print(f"[FAIL] {bot_id}: {result.get('error')}")

if __name__ == "__main__":
    main()
