/**
 * RightPanel - 右侧信息面板
 * 标签页：事件流 / 朋友圈 / 地点详情
 */

import { useState } from "react";
import type { WorldState, Moment } from "@/types/world";
import { BOT_COLORS, LOCATION_MAP_CONFIG } from "@/types/world";

interface Props {
  world: WorldState | null;
  moments: Moment[];
  selectedLocation: string | null;
  onBotClick: (botId: string) => void;
}

type Tab = "events" | "moments" | "location";

export default function RightPanel({ world, moments, selectedLocation, onBotClick }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("events");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "events",   label: "事件流", icon: "⚡" },
    { id: "moments",  label: "朋友圈", icon: "📱" },
    { id: "location", label: "地点",   icon: "📍" },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: "rgba(6,11,20,0.95)" }}>
      {/* 标签栏 */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: "1px solid rgba(77,150,255,0.12)" }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 text-[10px] transition-colors"
            style={{
              color: activeTab === tab.id ? "#4d96ff" : "rgba(200,216,240,0.4)",
              borderBottom: activeTab === tab.id ? "2px solid #4d96ff" : "2px solid transparent",
              background: activeTab === tab.id ? "rgba(77,150,255,0.05)" : "transparent",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "events" && <EventsTab world={world} onBotClick={onBotClick} />}
        {activeTab === "moments" && <MomentsTab moments={moments} world={world} />}
        {activeTab === "location" && <LocationTab world={world} selectedLocation={selectedLocation} onBotClick={onBotClick} />}
      </div>
    </div>
  );
}

// ===== 事件流 =====
function EventsTab({ world, onBotClick }: { world: WorldState | null; onBotClick: (id: string) => void }) {
  if (!world) return <EmptyState text="等待连接..." />;

  // 收集所有 Bot 的最新行动
  const events: { time: string; botId: string; botName: string; text: string; color: string }[] = [];

  Object.entries(world.bots).forEach(([botId, bot]) => {
    if (bot.status !== "alive") return;
    const color = BOT_COLORS[botId] || "#4d96ff";
    const logs = bot.action_log || [];
    if (logs.length > 0) {
      const last = logs[logs.length - 1];
      events.push({
        time: last.time?.slice(11, 16) || "",
        botId,
        botName: bot.name,
        text: last.result?.narrative || last.plan || bot.current_activity || "...",
        color,
      });
    } else if (bot.current_activity) {
      events.push({
        time: "",
        botId,
        botName: bot.name,
        text: bot.current_activity,
        color,
      });
    }
  });

  // 世界事件
  const worldEvents = world.events || [];

  return (
    <div className="p-2 space-y-1">
      {/* 世界事件 */}
      {worldEvents.slice(-3).reverse().map((ev, i) => (
        <div
          key={`we-${i}`}
          className="p-2 rounded text-[9px] animate-slide-bottom"
          style={{ background: "rgba(255,217,61,0.06)", border: "1px solid rgba(255,217,61,0.15)" }}
        >
          <div className="flex items-center gap-1 mb-0.5">
            <span style={{ color: "#ffd93d" }}>🌐 世界事件</span>
            <span style={{ color: "rgba(200,216,240,0.3)" }}>{ev.time?.slice(11, 16)}</span>
          </div>
          <div style={{ color: "rgba(200,216,240,0.7)" }}>{ev.desc || ev.event}</div>
        </div>
      ))}

      {/* Bot 行动 */}
      {events.map((ev, i) => (
        <div
          key={i}
          className="p-2 rounded cursor-pointer transition-colors animate-slide-bottom"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(77,150,255,0.08)" }}
          onClick={() => onBotClick(ev.botId)}
        >
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] font-medium" style={{ color: ev.color }}>{ev.botName}</span>
            {ev.time && <span className="text-[8px]" style={{ color: "rgba(200,216,240,0.3)" }}>{ev.time}</span>}
          </div>
          <div className="text-[9px] leading-relaxed" style={{ color: "rgba(200,216,240,0.6)" }}>
            {ev.text.slice(0, 80)}
          </div>
        </div>
      ))}

      {events.length === 0 && <EmptyState text="暂无事件" />}
    </div>
  );
}

