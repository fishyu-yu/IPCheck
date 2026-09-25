import { createApp } from '../../api/app';
import { cloudflareAdapter } from './adapter';
import type { Env } from '../core/contracts';
import { securityHeaders } from '../core/security';
const app = createApp(cloudflareAdapter);
export default {
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/') || path === '/openapi.json') return app.fetch(request, env);
    const r = await env.ASSETS!.fetch(request);
    const h = new Headers(r.headers);
    Object.entries(securityHeaders).forEach(([k, v]) => h.set(k, v));
    if (env.DNS_TEST_DOMAIN)
      h.set(
        'Content-Security-Policy',
        securityHeaders['Content-Security-Policy'].replace(
          "connect-src 'self'",
          `connect-src 'self' https://*.${env.DNS_TEST_DOMAIN}`,
        ),
      );
    return new Response(r.body, { status: r.status, headers: h });
  },
};
