import { expect, test } from './fixtures';
test('overview, themes, tools and mobile layout are usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your network, in focus.' })).toBeVisible();
  await expect(page.getByText('Not available locally')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(nav.getByRole('link')).toHaveCount(4);
  const positions = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().top));
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
  await nav.getByRole('button', { name: 'More tools' }).click();
  await expect(nav.getByRole('link', { name: 'Environment', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('button', { name: 'More tools' })).toBeFocused();
  await expect(page.locator('#more-tools')).toBeHidden();
  await nav.getByRole('button', { name: 'More tools' }).click();
  await page.locator('.footer-identity').click();
  await expect(page.locator('#more-tools')).toBeHidden();
  await expect(page.getByRole('link', { name: 'whois.f1shyu.com' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/overview-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'artifacts/overview-light.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'More tools' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Environment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Browser environment', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/environment-mobile.png', fullPage: true, animations: 'disabled' });
  await page.goto('/');
  await expect(page.getByText('Not available locally')).toBeVisible();
  await page.screenshot({ path: 'artifacts/overview-mobile.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});
test('retired pages lead to core tools and reverse DNS is part of DNS lookup', async ({ page }) => {
  for (const [oldRoute, destination] of [
    ['/global', '/ping'],
    ['/trace', '/ping'],
    ['/dns', '/webrtc'],
  ]) {
    await page.goto(oldRoute);
    await expect(page).toHaveURL(new RegExp(destination + '$'));
    await expect(page.locator('main h1')).toBeVisible();
  }
  await page.goto('/dns-lookup');
  await page.goto('/reverse');
  await expect(page).toHaveURL(/\/dns-lookup\?type=PTR$/);
  await expect(page.getByLabel('Record type')).toHaveValue('PTR');
  await page.route('**/api/reverse?ip=8.8.8.8', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          name: '8.8.8.8',
          type: 'PTR',
          status: 0,
          source: 'test-resolver',
          answers: [{ name: '8.8.8.8.in-addr.arpa', type: 12, TTL: 300, data: 'dns.google' }],
        },
      },
    }),
  );
  await page.getByLabel('IP address', { exact: true }).fill('8.8.8.8');
  await page.getByRole('button', { name: 'Query DNS' }).click();
  await expect(page.getByRole('cell', { name: 'dns.google' })).toBeVisible();
  await page.getByLabel('Record type').selectOption('AAAA');
  await expect(page.getByLabel('Domain', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Record type')).toHaveValue('AAAA');
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
test('latency collects ten real samples and unsupported features stay hidden', async ({ page }) => {
  await page.goto('/latency');
  await page.getByRole('button', { name: 'Measure latency' }).click();
  await expect(page.getByText('10 / 10 requests')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Measure latency' })).toBeEnabled();
  await expect(page.locator('.stats-grid strong').first()).not.toContainText('—');
  await page.goto('/tcping');
  await expect(page).toHaveURL(/\/tools$/);
  await expect(page.getByRole('link', { name: 'TCP Ping', exact: true })).toHaveCount(0);
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
    '/dns-lookup',
    '/environment',
    '/fingerprint',
    '/webrtc',
    '/developers',
    '/status',
    '/tools',
  ]) {
    await page.goto(route);
    await expect(page.locator('main h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
