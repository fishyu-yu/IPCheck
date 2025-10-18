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
  if (typeof process !== "undefined" && typeof process.hrtime?.bigint === "function") {
    return process.hrtime.bigint();
  }
  return BigInt(Date.now()) * BigInt(1e6);
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

type JsonObject = Record<string, unknown>;

async function fetchJsonWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<JsonObject> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const timer: ReturnType<typeof setTimeout> | null = controller ? setTimeout(() => controller!.abort(), timeoutMs) : null;
  try {
    const nextOpts = (opts as { next?: { revalidate?: number } }).next ?? { revalidate: 60 };
    const res = await fetch(url, {
      ...opts,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPCheck/1.0",
        ...(opts.headers || {}),
      },
      signal: controller ? controller.signal : undefined,
      next: nextOpts,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as JsonObject;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchIpWho(ip: string): Promise<IpWhoResponse> {
  try {
    const data = await fetchJsonWithTimeout(`https://ipwho.is/${encodeURIComponent(ip)}`);
    return data as IpWhoResponse;
  } catch {
    // 备用数据源：ipapi.co
    const alt = await fetchJsonWithTimeout(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    const tz = typeof alt.timezone === "string" ? { id: String(alt.timezone), current_time: undefined } : undefined;
    const conn = {
      isp: typeof alt.org === "string" ? String(alt.org) : undefined,
      domain: undefined,
      asn: typeof alt.asn === "string" ? String(alt.asn) : undefined,
      org: typeof alt.org === "string" ? String(alt.org) : undefined,
    };
    return {
      success: true,
      ip: typeof alt.ip === "string" ? String(alt.ip) : ip,
      type: typeof alt.version === "string" ? String(alt.version) : undefined,
      country: typeof alt.country_name === "string" ? String(alt.country_name) : undefined,
      country_code: typeof alt.country === "string" ? String(alt.country) : undefined,
      region: typeof alt.region === "string" ? String(alt.region) : undefined,
      city: typeof alt.city === "string" ? String(alt.city) : undefined,
      latitude: typeof alt.latitude === "number" ? (alt.latitude as number) : undefined,
      longitude: typeof alt.longitude === "number" ? (alt.longitude as number) : undefined,
      postal: typeof alt.postal === "string" ? String(alt.postal) : undefined,
      timezone: tz,
      connection: conn,
    };
  }
}

async function getPublicIp(): Promise<string> {
  try {
    const ipify = await fetchJsonWithTimeout("https://api.ipify.org?format=json");
    const v = typeof ipify.ip === "string" ? (ipify.ip as string) : "";
    if (v) return v;
  } catch {}
  try {
    const ipapi = await fetchJsonWithTimeout("https://ipapi.co/json/");
    const v = typeof ipapi.ip === "string" ? (ipapi.ip as string) : "";
    return v;
  } catch {}
  return "";
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
  const reqId =
    typeof globalThis.crypto !== "undefined" &&
    typeof (globalThis.crypto as Crypto).randomUUID === "function"
      ? (globalThis.crypto as Crypto).randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    const payload: IpInfoLike | Omit<IpInfoLike, "readme"> = omitReadme
      ? {
          ip: result.ip,
          city: result.city,
          region: result.region,
          country: result.country,
          loc: result.loc,
          org: result.org,
          postal: result.postal,
          timezone: result.timezone,
        }
      : result;
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