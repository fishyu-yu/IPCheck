import type { Page } from '@playwright/test';
import type { PurityResult } from '../../src/types';
import { expect, test } from './fixtures';

const currentIp = '8.8.8.8';
function assessment(ip: string, score = 81, revision = 1): PurityResult {
  const source = `Release fixture ${ip} revision ${revision}`;
  return {
    ip,
    score,
    scoreRange: { min: Math.max(0, score - 10), max: Math.min(100, score + 10) },
    recommendations: ['Review source coverage and freshness before relying on this assessment.'],
    level: 'Moderate purity',
    confidence: 'Low',
    coverage: 40,
    status: 'limited',
    model: 'release-fixture-v2',
    assessedAt: new Date(Date.now() + revision).toISOString(),
    asnType: { type: 'isp', source, inferred: false },
    companyType: { type: 'unknown', source, inferred: false },
    dimensions: [
      ['asn', 15],
      ['company', 20],
      ['anonymity', 30],
      ['abuse', 25],
      ['neighborhood', 10],
    ].map(([key, weight]) => ({
      key: key as PurityResult['dimensions'][number]['key'],
      weight: Number(weight),
      score: 50,
      reliability: 0,
      observed: false,
      inferred: false,
      evidence: 'Evidence unavailable',
      sources: [source],
    })),
    neighborhood: { cidr: null, activeBadNeighbors: null, abuseDensity: null, scope: 'none', source },
    feeds: [
      {
        source,
        url: 'https://example.com/evidence',
        checked: true,
        updatedAt: null,
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 900000).toISOString(),
        origin: 'live',
        status: 'available',
      },
    ],
    signals: [{ key: 'vpn', value: false, confidence: null, source, detection: 'Provider Detection' }],
    conflicts: [],
    sources: [source],
    warnings: [],
  };
}
async function mockCurrent(page: Page) {
  await page.route('**/api/ip', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ip: currentIp,
          version: 4,
          type: [],
          sources: ['Release fixture'],
          partial: true,
          warnings: [],
          detection: 'Estimated / Unsupported',
        },
      },
    }),
  );
}

test('manually submitted IPv6 purity queries refresh and retain only matching evidence', async ({ page }) => {
  await mockCurrent(page);
  await page.clock.install();
  const entered = '2606:4700:4700:0:0:0:0:1111';
  const canonical = '2606:4700:4700::1111';
  const requests = new Map<string, number>();
  await page.route('**/api/purity/*', (route) => {
    const target = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
    const count = (requests.get(target) || 0) + 1;
    requests.set(target, count);
    return route.fulfill({
      json: {
        success: true,
        data: assessment(target === entered ? canonical : target, count === 1 ? 81 : 67, count),
      },
    });
  });
  await page.goto('/risk');
  await expect(page.locator('.purity-address')).toHaveText(currentIp);
  await page.getByLabel('IPv4 / IPv6 address').fill(entered);
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(page.locator('.purity-address')).toHaveText(canonical);
  await expect(page.locator('[data-signal-key="vpn"]')).toContainText(`${canonical} revision 1`);
  await page.clock.fastForward(61000);
  await expect(page.locator('.purity-score strong')).toHaveText('67');
  await expect(page.locator('[data-signal-key="vpn"]')).toContainText(`${canonical} revision 2`);
  expect(requests.get(entered)).toBe(2);
  expect(requests.get(currentIp)).toBe(1);
});

test('leaving a pending manual query prevents a late response from replacing another IP', async ({
  page,
}) => {
  await mockCurrent(page);
  const slowIp = '1.1.1.1';
  let release!: () => void;
  let finished = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/purity/*', async (route) => {
    const target = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
    if (target === slowIp) {
      await pending;
      try {
        await route.fulfill({ json: { success: true, data: assessment(slowIp, 23) } });
      } catch {
        /* Leaving the query aborts its browser request. */
      } finally {
        finished = true;
      }
    } else await route.fulfill({ json: { success: true, data: assessment(target) } });
  });
  await page.goto('/risk');
  await expect(page.locator('.purity-address')).toHaveText(currentIp);
  await page.getByLabel('IPv4 / IPv6 address').fill(slowIp);
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(page.locator('.purity-panel')).toContainText('Assessing IP purity');
  await expect(page.locator('.purity-address')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'IP Lookup', exact: true }).click();
  await expect(page.locator('.purity-address')).toHaveText(currentIp);
  release();
  await expect.poll(() => finished).toBe(true);
  await expect(page.locator('.purity-score strong')).toHaveText('81');
  await expect(page.locator('[data-signal-key="vpn"]')).toContainText(`${currentIp} revision 1`);
  await expect(page.locator('.purity-panel')).not.toContainText(`${slowIp} revision 1`);
  await page.getByRole('navigation').getByRole('link', { name: 'IP Purity', exact: true }).click();
  await expect(page.locator('.purity-address')).toHaveText(currentIp);
});

