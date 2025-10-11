import { NextResponse } from "next/server";

type NormalizedIpInfo = {
  // 基础信息
  ip_address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  coordinates: { lat: number | null; lon: number | null };
  isp: string | null;
  time_zone: string | null;
  local_time: string | null;
  domain: string | null;
  // 网络信息
  net_speed: string | null;
  idd_code: string | null;
  zip_code: string | null;
  usage_type: string | null;
  address_type: string | null;
  asn: string | null;
  as_domain: string | null;
  as_cidr: string | null;
  as_usage_type: string | null;
  // 位置详情
  district: string | null;
  elevation: number | null;
  weather_station: string | null;
  // 安全信息
  fraud_score: number | null;
  is_proxy: boolean | null;
  proxy_type: string | null;
  proxy_asn: string | null;
  proxy_last_seen: string | null;
  proxy_provider: string | null;
  // 移动信息
  mobile_carrier: string | null;
  mobile_country_code: string | null;
  mobile_network_code: string | null;
};

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

function getClientIpFromHeaders(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  if (!forwarded) return null;
  // x-forwarded-for 可能包含多个 IP，以逗号分隔，取第一个
  const first = forwarded.split(",")[0].trim();
  return first || null;
}

function isReservedIp(ip: string): boolean {
  // 粗略判断常见保留/私有地址段
  if (!ip) return true;
  const v6 = ip.includes(":");
  if (v6) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fe80:") || // 链路本地
      lower.startsWith("fc") || lower.startsWith("fd") || // ULA
      lower.startsWith("::") // 未指定
    );
  }
  // IPv4 判断
  const parts = ip.split(".").map((x) => parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // 127/8 回环
  if (a === 0) return true; // 未指定
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 169 && b === 254) return true; // 链路本地
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 基准测试
  return false;
}

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
  try {
    const { searchParams } = new URL(req.url);
    let ip = searchParams.get("ip");

    if (!ip) {
      ip = getClientIpFromHeaders(req);
    }

    // 若 IP 缺失或为保留/私有地址，则使用公网 IP 兜底
    async function getPublicIp(): Promise<string | ""> {
      const ipifyRes = await fetch("https://api.ipify.org?format=json", { next: { revalidate: 60 } });
      const ipify = await ipifyRes.json().catch(() => ({}));
      return ipify?.ip || "";
    }

    if (!ip || isReservedIp(ip)) {
      ip = await getPublicIp();
    }

    if (!ip) {
      return NextResponse.json({ error: "无法确定访问者 IP" }, { status: 400 });
    }

    let raw: IpWhoResponse = await fetchIpInfo(ip);
    if (raw?.success === false) {
      // 如果返回保留地址错误，再尝试一次公网 IP
      const msg = String(raw?.message || "");
      if (/reserved range/i.test(msg)) {
        const pub = await getPublicIp();
        if (pub) {
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
    return NextResponse.json({ error: message || "服务器错误" }, { status: 500 });
  }
}