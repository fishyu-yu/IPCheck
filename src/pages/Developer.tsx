import { Link } from 'react-router-dom';
import { ArrowUpRight, Braces } from 'lucide-react';
import { navigation, site } from '../config/site';
import { useHealth } from '../hooks/queries';
import { Badge, Card, CopyButton, DataList, Notice, PageTitle, Skeleton } from '../components/ui';
export function ToolsPage() {
  return (
    <>
      <PageTitle
        title="Your network toolkit"
        description="Focused diagnostics, clear limitations, and evidence you can inspect."
      />
      <div className="tools-grid">
        {navigation
          .filter((s) => !['Workspace', 'Developer'].includes(s.label))
          .map((s) => (
            <Card key={s.label} title={s.label}>
              {s.items.map(([path, title]) => (
                <Link className="tool-link" to={path} key={path}>
                  <span>
                    {title}
                    <small>{path}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </Card>
          ))}
      </div>
    </>
  );
}
export function DeveloperPage() {
  const origin = location.origin;
  const examples = [
    [
      'curl',
      `curl '${origin}/api/ip'\ncurl '${origin}/api/ip/8.8.8.8'\ncurl -X POST '${origin}/api/tcping' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"host":"example.com","port":443}'`,
    ],
    [
      'JavaScript',
      `const response = await fetch('/api/ip');\nconst result = await response.json();\nif (!result.success) throw new Error(result.error.message);\nconsole.log(result.data);`,
    ],
    [
      'Python',
      `import requests\n\nresult = requests.get(\n    '${origin}/api/ip', timeout=10\n).json()\nprint(result)`,
    ],
  ];
  return (
    <>
      <PageTitle
        eyebrow="DEVELOPER"
        title="A transparent API"
        description="Standard JSON. Explicit sources. The same endpoints that power this workspace."
        action={
          <a className="button" href="/openapi.json" target="_blank" rel="noreferrer">
            <Braces size={15} /> OpenAPI 3.1
          </a>
        }
      />
      <Notice>
        Browser requests are same-origin by default. CLI clients can call the endpoints directly. Queries:
        60/min/IP; active probes: 10/min/IP. Fingerprint, environment, and WebRTC candidates have no upload
        endpoint.
      </Notice>
      <div className="two-columns">
        <Card title="Lookup endpoints">
          <DataList
            data={{
              'GET /api/ip': 'Current client address',
              'GET /api/ip/:ip': 'IP intelligence',
              'GET /api/asn/:asn': 'Autonomous system',
              'GET /api/risk/:ip': 'Risk evidence',
              'GET /api/dns?name=example.com&type=A': 'DNS records',
              'GET /api/reverse?ip=8.8.8.8': 'PTR lookup',
            }}
          />
        </Card>
        <Card title="Probe endpoints">
          <DataList
            data={{
              'GET /api/ping': 'Uncached edge echo',
              'POST /api/http-ping': 'HTTP HEAD timing',
              'POST /api/tcping': 'TCP connection timing',
              'POST /api/ping': 'HTTP / remote ICMP',
              'POST /api/global': 'Remote multi-node ICMP',
              'POST /api/trace': 'Remote traceroute',
              'GET /api/health': 'Capabilities & providers',
            }}
          />
        </Card>
      </div>
      {examples.map(([language, code]) => (
        <Card key={language} title={language} action={<CopyButton text={code} />}>
          <pre>{code}</pre>
        </Card>
      ))}
      <Card title="Privacy architecture">
        <p>
          {site.name} does not store browser fingerprints, WebRTC candidates, or query history. Provider
          lookups disclose the queried IP to the configured provider. IP / ASN / risk provider results may be
          cached for 24h / 24h / 1h respectively. Rate counters are short-lived. Hosting platforms and
          third-party providers have their own retention policies.
        </p>
        <p>
          Risk is a local scoring model over provider evidence. A score of zero with partial coverage is not
          proof of safety. Unsupported tests report limitations, never invented measurements.
        </p>
      </Card>
    </>
  );
}
export function StatusPage() {
  const health = useHealth();
  return (
    <>
      <PageTitle
        title="System status"
        description="Live capabilities reported by the runtime handling your request."
      />
      {health.isLoading && <Skeleton />}
      {health.error && <Notice error>{health.error.message}</Notice>}
      {health.data && (
        <>
          <Card title={health.data.platform} action={<Badge tone="green">API responding</Badge>}>
            <DataList
              data={Object.fromEntries(
                Object.entries(health.data.capabilities).map(([k, v]) => [
                  k,
                  v ? 'Available' : 'Not configured / Unsupported',
                ]),
              )}
            />
          </Card>
          <Card title="Provider configuration">
            <DataList
              data={Object.fromEntries(
                Object.entries(health.data.providers).map(([k, v]) => [
                  k,
                  v ? 'Configured' : 'Not configured',
                ]),
              )}
            />
            <Notice>{health.data.rateLimit}</Notice>
            <p className="helper">
              Configured does not mean the upstream is reachable. Individual tests report real failures and
              timeouts.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
