import { useState, useEffect, useCallback } from "react";
import { NormalizedIpInfo } from "@/lib/types";

export function useIpInfo() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NormalizedIpInfo | null>(null);
  const [ip, setIp] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [nowString, setNowString] = useState<string>("");

  const fetchIpInfo = useCallback(async (targetIp?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = targetIp ? `/api/ip?ip=${encodeURIComponent(targetIp)}` : "/api/ip";
      const res = await fetch(url);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json?.error || "请求失败");
      }
      
      setData(json.data);
      setIp(json.ip);
      
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
  }, []);

  const updateTime = (timeZone: string) => {
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
  };

  // Clock effect
  useEffect(() => {
    if (!data?.time_zone) return;
    
    // Initial update
    updateTime(data.time_zone);

    const timer = setInterval(() => {
      updateTime(data.time_zone!);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [data?.time_zone]);

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
