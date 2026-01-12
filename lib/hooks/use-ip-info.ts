import { useState, useEffect, useCallback, useRef } from "react";
import { NormalizedIpInfo } from "@/lib/types";

const CACHE_TTL = 60 * 1000; // 1 minute cache

interface CacheItem {
  data: NormalizedIpInfo | null;
  ip: string;
  timestamp: number;
}

export function useIpInfo() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NormalizedIpInfo | null>(null);
  const [ip, setIp] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [nowString, setNowString] = useState<string>("");

  // Simple in-memory cache
  const cache = useRef<Map<string, CacheItem>>(new Map());

  // Function to update time string
  const updateTime = useCallback((timeZone: string) => {
    try {
      const formatter = new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: timeZone,
      });
      setNowString(formatter.format(new Date()));
    } catch (e) {
      console.error("Invalid time zone:", timeZone);
      setNowString("");
    }
  }, []);

  const fetchIpInfo = useCallback(async (targetIp?: string, force: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = targetIp || "current";
      const now = Date.now();

      if (!force && cache.current.has(cacheKey)) {
        const cached = cache.current.get(cacheKey)!;
        if (now - cached.timestamp < CACHE_TTL) {
          setData(cached.data);
          setIp(cached.ip);
          if (cached.data?.time_zone) {
            updateTime(cached.data.time_zone);
          }
          setLoading(false);
          return;
        }
      }

      const url = targetIp ? `/api/ip?ip=${encodeURIComponent(targetIp)}` : "/api/ip";
      const res = await fetch(url);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json?.error || "请求失败");
      }
      
      setData(json.data);
      setIp(json.ip);

      // Update cache
      cache.current.set(cacheKey, {
        data: json.data,
        ip: json.ip,
        timestamp: now
      });
      
      // Initialize time
      if (json.data?.time_zone) {
        updateTime(json.data.time_zone);
      } else {
        setNowString("");
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "发生未知错误");
    } finally {
      setLoading(false);
    }
  }, [updateTime]); // Added updateTime dependency

  // Clock effect
  useEffect(() => {
    if (!data?.time_zone) return;
    
    // Initial update
    updateTime(data.time_zone);

    const timer = setInterval(() => {
      updateTime(data.time_zone!);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [data?.time_zone, updateTime]);

  // Initial fetch
  useEffect(() => {
    fetchIpInfo();
  }, [fetchIpInfo]);

  return {
    query,
    setQuery,
    loading,
    data,
    ip,
    error,
    nowString,
    fetchIpInfo
  };
}
