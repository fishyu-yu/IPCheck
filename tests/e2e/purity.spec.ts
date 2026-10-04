import type { Page } from '@playwright/test';
import type { IPInfo, PurityResult } from '../../src/types';
import { expect, test } from './fixtures';

const currentIp = '8.8.8.8';
function ipInfo(ip: string | null): IPInfo {
  return {
    ip,
    version: ip ? 4 : null,
    type: [],
    sources: ['Test fixture'],
    partial: true,
    warnings: [],
    detection: 'Estimated / Unsupported',
  };
}
function assessment(ip = currentIp, missing = false): PurityResult {
  return {
    ip,
    score: missing ? 50 : 84,
    level: missing ? 'Insufficient evidence' : 'Moderate purity',
    confidence: missing ? 'Low' : 'High',
    coverage: missing ? 0 : 90,
    status: missing ? 'insufficient' : 'assessed',
    model: 'local-purity-v1',
    assessedAt: '2026-10-04T01:02:03Z',
    scoreRange: missing ? { min: 0, max: 100 } : { min: 75, max: 90 },
    recommendations: ['Review source coverage and freshness before relying on this assessment.'],
    asnType: { type: missing ? 'unknown' : 'isp', source: 'Test provider', inferred: false },
    companyType: {
      type: missing ? 'unknown' : 'business',
      source: 'Local organization classification',
      inferred: true,
    },
    dimensions: [
      {
        key: 'asn',
        score: 95,
        weight: 15,
        observed: !missing,
        inferred: false,
        evidence: 'Provider network classification',
        sources: ['Test provider'],
      },
      {
        key: 'company',
        score: 90,
        weight: 20,
        observed: !missing,
        inferred: true,
        evidence: 'Estimated from organization name',
        sources: ['Local organization classification'],
      },
      {
        key: 'anonymity',
        score: 95,
        weight: 30,
        observed: !missing,
        inferred: false,
        evidence: 'No anonymity flags in checked sources',
        sources: ['Test provider'],
      },
      {
        key: 'abuse',
        score: 82,
        weight: 25,
        observed: !missing,
        inferred: false,
        evidence: 'No match in limited public threat feeds',
        sources: ['Feodo Tracker'],
      },
      {
        key: 'neighborhood',
        score: 45,
        weight: 10,
        observed: !missing,
        inferred: false,
        evidence: 'Recent malicious neighbors observed',
        sources: ['Feodo Tracker'],
      },
    ].map((factor) =>
      missing
        ? {
            ...factor,
            score: 50,
            reliability: 0,
            inferred: false,
            evidence: 'Neighborhood data unavailable',
            sources: [],
          }
        : { ...factor, reliability: factor.inferred ? 0.5 : 1 },
    ) as PurityResult['dimensions'],
    neighborhood: missing
      ? {
          cidr: null,
          activeBadNeighbors: null,
          abuseDensity: null,
          scope: 'none',
          source: 'Source unavailable',
        }
      : {
          cidr: '8.8.0.0/16',
          activeBadNeighbors: 3,
          abuseDensity: 0.17,
          scope: 'company-network',
          source: 'Company provider',
          activityCidr: '8.8.8.0/24',
          activitySource: 'Feodo Tracker',
        },
    feeds: missing
      ? []
      : [
          {
            source: 'Feodo Tracker',
            url: 'https://feodotracker.abuse.ch/',
            checked: true,
            updatedAt: '2026-10-04T00:00:00Z',
            fetchedAt: '2026-10-04T01:00:00Z',
            expiresAt: '2026-10-04T01:15:00Z',
            origin: 'live',
            status: 'available',
            copyright: '© abuse.ch',
          },
        ],
    signals: [],
    conflicts: [],
    sources: missing ? [] : ['Test provider', 'Feodo Tracker'],
    warnings: [],
  };
}
async function mockCurrent(page: Page, ip: string | null = currentIp) {
  await page.route('**/api/ip', (route) => route.fulfill({ json: { success: true, data: ipInfo(ip) } }));
}

