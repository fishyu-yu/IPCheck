import { localize } from '../config/i18n';
import { useState, type ReactNode } from 'react';
import { Check, Copy, Info, LoaderCircle } from 'lucide-react';
import type { Detection } from '../types';
export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'card ' + className}>
      {title && (
        <div className="card-heading">
          <div>
            <h2>{localize(title)}</h2>
            {subtitle && <p>{localize(subtitle)}</p>}
          </div>
          {localize(action)}
        </div>
      )}
      {localize(children)}
    </section>
  );
}
export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'green' | 'blue' | 'yellow' | 'red';
}) {
  return <span className={'badge ' + tone}>{localize(children)}</span>;
}
export function DetectionBadge({ type }: { type: Detection }) {
  return (
    <Badge tone={type === 'Real Detection' ? 'green' : type === 'Provider Detection' ? 'blue' : 'muted'}>
      {localize(type)}
    </Badge>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={'notice ' + (error ? 'error' : '')} role={error ? 'alert' : 'note'}>
      <Info size={16} />
      <div>{localize(children)}</div>
    </div>
  );
}
export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div aria-label={localize('Loading results')} className="skeleton-block">
      {Array.from({ length: lines }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      className="icon-button"
      aria-label={localize(failed ? 'Copy failed' : copied ? 'Copied' : 'Copy to clipboard')}
      title={localize(failed ? 'Copy unavailable; select text manually' : 'Copy')}
      onClick={() =>
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          })
          .catch(() => setFailed(true))
      }
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}
export function DataList({ data }: { data: Record<string, ReactNode> }) {
  return (
    <dl className="data-list">
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <dt>{localize(k)}</dt>
          <dd>{localize(v === undefined || v === null || v === '' ? 'Unknown' : v)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function PageTitle({
  eyebrow = 'NETWORK WORKSPACE',
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{localize(eyebrow)}</p>
        <h1>{localize(title)}</h1>
        <p>{localize(description)}</p>
      </div>
      {localize(action)}
    </div>
  );
}
export function RunButton({
  busy,
  children = 'Run test',
  ...props
}: { busy?: boolean; children?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="button primary" disabled={busy || props.disabled} {...props}>
      {busy && <LoaderCircle className="spin" size={16} />} {localize(busy ? 'Running…' : children)}
    </button>
  );
}
export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Info size={22} />
      </span>
      <h3>{localize(title)}</h3>
      <p>{localize(description)}</p>
    </div>
  );
}
