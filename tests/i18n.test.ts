import { describe, expect, it } from 'vitest';
import { detectLocale, translate } from '../src/config/i18n';
describe('language selection and translations', () => {
  it.each(['zh', 'zh-CN', 'zh-TW', 'zh-Hant-HK', 'ZH_hans'])('uses Chinese for %s', (language) => {
    expect(detectLocale(language)).toBe('zh');
  });
  it.each(['en-US', 'ja-JP', 'de-DE', '', 'zhongwen'])('falls back to English for %s', (language) => {
    expect(detectLocale(language)).toBe('en');
  });
  it('translates statuses without fabricating provider values', () => {
    expect(translate('Not checked', 'zh')).toBe('未检测');
    expect(translate('10 requests per minute exceeded; retry after 60 seconds', 'zh')).toContain('60 秒');
    expect(translate('AS13335', 'zh')).toBe('AS13335');
    expect(translate('2606:4700:4700::1111', 'zh')).toBe('2606:4700:4700::1111');
    expect(translate('Example ISP', 'zh')).toBe('Example ISP');
    expect(translate('Not checked', 'en')).toBe('Not checked');
  });
  it('localizes purity factors and distinguishes evidence confidence from risk', () => {
    expect(translate('IP Purity', 'zh')).toBe('IP 纯净度');
    expect(translate('High evidence confidence', 'zh')).toBe('证据可信度：高');
    expect(translate('Recent malicious neighbors', 'zh')).toBe('近期恶意邻居');
    expect(translate('No match in limited public threat feeds', 'zh')).toBe('有限公共威胁情报中未命中');
    expect(translate('Insufficient evidence. A neutral baseline is not a clean verdict.', 'zh')).toContain(
      '不代表',
    );
  });
});
