import { type NextRequest } from 'next/server';

/**
 * 验证 IP 地址格式是否合法 (IPv4 或 IPv6)
 */
export function isValidIp(ip: string): boolean {
  // IPv4 正则
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // 简化的 IPv6 正则 (足够覆盖常见情况)
  // 支持:
  // 1. 完整形式: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
  // 2. 压缩形式: 2001:db8::1, ::1, ::
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,7}|:):(([0-9a-fA-F]{1,4}:){0,7}|:)$/;
  
  if (ipv4Regex.test(ip)) {
    return ip.split('.').every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // 对于 IPv6，简单的正则很难完美覆盖所有压缩形式 (如 ::1)
  // 这里使用更宽松的检查配合 Node.js 内置模块（如果是 Node 环境）
  // 但为了浏览器兼容性，我们优化正则表达式
  // 支持 ::1, 2001::1 等常见压缩格式
  const ipv6CompressedRegex = /^(([0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{1,4})?::(([0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{1,4})?$/;
  const ipv6Loopback = /^::1$/;
  const ipv6Unspecified = /^::$/;
  
  return ipv6Regex.test(ip) || ipv6CompressedRegex.test(ip) || ipv6Loopback.test(ip) || ipv6Unspecified.test(ip);
}

/**
 * 判断是否为私有 IP 或保留 IP
 */
export function isPrivateIp(ip: string): boolean {
  if (!isValidIp(ip)) return false;

  // IPv6 本地回环/链路本地/ULA
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' || 
      lower.startsWith('fe80:') || 
      lower.startsWith('fc') || 
      lower.startsWith('fd') ||
      lower === '::'
    );
  }

  // IPv4 私有段
  const parts = ip.split('.').map(Number);
  const [a, b] = parts;
  
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  
  return false;
}

/**
 * 获取客户端真实 IP
 * 优先顺序:
 * 1. Cloudflare (CF-Connecting-IP)
 * 2. Standard Forwarded (X-Forwarded-For) - 取第一个非私有 IP
 * 3. Real IP (X-Real-IP)
 * 4. Vercel / Next.js 特定头 (x-vercel-forwarded-for 等)
 */
export function getClientIp(req: Request | NextRequest): string | null {
  const headers = req.headers;

  // 1. Cloudflare
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp && isValidIp(cfIp)) return cfIp;

  // 2. X-Forwarded-For
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // 可能包含多个 IP: "client, proxy1, proxy2"
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    
    // 遍历寻找第一个非私有 IP
    for (const ip of ips) {
      if (isValidIp(ip) && !isPrivateIp(ip)) {
        return ip;
      }
    }
    
    // 如果全是私有 IP (如内网测试)，返回第一个合法的
    if (ips.length > 0 && isValidIp(ips[0])) {
      return ips[0];
    }
  }

  // 3. X-Real-IP (Nginx 等常用)
  const realIp = headers.get('x-real-ip');
  if (realIp && isValidIp(realIp)) return realIp;

  // 4. AliCDN / Tencent CDN Specific Headers
  // 阿里云 CDN 通常也会透传 X-Forwarded-For，但也可能有 Ali-CDN-Real-IP
  const aliRealIp = headers.get('ali-cdn-real-ip');
  if (aliRealIp && isValidIp(aliRealIp)) return aliRealIp;

  // 腾讯云 CDN
  const tencentRealIp = headers.get('x-client-ip'); // 部分腾讯云配置会用这个
  if (tencentRealIp && isValidIp(tencentRealIp)) return tencentRealIp;

  return null;
}
