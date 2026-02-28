/**
 * BotCard - Bot 状态卡片
 * 设计：城市运营中心风格，紧凑信息密度，情绪颜色编码
 */

import { BOT_COLORS, BOT_ROLES, getDominantEmotion, getEmotionColor } from "@/types/world";
import type { BotState } from "@/types/world";

interface Props {
  botId: string;
  bot: BotState;
  isSelected: boolean;
  onClick: () => void;
}

function StatBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[8px] font-mono-data w-5 shrink-0" style={{ color: "rgba(200,216,240,0.5)" }}>
        {label}
      </span>
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[8px] font-mono-data w-5 text-right shrink-0" style={{ color: "rgba(200,216,240,0.5)" }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

export default function BotCard({ botId, bot, isSelected, onClick }: Props) {
  const color = BOT_COLORS[botId] || "#4d96ff";
  const role = BOT_ROLES[botId] || "居民";
  const emotion = getDominantEmotion(bot.emotions);
  const emotionColor = getEmotionColor(bot.emotions);
  const isDead = bot.status === "dead";
  const hpPct = bot.hp;

  // HP 颜色
  const hpColor = hpPct > 60 ? "#6bcb77" : hpPct > 30 ? "#ffd93d" : "#ff6b6b";

  return (
    <div
      onClick={onClick}
      className="relative rounded transition-all duration-200 cursor-pointer select-none"
      style={{
        background: isSelected
          ? `linear-gradient(135deg, rgba(13,26,46,0.95), rgba(15,32,64,0.95))`
          : "rgba(10,16,28,0.85)",
        border: `1px solid ${isSelected ? color + "80" : "rgba(77,150,255,0.12)"}`,
        boxShadow: isSelected ? `0 0 12px ${color}30, inset 0 0 20px ${color}08` : "none",
        opacity: isDead ? 0.4 : 1,
        padding: "8px",
      }}
    >
      {/* 选中角标 */}
      {isSelected && (
        <>
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: color }} />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: color }} />
        </>
      )}

      {/* 头部：头像 + 名字 + 情绪 */}
      <div className="flex items-center gap-2 mb-2">
        {/* 像素头像 */}
        <div
          className="relative shrink-0 flex items-center justify-center rounded"
          style={{
            width: 32, height: 32,
            background: `radial-gradient(circle, ${color}22, transparent)`,
            border: `1px solid ${color}60`,
          }}
        >
          {/* 像素人形 */}
          <svg width="20" height="20" viewBox="0 0 10 10" style={{ imageRendering: "pixelated" }}>
            {/* 头 */}
            <rect x="3" y="0" width="4" height="3" fill={color} />
            {/* 身体 */}
            <rect x="2" y="3" width="6" height="4" fill={color} />
            {/* 腿 */}
            <rect x="2" y="7" width="2" height="3" fill={color} />
            <rect x="6" y="7" width="2" height="3" fill={color} />
          </svg>
          {bot.is_sleeping && (
            <span className="absolute -top-1 -right-1 text-[8px]">💤</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium truncate" style={{ color }}>
              {bot.name}
            </span>
            <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.4)" }}>
              {bot.age}岁
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.5)" }}>{role}</span>
            <span className="text-[10px]">{emotion.emoji}</span>
          </div>
        </div>

        {/* 金钱 */}
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono-data" style={{ color: "#ffd93d" }}>
            ¥{bot.money}
          </div>
          <div className="text-[8px]" style={{ color: "rgba(200,216,240,0.4)" }}>
            {bot.location?.slice(0, 4)}
          </div>
        </div>
      </div>

      {/* 状态条 */}
      <div className="space-y-1">
        <StatBar value={hpPct} color={hpColor} label="HP" />
        <StatBar value={bot.energy} color="#4d96ff" label="能" />
        <StatBar value={bot.satiety} color="#ff9f43" label="饱" />
      </div>

      {/* 当前活动 */}
      {bot.current_activity && (
        <div
          className="mt-2 text-[8px] truncate"
          style={{ color: "rgba(200,216,240,0.45)" }}
          title={bot.current_activity}
        >
          {bot.current_activity}
        </div>
      )}

      {/* 死亡遮罩 */}
      {isDead && (
        <div className="absolute inset-0 flex items-center justify-center rounded"
          style={{ background: "rgba(0,0,0,0.5)" }}>
          <span className="text-[10px]" style={{ color: "#ff6b6b" }}>已离开</span>
        </div>
      )}
    </div>
  );
}