test('purity is available without a client IP and offers a useful state instead of a blank score', async ({
  page,
}) => {
  await mockCurrent(page, null);
  await page.goto('/');
  await expect(page.locator('.purity-panel')).toContainText('A public IP is needed');
  await expect(page.locator('.purity-score')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'IP Purity', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('IP Purity');
  await expect(page.locator('.purity-panel')).toContainText('Look up a public IPv4 or IPv6');
  await expect(page.locator('.purity-signal')).toHaveCount(10);
  await expect(page.locator('.purity-assessment-meta')).toContainText('Not assessed');
  await expect(page.locator('.purity-assessment-meta time')).toHaveAttribute('datetime', /T/);
});

test('purity shows all factors, exact malicious neighbors, separate network scopes and feed attribution', async ({
  page,
}) => {
  await mockCurrent(page);
  await page.route('**/api/purity/*', (route) =>
    route.fulfill({ json: { success: true, data: assessment() } }),
  );
  await page.goto('/risk');
  const panel = page.locator('.purity-panel');
  await expect(panel.locator('.purity-score strong')).toHaveText('84');
  await expect(panel.locator('.purity-factor')).toHaveCount(5);
  for (const [index, weight] of [15, 20, 30, 25, 10].entries()) {
    await expect(panel.locator('.purity-factor').nth(index)).toContainText(`Weight: ${weight}%`);
  }
  await expect(panel).toContainText('High evidence confidence');
  await expect(panel).toContainText('Evidence coverage: 90%');
  await expect(panel).toContainText('Inferred classification');
  await expect(panel.locator('.purity-neighbors')).toContainText('8.8.8.0/24');
  await expect(panel.locator('.purity-neighbors')).toContainText('8.8.0.0/16');
  await expect(
    panel.locator('.purity-neighbors p').filter({ hasText: 'Recent malicious neighbors' }),
  ).toContainText('3');
  await expect(panel.locator('.purity-neighbors p').filter({ hasText: 'Abuse density' })).toContainText(
    '17%',
  );
  await expect(panel.getByRole('link', { name: 'Feodo Tracker' })).toHaveAttribute(
    'href',
    'https://feodotracker.abuse.ch/',
  );
  await expect(panel).toContainText('© abuse.ch');
  await expect(panel).toContainText('Assessed at');
  await expect(panel).toContainText('Evidence score range: 75–90 / 100');
  await expect(panel).toContainText('Live download');
  await expect(panel).not.toContainText(/—|NaN|undefined/);
  for (const width of [320, 390, 700, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390)
      await page.screenshot({ path: 'artifacts/purity-mobile.png', fullPage: true, animations: 'disabled' });
  }
  await page.screenshot({ path: 'artifacts/purity-desktop.png', fullPage: true, animations: 'disabled' });
});

test('partial coverage uses the API percentage and a moderate level keeps the ring cautious', async ({
  page,
}) => {
  await mockCurrent(page);
  await page.route('**/api/purity/*', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...assessment(),
          score: 90,
          coverage: 38,
          level: 'Moderate purity',
          status: 'limited',
          confidence: 'Low',
        },
      },
    }),
  );
  await page.goto('/risk');
  const panel = page.locator('.purity-panel');
  await expect(panel).toContainText('Evidence coverage: 38%');
  await expect(panel.locator('.purity-score')).toHaveClass('purity-score limited');
  await expect(panel.locator('.purity-score strong')).toHaveText('90');
});

test('missing evidence keeps a neutral score and explains unavailable neighborhood data', async ({
  page,
}) => {
  await mockCurrent(page);
  await page.route('**/api/purity/*', (route) =>
    route.fulfill({ json: { success: true, data: assessment(currentIp, true) } }),
  );
  await page.goto('/risk');
  const panel = page.locator('.purity-panel');
  await expect(panel.locator('.purity-score strong')).toHaveText('50');
  await expect(panel).toContainText('Insufficient evidence');
  await expect(panel).toContainText('Low evidence confidence');
  await expect(panel).toContainText('Count unavailable');
  await expect(panel).toContainText('Density unavailable');
  await expect(panel).toContainText('A neutral baseline is not a clean verdict');
  await expect(panel.locator('.purity-signal')).toHaveCount(10);
  await expect(panel.locator('.purity-signal').filter({ hasText: 'Unknown / Not checked' })).toHaveCount(10);
  await expect(panel.locator('.purity-assessment-meta')).toContainText('local-purity-v1');
  await expect(panel).not.toContainText(/—|NaN|undefined/);
});

