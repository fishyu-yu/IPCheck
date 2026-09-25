import type { BrowserEnvironment } from '../types';
interface NetworkInfo {
  type?: string;
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}
interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
  connection?: NetworkInfo;
  mozConnection?: NetworkInfo;
  webkitConnection?: NetworkInfo;
}
const unsupported = 'Unsupported by browser';
export function browserEnvironment(): BrowserEnvironment {
  const n = navigator as ExtendedNavigator,
    ua = n.userAgent,
    c = n.connection || n.mozConnection || n.webkitConnection;
  const match = ua.match(/(Edg|OPR)\/([\d.]+)/) || ua.match(/(Firefox|Chrome|Version)\/([\d.]+)/);
  const browser = match
    ? { Edg: 'Edge', OPR: 'Opera', Firefox: 'Firefox', Chrome: 'Chrome', Version: 'Safari' }[match[1]] ||
      'Unknown'
    : 'Unknown';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown';
  return {
    detection: 'Browser-side Detection',
    sections: {
      Browser: {
        'Browser (UA estimate)': browser,
        'Version (reported)': match?.[2] || 'Unknown',
        'Rendering engine (estimate)': /Firefox/.test(ua)
          ? 'Gecko'
          : /Chrome|Edg|OPR/.test(ua)
            ? 'Blink'
            : /AppleWebKit/.test(ua)
              ? 'WebKit'
              : 'Unknown',
        'Operating system (UA estimate)': os,
        Platform: n.platform,
        'Device type (estimate)': /Mobi|Android|iPhone/.test(ua) ? 'Mobile' : 'Desktop / Tablet',
        'User Agent': ua,
      },
      Screen: {
        Resolution: `${screen.width} × ${screen.height}`,
        'Available resolution': `${screen.availWidth} × ${screen.availHeight}`,
        'Pixel ratio': devicePixelRatio,
        'Color depth': screen.colorDepth,
      },
      Locale: {
        Language: n.language,
        Languages: n.languages.join(', '),
        Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        'Timezone offset (minutes)': new Date().getTimezoneOffset(),
      },
      Hardware: {
        'CPU threads': n.hardwareConcurrency || unsupported,
        'Device memory (GiB)': n.deviceMemory ?? unsupported,
        'Touch support': n.maxTouchPoints > 0,
        'Touch points': n.maxTouchPoints,
      },
      Network: {
        'Connection type': c?.type ?? unsupported,
        'Effective type': c?.effectiveType ?? unsupported,
        'RTT (browser estimate, ms)': c?.rtt ?? unsupported,
        'Downlink (browser estimate, Mbps)': c?.downlink ?? unsupported,
        'Save data': c?.saveData ?? unsupported,
      },
    },
  };
}
export function fingerprintEnvironment() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  const data: Record<string, string | number | boolean> = {
    ...browserEnvironment().sections.Locale,
    'User Agent': navigator.userAgent,
    Platform: navigator.platform,
    Screen: `${screen.width} × ${screen.height} @ ${devicePixelRatio}`,
    'WebGL renderer':
      ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'Unavailable / protected',
    'WebGL vendor':
      ext && gl ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : 'Unavailable / protected',
    'Canvas capability': !!document.createElement('canvas').getContext('2d'),
    'Audio capability': typeof AudioContext !== 'undefined',
    'Hardware concurrency': navigator.hardwareConcurrency || unsupported,
    'Device memory': (navigator as ExtendedNavigator).deviceMemory ?? unsupported,
    'Touch points': navigator.maxTouchPoints,
  };
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return data;
}
export async function environmentHash(data: Record<string, unknown>) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      JSON.stringify(
        Object.keys(data)
          .sort()
          .map((k) => [k, data[k]]),
      ),
    ),
  );
  return Array.from(new Uint8Array(bytes))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
