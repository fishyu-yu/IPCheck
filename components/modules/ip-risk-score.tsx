"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getIcon = (score: number) => {
    if (score >= 80) return <ShieldCheck className="w-6 h-6 text-green-500" />;
    if (score >= 50) return <Shield className="w-6 h-6 text-yellow-500" />;
    return <ShieldAlert className="w-6 h-6 text-red-500" />;
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
                    <div className={`text-2xl font-bold ${getScoreColor(data.score)}`}>
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
                  className={`h-full ${getScoreBg(data.score)}`}
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
