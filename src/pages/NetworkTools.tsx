import { localize } from '../config/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Play, Square } from 'lucide-react';
import { api } from '../services/api';
import { useHealth } from '../hooks/queries';
import { useLatency } from '../hooks/useLatency';
import { statistics } from '../lib/statistics';
import type { DNSResult, PingResult, ProbeNode, TraceResult } from '../types';
import { Badge, Card, DataList, Empty, Notice, PageTitle, RunButton } from '../components/ui';
import { LatencyChart } from '../components/LatencyChart';
export function LatencyPage() {
  const test = useLatency();
  const stats = statistics(test.samples);
  return (
    <>
      <PageTitle
        title={localize('Connection latency')}
        description="10 uncached HTTP requests from this browser to the current edge. This is not ICMP."
      />
      <Card
        title={localize('Browser → edge')}
        action={<Badge tone="blue">{localize('Browser-side Detection')}</Badge>}
      >
        <div className="test-toolbar">
          <RunButton busy={test.busy} onClick={() => void test.run()}>
            {localize(' Measure latency ')}
          </RunButton>
          {test.busy && (
            <button className="button" onClick={test.stop}>
              {localize(' Stop ')}
            </button>
          )}
          <span aria-live="polite">
            {localize(test.samples.length)}
            {localize(' / 10 requests')}
          </span>
        </div>
        <LatencyChart samples={test.samples} />
        <div className="stats-grid">
          {['min', 'average', 'median', 'p95', 'max', 'jitter'].map((key) => (
            <div key={key}>
              <span>{localize(key)}</span>
              <strong>
                {localize(stats ? stats[key as keyof typeof stats].toFixed(2) : '—')}
                <small>{localize(' ms')}</small>
              </strong>
            </div>
          ))}
        </div>
        {test.error && <Notice error>{localize(test.error)}</Notice>}
        <p className="helper">
          {localize(
            ' RTT includes browser scheduling and HTTP overhead. P95 uses nearest rank. Jitter is the mean absolute difference between consecutive successful RTT samples. ',
          )}
        </p>
      </Card>
    </>
  );
}
export function PingPage({ tcp = false }: { tcp?: boolean }) {
  const [host, setHost] = useState(''),
    [port, setPort] = useState(443),
    [mode, setMode] = useState<'http' | 'tcp' | 'icmp'>(tcp ? 'tcp' : 'http'),
    [protocol, setProtocol] = useState('http'),
    [busy, setBusy] = useState(false),
    [results, setResults] = useState<PingResult[]>([]),
    [error, setError] = useState('');
  const health = useHealth();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const supported =
    mode === 'tcp'
      ? health.data?.capabilities.tcpSocket || health.data?.providers.remoteProbe
      : mode === 'icmp'
        ? health.data?.capabilities.icmp
        : health.data?.capabilities.httpProbe;
  const run = async (count: number) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    const deadline = setTimeout(() => ctrl.abort(), 120000);
    controller.current = ctrl;
    setBusy(true);
    setResults([]);
    setError('');
    try {
      for (let i = 0; i < count; i++) {
        const result = await api<PingResult>(
          mode === 'tcp' ? '/api/tcping' : mode === 'http' ? '/api/http-ping' : '/api/ping',
          { host: host.trim(), mode: mode === 'icmp' ? 'icmp' : 'http', port, protocol },
          ctrl.signal,
        );
        setResults((r) => [...r, result]);
        if (!result.supported || ctrl.signal.aborted) break;
        if (i < count - 1)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 6500);
            ctrl.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
          });
        if (ctrl.signal.aborted) break;
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Probe failed');
    } finally {
      clearTimeout(deadline);
      setBusy(false);
    }
  };
  const samples = results.flatMap((r) =>
    r.latency !== undefined ? [r.latency] : r.totalTime !== undefined ? [r.totalTime] : [],
  );
  return (
    <>
      <PageTitle
        title={localize(tcp ? 'TCP Ping' : 'Ping')}
        description="Measure from the edge or an authenticated probe. Every mode describes what it actually measures."
      />
      <form
        className="card tool-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(1);
        }}
      >
        <div className="form-grid">
          <label>
            {localize(' Target hostname / IP ')}
            <input
              required
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={localize('example.com')}
              disabled={busy}
            />
          </label>
          <label>
            {localize(' Mode ')}
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} disabled={busy}>
              <option value="http">{localize('HTTP HEAD')}</option>
              <option value="tcp">{localize('TCP connection')}</option>
              <option value="icmp">{localize('ICMP echo')}</option>
            </select>
          </label>
          {mode === 'tcp' ? (
            <label>
              {localize(' Port ')}
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                disabled={busy}
              />
            </label>
          ) : mode === 'http' ? (
            <label>
              {localize(' Protocol ')}
              <select value={protocol} onChange={(e) => setProtocol(e.target.value)} disabled={busy}>
                <option value="http">{localize('HTTP')}</option>
                <option value="https">{localize('HTTPS')}</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="test-toolbar">
          <RunButton busy={busy} disabled={!supported}>
            <Play size={14} />
            {localize(' Single test ')}
          </RunButton>
          <button
            type="button"
            className="button"
            disabled={busy || !host || !supported}
            onClick={() => void run(10)}
          >
            {localize(' Continuous test · 10 ')}
          </button>
          {busy && (
            <button type="button" className="button" onClick={() => controller.current?.abort()}>
              <Square size={13} />
              {localize(' Stop ')}
            </button>
          )}
          <span aria-live="polite">
            {localize(results.length)}
            {localize(' completed')}
          </span>
        </div>
        <p className="helper">
          {localize(
            ' One request at a time · minimum 6.5 s between probes · maximum 10 / 120 s per run · 10 active requests/min/IP shared across tools. ',
          )}
        </p>
      </form>
      {!supported && (
        <Notice>
          {localize(
            mode === 'tcp'
              ? 'TCP Ping unavailable on this edge provider'
              : mode === 'icmp'
                ? 'ICMP requires a configured Probe Agent'
                : 'Active probes are unavailable',
          )}
        </Notice>
      )}
      {mode === 'http' && (
        <Notice>
          {localize(
            ' HTTP measures a HEAD request to /. Redirects are reported, never followed. HTTPS hostnames require a remote agent that supports IP pinning and TLS hostname verification; unsupported runtimes return a clear explanation. ',
          )}
        </Notice>
      )}
      {error && <Notice error>{localize(error)}</Notice>}
      <Card
        title={localize('Probe results')}
        action={<Badge>{localize(busy ? 'Measuring' : 'Ready')}</Badge>}
      >
        <LatencyChart samples={samples} />
        {!results.length ? (
          <Empty
            title={localize('Ready when you are')}
            description="Enter a public target. No synthetic measurements are shown."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{localize('Mode')}</th>
                  <th>{localize('Result')}</th>
                  <th>{localize('Time')}</th>
                  <th>{localize('Target IP')}</th>
                  <th>{localize('Source')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{localize(i + 1)}</td>
                    <td>{localize(r.mode.toUpperCase())}</td>
                    <td>
                      {localize(
                        r.supported
                          ? r.status
                            ? `HTTP ${r.status}`
                            : r.success
                              ? 'Connected'
                              : 'Failed'
                          : r.message,
                      )}
                    </td>
                    <td>
                      {localize(
                        r.totalTime !== undefined || r.latency !== undefined
                          ? `${(r.totalTime ?? r.latency)?.toFixed(2)} ms`
                          : '—',
                      )}
                    </td>
                    <td className="mono">{localize(r.targetIp || 'Unknown')}</td>
                    <td>
                      {localize(r.source)}
                      <small>{localize(r.detection)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {results.at(-1)?.server && (
        <Notice>
          {localize(' Reported Server header: ')}
          {localize(results.at(-1)?.server)}
          {localize('. DNS / connect / TTFB breakdown: Unsupported by runtime. ')}
        </Notice>
      )}
    </>
  );
}
export function DnsLookupPage({ reverse = false }: { reverse?: boolean }) {
  const [name, setName] = useState(''),
    [type, setType] = useState('A'),
    [data, setData] = useState<DNSResult>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setData(undefined);
    try {
      setData(
        await api(
          reverse
            ? `/api/reverse?ip=${encodeURIComponent(name.trim())}`
            : `/api/dns?name=${encodeURIComponent(name.trim())}&type=${type}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        title={localize(reverse ? 'Reverse DNS' : 'DNS Lookup')}
        description="Query configurable DNS-over-HTTPS resolvers. These are DNS records, not a DNS leak test."
      />
      <form className="card tool-form" onSubmit={(e) => void submit(e)}>
        <div className="form-grid">
          <label>
            {localize(reverse ? 'IP address' : 'Domain')}
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={localize(reverse ? '8.8.8.8' : 'example.com')}
            />
          </label>
          {!reverse && (
            <label>
              {localize(' Record type ')}
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA'].map((t) => (
                  <option key={t}>{localize(t)}</option>
                ))}
              </select>
            </label>
          )}
          <RunButton busy={busy}>{localize('Query DNS')}</RunButton>
        </div>
      </form>
      {error && <Notice error>{localize(error)}</Notice>}
      <Card
        title={localize('DNS records')}
        action={<Badge tone="blue">{localize('Provider Detection')}</Badge>}
      >
        {data ? (
          <>
            <p className="helper">
              {localize(' Resolver: ')}
              {localize(data.source)}
              {localize(' · DNS status ')}
              {localize(data.status)} {localize(data.status === 3 ? '(NXDOMAIN)' : '')}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{localize('Name')}</th>
                    <th>{localize('Type')}</th>
                    <th>{localize('TTL')}</th>
                    <th>{localize('Value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.answers.map((a, i) => (
                    <tr key={i}>
                      <td>{localize(a.name)}</td>
                      <td>{localize(a.type)}</td>
                      <td>
                        {localize(a.TTL)}
                        {localize(' s')}
                      </td>
                      <td className="mono">{localize(a.data)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.answers.length && (
              <Empty
                title={localize('No answers returned')}
                description="The resolver returned no matching records. This is not a privacy verdict."
              />
            )}
          </>
        ) : (
          <Empty
            title={localize('Inspect a DNS record')}
            description="Select a record type and submit a domain to see real resolver answers."
          />
        )}
      </Card>
    </>
  );
}
type GlobalResult = ProbeNode & { result: PingResult };
const locations = [
  { id: 'sin', location: 'Singapore', latitude: 1.35, longitude: 103.82 },
  { id: 'hkg', location: 'Hong Kong', latitude: 22.32, longitude: 114.17 },
  { id: 'nrt', location: 'Tokyo', latitude: 35.68, longitude: 139.69 },
  { id: 'lax', location: 'Los Angeles', latitude: 34.05, longitude: -118.24 },
  { id: 'fra', location: 'Frankfurt', latitude: 50.11, longitude: 8.68 },
  { id: 'lhr', location: 'London', latitude: 51.51, longitude: -0.13 },
];
export function RemotePage({ trace = false }: { trace?: boolean }) {
  const health = useHealth();
  const [host, setHost] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [global, setGlobal] = useState<GlobalResult[]>(),
    [result, setResult] = useState<TraceResult>();
  const run = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (trace) setResult(await api('/api/trace', { host }));
      else setGlobal(await api('/api/global', { host }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        title={localize(trace ? 'Traceroute' : 'Global Ping')}
        description={
          trace
            ? 'Hop-by-hop visibility from a real probe agent.'
            : 'One target. Six possible vantage points. Only real, available agents return measurements.'
        }
      />
      <form className="card tool-form" onSubmit={(e) => void run(e)}>
        <label htmlFor="remote-target">{localize('Target hostname / IP')}</label>
        <div className="input-row">
          <input
            id="remote-target"
            required
            placeholder={localize('example.com')}
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
          <RunButton busy={busy} disabled={!health.data?.providers.remoteProbe}>
            {localize(' Run ')}
            {localize(trace ? 'traceroute' : 'global test')}
          </RunButton>
        </div>
      </form>
      {!health.data?.providers.remoteProbe && (
        <Notice>
          {localize(
            trace
              ? 'Traceroute requires a Probe Agent.'
              : 'Node unavailable. Configure PROBE_URL and PROBE_SECRET to connect a coordinator.',
          )}
        </Notice>
      )}
      {error && <Notice error>{localize(error)}</Notice>}
      {!trace && (
        <Card
          title={localize('Probe network')}
          subtitle="Schematic positions · measurements only appear after a successful probe"
        >
          <svg
            className="probe-map"
            viewBox="0 0 900 300"
            role="img"
            aria-label={localize(
              'Six proposed probe locations; target links appear only for real successful results',
            )}
          >
            <defs>
              <pattern id="map-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M30 0H0V30" fill="none" stroke="var(--border)" />
              </pattern>
            </defs>
            <rect width="900" height="300" fill="url(#map-grid)" />
            {locations.map((node, i) => {
              const x = (node.longitude + 180) * 2.5,
                y = (90 - node.latitude) * 1.6;
              const r = global?.find((n) => n.id === node.id)?.result;
              return (
                <g key={node.id}>
                  {r?.success && (
                    <path
                      d={`M${x} ${y} Q450 20 450 250`}
                      fill="none"
                      stroke="var(--accent)"
                      strokeDasharray="5 5"
                    />
                  )}
                  <circle cx={x} cy={y} r="5" fill={r?.success ? 'var(--accent)' : 'var(--muted)'} />
                  <text x={x + 9} y={y + (i === 1 ? 25 : i === 5 ? -14 : 4)} fill="var(--text)" fontSize="12">
                    {localize(node.location)}
                  </text>
                </g>
              );
            })}
            {global?.some((n) => n.result.success) && (
              <text x="450" y="277" textAnchor="middle" fill="var(--accent)" fontSize="13">
                {localize(' Target: ')}
                {localize(host)}
                {localize(' (schematic) ')}
              </text>
            )}
          </svg>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{localize('Location')}</th>
                  <th>{localize('Status')}</th>
                  <th>{localize('Latency')}</th>
                  <th>{localize('Target IP')}</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((n) => {
                  const r = global?.find((g) => g.id === n.id)?.result;
                  return (
                    <tr key={n.id}>
                      <td>{localize(n.location)}</td>
                      <td>
                        {localize(
                          r?.supported
                            ? r.success
                              ? 'Responded'
                              : 'Failed'
                            : r?.message || 'Node unavailable',
                        )}
                      </td>
                      <td>{localize(r?.latency !== undefined ? r.latency.toFixed(2) + ' ms' : '—')}</td>
                      <td>{localize(r?.targetIp || 'Unknown')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {trace && (
        <Card title={localize('Route hops')}>
          {result?.supported ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {['Hop', 'IP', 'Hostname', 'ASN', 'Country', 'Latency'].map((x) => (
                      <th key={x}>{localize(x)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.hops.map((h) => (
                    <tr key={h.hop}>
                      <td>{localize(h.hop)}</td>
                      <td>{localize(h.ip || '*')}</td>
                      <td>{localize(h.hostname || 'Unknown')}</td>
                      <td>{localize(h.asn || 'Unknown')}</td>
                      <td>{localize(h.country || 'Unknown')}</td>
                      <td>{localize(h.latency === null ? '*' : h.latency + ' ms')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={localize('No route measured')}
              description={
                result?.message ||
                'A connected probe is required to report route hops. Browser fetch cannot perform traceroute.'
              }
            />
          )}
        </Card>
      )}
      <Card title={localize('Probe contract')}>
        <DataList
          data={{
            Transport: 'Authenticated HTTPS',
            Authentication: 'Bearer PROBE_SECRET',
            'Target policy': 'Resolve all addresses, validate, then pin connection IP',
            'Execution policy': 'Fixed executable and arguments; never shell=true',
            'Result source': 'Provider Detection — Remote Probe Agent',
          }}
        />
      </Card>
    </>
  );
}
