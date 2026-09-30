import { localize } from '../config/i18n';
import { ShieldCheck } from 'lucide-react';
import type { RiskResult } from '../types';
import { riskWeights } from '../config/risk.config';
import { Badge, Card, Notice } from './ui';
export function RiskPanel({ data, compact = false }: { data?: RiskResult; compact?: boolean }) {
  const keys = Object.keys(riskWeights) as (keyof typeof riskWeights)[];
  return (
    <Card
      title={localize('Risk analysis')}
      subtitle="Evidence, not assumptions"
      action={<ShieldCheck size={17} className="text-muted" />}
    >
      <div className="risk-summary">
        <div className="risk-ring" style={{ '--risk': (data?.score ?? 0) + '%' } as React.CSSProperties}>
          <strong>{localize(data?.score ?? '—')}</strong>
          <span>/ 100</span>
        </div>
        <div>
          <Badge
            tone={
              data?.score === undefined || data.score === null
                ? 'muted'
                : data.score < 25
                  ? 'green'
                  : data.score < 60
                    ? 'yellow'
                    : 'red'
            }
          >
            {localize(data?.level || 'Not checked')}
          </Badge>
          <p>
            {localize(data?.checked ?? 0)}
            {localize(' of ')}
            {localize(keys.length)}
            {localize(' signals checked ')}
          </p>
          <small>{localize('Lower score = lower observed risk')}</small>
        </div>
      </div>
      <div className="signal-list">
        {keys.slice(0, compact ? 5 : undefined).map((key) => {
          const all = data?.signals.filter((s) => s.key === key && s.value !== null) || [];
          return (
            <div key={key}>
              <span>
                {localize(
                  key === 'vpn' ? 'VPN' : key === 'tor' ? 'Tor' : key.charAt(0).toUpperCase() + key.slice(1),
                )}
              </span>
              <div>
                {all.length ? (
                  all.map((s, i) => (
                    <span
                      key={i}
                      className={'signal ' + (s.value ? 'warning' : 'clear')}
                      title={localize(
                        `Source: ${s.source}; confidence: ${s.confidence === null ? 'not supplied' : s.confidence}; Provider Detection`,
                      )}
                    >
                      {localize(
                        typeof s.value === 'number'
                          ? `${Math.round(s.value * 100)}% evidence`
                          : s.value
                            ? 'Detected'
                            : 'Not detected',
                      )}
                      <small>
                        {localize(s.source)}
                        {localize(' · confidence')}
                        {localize(' ')}
                        {localize(s.confidence === null ? 'Unknown' : `${Math.round(s.confidence * 100)}%`)}
                      </small>
                    </span>
                  ))
                ) : (
                  <span className="text-muted">{localize('Not checked')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!compact && (
        <>
          <Notice>
            {localize(
              data?.model ||
                'This score is a weighted model, not an absolute safety verdict. Configure a risk provider to obtain evidence.',
            )}
          </Notice>
          {data?.conflicts.length ? (
            <Notice error>
              {localize(' Conflicting Data: ')}
              {data.conflicts.map((key) => localize(key)).join('、')}
              {localize('. All provider findings are retained. ')}
            </Notice>
          ) : null}
          {data?.partial && (
            <Notice>
              {localize(
                ' Partial data. Unchecked signals can change the score; a low score is not an assurance of safety. ',
              )}
            </Notice>
          )}
          {data?.warnings.map((w) => (
            <p key={w} className="helper">
              {localize(w)}
            </p>
          ))}
        </>
      )}
    </Card>
  );
}
