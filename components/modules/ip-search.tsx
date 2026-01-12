"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/mode-toggle";

interface IpSearchProps {
  query: string;
  setQuery: (val: string) => void;
  onSearch: () => void;
  loading: boolean;
}

export function IpSearch({ query, setQuery, onSearch, loading }: IpSearchProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-4 sm:flex-row sm:items-center bg-card/50 backdrop-blur-sm p-4 rounded-xl border border-border/50 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          <Search className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">IP CHECK</h1>
      </div>
      
      <div className="flex-1" />
      
      <div className="flex w-full sm:w-auto gap-2 items-center">
        <Input
          className="bg-background/50 border-primary/20 focus-visible:ring-primary/30 transition-all"
          placeholder="输入 IP 地址 (如 8.8.8.8)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
        <Button 
          disabled={loading} 
          onClick={onSearch}
          className="bg-primary hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
        >
          {loading ? "查询中..." : "查询"}
        </Button>
        <ModeToggle />
      </div>
    </motion.div>
  );
}
