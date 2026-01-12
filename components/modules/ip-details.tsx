"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NormalizedIpInfo } from "@/lib/types";
import { isPresent, toText } from "@/lib/utils";

interface IpDetailsProps {
  data: NormalizedIpInfo | null;
  coordsLabel: string;
  mapUrl?: string;
  nowString: string;
}

export function IpDetails({ data, coordsLabel, mapUrl, nowString }: IpDetailsProps) {
  if (!data) return null;

  const items = [
    { label: "IP地址", value: data.ip_address },
    { label: "国家", value: data.country },
    { label: "州/地区", value: data.region },
    { label: "城市", value: data.city },
    { label: "坐标", value: coordsLabel, link: mapUrl },
    { label: "ISP", value: data.isp },
    { label: "时区", value: data.time_zone },
    { label: "本地时间", value: data.time_zone ? nowString : "" },
    { label: "域名", value: data.domain },
  ].filter((i) => isPresent(i.value));

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="h-full"
    >
      <Card className="h-full border-primary/10 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-primary">基础信息</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {items.map((item, index) => (
              <motion.div 
                key={item.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-medium text-muted-foreground min-w-[100px]">
                  {item.label}
                </span>
                <div className="flex items-center gap-2 mt-1 sm:mt-0 text-right font-medium">
                  <span className="break-all">{toText(item.value)}</span>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
