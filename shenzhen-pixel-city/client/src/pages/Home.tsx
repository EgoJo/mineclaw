/**
 * Home - 深圳像素城市主页面
 * 设计哲学：城市运营中心（NOC Dashboard）
 * 布局：顶部 Header + 左侧地图(60%) + 右侧面板(40%)
 *       右侧面板：上半 Bot 卡片网格 + 下半 标签页信息面板
 *       点击 Bot 卡片时右侧切换为 Bot 详情
 */

import { useState, useCallback, useRef, useEffect, memo, useMemo } from "react";
import { useWorldData, sendMessage, setEngineUrl } from "@/hooks/useWorldData";
import PixelCityMap from "@/components/PixelCityMap";
import CityOverviewMap from "@/components/CityOverviewMap";
import BotCard from "@/components/BotCard";
import BotDetailPanel from "@/components/BotDetailPanel";
import RightPanel from "@/components/RightPanel";
import TopHeader from "@/components/TopHeader";
import { toast } from "sonner";

export default function Home() {
  const [engineUrl, setEngineUrlState] = useState(
    (import.meta.env.VITE_ENGINE_URL as string) || "http://localhost:8000"
  );
  const { world, moments, isConnected, isLoading, lastUpdated, error } = useWorldData(3000, engineUrl);

  const handleEngineUrlChange = useCallback((url: string) => {
    setEngineUrlState(url);
    setEngineUrl(url);
  }, []);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [currentMapLocation, setCurrentMapLocation] = useState<string>('宝安城中村');
  const [showBotDetail, setShowBotDetail] = useState(false);
  // Two-layer map: 'overview' = city overview, 'scene' = zoomed-in location
  const [mapLayer, setMapLayer] = useState<'overview' | 'scene'>('overview');
  const [zoomAnimating, setZoomAnimating] = useState(false);

  const handleBotClick = useCallback((botId: string) => {
    setSelectedBotId(botId);
    setShowBotDetail(true);
  }, []);

  const handleLocationClick = useCallback((location: string) => {
    setSelectedLocation(location);
    setCurrentMapLocation(location);
    setShowBotDetail(false);
  }, []);

  // Handle overview map location click → zoom into scene
  const handleOverviewLocationSelect = useCallback((locationKey: string) => {
    // Map overview keys to scene config keys
    const keyMap: Record<string, string> = {
      'baoan_urban_village': '宝安城中村',
      'nanshan_tech_park':   '南山科技园',
      'futian_cbd':          '福田CBD',
      'huaqiangbei':         '华强北',
      'dongmen_oldstreet':   '东门老街',
      'nanshan_apartments':  '南山公寓',
      'shenzhen_bay_park':   '深圳湾公园',
    };
    const sceneName = keyMap[locationKey] || '宝安城中村';
    setZoomAnimating(true);
    setTimeout(() => {
      setCurrentMapLocation(sceneName);
      setSelectedLocation(sceneName);
      setMapLayer('scene');
      setZoomAnimating(false);
    }, 350);
  }, []);

  const handleSendMessage = useCallback(async (botId: string, msg: string) => {
    const ok = await sendMessage(botId, msg);
    if (ok) {
      toast.success(`消息已发送给 ${world?.bots[botId]?.name || botId}`);
    } else {
      toast.error("发送失败，请检查 world_engine 是否运行");
    }
  }, [world]);

  const aliveBots = useMemo(() =>
    world
      ? Object.entries(world.bots).filter(([, b]) => b.status === "alive")
      : [],
    [world]
  );

  const selectedBot = selectedBotId && world ? world.bots[selectedBotId] : null;

  // Lazy-load Bot cards: only render visible ones via IntersectionObserver
  const [visibleBotIds, setVisibleBotIds] = useState<Set<string>>(new Set());
  const botCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        setVisibleBotIds(prev => {
          const next = new Set(prev);
          entries.forEach(e => {
            const id = (e.target as HTMLElement).dataset.botid;
            if (id) { if (e.isIntersecting) next.add(id); }
          });
          return next;
        });
      },
      { threshold: 0.01 }
    );
    Object.entries(botCardRefs.current).forEach(([, el]) => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [aliveBots]);

  return (
    <div
      className="flex flex-col"
      style={{ height: "100vh", background: "#060b14", overflow: "hidden" }}
    >
      {/* 顶部 Header */}
      <TopHeader
        world={world}
        isConnected={isConnected}
        lastUpdated={lastUpdated}
        engineUrl={engineUrl}
        onEngineUrlChange={handleEngineUrlChange}
      />

      {/* 主体区域 */}
      <div className="flex flex-1 overflow-hidden">

        {/* 左侧：像素城市地图（两层：全景 ↔ 场景） */}
        <div
          className="relative"
          style={{
            width: "60%",
            borderRight: "1px solid rgba(77,150,255,0.12)",
            overflow: "hidden",
          }}
        >
          {/* 地图标题 + 层级指示 */}
          <div
            className="absolute top-2 left-3 z-10 flex items-center gap-2"
            style={{ pointerEvents: "none" }}
          >
            <span className="text-[9px] font-orbitron" style={{ color: "rgba(77,150,255,0.5)" }}>
              {mapLayer === 'overview' ? 'PIXEL MAP · SHENZHEN' : `SCENE · ${currentMapLocation.toUpperCase()}`}
            </span>
          </div>

          {/* 场景层：返回全景按钮 */}
          {mapLayer === 'scene' && (
            <button
              onClick={() => setMapLayer('overview')}
              className="absolute top-2 right-3 z-20 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-orbitron"
              style={{
                background: "rgba(77,150,255,0.15)",
                border: "1px solid rgba(77,150,255,0.35)",
                color: "#4d96ff",
                cursor: "pointer",
              }}
            >
              ← 全城视图
            </button>
          )}

          {/* 全景提示 */}
          {mapLayer === 'overview' && (
            <div
              className="absolute bottom-3 left-1/2 z-10 text-[9px] font-orbitron"
              style={{ transform: "translateX(-50%)", color: "rgba(77,150,255,0.45)", pointerEvents: "none" }}
            >
              点击地点进入场景
            </div>
          )}

          {/* 缩放动画遮罩 */}
          {zoomAnimating && (
            <div
              className="absolute inset-0 z-30"
              style={{
                background: "rgba(6,11,20,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className="text-[11px] font-orbitron" style={{ color: "#4d96ff" }}>
                进入 {currentMapLocation}...
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-20"
              style={{ background: "rgba(6,11,20,0.7)" }}>
              <div className="text-center">
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent mx-auto mb-2 animate-spin"
                  style={{ borderColor: "#4d96ff", borderTopColor: "transparent" }}
                />
                <div className="text-[10px] font-orbitron" style={{ color: "#4d96ff" }}>
                  连接 world_engine...
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {!isConnected && !isLoading && (
            <div
              className="absolute bottom-8 left-3 right-3 z-10 p-2 rounded text-[9px]"
              style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "#ff6b6b" }}
            >
              ⚠️ 无法连接到 world_engine ({engineUrl})。请确保 world_engine_v8.py 正在运行，或修改上方地址。
            </div>
          )}

          {/* 全景层 - 条件渲染避免 canvas 重叠 */}
          {mapLayer === 'overview' && (
            <div style={{ position: "absolute", inset: 0 }}>
              <CityOverviewMap
                world={world}
                onLocationSelect={handleOverviewLocationSelect}
              />
            </div>
          )}

          {/* 场景层 - 条件渲染 */}
          {mapLayer === 'scene' && (
            <div style={{ position: "absolute", inset: 0 }}>
              <PixelCityMap
                world={world}
                selectedBotId={selectedBotId}
                onBotClick={handleBotClick}
                onLocationClick={handleLocationClick}
                currentLocation={currentMapLocation}
              />
            </div>
          )}
        </div>

        {/* 右侧面板 */}
        <div className="flex flex-col" style={{ width: "40%", overflow: "hidden" }}>

          {/* Bot 状态网格（上半部分） */}
          <div
            className="shrink-0 overflow-y-auto"
            style={{
              height: showBotDetail ? "0" : "45%",
              borderBottom: "1px solid rgba(77,150,255,0.1)",
              transition: "height 0.3s ease",
            }}
          >
            <div
              className="px-2 pt-2 pb-1 flex items-center justify-between sticky top-0 z-10"
              style={{ background: "rgba(6,11,20,0.95)", borderBottom: "1px solid rgba(77,150,255,0.08)" }}
            >
              <span className="text-[9px] font-orbitron" style={{ color: "rgba(77,150,255,0.6)" }}>
                BOT STATUS · {aliveBots.length} ACTIVE
              </span>
              {selectedBotId && (
                <button
                  onClick={() => { setSelectedBotId(null); setShowBotDetail(false); }}
                  className="text-[8px]"
                  style={{ color: "rgba(200,216,240,0.3)" }}
                >
                  清除选择
                </button>
              )}
            </div>
            <div className="p-2 grid grid-cols-2 gap-1.5">
              {aliveBots.map(([botId, bot]) => (
                <div
                  key={botId}
                  data-botid={botId}
                  ref={el => { botCardRefs.current[botId] = el; }}
                  style={{ minHeight: 80 }}
                >
                  {(visibleBotIds.has(botId) || selectedBotId === botId) ? (
                    <BotCard
                      botId={botId}
                      bot={bot}
                      isSelected={selectedBotId === botId}
                      onClick={() => handleBotClick(botId)}
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded"
                      style={{ background: 'rgba(77,150,255,0.03)', minHeight: 80 }}
                    />
                  )}
                </div>
              ))}
              {aliveBots.length === 0 && (
                <div
                  className="col-span-2 flex items-center justify-center h-20 text-[10px]"
                  style={{ color: "rgba(200,216,240,0.25)" }}
                >
                  {isLoading ? "加载中..." : "暂无存活 Bot"}
                </div>
              )}
            </div>
          </div>

          {/* Bot 详情面板（展开时覆盖上半部分） */}
          {showBotDetail && selectedBot && (
            <div
              className="shrink-0 overflow-hidden"
              style={{ height: "45%", borderBottom: "1px solid rgba(77,150,255,0.1)" }}
            >
              <BotDetailPanel
                botId={selectedBotId}
                bot={selectedBot}
                onClose={() => setShowBotDetail(false)}
                onSendMessage={handleSendMessage}
              />
            </div>
          )}

          {/* 下半部分：标签页信息面板 */}
          <div className="flex-1 overflow-hidden">
            <RightPanel
              world={world}
              moments={moments}
              selectedLocation={selectedLocation}
              onBotClick={handleBotClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
