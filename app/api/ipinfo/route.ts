import { NextResponse } from "next/server";

// 参考 ipinfo 样本返回格式
// {
//   "ip": "148.135.184.45",
//   "city": "Salt Lake City",
//   "region": "Utah",
//   "country": "US",
//   "loc": "40.7371,-111.8258",
//   "org": "AS63150 BAGE CLOUD LLC",
//   "postal": "84108",
//   "timezone": "America/Denver",
//   "readme": "https://ipinfo.io/missingauth"
// }

type IpInfoLike = {
  ip: string;
  city: string;
  region: string;
  country: string; // ISO-2
  loc: string; // "lat,lon"
  org: string;
  postal: string;
  timezone: string;
  readme: string;
};

type IpWhoResponse = {
  success?: boolean;
  message?: string;
  ip?: string;
  type?: string;
  country?: string;
  country_code?: string;
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

function nowNs(): bigint {
  // 高精度计时
  return typeof process !== "undefined" && (process as any).hrtime ? (process as any).hrtime.bigint() : BigInt(Date.now()) * BigInt(1e6);
}

function msSince(start: bigint): number {
  const end = nowNs();
  return Number((end - start) / BigInt(1e6));
}

function getClientIpFromHeaders(req: Request): string | null {
  const forwarded =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip");
  if (!forwarded) return null;
  const first = forwarded.split(",")[0].trim();
  return first || null;
}

function isReservedIp(ip: string): boolean {
  if (!ip) return true;
  const v6 = ip.includes(":");
  if (v6) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("::");
  }
  const parts = ip.split(".").map((x) => parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function isValidIp(ip: string): boolean {
  if (!ip) return false;
  if (ip.includes(":")) {
    // 简单 IPv6 结构检查
    return /^(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i.test(ip) || ip === "::1";
  }
  const parts = ip.split(".").map((x) => Number(x));
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
}

async function fetchIpWho(ip: string): Promise<IpWhoResponse> {
  const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`ipwho.is 请求失败: ${res.status}`);
  return res.json();
}

async function getPublicIp(): Promise<string> {
  const ipifyRes = await fetch("https://api.ipify.org?format=json", { next: { revalidate: 60 } });
  const ipify = await ipifyRes.json().catch(() => ({}));
  return ipify?.ip || "";
}

function toCountryCode(code?: string, name?: string): string {
  if (code && /^[A-Z]{2}$/i.test(code)) return code.toUpperCase();
  // 尝试从名称映射（简单回退，不保证完整）
  const m: Record<string, string> = { "United States": "US", China: "CN", Japan: "JP", Germany: "DE" };
  return (name && m[name]) || "";
}

function toLoc(lat?: number, lon?: number): string {
  if (typeof lat === "number" && typeof lon === "number" && isFinite(lat) && isFinite(lon)) {
    return `${lat},${lon}`;
  }
  return "";
}

function toOrg(conn?: IpWhoResponse["connection"]): string {
  const rawAsn = conn?.asn as unknown;
  const asnStr = rawAsn == null ? "" : String(rawAsn);
  const asn = asnStr ? (asnStr.toUpperCase().startsWith("AS") ? asnStr : `AS${asnStr}`) : "";
  const org = conn?.org || conn?.isp || "";
  const joined = `${asn} ${org}`.trim();
  return joined || "";
}

function validateResult(r: IpInfoLike): IpInfoLike {
  // 保证所有字段为字符串并存在（若缺失则为空串）
  return {
    ip: r.ip || "",
    city: r.city || "",
    region: r.region || "",
    country: r.country || "",
    loc: r.loc || "",
    org: r.org || "",
    postal: r.postal || "",
    timezone: r.timezone || "",
    readme: r.readme || "https://ipinfo.io/missingauth",
  };
}

function log(kind: string, payload: Record<string, unknown>) {
  try {
    console.info(`[api/ipinfo] ${kind}`, JSON.stringify(payload));
  } catch {}
}

export async function GET(req: Request) {
  const started = nowNs();
  const reqId = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let status = 200;
  try {
    const { searchParams } = new URL(req.url);
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    const isCurlUA = ua.includes("curl/");
    const omitReadme = isCurlUA || ["1", "true", "yes"].includes((searchParams.get("omit_readme") || "").toLowerCase());
    const qIp = searchParams.get("ip") || "";
    const headerIp = getClientIpFromHeaders(req) || "";
    let ip = qIp && isValidIp(qIp) ? qIp : headerIp;

    if (!ip || isReservedIp(ip)) {
      ip = await getPublicIp();
    }
    if (!ip) {
      status = 400;
      const err = { code: "IP_NOT_FOUND", message: "无法确定访问者 IP", requestId: reqId };
      log("error", { ...err, durationMs: msSince(started) });
      return NextResponse.json(err, { status, headers: { "x-request-id": reqId, "x-response-time-ms": String(msSince(started)) } });
    }

    let raw = await fetchIpWho(ip);
    if (raw?.success === false) {
      const msg = String(raw?.message || "");
      if (/reserved range/i.test(msg)) {
        const pub = await getPublicIp();
        if (pub) raw = await fetchIpWho(pub);
      }
      if (raw?.success === false) {
        status = 400;
        const err = { code: "LOOKUP_FAILED", message: raw?.message || "查询失败", requestId: reqId };
        log("error", { ...err, durationMs: msSince(started) });
        return NextResponse.json(err, { status, headers: { "x-request-id": reqId, "x-response-time-ms": String(msSince(started)) } });
      }
    }

    const r: IpInfoLike = {
      ip: raw?.ip || ip,
      city: raw?.city || "",
      region: raw?.region || "",
      country: toCountryCode(raw?.country_code, raw?.country),
      loc: toLoc(raw?.latitude, raw?.longitude),
      org: toOrg(raw?.connection),
      postal: raw?.postal || "",
      timezone: raw?.timezone?.id || "",
      readme: "https://ipinfo.io/missingauth",
    };

    const result = validateResult(r);
    const duration = msSince(started);
    log("ok", { ip: result.ip, requestId: reqId, durationMs: duration });
    const { readme, ...minimal } = result as any;
    const payload = omitReadme ? minimal : result;
    const pretty = isCurlUA || ["1", "true", "yes"].includes((searchParams.get("pretty") || "").toLowerCase());
    const headers = {
      "x-request-id": reqId,
      "x-response-time-ms": String(duration),
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    } as const;
    if (pretty) {
      return new NextResponse(JSON.stringify(payload, null, 2) + "\n", { status, headers });
    }
    return NextResponse.json(payload, { status, headers });
  } catch (e: unknown) {
    status = 500;
    const msg = e instanceof Error ? e.message : String(e);
    const err = { code: "SERVER_ERROR", message: msg, requestId: reqId };
    log("error", { ...err, durationMs: msSince(started) });
    return NextResponse.json(err, { status, headers: { "x-request-id": reqId, "x-response-time-ms": String(msSince(started)) } });
  }
}