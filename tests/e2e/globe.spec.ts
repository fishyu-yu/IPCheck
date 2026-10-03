import { expect, test } from './fixtures';
import type { IPInfo } from '../../src/types';

test.use({ locale: 'zh-CN' });

async function mockLocation(page: import('@playwright/test').Page, latitude?: number, longitude?: number) {
  const data: IPInfo = {
    ip: '203.0.113.42', version: 4, city: 'Los Angeles', countryCode: 'US',
    latitude, longitude, organization: '示例网络', asn: 64500, type: [],
    sources: ['界面预览 · 示例数据'], partial: true, warnings: [], detection: 'Estimated / Unsupported',
  };
  await page.route('**/api/ip', (route) => route.fulfill({ json: { success: true, data } }));
  await page.route('**/api/purity/**', (route) => route.fulfill({
    status: 503, json: { success: false, error: { code: 'PREVIEW', message: '示例数据' } },
  }));
}

test('located IP renders an interactive globe, can be recentered and fits mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockLocation(page, 34.05, -118.24);
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto('/');
  const globe = page.locator('.location-globe');
  await expect(globe).toHaveAttribute('data-renderer', 'interactive');
  await expect(globe.locator('canvas')).toHaveCount(1);
  await expect(globe.locator('.globe-marker')).toBeVisible();
  await expect(globe.locator('.globe-caption strong')).toHaveText('洛杉矶 · 美国');
  await expect(globe.getByRole('button', { name: '回到 IP 所在位置' })).toBeEnabled();
  const position = await globe.locator('.globe-marker').getAttribute('style');
  await globe.getByRole('button', { name: '向右旋转地球' }).click();
  await expect(globe.locator('.globe-marker')).not.toHaveAttribute('style', position!);
  await globe.getByRole('button', { name: '回到 IP 所在位置' }).click();
  await expect(globe.locator('.globe-marker')).toHaveAttribute('style', position!);
  await page.screenshot({ path: 'artifacts/globe-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/globe-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('navigation').getByRole('link', { name: 'DNS 查询', exact: true }).click();
  await expect(page.locator('.globe-canvas canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('missing coordinates never create a location pin', async ({ page }) => {
  await mockLocation(page);
  await page.goto('/');
  await expect(page.locator('.location-globe')).toHaveAttribute('data-renderer', 'interactive');
  await expect(page.locator('.globe-marker')).toHaveCount(0);
  await expect(page.locator('.globe-caption')).toContainText('暂无经纬度数据');
});

test('WebGL failure preserves the static globe and a valid zero-coordinate pin', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return original.call(this, type as '2d', ...args as []) as never;
    } as typeof original;
  });
  await mockLocation(page, 0, 0);
  await page.goto('/');
  await expect(page.locator('.location-globe')).toHaveAttribute('data-renderer', 'static');
  await expect(page.locator('.globe-fallback text')).toHaveText('IP');
  await expect(page.locator('.globe-caption')).toContainText('静态地球视图');
  await expect(page.locator('.globe-caption')).not.toContainText('暂无经纬度数据');
});
