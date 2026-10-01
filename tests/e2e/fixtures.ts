import { test as base, type APIResponse } from '@playwright/test';

export { expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Full-document route checks should reuse the runtime capabilities, just as
    // client-side navigation does, without consuming the latency test's quota.
    let health: Promise<APIResponse> | undefined;
    await page.route('**/api/health', async (route) => {
      health ??= route.fetch();
      await route.fulfill({ response: await health });
    });
    await use(page);
  },
});
