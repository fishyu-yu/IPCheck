import { expect, test } from './fixtures';
test.describe('Chinese interface', () => {
  test.use({ locale: 'zh-CN', colorScheme: 'light' });
  test('all pages, dynamic states, accessible labels and mobile navigation use Chinese', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('heading', { name: '看清你的网络。' })).toBeVisible();
    await expect(page).toHaveTitle('概览 · NetProbe');
    await expect(page.getByText('本地无法获取')).toBeVisible();
    await page.screenshot({
      path: 'artifacts/zh-overview-light.png',
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: '切换明暗主题' }).click();
    await page.screenshot({ path: 'artifacts/zh-overview-dark.png', fullPage: true, animations: 'disabled' });
    for (const route of [
      '/ip',
      '/asn',
      '/risk',
      '/ping',
      '/tcping',
      '/http-ping',
      '/latency',
      '/dns-lookup',
      '/environment',
      '/fingerprint',
      '/webrtc',
      '/developers',
      '/status',
      '/tools',
    ]) {
      await page.goto(route);
      await expect(page.locator('main h1')).toContainText(/[\u4e00-\u9fff]/);
      await expect(page.locator('main')).not.toContainText(
        /Not checked|Unknown|Unsupported|Run test|No test performed/,
      );
    }
    await page.goto('/fingerprint');
    await page.getByRole('button', { name: '在本地计算' }).click();
    await expect(page.locator('.hash-output code')).toHaveText(/^[a-f0-9]{64}$/);
    await page.goto('/latency');
    await page.getByRole('button', { name: '测量延迟' }).click();
    await expect(page.getByText('10 / 10 次请求')).toBeVisible({ timeout: 15000 });
    await page.goto('/ip');
    await page.getByPlaceholder('输入 IPv4 / IPv6 地址').fill('invalid-ip');
    await page.getByRole('button', { name: '查询', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('有效的 IPv4');
    await page.goto('/');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: '看清你的网络。' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: 'artifacts/zh-overview-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: '更多工具' }).click();
    await page.getByRole('navigation').getByRole('link', { name: '浏览器环境', exact: true }).click();
    await expect(page.locator('main h1')).toHaveText('浏览器环境');
    expect(errors).toEqual([]);
  });
});
test.describe('non-Chinese fallback', () => {
  test.use({ locale: 'ja-JP' });
  test('uses English for another primary language', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Your network, in focus.' })).toBeVisible();
  });
});
