# Authenticated Probe / DNS Collector Contract v1

This directory documents the real external infrastructure required for ICMP, traceroute and authoritative DNS observation. **There is no pretend ping agent or collector in this project.** The edge-side clients and UI are implemented; missing infrastructure returns Unsupported.

## Trust boundary

Deploy a coordinator on a fixed HTTPS URL. Configure `PROBE_URL` and a high-entropy `PROBE_SECRET` only in server-side secrets. Every request requires `Authorization: Bearer <PROBE_SECRET>`; compare secrets in constant time. Reject missing/invalid tokens before DNS resolution or process creation. Restrict ingress to your edge service where possible, rotate secrets and enforce global quotas and concurrency at the coordinator.

Do not expose unauthenticated agents. Agents can run on a Linux VPS / Docker with minimal privileges. A container requiring ping sockets may need a narrowly scoped `CAP_NET_RAW`; do not use privileged containers or root shells as a shortcut. A geographically labelled node must actually run in that location.

## Request contract

All endpoints accept JSON, max 2 KB. The edge generates UUID `requestId`; its validated `targetIps` list is a hint to pin the destination, not permission to bypass agent validation.

```json
{
  "version": 1,
  "requestId": "<UUID>",
  "host": "example.com",
  "targetIps": ["<validated-public-address>"],
  "timeoutMs": 3000,
  "node": "sin"
}
```

- `POST /probe/ping`: adds `mode: "icmp" | "http"`, `count: 1`, `protocol: "http" | "https"`.
- `POST /probe/tcp`: adds validated integer `port`.
- `POST /probe/traceroute`: adds `maxHops: 20`, hard cap 30.
- `node` is optional for single-region requests, or one of `sin / hkg / nrt / lax / fra / lhr` for Singapore / Hong Kong / Tokyo / Los Angeles / Frankfurt / London.

Coordinator must return within 4.5 seconds, including queue time. Use bounded per-node parallelism (recommended 2), one destination per probe, count limits and an overall budget. Return 503 for offline nodes; the UI will show Node unavailable. Never fill unavailable slots with synthetic results.

## Response contract

Ping / TCP response (fields only if actually measured):

```typescript
{
  success: boolean;
  latency?: number;      // ICMP RTT or TCP open duration, milliseconds
  totalTime?: number;    // HTTP HEAD elapsed duration, milliseconds
  status?: number;       // Actual HTTP status
  server?: string;       // Actual Server header, <= 256 chars
  targetIp?: string;     // Actual connected public IP
  message?: string;      // <= 500 chars, sanitized, no command or secret dump
}
```

Traceroute response:

```typescript
{
  hops: Array<{
    hop: number;
    ip: string | null;
    hostname: string | null;
    asn: number | null;
    country: string | null;
    latency: number | null;
  }>;
}
```

Timed-out hops use null, not zero. RFC1918 hops can legitimately occur _along_ a route; they may be returned but must never become follow-up scan targets. ASN/country enrichment requires an actual Provider. Edge labels these results Provider Detection because measurement occurred outside its own runtime.

## Required target defense

1. Accept a host, not an arbitrary URL / path / shell command. Apply the same strict validation as `edge/core/security.ts`.
2. Resolve both A and AAAA. Validate **all** returned addresses and all edge-supplied targetIps against current nonpublic / metadata ranges. Reject mixed answers and resolution failures.
3. Require the chosen IP to be in the validated list. Connect to that literal IP; do not let a library silently re-resolve the hostname.
4. For HTTPS use a transport with separate `connectAddress` and TLS `serverName`, verify the certificate against the original host. Never disable certificate verification. Redirects remain disabled.
5. TCP must enforce the port allowlist independently. HTTP is HEAD `/` on 80 / 443 only; never return body data.
6. ICMP count 1 and bounded packet size, trace max 20 hops and bounded per-hop timeout. Never expose flags to the browser.
7. Prefer a native ICMP / socket library. If system utilities are necessary, use an absolute executable, `spawn(executable, fixedArgumentArray, {shell:false})`, validated IP literal arguments, numeric limits and process termination on timeout. **Never** interpolate into a shell command or enable shell=true.
8. Disable persistent target/IP logs by default. Metrics may aggregate success/latency without complete IPs. Add Coordinator authentication, quotas and replay protection before exposing agents publicly.

## Authoritative DNS Collector

Delegate a subdomain such as `test.your-domain.example` to authoritative nameservers you operate. Serve wildcard HTTPS for random UUID hostnames without redirects. DNS must be authoritative for that zone; calling Google/Cloudflare DoH from the edge is not a replacement.

Configure `DNS_COLLECTOR_URL`, `DNS_COLLECTOR_SECRET`, `DNS_TEST_DOMAIN`. The edge-side `RemoteDnsProbeProvider` uses the same fixed-URL Bearer trust model.

`POST /sessions`:

```typescript
// request
{
  id: UUID;
  hostname: `${UUID}.${DNS_TEST_DOMAIN}`;
  ttlSeconds: 120;
}
// response
{
  token: string;
  expiresAt: string; /* ISO date */
}
```

Token must be at least 128 bits of cryptographically random entropy (string length 16–512 accepted by client). Bind token to the session and enforce expiration server-side. The authority must only record resolver IPs for known unexpired UUIDs. Capture recursive resolver source addresses and optionally perform reliable ASN / country enrichment; never infer resolver IP from the HTTP caller's IP. Do not identify ECS hints as observed resolvers.

`POST /results`:

```typescript
// request — edge has Bearer secret, browser supplies only its session token
{
  id: UUID;
  token: string;
}
// response
{
  complete: boolean;
  resolvers: Array<{
    ip: string;
    asn: number | null;
    country: string | null;
    organization: string | null;
  }>;
}
```

Use TTL ≤ 120 seconds and purge expired data; max 50 resolver entries. Reject enumeration, expired sessions, unknown UUIDs and wrong tokens. Empty results mean unable to determine; even a populated result is an observation, not automatic proof of a leak. Browser polls at most five times. Update the site's CSP to allow HTTPS requests only to `*.DNS_TEST_DOMAIN`.

## Acceptance tests before enabling a real agent

- Auth absent / invalid: 401, zero network activity.
- Metadata/private/mapped/rebinding/redirect targets: rejected without connection.
- shell metacharacters / newlines / numeric-IP tricks: rejected.
- Reachable public test target: actual measured value and actual target IP.
- Nonresponsive target: bounded timeout, no fabricated zero.
- Offline region: 503, no fallback labelled as that location.
- DNS session UUID produces matching authoritative query logs; only its token reads the result; expiry removes it.
