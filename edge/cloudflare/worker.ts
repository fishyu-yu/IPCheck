import { createApp } from '../../api/app';
import { cloudflareAdapter } from './adapter';
import type { Env } from '../core/contracts';
import { securityHeaders } from '../core/security';
const app = createApp(cloudflareAdapter);
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/') || path === '/openapi.json') return app.fetch(request, env);
    if (!env.ASSETS) return new Response('Asset binding missing', { status: 503 });
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    Object.entries(securityHeaders).forEach(([k, v]) => headers.set(k, v));
    if (env.DNS_TEST_DOMAIN)
      headers.set(
        'Content-Security-Policy',
        securityHeaders['Content-Security-Policy'].replace(
          "connect-src 'self'",
          `connect-src 'self' https://*.${env.DNS_TEST_DOMAIN}`,
        ),
      );
    return new Response(response.body, { status: response.status, headers });
  },
};
