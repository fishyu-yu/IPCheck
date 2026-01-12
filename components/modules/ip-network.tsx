"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NormalizedIpInfo } from "@/lib/types";
import { isPresent, toText } from "@/lib/utils";

interface IpNetworkProps {
  data: NormalizedIpInfo | null;
}

export function IpNetwork({ data }: IpNetworkProps) {
  if (!data) return null;

  const items = [
    { label: "网络速度", value: data.net_speed },
    { label: "国际区号", value: data.idd_code },
    { label: "邮政编码", value: data.zip_code },
    { label: "使用类型", value: data.usage_type },
    { label: "地址类型", value: data.address_type },
    { label: "ASN", value: data.asn },
    { label: "AS域名", value: data.as_domain },
    { label: "AS CIDR", value: data.as_cidr },
    { label: "AS使用类型", value: data.as_usage_type },
  ].filter((i) => isPresent(i.value));

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="h-full"
    >
      <Card className="h-full border-primary/10 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-primary">网络详情</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {items.map((item, index) => (
              <motion.div 
                key={item.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-medium text-muted-foreground min-w-[100px]">
                  {item.label}
                </span>
                <span className="font-mono text-sm mt-1 sm:mt-0 text-right break-all">
                  {toText(item.value)}
                </span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
