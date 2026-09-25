import { describe, it, expect } from 'vitest';
import { createApp } from '../api/app';
import { localAdapter } from '../edge/local/adapter';
import { rateLimit } from '../edge/core/ratelimit';
const app = createApp(localAdapter());
const env = { GEO_FREE_PROVIDER: 'off' };
describe('API contracts and safe degradation', () => {
  it('returns health without secrets', async () => {
    const r = await app.request('/api/health', {}, env);
    const b = await r.json();
    expect(b.success).toBe(true);
    expect(b.data.capabilities.icmp).toBe(false);
    expect(r.headers.get('content-security-policy')).toContain("default-src 'self'");
  });
  it('does not trust forwarded client IP in local mode', async () => {
    const r = await app.request(
      '/api/ip',
      { headers: { 'x-forwarded-for': '8.8.8.8', 'cf-connecting-ip': '8.8.8.8' } },
      env,
    );
    expect((await r.json()).data.ip).toBeNull();
  });
  it('degrades missing risk provider to not checked', async () => {
    const r = await app.request('/api/risk/8.8.8.8', {}, env);
    expect((await r.json()).data.score).toBeNull();
  });
  it('rejects private TCP targets before checking capability', async () => {
    const r = await app.request(
      '/api/tcping',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ host: '127.0.0.1', port: 443 }),
      },
      env,
    );
    expect(r.status).toBe(400);
  });
  it('returns genuine unsupported TCP status', async () => {
    const r = await app.request(
      '/api/tcping',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ host: 'example.com', port: 443 }),
      },
      env,
    );
    expect((await r.json()).data.supported).toBe(false);
  });
  it('rejects cross-origin browser writes', async () => {
    const r = await app.request(
      '/api/ping',
      { method: 'POST', headers: { origin: 'https://attacker.example' } },
      env,
    );
    expect(r.status).toBe(403);
  });
  it('rejects malformed JSON with a structured error', async () => {
    const r = await app.request(
      '/api/ping',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' },
      env,
    );
    expect((await r.json()).error.code).toBe('INVALID_JSON');
  });
  it('returns collector unavailable instead of invented resolvers', async () => {
    const r = await app.request('/api/dns-leak', { method: 'POST' }, env);
    expect((await r.json()).data.supported).toBe(false);
  });
  it('generates OpenAPI', async () => {
    const r = await app.request('/openapi.json', {}, env);
    expect((await r.json()).paths['/api/tcping'].post.requestBody).toBeDefined();
  });
  it('enforces the active-probe budget', async () => {
    const id = crypto.randomUUID();
    for (let i = 0; i < 10; i++) expect(await rateLimit(id, 'probe')).toBe(true);
    expect(await rateLimit(id, 'probe')).toBe(false);
  });
});
