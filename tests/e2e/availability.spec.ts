import { expect, test } from './fixtures';
import type { Health } from '../../src/services/api';

const enabledHealth: Health = {
  status: 'operational',
  platform: 'Test runtime',
  capabilities: {
    geo: false,
    tcpSocket: true,
    httpProbe: true,
    kv: false,
    icmp: false,
    traceroute: false,
    dnsCollector: false,
  },
  providers: { geo: true, risk: true, remoteProbe: false },
  rateLimit: 'Platform bindings',
};

test('unavailable tools disappear from every entry point while configured implementations remain', async ({
  page,
}) => {
  const riskRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/risk/')) riskRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('.route-view h1')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'IP Purity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'IP purity', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Risk analysis', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'More tools' }).click();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'TCP Ping' })).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Ping', exact: true })).toBeVisible();
  await page.goto('/tools');
  await expect(page.locator('main').getByRole('link', { name: 'IP Purity', exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('TCP Ping');
  await page.goto('/ping');
  await expect(page.getByLabel('Mode')).toHaveValue('http');
  await expect(page.getByLabel('Mode').locator('option')).toHaveCount(1);
  await page.goto('/risk');
  await expect(page.getByRole('heading', { name: 'IP Purity', exact: true })).toBeVisible();
  await expect(page.getByText('A public IP is needed')).toBeVisible();
  expect(riskRequests).toEqual([]);

  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { success: true, data: enabledHealth } }),
  );
  await page.goto('/tools');
  await expect(page.locator('main').getByRole('link', { name: 'IP Purity', exact: true })).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: 'TCP Ping', exact: true })).toBeVisible();
  await page.goto('/risk');
  await expect(page.getByRole('heading', { name: 'IP Purity', exact: true })).toBeVisible();
  await page.goto('/tcping');
  await expect(page.getByRole('heading', { name: 'TCP Ping', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Single test' })).toBeEnabled();
  await expect(page.getByLabel('Mode').locator('option')).toHaveCount(2);
});

test('navigation moves its highlight, animates content and preserves the header', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.nav-indicator')).toHaveCSS('opacity', '1');
  const initialPosition = await page.locator('.nav-indicator').getAttribute('style');
  await page.getByRole('navigation').getByRole('link', { name: 'IP Lookup', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('IP Lookup');
  await expect(page.locator('.nav-indicator')).not.toHaveAttribute('style', initialPosition!);
  await expect(page.locator('.route-view')).toHaveCSS('animation-name', 'page-enter');
  await expect(page.locator('.nav-indicator')).toHaveCSS('transition-duration', '0.26s, 0.26s, 0.16s');
  await page.getByRole('button', { name: 'More tools' }).click();
  await expect(page.locator('#more-tools')).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape');
  await expect(page.locator('#more-tools')).toHaveAttribute('inert', '');
  await expect(page.locator('#more-tools')).toBeHidden();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('navigation').getByRole('link', { name: 'DNS Lookup', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('DNS Lookup');
  await expect(page.locator('.route-view')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.nav-indicator')).toHaveCSS('transition-duration', '0s');
  for (const width of [320, 700, 960, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
