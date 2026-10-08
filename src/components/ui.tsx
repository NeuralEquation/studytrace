import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{actions}</div>
    </header>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  children,
  to,
  label = "教材を登録する",
}: {
  children: ReactNode;
  to?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <p>{children}</p>
      {to && (
        <Link className="button" to={to}>
          {label} →
        </Link>
      )}
    </div>
  );
}
export function Progress({
  value,
  max = 100,
}: {
  value: number;
  max?: number;
}) {
  return <progress aria-label="進捗" value={value} max={max || 1} />;
}
export function ExternalLink({ url }: { url?: string }) {
  return url ? (
    <a
      className="button secondary"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      元サイトで開く <ArrowUpRight size={16} />
    </a>
  ) : null;
}
export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
