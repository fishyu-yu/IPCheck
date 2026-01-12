"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface IpCoordinatesProps {
  lat?: number | null;
  lon?: number | null;
  onRefresh: () => void;
}

export function IpCoordinates({ lat, lon, onRefresh }: IpCoordinatesProps) {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onRefresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRefresh]);

  if (lat === undefined || lon === undefined || lat === null || lon === null) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-6 text-sm font-medium">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">经度:</span>
                <span className="font-mono text-primary">{lon.toFixed(6)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">纬度:</span>
                <span className="font-mono text-primary">{lat.toFixed(6)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
            <span>{timeLeft}s 后刷新</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs ml-2 hover:bg-primary/10"
              onClick={() => {
                onRefresh();
                setTimeLeft(30);
              }}
            >
              立即刷新
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
