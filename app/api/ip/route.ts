import { NextResponse } from "next/server";
import type { NormalizedIpInfo } from "@/lib/types";
import { getClientIp, isPrivateIp } from "@/lib/ip-helper";

// ipwho.is 响应类型（仅列出使用到的字段）
type IpWhoResponse = {
  success?: boolean;
  message?: string;
  ip?: string;
  type?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  postal?: string;
  district?: string;
  timezone?: {
    id?: string;
    current_time?: string;
  };
  connection?: {
    isp?: string;
    domain?: string;
    asn?: string;
    org?: string;
  };
  security?: {
    is_proxy?: boolean;
    proxy_type?: string;
  };
};

async function fetchIpInfo(ip: string): Promise<IpWhoResponse> {
  const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`ipwho.is 请求失败: ${res.status}`);
  const data = await res.json();
  return data;
}

function normalize(ipwho: IpWhoResponse): NormalizedIpInfo {
  const tz = ipwho?.timezone;
  const conn = ipwho?.connection;
  const sec = ipwho?.security;
  return {
    // 基础信息
    ip_address: ipwho?.ip ?? null,
    country: ipwho?.country ?? null,
    region: ipwho?.region ?? null,
    city: ipwho?.city ?? null,
    coordinates: { lat: ipwho?.latitude ?? null, lon: ipwho?.longitude ?? null },
    isp: conn?.isp ?? null,
    time_zone: tz?.id ?? null,
    local_time: tz?.current_time ?? null,
    domain: conn?.domain ?? null,
    // 网络信息（部分字段来源缺失，置空）
    net_speed: null,
    idd_code: null,
    zip_code: ipwho?.postal ?? null,
    usage_type: null,
    address_type: ipwho?.type ?? null,
    asn: conn?.asn ?? null,
    as_domain: conn?.org ?? null,
    as_cidr: null,
    as_usage_type: null,
    // 位置详情
    district: ipwho?.district ?? null,
    elevation: null,
    weather_station: null,
    // 安全信息
    fraud_score: null,
    is_proxy: typeof sec?.is_proxy === "boolean" ? sec.is_proxy : null,
    proxy_type: sec?.proxy_type ?? null,
    proxy_asn: null,
    proxy_last_seen: null,
    proxy_provider: null,
    // 移动信息
    mobile_carrier: null,
    mobile_country_code: null,
    mobile_network_code: null,
  };
}

export async function GET(req: Request) {
  const requestId = Math.random().toString(36).substring(7);
  try {
    const { searchParams } = new URL(req.url);
    let ip = searchParams.get("ip");

    // 日志记录：记录原始请求头以便调试
    console.log(`[${requestId}] Incoming request headers:`, {
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
      'cf-connecting-ip': req.headers.get('cf-connecting-ip'),
      'x-real-ip': req.headers.get('x-real-ip'),
      'ali-cdn-real-ip': req.headers.get('ali-cdn-real-ip'),
      'x-client-ip': req.headers.get('x-client-ip')
    });

    if (!ip) {
      ip = getClientIp(req);
      console.log(`[${requestId}] Resolved Client IP: ${ip}`);
    } else {
      console.log(`[${requestId}] User provided IP: ${ip}`);
    }

    // 若 IP 缺失或为保留/私有地址，则使用公网 IP 兜底
    async function getPublicIp(): Promise<string | ""> {
      try {
        const ipifyRes = await fetch("https://api.ipify.org?format=json", { next: { revalidate: 60 } });
        const ipify = await ipifyRes.json();
        return ipify?.ip || "";
      } catch (e) {
        console.error(`[${requestId}] Failed to fetch public IP fallback`, e);
        return "";
      }
    }

    if (!ip || isPrivateIp(ip)) {
      console.log(`[${requestId}] IP is missing or private (${ip}), fetching public IP fallback...`);
      ip = await getPublicIp();
      console.log(`[${requestId}] Fallback IP: ${ip}`);
    }

    if (!ip) {
      return NextResponse.json({ error: "无法确定访问者 IP" }, { status: 400 });
    }

    let raw: IpWhoResponse = await fetchIpInfo(ip);
    
    // 如果返回保留地址错误，再尝试一次公网 IP (以防万一上一步没过滤干净)
    if (raw?.success === false) {
      const msg = String(raw?.message || "");
      if (/reserved range/i.test(msg)) {
        console.log(`[${requestId}] ipwho.is returned reserved range error, retrying with public IP...`);
        const pub = await getPublicIp();
        if (pub && pub !== ip) {
          ip = pub;
          raw = await fetchIpInfo(ip);
        }
      }
      
      if (raw?.success === false) {
        return NextResponse.json({ error: raw?.message || "查询失败" }, { status: 400 });
      }
    }

    const data = normalize(raw);
    return NextResponse.json({ ip, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${requestId}] Error processing request:`, err);
    return NextResponse.json({ error: message || "服务器错误" }, { status: 500 });
  }
}