test('pending and failed assessments remain meaningful and retry recovers', async ({ page }) => {
  await mockCurrent(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let failing = true;
  await page.route('**/api/purity/*', async (route) => {
    await pending;
    await route.fulfill({
      json: failing
        ? {
            success: false,
            error: { code: 'UPSTREAM', message: 'Upstream service is unavailable or rate limited' },
          }
        : { success: true, data: assessment() },
    });
  });
  await page.goto('/risk');
  const panel = page.locator('.purity-panel');
  await expect(panel).toContainText('Assessing IP purity…');
  await expect(panel.locator('.purity-score')).toHaveCount(0);
  release();
  await expect(panel).toContainText('Purity assessment unavailable');
  await expect(panel).not.toContainText('—');
  failing = false;
  await panel.getByRole('button', { name: 'Retry assessment' }).click();
  await expect(panel.locator('.purity-score strong')).toHaveText('84');
});

test('IP lookup purity follows the submitted IP and clears the old assessment while the lookup is pending', async ({
  page,
}) => {
  await mockCurrent(page);
  const queriedIp = '1.1.1.1';
  const purityRequests: string[] = [];
  await page.route('**/api/purity/*', (route) => {
    const target = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
    purityRequests.push(target);
    return route.fulfill({ json: { success: true, data: assessment(target) } });
  });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/ip/${queriedIp}`, async (route) => {
    await pending;
    await route.fulfill({ json: { success: true, data: ipInfo(queriedIp) } });
  });
  await page.goto('/ip');
  await expect(page.locator('.purity-address')).toHaveText(currentIp);
  await page.getByLabel('IPv4 / IPv6 address').fill(queriedIp);
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(page.locator('.purity-panel')).toContainText('Assessing IP purity…');
  await expect(page.locator('.purity-address')).toHaveCount(0);
  release();
  await expect(page.locator('.purity-address')).toHaveText(queriedIp);
  expect(purityRequests).toContain(queriedIp);
  await page.getByRole('navigation').getByRole('link', { name: 'IP Purity', exact: true }).click();
  await expect(page.locator('.purity-address')).toHaveText(currentIp);
});

test('purity labels, evidence and confidence are localized in Chinese', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { value: ['zh-CN'] });
  });
  await mockCurrent(page);
  await page.route('**/api/purity/*', (route) =>
    route.fulfill({ json: { success: true, data: assessment() } }),
  );
  await page.goto('/risk');
  await expect(page.locator('main h1')).toHaveText('IP 纯净度');
  const panel = page.locator('.purity-panel');
  await expect(panel).toContainText('证据可信度：高');
  await expect(panel).toContainText('近期恶意邻居');
  await expect(panel).toContainText('由组织名称推断');
  await expect(panel).toContainText('逐项来源证据');
  await expect(panel).toContainText('未知 / 未检测');
  await expect(panel).toContainText('当前时间');
  await expect(panel).not.toContainText(
    /Factor score|High evidence confidence|Insufficient evidence|Provider network classification/,
  );
});

test('all source findings retain false, numeric, inferred and conflicting evidence without claiming safety', async ({
  page,
}) => {
  await mockCurrent(page);
  const data = assessment();
  data.signals = [
    {
      key: 'vpn',
      value: true,
      source: 'VPN prefix inference',
      confidence: 0.6,
      detection: 'Estimated / Unsupported',
    },
    { key: 'proxy', value: true, source: 'Provider A', confidence: 0.9, detection: 'Provider Detection' },
    { key: 'proxy', value: false, source: 'Provider B', confidence: 0.8, detection: 'Provider Detection' },
    { key: 'abuse', value: 0.23, source: 'Abuse provider', confidence: 0.7, detection: 'Provider Detection' },
    { key: 'bot', value: 0, source: 'Bot provider', confidence: 1, detection: 'Provider Detection' },
    {
      key: 'blacklist',
      value: null,
      source: 'Unavailable provider',
      confidence: null,
      detection: 'Provider Detection',
    },
  ];
  data.conflicts = ['proxy'];
  await page.route('**/api/purity/*', (route) => route.fulfill({ json: { success: true, data } }));
  await page.goto('/risk');
  const panel = page.locator('.purity-panel');
  await expect(panel.locator('.purity-signal')).toHaveCount(10);
  const vpn = panel.locator('[data-signal-key="vpn"]');
  await expect(vpn).toContainText('true · Inferred finding');
  await expect(vpn).toContainText('60%');
  await expect(vpn).toContainText('Estimated / Unsupported');
  const proxy = panel.locator('[data-signal-key="proxy"]');
  await expect(proxy).toContainText('Conflicting findings');
  await expect(proxy).toContainText('true · Detected');
  await expect(proxy).toContainText('false · Not detected in this source');
  await expect(proxy).toContainText('Provider A');
  await expect(proxy).toContainText('Provider B');
  await expect(proxy).toContainText('90%');
  await expect(proxy).toContainText('80%');
  await expect(panel.locator('[data-signal-key="abuse"]')).toContainText('0.23 · 23% Evidence strength');
  await expect(panel.locator('[data-signal-key="bot"]')).toContainText('0 · 0% Evidence strength');
  await expect(panel.locator('[data-signal-key="bot"]')).toContainText('within its coverage');
  await expect(panel.locator('[data-signal-key="blacklist"]')).toContainText('Unknown / Not checked');
  await expect(panel.locator('[data-signal-key="blacklist"]')).toContainText('Unavailable provider');
  await expect(panel.locator('[data-signal-key="tor"]')).toContainText('Source unavailable');
  await expect(panel).not.toContainText(/NaN|undefined|probability:|100% safe/);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('feed status distinguishes snapshots, stale data and unsupported families, and licenses stay readable', async ({
  page,
}) => {
  await mockCurrent(page);
  const data = assessment();
  data.feeds = [
    {
      source: 'Snapshot feed',
      url: 'https://example.com/snapshot',
      checked: true,
      updatedAt: null,
      fetchedAt: '2026-10-04T00:00:00Z',
      expiresAt: '2026-10-04T02:00:00Z',
      origin: 'snapshot',
      status: 'available',
      copyright: 'MIT license '.repeat(30),
    },
    {
      source: 'Old feed',
      url: 'https://example.com/old',
      checked: false,
      updatedAt: '2026-06-01T00:00:00Z',
      origin: 'live',
      status: 'stale',
    },
    {
      source: 'IPv4 feed',
      url: 'https://example.com/v4',
      checked: false,
      updatedAt: null,
      status: 'unsupported',
    },
  ];
  await page.route('**/api/purity/*', (route) => route.fulfill({ json: { success: true, data } }));
  await page.goto('/risk');
  const panel = page.locator('.purity-panel');
  await expect(panel.locator('[data-feed-status="available"]')).toContainText('Bundled offline snapshot');
  await expect(panel.locator('[data-feed-status="available"]')).toContainText('Feed fetched at');
  await expect(panel.locator('[data-feed-status="stale"]')).toContainText('Feed stale');
  await expect(panel.locator('[data-feed-status="unsupported"]')).toContainText('IP family unsupported');
  const license = panel.locator('.purity-license');
  await expect(license).not.toHaveAttribute('open');
  await license.locator('summary').click();
  await expect(license.locator('pre')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const status of ['insufficient', 'limited', 'assessed'] as const) {
  test(`${status} assessments refresh at the evidence-dependent interval`, async ({ page }) => {
    await mockCurrent(page);
    await page.clock.install();
    let requests = 0;
    await page.route('**/api/purity/*', (route) => {
      requests++;
      return route.fulfill({ json: { success: true, data: { ...assessment(), status } } });
    });
    await page.goto('/risk');
    await expect(page.locator('.purity-score strong')).toHaveText('84');
    expect(requests).toBe(1);
    await page.clock.fastForward(61000);
    if (status === 'assessed') {
      expect(requests).toBe(1);
      await page.clock.fastForward(840000);
    }
    await expect.poll(() => requests).toBe(2);
  });
}

test('legacy v1 payloads remain complete and mismatched IP assessments are withheld', async ({ page }) => {
  await mockCurrent(page);
  const legacy = { ...assessment() };
  delete (legacy as Partial<PurityResult>).recommendations;
  delete (legacy as Partial<PurityResult>).scoreRange;
  legacy.feeds = legacy.feeds.map(({ source, url, checked, updatedAt }) => ({
    source,
    url,
    checked,
    updatedAt,
  }));
  await page.route('**/api/purity/*', (route) => route.fulfill({ json: { success: true, data: legacy } }));
  await page.goto('/risk');
  await expect(page.locator('.purity-panel')).toContainText('Evidence score range: Not supplied');
  await expect(page.locator('.purity-signal')).toHaveCount(10);
  await expect(page.locator('.purity-panel')).not.toContainText(/NaN|undefined/);
  await page.goto('/risk?ip=1.1.1.1');
  await expect(page.locator('.purity-panel')).toContainText('Purity assessment unavailable');
  await expect(page.locator('.purity-score')).toHaveCount(0);
  await expect(page.locator('.purity-address')).toHaveCount(0);
  await expect(page.locator('[data-signal-key="proxy"]')).toContainText('Unknown / Not checked');
});

test('a current threat-list neighbor count does not claim recent events or live activity', async ({
  page,
}) => {
  await mockCurrent(page);
  const data = assessment();
  data.neighborhood = {
    ...data.neighborhood,
    activityKind: 'threat-list',
    activitySource: 'CINS Army threat list',
  };
  data.dimensions = data.dimensions.map((factor) =>
    factor.key === 'neighborhood'
      ? { ...factor, evidence: 'Known threat-list neighbors observed', sources: ['CINS Army threat list'] }
      : factor,
  );
  data.feeds = [
    {
      source: 'CINS Army threat list',
      url: 'https://cinsscore.com/',
      checked: true,
      updatedAt: '2026-10-04T00:00:00Z',
    },
  ];
  await page.route('**/api/purity/*', (route) => route.fulfill({ json: { success: true, data } }));
  await page.goto('/risk');
  const panel = page.locator('.purity-panel');
  await expect(panel).toContainText('Neighborhood threat evidence');
  await expect(
    panel.locator('.purity-neighbors p').filter({ hasText: 'Known threat-list neighbors' }),
  ).toContainText('3');
  await expect(panel).toContainText('Individual event times are not supplied');
  await expect(panel).not.toContainText('Recent malicious neighbors');
  await expect(panel.getByRole('link', { name: 'CINS Army threat list' })).toHaveAttribute(
    'href',
    'https://cinsscore.com/',
  );
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
