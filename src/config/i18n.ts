import { zh } from './zh';
export type Locale = 'zh' | 'en';
export function detectLocale(language: string): Locale {
  return /^zh(?:[-_]|$)/i.test(language) ? 'zh' : 'en';
}
// Use the primary preference, not any secondary Chinese language in the list.
export const locale = detectLocale(
  typeof navigator === 'undefined' ? 'en' : navigator.languages?.[0] || navigator.language,
);
export function translate(text: string, language: Locale = locale): string {
  if (language !== 'zh') return text;
  const key = text.trim().replace(/\s+/g, ' ');
  if (zh[key]) return text.replace(text.trim(), zh[key]);
  if (key.includes(' · '))
    return text
      .split(' · ')
      .map((part) => translate(part, language))
      .join(' · ');
  const patterns: [RegExp, (...values: string[]) => string][] = [
    [/^(\d+) signals checked$/, (n) => `已检测 ${n} 项信号`],
    [/^(.+) request metadata$/, (name) => `${translate(name, language)} 请求元数据`],
    [/^(.+) client address$/, (name) => `${translate(name, language)} 访客地址`],
    [/^String must contain at most (\d+) character\(s\)$/, (n) => `输入最多包含 ${n} 个字符`],
    [/^String must contain at least (\d+) character\(s\)$/, (n) => `输入至少包含 ${n} 个字符`],
    [/^Number must be greater than or equal to (\d+)$/, (n) => `数值不能小于 ${n}`],
    [/^Number must be less than or equal to (\d+)$/, (n) => `数值不能大于 ${n}`],
    [/^(\d+)% evidence$/, (n) => `${n}% 风险证据`],
    [
      /^Source: (.+); confidence: (.+); Provider Detection$/,
      (source, confidence) => `来源：${source}；置信度：${translate(confidence, language)}；数据源检测`,
    ],
    [
      /^(\d+) requests per minute exceeded; retry after 60 seconds$/,
      (n) => `已超过每分钟 ${n} 次限制，请 60 秒后重试`,
    ],
    [/^(.+) unavailable; trying next provider$/, (name) => `${name} 暂不可用，正在尝试其他数据源`],
    [/^(.+) provider unavailable$/, (name) => `${translate(name, language)}数据源暂不可用`],
    [/^(.+) unavailable$/, (name) => `${name} 暂不可用`],
    [
      /^(.+) unavailable or invalid; absence is not a negative finding(?: \(stale or missing update metadata\))?$/,
      (name) => `${name} 暂不可用或格式无效；缺失不能视为未发现风险`,
    ],
    [/^Local name inference \((.+)\)$/, (source) => `本地名称推断（${source}）`],
    [
      /^(.+) refresh unavailable; using local snapshot if valid\.$/,
      (source) => `${source} 刷新暂不可用，使用仍有效的本地快照。`,
    ],
    [
      /^(.+) local snapshot expired or invalid; classification is unknown\.$/,
      (source) => `${source} 本地快照已过期或无效，分类保持未知。`,
    ],
    [
      /^(.+) cached snapshot expired; absence remains unknown$/,
      (source) => `${source} 缓存快照已过期，未命中情况保持未知。`,
    ],
    [
      /^(\d+) resolvers observed\. Empty results do not prove absence of a leak\.$/,
      (n) => `观测到 ${n} 个解析器。结果为空不代表没有泄露。`,
    ],
  ];
  for (const [pattern, render] of patterns) {
    const found = key.match(pattern);
    if (found) return render(...found.slice(1));
  }
  if (key.includes('; '))
    return key
      .split('; ')
      .map((part) => translate(part, language))
      .join('；');
  return text;
}
// Render boundaries only: never transform API payloads, form values or fingerprint inputs.
export function localize<T>(value: T): T {
  if (typeof value === 'string') return translate(value) as T;
  if (Array.isArray(value)) return value.map((item) => localize(item)) as T;
  return value;
}

export function countryName(code?: string | null, fallback?: string | null): string {
  if (code && /^[A-Z]{2}$/i.test(code)) {
    try {
      return (
        new Intl.DisplayNames([locale === 'zh' ? 'zh-CN' : 'en'], { type: 'region' }).of(
          code.toUpperCase(),
        ) ||
        fallback ||
        code
      );
    } catch {
      /* Preserve the source value if this browser lacks DisplayNames. */
    }
  }
  return fallback || code || translate('Unknown');
}
