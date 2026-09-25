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
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
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
  return <span className={'badge ' + tone}>{children}</span>;
}
export function DetectionBadge({ type }: { type: Detection }) {
  return (
    <Badge tone={type === 'Real Detection' ? 'green' : type === 'Provider Detection' ? 'blue' : 'muted'}>
      {type}
    </Badge>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={'notice ' + (error ? 'error' : '')} role={error ? 'alert' : 'note'}>
      <Info size={16} />
      <div>{children}</div>
    </div>
  );
}
export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div aria-label="Loading results" className="skeleton-block">
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
      aria-label={failed ? 'Copy failed' : copied ? 'Copied' : 'Copy to clipboard'}
      title={failed ? 'Copy unavailable; select text manually' : 'Copy'}
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
          <dt>{k}</dt>
          <dd>{v === undefined || v === null || v === '' ? 'Unknown' : v}</dd>
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
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
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
      {busy && <LoaderCircle className="spin" size={16} />} {busy ? 'Running…' : children}
    </button>
  );
}
export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Info size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
