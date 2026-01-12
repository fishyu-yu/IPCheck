"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IpMap } from "@/components/ui/ip-map";
import { NormalizedIpInfo } from "@/lib/types";
import { isPresent } from "@/lib/utils";

interface IpLocationMapProps {
  data: NormalizedIpInfo | null;
}

export function IpLocationMap({ data }: IpLocationMapProps) {
  const coordsPresent = isPresent(data?.coordinates?.lat) && isPresent(data?.coordinates?.lon);

  if (!coordsPresent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <Card className="overflow-hidden border-primary/10 shadow-md bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-primary">位置地图</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[300px] sm:h-[400px] w-full">
            <IpMap lat={data?.coordinates?.lat ?? undefined} lon={data?.coordinates?.lon ?? undefined} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
