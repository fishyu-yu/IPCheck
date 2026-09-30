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
});
