import { expect, test } from './fixtures';
import type { IPInfo } from '../../src/types';

test.use({ locale: 'zh-CN' });

test('pixel address stays centered, accessible and readable on desktop and mobile', async ({ page }) => {
  let address = '203.0.113.42';
  await page.route('**/api/ip', (route) => {
    const data: IPInfo = {
      ip: address,
      version: address.includes(':') ? 6 : 4,
      city: '示例位置',
      organization: '示例网络',
      asn: 64500,
      timezone: 'Asia/Shanghai',
      type: [],
      sources: ['界面预览 · 示例数据'],
      partial: true,
      warnings: [],
      edge: { provider: '预览环境' },
      detection: 'Estimated / Unsupported',
    };
    return route.fulfill({ json: { success: true, data } });
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await expect(page.locator('.pixel-address-text')).toHaveText(address);
  await expect(page.locator('.pixel-glyph')).toHaveCount(address.length);
  await expect(page.locator('.pixel-glyph').last()).toHaveCSS('opacity', '1');
  const hero = (await page.locator('.ip-hero').boundingBox())!;
  const ip = (await page.locator('.pixel-address').boundingBox())!;
  expect(Math.abs(hero.x + hero.width / 2 - ip.x - ip.width / 2)).toBeLessThan(2);
  await expect(page.getByRole('button', { name: '复制到剪贴板' })).toHaveCount(1);
  await page.screenshot({ path: 'artifacts/pixel-ip-desktop.png', animations: 'disabled' });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/pixel-ip-mobile.png', animations: 'disabled' });
  address = 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff';
  await page.getByRole('button', { name: '刷新检测' }).click();
  await expect(page.locator('.pixel-address-text')).toHaveText(address);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.pixel-glyph').first()).toHaveCSS('animation-name', 'none');
  for (const width of [320, 390, 700, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = (await page.locator('.pixel-address-glyphs').boundingBox())!;
    const container = (await page.locator('.ip-hero').boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(container.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(container.x + container.width);
  }
});
