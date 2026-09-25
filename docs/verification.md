# Verification record

Date: 2026-09-25 (Asia/Shanghai). Platform: Windows, Node.js 24.19.0, pnpm 11.19.0.

## Executed checks

| Command / check | Result |
| --- | --- |
| `pnpm install` | Passed; esbuild and workerd build scripts explicitly permitted |
| `pnpm typecheck` | Passed, TypeScript strict |
| `pnpm lint` | Passed, no errors or warnings |
| `pnpm test` | 72 passed across 3 suites |
| `pnpm test:e2e` | 4 passed in Chrome |
| `pnpm build` | Passed; Vite frontend, Pages worker, EdgeOne function, SEO and OpenAPI |
| `pnpm build:edgeone` | Passed; isolated static output in dist-edgeone |
| `pnpm dev` | Started successfully at http://127.0.0.1:5173 |
| `pnpm preview --port 8787` | Cloudflare workerd started with ASSETS and rate-limit bindings |
| `pnpm test:smoke` | Successful real provider / socket tests through workerd |
| `pnpm check:cloudflare` | Passed; Worker bundle and ASSETS / rate-limit bindings verified without deployment |

The last item is an additional Wrangler deploy dry-run, not the application build. The first attempt was blocked by a temporary automatic-approval service usage limit. After the approval service recovered, a normally approved retry passed. No attempt was made to bypass review. Actual Cloudflare / EdgeOne account deployment has not been performed.

## Real network smoke observations

- Geo lookup of the explicit public test address 8.8.8.8 returned ipwho.is geography and Google / AS15169.
- RIPEstat AS13335 returned organization, ARIN and 5,462 observed prefixes (2,423 IPv4 / 3,039 IPv6) at test time. These are observed provider results, not fixtures or permanent claims.
- DNS-over-HTTPS returned real A records for example.com and PTR dns.google. for 8.8.8.8.
- Workerd `connect()` to the explicit public test target 1.1.1.1:443 succeeded and returned measured socket-open duration.
- Pinned HTTP HEAD to 1.1.1.1:80 returned a real 301 and Server: cloudflare. Redirect was not followed.
- The Node development adapter returned its correct TCP unsupported status and successfully executed its real HTTP HEAD implementation.

A runtime incompatibility with `redirect: 'error'` initially prevented workerd Provider calls. It was fixed by using `redirect: 'manual'` and rejecting non-2xx results. The subsequent real-network run passed. Timing numbers from local workerd are local measurements, not production edge latency.

## Browser verification

- All tool routes rendered with no uncaught page errors.
- Deep / light themes and the 390px mobile drawer worked; no horizontal page overflow.
- Fingerprint generated a 64-character SHA-256 locally with **zero new network requests** during the computation.
- Latency performed ten actual local API requests and rendered measured statistics.
- Unconfigured TCP / DNS Collector features remained clearly unavailable.
- Desktop, light and mobile screenshots were inspected; generated screenshots live in ignored `artifacts/`.

## Scope of unverified external infrastructure

Paid IPinfo / IPQualityScore / AbuseIPDB production credentials were not supplied; their normalization and failure behavior are tested with clearly separated test fixtures. Real ICMP agents, distributed nodes and a DNS authority were not supplied or deployed. Their transport, authentication, schemas and UI are implemented with explicit unsupported states. EdgeOne's adapter and bundle are tested locally, not certified against a live account.