// ===== 朋友圈 =====
function MomentsTab({ moments, world }: { moments: Moment[]; world: WorldState | null }) {
  if (moments.length === 0) return <EmptyState text="朋友圈空空如也..." />;

  return (
    <div className="p-2 space-y-2">
      {[...moments].reverse().slice(0, 20).map(moment => {
        const bot = world?.bots[moment.bot_id];
        const color = BOT_COLORS[moment.bot_id] || "#4d96ff";

        return (
          <div
            key={moment.id}
            className="p-2 rounded animate-slide-bottom"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(77,150,255,0.08)" }}
          >
            {/* 发布者 */}
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="flex items-center justify-center rounded"
                style={{ width: 24, height: 24, background: `${color}18`, border: `1px solid ${color}40` }}
              >
                <svg width="14" height="14" viewBox="0 0 10 10" style={{ imageRendering: "pixelated" }}>
                  <rect x="3" y="0" width="4" height="3" fill={color} />
                  <rect x="2" y="3" width="6" height="4" fill={color} />
                  <rect x="2" y="7" width="2" height="3" fill={color} />
                  <rect x="6" y="7" width="2" height="3" fill={color} />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-medium" style={{ color }}>{moment.bot_name}</div>
                <div className="text-[8px]" style={{ color: "rgba(200,216,240,0.3)" }}>
                  {moment.time?.slice(11, 16)} · {bot?.location || ""}
                </div>
              </div>
            </div>

            {/* 内容 */}
            <div className="text-[10px] leading-relaxed mb-1.5" style={{ color: "rgba(200,216,240,0.75)" }}>
              {moment.content}
            </div>

            {/* 互动 */}
            <div className="flex items-center gap-3">
              <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.35)" }}>
                ❤️ {moment.likes?.length || 0}
              </span>
              <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.35)" }}>
                💬 {moment.comments?.length || 0}
              </span>
            </div>

            {/* 评论 */}
            {moment.comments && moment.comments.length > 0 && (
              <div
                className="mt-1.5 p-1.5 rounded space-y-1"
                style={{ background: "rgba(77,150,255,0.04)", border: "1px solid rgba(77,150,255,0.08)" }}
              >
                {moment.comments.slice(-2).map((c, i) => (
                  <div key={i} className="text-[9px]">
                    <span style={{ color: BOT_COLORS[c.bot_id] || "#4d96ff" }}>{c.bot_name}: </span>
                    <span style={{ color: "rgba(200,216,240,0.55)" }}>{c.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===== 地点详情 =====
function LocationTab({
  world, selectedLocation, onBotClick
}: {
  world: WorldState | null;
  selectedLocation: string | null;
  onBotClick: (id: string) => void;
}) {
  const [viewLoc, setViewLoc] = useState<string | null>(null);
  const displayLoc = viewLoc || selectedLocation;

  if (!world) return <EmptyState text="等待连接..." />;

  const locNames = Object.keys(LOCATION_MAP_CONFIG);

  return (
    <div className="p-2">
      {/* 地点选择 */}
      <div className="flex flex-wrap gap-1 mb-2">
        {locNames.map(loc => {
          const cfg = LOCATION_MAP_CONFIG[loc];
          const count = world.locations[loc]?.bots?.length || 0;
          const isActive = displayLoc === loc;
          return (
            <button
              key={loc}
              onClick={() => setViewLoc(loc)}
              className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
              style={{
                background: isActive ? `${cfg.color}20` : "rgba(255,255,255,0.03)",
                border: `1px solid ${isActive ? cfg.color + "50" : "rgba(77,150,255,0.1)"}`,
                color: isActive ? cfg.color : "rgba(200,216,240,0.5)",
              }}
            >
              {cfg.icon} {loc.slice(0, 4)} {count > 0 && <span style={{ color: "#ff6b6b" }}>·{count}</span>}
            </button>
          );
        })}
      </div>

      {displayLoc && world.locations[displayLoc] ? (
        <LocationDetail
          name={displayLoc}
          data={world.locations[displayLoc]}
          bots={world.bots}
          onBotClick={onBotClick}
        />
      ) : (
        <EmptyState text="点击地点查看详情" />
      )}
    </div>
  );
}

function LocationDetail({
  name, data, bots, onBotClick
}: {
  name: string;
  data: WorldState["locations"][string];
  bots: WorldState["bots"];
  onBotClick: (id: string) => void;
}) {
  const cfg = LOCATION_MAP_CONFIG[name];

  return (
    <div className="space-y-2">
      {/* 地点头部 */}
      <div
        className="p-2 rounded"
        style={{ background: `${cfg?.color || "#4d96ff"}10`, border: `1px solid ${cfg?.color || "#4d96ff"}25` }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{cfg?.icon || "📍"}</span>
          <div>
            <div className="text-[11px] font-medium" style={{ color: cfg?.color || "#4d96ff" }}>{name}</div>
            <div className="text-[9px]" style={{ color: "rgba(200,216,240,0.5)" }}>{data.desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[8px] px-1 py-0.5 rounded"
            style={{ background: "rgba(77,150,255,0.1)", color: "#4d96ff" }}
          >
            {data.type}
          </span>
          <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.4)" }}>
            氛围: {data.vibe || "普通"}
          </span>
        </div>
      </div>

      {/* 在场 Bot */}
      {data.bots && data.bots.length > 0 && (
        <div>
          <div className="text-[9px] mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>在场人物 ({data.bots.length})</div>
          <div className="space-y-1">
            {data.bots.map(botId => {
              const bot = bots[botId];
              if (!bot) return null;
              const color = BOT_COLORS[botId] || "#4d96ff";
              return (
                <div
                  key={botId}
                  className="flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(77,150,255,0.08)" }}
                  onClick={() => onBotClick(botId)}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[10px]" style={{ color }}>{bot.name}</span>
                  <span className="text-[9px]" style={{ color: "rgba(200,216,240,0.4)" }}>
                    {bot.current_activity?.slice(0, 20) || "..."}
                  </span>
                  {bot.is_sleeping && <span className="text-[9px]">💤</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NPC */}
      {data.npcs && data.npcs.length > 0 && (
        <div>
          <div className="text-[9px] mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>NPC</div>
          <div className="flex flex-wrap gap-1">
            {data.npcs.map((npc, i) => (
              <span
                key={i}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(200,216,240,0.5)", border: "1px solid rgba(77,150,255,0.1)" }}
              >
                {npc.name} · {npc.role}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 公共记忆 */}
      {data.public_memory && data.public_memory.length > 0 && (
        <div>
          <div className="text-[9px] mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>地点记忆</div>
          <div className="space-y-1">
            {data.public_memory.slice(-3).map((mem, i) => (
              <div
                key={i}
                className="text-[9px] p-1.5 rounded"
                style={{ background: "rgba(77,150,255,0.04)", color: "rgba(200,216,240,0.55)", border: "1px solid rgba(77,150,255,0.08)" }}
              >
                {typeof mem === "string" ? mem : mem.event}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 工作岗位 */}
      {data.jobs && data.jobs.length > 0 && (
        <div>
          <div className="text-[9px] mb-1" style={{ color: "rgba(77,150,255,0.6)" }}>工作岗位</div>
          <div className="flex flex-wrap gap-1">
            {data.jobs.map((job, i) => (
              <span
                key={i}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(107,203,119,0.08)", color: "#6bcb77", border: "1px solid rgba(107,203,119,0.2)" }}
              >
                {job.title} ¥{job.pay}/轮
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-32">
      <span className="text-[11px]" style={{ color: "rgba(200,216,240,0.25)" }}>{text}</span>
    </div>
  );
}
