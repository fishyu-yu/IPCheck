"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { IpMap } from "@/components/ui/ip-map";

import type { NormalizedIpInfo } from "@/lib/types";



export default function Home() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<NormalizedIpInfo | null>(null);
  const [ip, setIp] = React.useState<string>("");
  const [nowString, setNowString] = React.useState<string>("");

  function isPresent(value: unknown) {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  }

  function toText(value: unknown) {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "是" : "否";
    return String(value);
  }

  async function fetchIpInfo(targetIp?: string) {
    try {
      setLoading(true);
      const url = targetIp ? `/api/ip?ip=${encodeURIComponent(targetIp)}` : "/api/ip";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "请求失败");
      setData(json.data);
      setIp(json.ip);
      // 初始本地时间
      if (json.data?.time_zone) {
        const formatter = new Intl.DateTimeFormat("zh-CN", {
          dateStyle: "medium",
          timeStyle: "medium",
          timeZone: json.data.time_zone,
        });
        setNowString(formatter.format(new Date()));
      } else {
        setNowString("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchIpInfo();
  }, []);

  // 动态更新时间显示（每秒）
  React.useEffect(() => {
    if (!data?.time_zone) return;
    const formatter = new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: data.time_zone,
    });
    const timer = setInterval(() => {
      setNowString(formatter.format(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.time_zone]);

  const coordsPresent = React.useMemo(() => {
    return isPresent(data?.coordinates?.lat) && isPresent(data?.coordinates?.lon);
  }, [data?.coordinates]);

  const coordsLabel = React.useMemo(() => {
    if (!coordsPresent) return "";
    return `${data!.coordinates!.lat}, ${data!.coordinates!.lon}`;
  }, [coordsPresent, data]);

  const mapUrl = React.useMemo(() => {
    if (!coordsPresent) return undefined;
    return `https://www.google.com/maps/search/?api=1&query=${data!.coordinates!.lat},${data!.coordinates!.lon}`;
  }, [coordsPresent, data]);

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      {/* 顶部搜索 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold">IP CHECK</h1>
        <div className="flex-1" />
        <div className="flex w-full sm:w-auto gap-2">
          <Input
            placeholder="输入 IP 地址，如 8.8.8.8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button disabled={loading} onClick={() => fetchIpInfo(query)}>查询</Button>
        </div>
      </div>

      {/* 当前 IP 概览（仅显示有数据的项） */}
      {(() => {
        const items = [
          { label: "国家", value: data?.country },
          { label: "州/地区", value: data?.region },
          { label: "城市", value: data?.city },
          { label: "ISP 提供商", value: data?.isp },
        ].filter((i) => isPresent(i.value));
        if (items.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle>当前查询 IP：{ip}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {items.map((i) => (
                <div key={i.label}>
                  <div className="text-muted-foreground">{i.label}</div>
                  <div className="font-medium">{toText(i.value)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* 地图（有坐标时显示） */}
      {coordsPresent && (
        <Card>
          <CardHeader>
            <CardTitle>位置地图</CardTitle>
          </CardHeader>
          <CardContent>
            <IpMap lat={data?.coordinates?.lat ?? undefined} lon={data?.coordinates?.lon ?? undefined} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 基础信息（仅显示有数据的项） */}
        {(() => {
          const items = [
            { label: "IP地址", value: data?.ip_address },
            { label: "国家", value: data?.country },
            { label: "州/地区", value: data?.region },
            { label: "城市", value: data?.city },
            { label: "城市坐标", value: coordsLabel, link: mapUrl, present: coordsPresent },
            { label: "ISP提供商", value: data?.isp },
            { label: "时区", value: data?.time_zone },
            { label: "本地时间", value: data?.time_zone ? nowString : "" },
            { label: "域名", value: data?.domain },
          ].filter((i) => ("present" in i ? i.present : isPresent(i.value)));
          if (items.length === 0) return null;
          return (
            <Card>
              <CardHeader>
                <CardTitle>基础信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {items.map((i) => (
                  <Field key={i.label} label={i.label} value={toText(i.value)} link={"link" in i ? i.link : undefined} />
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* 网络信息（仅显示有数据的项） */}
        {(() => {
          const items = [
            { label: "网络速度", value: data?.net_speed },
            { label: "国际拨号代码和区号", value: data?.idd_code },
            { label: "邮政编码", value: data?.zip_code },
            { label: "使用类型", value: data?.usage_type },
            { label: "地址类型", value: data?.address_type },
            { label: "ASN", value: data?.asn },
            { label: "AS域名", value: data?.as_domain },
            { label: "AS CIDR", value: data?.as_cidr },
            { label: "AS使用类型", value: data?.as_usage_type },
          ].filter((i) => isPresent(i.value));
          if (items.length === 0) return null;
          return (
            <Card>
              <CardHeader>
                <CardTitle>网络信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {items.map((i) => (
                  <Field key={i.label} label={i.label} value={toText(i.value)} />
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* 位置详情（仅显示有数据的项） */}
        {(() => {
          const items = [
            { label: "行政区", value: data?.district },
            { label: "海拔", value: data?.elevation },
            { label: "气象站", value: data?.weather_station },
          ].filter((i) => isPresent(i.value));
          if (items.length === 0) return null;
          return (
            <Card>
              <CardHeader>
                <CardTitle>位置详情</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {items.map((i) => (
                  <Field key={i.label} label={i.label} value={toText(i.value)} />
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* 安全信息（仅显示有数据的项；布尔值按存在显示） */}
        {(() => {
          const items = [
            { label: "欺诈评分", value: data?.fraud_score },
            { label: "是否为代理", value: data?.is_proxy },
            { label: "代理类型", value: data?.proxy_type },
            { label: "代理ASN", value: data?.proxy_asn },
            { label: "代理最后出现时间", value: data?.proxy_last_seen },
            { label: "代理提供商", value: data?.proxy_provider },
          ].filter((i) => isPresent(i.value));
          if (items.length === 0) return null;
          return (
            <Card>
              <CardHeader>
                <CardTitle>安全信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {items.map((i) => (
                  <Field key={i.label} label={i.label} value={toText(i.value)} />
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* 移动信息（仅显示有数据的项） */}
        {(() => {
          const items = [
            { label: "移动运营商", value: data?.mobile_carrier },
            { label: "移动国家代码", value: data?.mobile_country_code },
            { label: "移动网络代码", value: data?.mobile_network_code },
          ].filter((i) => isPresent(i.value));
          if (items.length === 0) return null;
          return (
            <Card>
              <CardHeader>
                <CardTitle>移动信息（如适用）</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {items.map((i) => (
                  <Field key={i.label} label={i.label} value={toText(i.value)} />
                ))}
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: string }) {
  const content = (
    <div className="font-medium break-words">
      {value}
    </div>
  );
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      {link && value !== "-" ? (
        <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}