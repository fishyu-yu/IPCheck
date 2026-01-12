"use client";

import { motion } from "framer-motion";
import { Globe, MapPin, Building2, Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NormalizedIpInfo } from "@/lib/types";

interface IpOverviewProps {
  data: NormalizedIpInfo | null;
  ip: string;
}

export function IpOverview({ data, ip }: IpOverviewProps) {
  if (!data) return null;

  const items = [
    { label: "国家", value: data.country, icon: Globe, color: "text-blue-500" },
    { label: "区域", value: data.region, icon: MapPin, color: "text-green-500" },
    { label: "城市", value: data.city, icon: Building2, color: "text-orange-500" },
    { label: "ISP", value: data.isp, icon: Network, color: "text-purple-500" },
  ].filter(i => i.value);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="overflow-hidden border-primary/10 shadow-md hover:shadow-lg transition-shadow bg-card/80 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            当前查询 IP：
            <span className="font-mono text-primary">{ip}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          {items.map((item, index) => (
            <motion.div 
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className={`p-2 rounded-md bg-muted ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {item.label}
                </div>
                <div className="font-semibold text-foreground/90 leading-tight">
                  {item.value}
                </div>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
