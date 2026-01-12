"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Shield, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IpRiskScoreProps {
  ip: string;
}

interface RiskData {
  score: number;
  risk_level: string;
  source: string;
}

export function IpRiskScore({ ip }: IpRiskScoreProps) {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ip) return;

    const fetchRisk = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/risk?ip=${ip}`);
        if (!res.ok) throw new Error("Failed to fetch risk score");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError("无法获取评分");
      } finally {
        setLoading(false);
      }
    };

    fetchRisk();
  }, [ip]);

  if (!ip) return null;

  // 0-20分：深红色（#d62728）
  // 21-40分：橙色（#ff7f0e）
  // 41-60分：黄色（#f7e600）
  // 61-80分：浅绿色（#7fdb6a）
  // 81-100分：深绿色（#2ca02c）

  const getColorClass = (score: number, type: 'text' | 'bg') => {
    let color = "";
    if (score <= 20) color = "#d62728";
    else if (score <= 40) color = "#ff7f0e";
    else if (score <= 60) color = "#f7e600";
    else if (score <= 80) color = "#7fdb6a";
    else color = "#2ca02c";

    return type === 'text' ? `text-[${color}]` : `bg-[${color}]`;
  };

  // 由于 Tailwind 动态类名无法被扫描到，我们需要使用 style 属性或者返回完整的类名
  // 这里使用 style 属性来确保颜色准确，同时保留 Tailwind 的工具类
  const getColorStyle = (score: number) => {
    if (score <= 20) return "#d62728";
    if (score <= 40) return "#ff7f0e";
    if (score <= 60) return "#f7e600";
    if (score <= 80) return "#7fdb6a";
    return "#2ca02c";
  };

  const getIcon = (score: number) => {
    const color = getColorStyle(score);
    const style = { color };
    
    if (score <= 40) return <ShieldAlert className="w-6 h-6" style={style} />;
    if (score <= 60) return <Shield className="w-6 h-6" style={style} />;
    return <ShieldCheck className="w-6 h-6" style={style} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="border-primary/10 shadow-sm bg-card/80 backdrop-blur-sm h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            <span>IP 纯净度评估 (Cloudflare)</span>
            {loading && <span className="text-xs animate-pulse">评估中...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-red-500 text-sm">{error}</div>
          ) : data ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getIcon(data.score)}
                  <div>
                    <div 
                      className="text-2xl font-bold"
                      style={{ color: getColorStyle(data.score) }}
                    >
                      {data.score}
                      <span className="text-sm text-muted-foreground ml-1">/ 100</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      风险等级: {data.risk_level}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div 
                  className="h-full"
                  style={{ backgroundColor: getColorStyle(data.score) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${data.score}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              
              <div className="text-xs text-muted-foreground text-right">
                数据来源: {data.source}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
