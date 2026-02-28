/**
 * TopHeader - 城市运营中心顶部横幅
 * 包含：系统标题、虚拟时间、天气、全局统计、新闻滚动条
 */

import { WEATHER_ICONS } from "@/types/world";
import type { WorldState } from "@/types/world";

interface Props {
  world: WorldState | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  engineUrl: string;
  onEngineUrlChange: (url: string) => void;
}

export default function TopHeader({ world, isConnected, lastUpdated, engineUrl, onEngineUrlChange }: Props) {
  const time = world?.time;
  const weather = world?.weather;
  const weatherIcon = weather ? (WEATHER_ICONS[weather.current] || "🌤️") : "🌤️";

  const aliveBots = world ? Object.values(world.bots).filter(b => b.status === "alive").length : 0;
  const totalMoney = world ? Object.values(world.bots).reduce((s, b) => s + (b.money || 0), 0) : 0;
  const avgHappiness = world
    ? Math.round(Object.values(world.bots).reduce((s, b) => s + (b.emotions?.happiness || 0), 0) / Math.max(aliveBots, 1))
    : 0;

  const newsItems = world?.news_feed || [];
  const hotTopics = world?.hot_topics || [];
  const allNews = [
    ...newsItems.map(n => `【${n.source}】${n.headline}`),
    ...hotTopics.map(t => `🔥 ${t}`),
  ];

  return (
    <header
      className="shrink-0 flex flex-col"
      style={{ background: "rgba(6,11,20,0.98)", borderBottom: "1px solid rgba(77,150,255,0.15)" }}
    >
      {/* 主行 */}
      <div className="flex items-center gap-4 px-4 py-2">
        {/* 标题 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-base font-orbitron font-bold neon-blue tracking-wider">
            深圳像素城市
          </div>
          <div
            className="text-[9px] font-orbitron px-1.5 py-0.5 rounded"
            style={{ background: "rgba(77,150,255,0.1)", color: "rgba(77,150,255,0.7)", border: "1px solid rgba(77,150,255,0.2)" }}
          >
            LIVE SIM
          </div>
        </div>

        {/* 虚拟时间 */}
        {time && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.4)" }}>虚拟时间</span>
            <span className="text-[11px] font-mono-data" style={{ color: "#4d96ff" }}>
              {time.virtual_datetime?.slice(0, 16) || `第${time.tick}轮`}
            </span>
          </div>
        )}

        {/* 天气 */}
        {weather && (
          <div className="flex items-center gap-1 shrink-0">
            <span>{weatherIcon}</span>
            <span className="text-[10px]" style={{ color: "rgba(200,216,240,0.6)" }}>{weather.current}</span>
          </div>
        )}

        {/* 全局统计 */}
        <div className="flex items-center gap-4 shrink-0">
          <StatItem label="在线" value={`${aliveBots}人`} color="#6bcb77" />
          <StatItem label="总资产" value={`¥${totalMoney}`} color="#ffd93d" />
          <StatItem label="平均快乐" value={`${avgHappiness}%`} color="#c77dff" />
          {world?.generation_count !== undefined && (
            <StatItem label="世代" value={`G${world.generation_count}`} color="#ff9f43" />
          )}
        </div>

        <div className="flex-1" />

        {/* 连接状态 + Engine URL */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: isConnected ? "#6bcb77" : "#ff6b6b",
                boxShadow: isConnected ? "0 0 6px #6bcb77" : "0 0 6px #ff6b6b",
                animation: isConnected ? "pulse-glow 2s infinite" : "none",
              }}
            />
            <span className="text-[9px]" style={{ color: isConnected ? "#6bcb77" : "#ff6b6b" }}>
              {isConnected ? "已连接" : "离线"}
            </span>
          </div>
          <input
            type="text"
            value={engineUrl}
            onChange={e => onEngineUrlChange(e.target.value)}
            className="text-[9px] px-2 py-1 rounded outline-none w-44"
            style={{
              background: "rgba(77,150,255,0.06)",
              border: "1px solid rgba(77,150,255,0.15)",
              color: "rgba(200,216,240,0.6)",
            }}
            placeholder="http://localhost:8000"
          />
          {lastUpdated && (
            <span className="text-[8px]" style={{ color: "rgba(200,216,240,0.3)" }}>
              {lastUpdated.toLocaleTimeString("zh-CN")}
            </span>
          )}
        </div>
      </div>

      {/* 新闻滚动条 */}
      {allNews.length > 0 && (
        <div
          className="flex items-center overflow-hidden"
          style={{
            height: 22,
            borderTop: "1px solid rgba(77,150,255,0.08)",
            background: "rgba(77,150,255,0.04)",
          }}
        >
          <div
            className="shrink-0 px-2 text-[9px] font-orbitron"
            style={{ color: "#4d96ff", borderRight: "1px solid rgba(77,150,255,0.15)" }}
          >
            NEWS
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div
              className="flex gap-8 whitespace-nowrap text-[9px] animate-ticker"
              style={{ color: "rgba(200,216,240,0.55)" }}
            >
              {/* 双份内容确保无缝循环 */}
              {[...allNews, ...allNews].map((item, i) => (
                <span key={i} className="shrink-0">{item}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 世界叙事 */}
      {world?.world_narrative && (
        <div
          className="px-4 py-1 text-[9px] truncate"
          style={{ color: "rgba(200,216,240,0.35)", borderTop: "1px solid rgba(77,150,255,0.06)" }}
        >
          📖 {world.world_narrative}
        </div>
      )}
    </header>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.4)" }}>{label}</span>
      <span className="text-[11px] font-mono-data" style={{ color }}>{value}</span>
    </div>
  );
}
