import { expect, test } from '@playwright/test';
test('overview, themes, tools and mobile layout are usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your network, in focus.' })).toBeVisible();
  await expect(page.getByText('Not available locally')).toBeVisible();
  await page.screenshot({ path: 'artifacts/overview-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'artifacts/overview-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Environment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Browser environment', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/environment-mobile.png', fullPage: true });
  await page.goto('/');
  await expect(page.getByText('Not available locally')).toBeVisible();
  await page.screenshot({ path: 'artifacts/overview-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('fingerprint is local and does not make network requests', async ({ page }) => {
  await page.goto('/fingerprint');
  await expect(page.getByRole('heading', { name: 'Browser fingerprint', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.getByRole('button', { name: 'Compute locally' }).click();
  await expect(page.locator('.hash-output code')).toHaveText(/^[a-f0-9]{64}$/);
  expect(requests).toEqual([]);
});
test('latency collects ten real samples and unsupported features stay unavailable', async ({ page }) => {
  await page.goto('/latency');
  await page.getByRole('button', { name: 'Measure latency' }).click();
  await expect(page.getByText('10 / 10 requests')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Measure latency' })).toBeEnabled();
  await expect(page.locator('.stats-grid strong').first()).not.toContainText('—');
  await page.goto('/tcping');
  await expect(page.getByText('TCP Ping unavailable on this edge provider')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Single test' })).toBeDisabled();
  await page.goto('/dns');
  await expect(page.getByText('DNS Leak advanced test requires DNS collector configuration.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start DNS leak test' })).toBeDisabled();
});
test('every tool route renders without a runtime error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of [
    '/ip',
    '/asn',
    '/risk',
    '/ping',
    '/tcping',
    '/http-ping',
    '/global',
    '/trace',
    '/dns-lookup',
    '/reverse',
    '/environment',
    '/fingerprint',
    '/webrtc',
    '/dns',
    '/developers',
    '/status',
    '/tools',
  ]) {
    await page.goto(route);
    await expect(page.locator('main h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
