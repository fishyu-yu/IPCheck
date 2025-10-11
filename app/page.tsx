"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type IPData = {
  ip_address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  coordinates: { lat: number | null; lon: number | null };
  isp: string | null;
  time_zone: string | null;
  local_time: string | null;
  domain: string | null;
  net_speed: string | null;
  idd_code: string | null;
  zip_code: string | null;
  usage_type: string | null;
  address_type: string | null;
  asn: string | null;
  as_domain: string | null;
  as_cidr: string | null;
  as_usage_type: string | null;
  district: string | null;
  elevation: number | null;
  weather_station: string | null;
  fraud_score: number | null;
  is_proxy: boolean | null;
  proxy_type: string | null;
  proxy_asn: string | null;
  proxy_last_seen: string | null;
  proxy_provider: string | null;
  mobile_carrier: string | null;
  mobile_country_code: string | null;
  mobile_network_code: string | null;
};

export default function Home() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<IPData | null>(null);
  const [ip, setIp] = React.useState<string>("");
  const [nowString, setNowString] = React.useState<string>("");

  function display(value: unknown) {
    if (value === null || value === undefined || value === "") return "-";
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

  const coordsLabel = React.useMemo(() => {
    if (!data?.coordinates?.lat || !data?.coordinates?.lon) return "-";
    return `${data.coordinates.lat}, ${data.coordinates.lon}`;
  }, [data?.coordinates]);

  const mapUrl = React.useMemo(() => {
    if (!data?.coordinates?.lat || !data?.coordinates?.lon) return undefined;
    return `https://www.google.com/maps/search/?api=1&query=${data.coordinates.lat},${data.coordinates.lon}`;
  }, [data?.coordinates]);

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

      {/* 当前 IP 概览 */}
      <Card>
        <CardHeader>
          <CardTitle>当前查询 IP：{ip || "-"}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">国家</div>
            <div className="font-medium">{display(data?.country)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">州/地区</div>
            <div className="font-medium">{display(data?.region)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">城市</div>
            <div className="font-medium">{display(data?.city)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">ISP 提供商</div>
            <div className="font-medium">{display(data?.isp)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 基础信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="IP地址" value={display(data?.ip_address)} />
            <Field label="国家" value={display(data?.country)} />
            <Field label="州/地区" value={display(data?.region)} />
            <Field label="城市" value={display(data?.city)} />
            <Field label="城市坐标" value={coordsLabel} link={mapUrl} />
            <Field label="ISP提供商" value={display(data?.isp)} />
            <Field label="时区" value={display(data?.time_zone)} />
            <Field label="本地时间" value={data?.time_zone ? nowString : "-"} />
            <Field label="域名" value={display(data?.domain)} />
          </CardContent>
        </Card>

        {/* 网络信息 */}
        <Card>
          <CardHeader>
            <CardTitle>网络信息</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="网络速度" value={display(data?.net_speed)} />
            <Field label="国际拨号代码和区号" value={display(data?.idd_code)} />
            <Field label="邮政编码" value={display(data?.zip_code)} />
            <Field label="使用类型" value={display(data?.usage_type)} />
            <Field label="地址类型" value={display(data?.address_type)} />
            <Field label="ASN" value={display(data?.asn)} />
            <Field label="AS域名" value={display(data?.as_domain)} />
            <Field label="AS CIDR" value={display(data?.as_cidr)} />
            <Field label="AS使用类型" value={display(data?.as_usage_type)} />
          </CardContent>
        </Card>

        {/* 位置详情 */}
        <Card>
          <CardHeader>
            <CardTitle>位置详情</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="行政区" value={display(data?.district)} />
            <Field label="海拔" value={display(data?.elevation)} />
            <Field label="气象站" value={display(data?.weather_station)} />
          </CardContent>
        </Card>

        {/* 安全信息 */}
        <Card>
          <CardHeader>
            <CardTitle>安全信息</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="欺诈评分" value={display(data?.fraud_score)} />
            <Field label="是否为代理" value={display(data?.is_proxy)} />
            <Field label="代理类型" value={display(data?.proxy_type)} />
            <Field label="代理ASN" value={display(data?.proxy_asn)} />
            <Field label="代理最后出现时间" value={display(data?.proxy_last_seen)} />
            <Field label="代理提供商" value={display(data?.proxy_provider)} />
          </CardContent>
        </Card>

        {/* 移动信息 */}
        <Card>
          <CardHeader>
            <CardTitle>移动信息（如适用）</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="移动运营商" value={display(data?.mobile_carrier)} />
            <Field label="移动国家代码" value={display(data?.mobile_country_code)} />
            <Field label="移动网络代码" value={display(data?.mobile_network_code)} />
          </CardContent>
        </Card>
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
