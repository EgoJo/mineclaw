/**
 * BotDetailPanel - Bot 详情面板
 * 显示选中 Bot 的完整状态：情绪雷达、技能、行动日志、关系
 */

import { BOT_COLORS, BOT_ROLES, getDominantEmotion, getEmotionColor } from "@/types/world";
import type { BotState } from "@/types/world";
import { useEffect, useRef } from "react";

interface Props {
  botId: string | null;
  bot: BotState | null;
  onClose: () => void;
  onSendMessage?: (botId: string, msg: string) => void;
}

// 情绪雷达图（Canvas）
function EmotionRadar({ emotions }: { emotions: BotState["emotions"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !emotions) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) * 0.38;

    ctx.clearRect(0, 0, w, h);

    const axes = [
      { key: "happiness", label: "开心", color: "#6bcb77" },
      { key: "anger",     label: "愤怒", color: "#ff6b6b" },
      { key: "anxiety",   label: "焦虑", color: "#ffd93d" },
      { key: "sadness",   label: "难过", color: "#4d96ff" },
      { key: "loneliness",label: "孤独", color: "#c77dff" },
    ] as const;

    const n = axes.length;

    // 背景网格
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const rx = cx + Math.cos(angle) * r * (ring / 4);
        const ry = cy + Math.sin(angle) * r * (ring / 4);
        if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(77,150,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 轴线
    axes.forEach((_, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.strokeStyle = "rgba(77,150,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 数据多边形
    ctx.beginPath();
    axes.forEach(({ key }, i) => {
      const val = (emotions[key] ?? 0) / 100;
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * r * val;
      const py = cy + Math.sin(angle) * r * val;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(77,150,255,0.15)";
    ctx.fill();
    ctx.strokeStyle = "#4d96ff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 顶点圆点
    axes.forEach(({ key, color }, i) => {
      const val = (emotions[key] ?? 0) / 100;
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * r * val;
      const py = cy + Math.sin(angle) * r * val;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // 标签
    ctx.font = "9px 'Noto Sans SC', sans-serif";
    axes.forEach(({ key, label, color }, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const lx = cx + Math.cos(angle) * (r + 14);
      const ly = cy + Math.sin(angle) * (r + 14);
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const val = emotions[key] ?? 0;
      ctx.fillText(`${label}${Math.round(val)}`, lx, ly);
    });
  }, [emotions]);

  return <canvas ref={canvasRef} width={160} height={160} className="w-full" style={{ maxWidth: 160 }} />;
}

export default function BotDetailPanel({ botId, bot, onClose, onSendMessage }: Props) {
  const msgRef = useRef<HTMLInputElement>(null);

  if (!botId || !bot) return null;

  const color = BOT_COLORS[botId] || "#4d96ff";
  const role = BOT_ROLES[botId] || "居民";
  const emotion = getDominantEmotion(bot.emotions);

  const handleSend = () => {
    const msg = msgRef.current?.value?.trim();
    if (msg && onSendMessage) {
      onSendMessage(botId, msg);
      if (msgRef.current) msgRef.current.value = "";
    }
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden animate-slide-right"
      style={{ background: "rgba(8,14,24,0.98)" }}
    >
      {/* 头部 */}
      <div
        className="flex items-center gap-3 px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${color}30` }}
      >
        <div
          className="flex items-center justify-center rounded"
          style={{ width: 36, height: 36, background: `${color}18`, border: `1px solid ${color}50` }}
        >
          <svg width="22" height="22" viewBox="0 0 10 10" style={{ imageRendering: "pixelated" }}>
            <rect x="3" y="0" width="4" height="3" fill={color} />
            <rect x="2" y="3" width="6" height="4" fill={color} />
            <rect x="2" y="7" width="2" height="3" fill={color} />
            <rect x="6" y="7" width="2" height="3" fill={color} />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color }}>{bot.name}</span>
            <span className="text-[10px]" style={{ color: "rgba(200,216,240,0.4)" }}>{bot.age}岁 · {bot.gender}</span>
          </div>
          <div className="text-[10px]" style={{ color: "rgba(200,216,240,0.5)" }}>
            {role} · {bot.location} · {emotion.emoji} {emotion.label}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] px-2 py-1 rounded transition-colors"
          style={{ color: "rgba(200,216,240,0.4)", border: "1px solid rgba(77,150,255,0.15)" }}
        >
          ✕
        </button>
      </div>

      {/* 内容滚动区 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">

        {/* 核心状态 */}
        <div>
          <div className="text-[9px] font-orbitron mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>核心状态</div>
          <div className="grid grid-cols-2 gap-1">
            {[
              { label: "HP", value: bot.hp, color: bot.hp > 60 ? "#6bcb77" : bot.hp > 30 ? "#ffd93d" : "#ff6b6b" },
              { label: "能量", value: bot.energy, color: "#4d96ff" },
              { label: "饱腹", value: bot.satiety, color: "#ff9f43" },
              { label: "手机电量", value: bot.phone_battery, color: "#c77dff" },
            ].map(({ label, value, color: c }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="text-[9px] w-12 shrink-0" style={{ color: "rgba(200,216,240,0.5)" }}>{label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: c }} />
                </div>
                <span className="text-[9px] w-6 text-right font-mono-data" style={{ color: c }}>{Math.round(value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.4)" }}>金钱</span>
            <span className="text-[11px] font-mono-data" style={{ color: "#ffd93d" }}>¥{bot.money}</span>
            <span className="text-[9px] ml-2" style={{ color: "rgba(200,216,240,0.4)" }}>工作</span>
            <span className="text-[9px]" style={{ color }}>{bot.job || "无"}</span>
          </div>
        </div>

        {/* 情绪雷达 */}
        <div>
          <div className="text-[9px] font-orbitron mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>情绪状态</div>
          <div className="flex justify-center">
            <EmotionRadar emotions={bot.emotions} />
          </div>
        </div>

        {/* 技能 */}
        {bot.skills && (
          <div>
            <div className="text-[9px] font-orbitron mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>技能</div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(bot.skills).map(([skill, val]) => (
                <div key={skill} className="flex items-center gap-1">
                  <span className="text-[9px] w-10 shrink-0" style={{ color: "rgba(200,216,240,0.5)" }}>
                    {skill === "tech" ? "技术" : skill === "social" ? "社交" : skill === "creative" ? "创意" : "体力"}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: color + "cc" }} />
                  </div>
                  <span className="text-[9px] w-5 text-right font-mono-data" style={{ color: "rgba(200,216,240,0.5)" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 长期目标 */}
        {bot.long_term_goal && (
          <div>
            <div className="text-[9px] font-orbitron mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>长期目标</div>
            <div className="text-[10px] leading-relaxed" style={{ color: "rgba(200,216,240,0.7)" }}>
              {bot.long_term_goal}
            </div>
          </div>
        )}

        {/* 内心叙事 */}
        {bot.narrative_summary && (
          <div>
            <div className="text-[9px] font-orbitron mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>内心状态</div>
            <div
              className="text-[10px] leading-relaxed p-2 rounded"
              style={{ color: "rgba(200,216,240,0.65)", background: "rgba(77,150,255,0.05)", border: "1px solid rgba(77,150,255,0.1)" }}
            >
              {bot.narrative_summary}
            </div>
          </div>
        )}

        {/* 行动日志 */}
        {bot.action_log && bot.action_log.length > 0 && (
          <div>
            <div className="text-[9px] font-orbitron mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>最近行动</div>
            <div className="space-y-1">
              {[...bot.action_log].reverse().slice(0, 5).map((log, i) => (
                <div
                  key={i}
                  className="text-[9px] p-1.5 rounded"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(77,150,255,0.08)" }}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="font-mono-data" style={{ color: "rgba(77,150,255,0.5)" }}>{log.time?.slice(11, 16)}</span>
                    <span style={{ color: "rgba(200,216,240,0.4)" }}>·</span>
                    <span style={{ color: "rgba(200,216,240,0.5)" }}>{log.plan?.slice(0, 20)}</span>
                  </div>
                  {log.result?.narrative && (
                    <div style={{ color: "rgba(200,216,240,0.6)" }}>{log.result.narrative.slice(0, 60)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 声望 */}
        {bot.reputation && (
          <div>
            <div className="text-[9px] font-orbitron mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>声望</div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-mono-data" style={{ color: "#ffd93d" }}>
                {bot.reputation.score ?? 0}
              </span>
              <div className="flex flex-wrap gap-1">
                {(bot.reputation.tags || []).slice(0, 3).map((tag, i) => (
                  <span
                    key={i}
                    className="text-[8px] px-1 rounded"
                    style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 发送消息 */}
      {onSendMessage && (
        <div
          className="px-3 py-2 shrink-0 flex gap-2"
          style={{ borderTop: "1px solid rgba(77,150,255,0.1)" }}
        >
          <input
            ref={msgRef}
            type="text"
            placeholder={`给 ${bot.name} 发消息...`}
            className="flex-1 text-[10px] px-2 py-1.5 rounded outline-none"
            style={{
              background: "rgba(77,150,255,0.06)",
              border: "1px solid rgba(77,150,255,0.15)",
              color: "rgba(200,216,240,0.8)",
            }}
            onKeyDown={e => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            className="text-[10px] px-2 py-1.5 rounded transition-colors"
            style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
          >
            发送
          </button>
        </div>
      )}
    </div>
  );
}
