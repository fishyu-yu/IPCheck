import { localize } from '../config/i18n';
import { useEffect, useRef, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { browserEnvironment, environmentHash, fingerprintEnvironment } from '../services/browser';
import { testWebRtc, type RtcResult } from '../services/webrtc';
import { api } from '../services/api';
import { useCurrentIp, useHealth } from '../hooks/queries';
import type { DnsSession } from '../types';
import { Badge, Card, CopyButton, DataList, Empty, Notice, PageTitle, RunButton } from '../components/ui';
export function EnvironmentPage() {
  const [data] = useState(browserEnvironment);
  return (
    <>
      <PageTitle
        eyebrow="PRIVACY / LOCAL ONLY"
        title={localize('Browser environment')}
        description="A readable inventory of what your browser exposes to this page."
      />
      <Notice>
        {localize(
          ' These values are self-reported and may be reduced or spoofed. Browser and device identification are estimates. No environment payload is sent to the API. ',
        )}
      </Notice>
      <div className="two-columns">
        {Object.entries(data.sections).map(([title, values]) => (
          <Card
            key={title}
            title={localize(title)}
            action={<Badge>{localize('Browser-side Detection')}</Badge>}
          >
            <DataList
              data={Object.fromEntries(
                Object.entries(values).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v]),
              )}
            />
          </Card>
        ))}
      </div>
    </>
  );
}
export function FingerprintPage() {
  const [data, setData] = useState<Record<string, string | number | boolean>>(),
    [hash, setHash] = useState(''),
    [error, setError] = useState('');
  const run = async () => {
    setError('');
    try {
      const d = fingerprintEnvironment();
      setData(d);
      setHash(await environmentHash(d));
    } catch {
      setError('Hashing unavailable. A secure context and Web Crypto support are required.');
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="PRIVACY / LOCAL ONLY"
        title={localize('Browser fingerprint')}
        description="Understand your observable environment without creating a server-side identity."
      />
      <Card
        title={localize('Browser environment hash')}
        action={
          <Badge tone="green">
            <LockKeyhole size={12} />
            {localize(' Local only ')}
          </Badge>
        }
      >
        <Notice>
          {localize(
            ' This identifier describes the current browser environment and may change. It is not guaranteed unique and is never uploaded by this application. ',
          )}
        </Notice>
        <div className="test-toolbar">
          <RunButton onClick={() => void run()}>{localize('Compute locally')}</RunButton>
        </div>
        {hash && (
          <div className="hash-output">
            <code>{localize(hash)}</code>
            <CopyButton text={hash} />
          </div>
        )}
        {error && <Notice error>{localize(error)}</Notice>}
        <p className="helper">
          {localize(
            ' SHA-256 of sorted observable fields. No persistent storage, canvas image extraction, or audio rendering is used. ',
          )}
        </p>
      </Card>
      {data && (
        <Card title={localize('Observable fields')}>
          <DataList
            data={Object.fromEntries(
              Object.entries(data).map(([k, v]) => [
                k,
                typeof v === 'boolean' ? (v ? 'Supported' : 'Unsupported') : v,
              ]),
            )}
          />
        </Card>
      )}
    </>
  );
}
export function WebRtcPage() {
  const current = useCurrentIp(),
    [data, setData] = useState<RtcResult>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async () => {
    const ctrl = new AbortController();
    controller.current = ctrl;
    setData(undefined);
    setBusy(true);
    setError('');
    try {
      setData(await testWebRtc(current.data?.ip, ctrl.signal));
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="PRIVACY"
        title={localize('WebRTC leak test')}
        description="Inspect ICE candidates and compare observable public addresses with your HTTP connection."
      />
      <Card
        title={localize('ICE candidate discovery')}
        action={<Badge tone="blue">{localize('Browser-side Detection')}</Badge>}
      >
        <Notice>
          {localize(
            ' Starting this test contacts Cloudflare’s public STUN service (stun.cloudflare.com:3478), which sees your public network address. Candidate data stays in this browser. No camera or microphone permission is requested. ',
          )}
        </Notice>
        <div className="test-toolbar">
          <RunButton busy={busy} onClick={() => void run()}>
            {localize(' Start WebRTC test ')}
          </RunButton>
          {busy && (
            <button className="button" onClick={() => controller.current?.abort()}>
              {localize(' Cancel ')}
            </button>
          )}
        </div>
        <DataList
          data={{
            'HTTP public IP': current.data?.ip,
            Comparison: data?.verdict || 'Not checked',
            'Local address protection': data?.protected ? 'Local IP protected by browser / mDNS' : 'Unknown',
            'Relay candidates': 'Require TURN configuration; no public TURN credentials bundled',
          }}
        />
        {data && <Notice error={data.verdict === 'Potential leak detected'}>{localize(data.detail)}</Notice>}
        {error && (
          <Notice error>
            {localize('Unable to determine: ')}
            {localize(error)}
          </Notice>
        )}
      </Card>
      <Card title={localize('WebRTC candidates')}>
        {data?.candidates.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{localize('Type')}</th>
                  <th>{localize('Address')}</th>
                  <th>{localize('Protocol')}</th>
                  <th>{localize('Port')}</th>
                </tr>
              </thead>
              <tbody>
                {data.candidates.map((c, i) => (
                  <tr key={i}>
                    <td>
                      {localize(
                        (
                          {
                            host: 'Host Candidate',
                            srflx: 'Server Reflexive Candidate',
                            relay: 'Relay Candidate',
                          } as Record<string, string>
                        )[c.type] || c.type,
                      )}
                    </td>
                    <td className="mono">{localize(c.address)}</td>
                    <td>{localize(c.protocol)}</td>
                    <td>{localize(c.port || 'Unknown')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={localize(data ? 'No candidates observed' : 'No test performed')}
            description="Missing or hidden candidates cannot be interpreted as No Leak."
          />
        )}
      </Card>
    </>
  );
}
export function DnsLeakPage() {
  const health = useHealth(),
    [data, setData] = useState<DnsSession>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const run = async () => {
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setError('');
    setData(undefined);
    try {
      const session = await api<DnsSession>('/api/dns-leak', {}, c.signal);
      setData(session);
      if (!session.supported || !session.hostname) return;
      await fetch(`https://${session.hostname}/probe`, {
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.any([c.signal, AbortSignal.timeout(5000)]),
      }).catch(() => {});
      for (let i = 0; i < 5 && !c.signal.aborted; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (c.signal.aborted) break;
        const result = await api<DnsSession>(
          '/api/dns-leak/results',
          { id: session.id, token: session.token },
          c.signal,
        );
        setData(result);
        if (result.complete) break;
      }
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="PRIVACY"
        title={localize('DNS leak test')}
        description="Real resolver observation requires an authoritative DNS collector."
      />
      <Card
        title={localize('Authoritative resolver test')}
        action={
          <Badge>
            {localize(health.data?.capabilities.dnsCollector ? 'Collector configured' : 'Not configured')}
          </Badge>
        }
      >
        <Notice>
          {localize(
            health.data?.capabilities.dnsCollector
              ? 'Starting this test causes a unique random subdomain to resolve. The configured collector temporarily sees recursive resolver addresses.'
              : 'DNS Leak advanced test requires DNS collector configuration.',
          )}
        </Notice>
        <ol className="steps">
          <li>{localize('Create a random UUID under your delegated test domain.')}</li>
          <li>{localize('Request that hostname from this browser.')}</li>
          <li>{localize('Collect resolver source IPs at the authoritative DNS server.')}</li>
          <li>{localize('Read authenticated, short-lived results for this session.')}</li>
        </ol>
        <RunButton busy={busy} disabled={!health.data?.capabilities.dnsCollector} onClick={() => void run()}>
          {localize(' Start DNS leak test ')}
        </RunButton>
        {busy && (
          <button className="button" onClick={() => ctrl.current?.abort()}>
            {localize(' Cancel ')}
          </button>
        )}
        {error && <Notice error>{localize(error)}</Notice>}
        {data && (
          <Notice>
            {localize(
              data.message ||
                `${data.complete ? 'Collector complete' : 'Partial / awaiting collector'} · ${data.resolvers?.length ?? 0} resolvers observed. Empty results do not prove absence of a leak.`,
            )}
          </Notice>
        )}
      </Card>
      <Card title={localize('Observed resolvers')}>
        {data?.resolvers?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{localize('Resolver IP')}</th>
                  <th>{localize('ASN')}</th>
                  <th>{localize('Country')}</th>
                  <th>{localize('Organization')}</th>
                </tr>
              </thead>
              <tbody>
                {data.resolvers.map((r) => (
                  <tr key={r.ip}>
                    <td>{localize(r.ip)}</td>
                    <td>{localize(r.asn || 'Unknown')}</td>
                    <td>{localize(r.country || 'Unknown')}</td>
                    <td>{localize(r.organization || 'Unknown')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={localize('Unable to determine')}
            description="A regular DNS-over-HTTPS lookup does not reveal which recursive resolver your browser used."
          />
        )}
      </Card>
    </>
  );
}
