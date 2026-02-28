import { useState, useEffect, useCallback, useRef } from "react";
import type { WorldState, Moment } from "@/types/world";
import { MOCK_WORLD, MOCK_MOMENTS } from "@/lib/mockData";

// 全局 engineUrl，支持运行时动态修改
let _engineUrl = (import.meta.env.VITE_ENGINE_URL as string) || "http://localhost:8000";

export function setEngineUrl(url: string) {
  _engineUrl = url.replace(/\/$/, ""); // 去掉末尾斜杠
}

export function getEngineUrl() {
  return _engineUrl;
}

export interface WorldDataState {
  world: WorldState | null;
  moments: Moment[];
  isConnected: boolean;
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

export function useWorldData(pollInterval = 3000, engineUrl?: string) {
  const [state, setState] = useState<WorldDataState>({
    world: null,
    moments: [],
    isConnected: false,
    isLoading: true,
    lastUpdated: null,
    error: null,
  });

  // 用 ref 追踪最新的 engineUrl，避免 stale closure
  const engineUrlRef = useRef(engineUrl || _engineUrl);
  useEffect(() => {
    engineUrlRef.current = engineUrl || _engineUrl;
  }, [engineUrl]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const fetchWorld = useCallback(async () => {
    const url = engineUrlRef.current;
    try {
      const [worldRes, momentsRes] = await Promise.all([
        fetch(`${url}/world`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${url}/moments`, { signal: AbortSignal.timeout(5000) }),
      ]);

      if (!worldRes.ok) throw new Error(`HTTP ${worldRes.status}`);

      const worldData: WorldState = await worldRes.json();
      const momentsData = momentsRes.ok ? await momentsRes.json() : { moments: [] };

      if (!isMountedRef.current) return;

      // world_engine /moments 返回 { moments: [...] } 或直接 [...]
      const momentsList = Array.isArray(momentsData)
        ? momentsData
        : (momentsData.moments || []);

      setState(prev => ({
        ...prev,
        world: worldData,
        moments: momentsList,
        isConnected: true,
        isLoading: false,
        lastUpdated: new Date(),
        error: null,
      }));
    } catch (err) {
      if (!isMountedRef.current) return;
      // 连接失败时使用 Mock 数据，让界面可以正常展示
      setState(prev => ({
        ...prev,
        world: prev.isConnected ? prev.world : (prev.world || MOCK_WORLD),
        moments: prev.isConnected ? prev.moments : (prev.moments.length > 0 ? prev.moments : MOCK_MOMENTS),
        isConnected: false,
        isLoading: false,
        error: err instanceof Error ? err.message : "连接失败",
      }));
    }
  }, []);

  // 当 engineUrl 变化时立即重新拉取
  useEffect(() => {
    if (engineUrl) {
      engineUrlRef.current = engineUrl;
      fetchWorld();
    }
  }, [engineUrl, fetchWorld]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchWorld();

    const schedule = () => {
      timerRef.current = setTimeout(() => {
        fetchWorld().then(() => {
          if (isMountedRef.current) schedule();
        });
      }, pollInterval);
    };
    schedule();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchWorld, pollInterval]);

  return { ...state, refresh: fetchWorld };
}

// 发送消息给 Bot
export async function sendMessage(targetId: string, message: string, senderAlias = "观察者") {
  const url = _engineUrl;
  const res = await fetch(`${url}/admin/send_message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: senderAlias, to: targetId, message }),
  });
  return res.ok;
}

// 获取 Bot 详情
export async function fetchBotDetail(botId: string) {
  const url = _engineUrl;
  const res = await fetch(`${url}/bot/${botId}/detail`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  return res.json();
}