test('failed background refresh keeps the previous result and automatically recovers', async ({ page }) => {
  await mockCurrent(page);
  await page.clock.install();
  let requests = 0;
  await page.route('**/api/purity/*', (route) => {
    requests++;
    return requests === 2
      ? route.fulfill({
          status: 503,
          json: {
            success: false,
            error: { code: 'UPSTREAM', message: 'Upstream service is unavailable or rate limited' },
          },
        })
      : route.fulfill({
          json: { success: true, data: assessment(currentIp, requests === 1 ? 81 : 74, requests) },
        });
  });
  await page.goto('/risk');
  await expect(page.locator('.purity-score strong')).toHaveText('81');
  await page.clock.fastForward(61000);
  await expect(page.locator('.purity-panel [role="alert"]')).toContainText(
    'Refresh failed. Showing the previous assessment.',
  );
  await expect(page.locator('.purity-score strong')).toHaveText('81');
  await expect(page.locator('.purity-address')).toHaveText(currentIp);
  await expect(page.locator('[data-signal-key="vpn"]')).toContainText(`${currentIp} revision 1`);
  await page.clock.fastForward(61000);
  await expect(page.locator('.purity-score strong')).toHaveText('74');
  await expect(page.locator('.purity-panel [role="alert"]')).toHaveCount(0);
  await expect(page.locator('[data-signal-key="vpn"]')).toContainText(`${currentIp} revision 3`);
  expect(requests).toBe(3);
});

test('an assessed result refreshes when its earliest source expires before fifteen minutes', async ({
  page,
}) => {
  await mockCurrent(page);
  await page.clock.install();
  let requests = 0;
  await page.route('**/api/purity/*', (route) => {
    requests++;
    const data = assessment(currentIp, requests === 1 ? 81 : 79, requests);
    data.status = 'assessed';
    data.feeds[0].expiresAt = new Date(Date.now() + (requests === 1 ? 35000 : 900000)).toISOString();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/risk');
  await expect(page.locator('.purity-score strong')).toHaveText('81');
  await page.clock.fastForward(34000);
  expect(requests).toBe(1);
  await page.clock.fastForward(2000);
  await expect(page.locator('.purity-score strong')).toHaveText('79');
  await expect(page.locator('[data-signal-key="vpn"]')).toContainText(`${currentIp} revision 2`);
  expect(requests).toBe(2);
});

test('failed refresh of an expired source retries once per minute and recovers', async ({ page }) => {
  await mockCurrent(page);
  await page.clock.install();
  let requests = 0;
  await page.route('**/api/purity/*', (route) => {
    requests++;
    if (requests === 2)
      return route.fulfill({
        status: 503,
        json: {
          success: false,
          error: { code: 'UPSTREAM', message: 'Upstream service is unavailable or rate limited' },
        },
      });
    const data = assessment(currentIp, requests === 1 ? 81 : 76, requests);
    data.status = 'assessed';
    data.feeds[0].expiresAt = new Date(Date.now() + (requests === 1 ? 20000 : 900000)).toISOString();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/risk');
  await expect(page.locator('.purity-score strong')).toHaveText('81');
  await page.clock.fastForward(21000);
  await expect(page.locator('.purity-panel [role="alert"]')).toContainText(
    'Refresh failed. Showing the previous assessment.',
  );
  expect(requests).toBe(2);
  await page.clock.fastForward(30000);
  await expect(page.locator('.purity-score strong')).toHaveText('81');
  expect(requests).toBe(2);
  await page.clock.fastForward(31000);
  await expect(page.locator('.purity-score strong')).toHaveText('76');
  await expect(page.locator('.purity-panel [role="alert"]')).toHaveCount(0);
  await expect(page.locator('[data-signal-key="vpn"]')).toContainText(`${currentIp} revision 3`);
  expect(requests).toBe(3);
});
