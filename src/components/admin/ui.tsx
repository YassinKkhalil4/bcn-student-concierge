import type { ReactNode } from "react";
import type { CaseBucket } from "@/lib/server/case-listing";
import type { PaymentStatus, Stage } from "@/lib/server/storage";

/** Small, shared building blocks for the staff dashboard. Server-safe. */

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  in_progress: "In progress",
  completed: "Completed",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Unpaid",
  paid: "Paid",
  refunded: "Refunded",
};

export const BUCKET_LABEL: Record<CaseBucket, string> = {
  action: "Needs action",
  in_progress: "In progress",
  unpaid: "Awaiting payment",
  completed: "Completed",
  purged: "Erased",
  all: "All",
};

type Tone = "neutral" | "good" | "warn" | "alert" | "info" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "bg-paper-dim text-ink-muted ring-paper-line",
  good: "bg-accent-tint text-accent-deep ring-accent/20",
  warn: "bg-paper-dim text-ink ring-paper-edge",
  alert: "bg-accent-tint text-accent-deep ring-accent/30",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  muted: "bg-transparent text-ink-soft ring-paper-line",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone: Tone = status === "paid" ? "good" : status === "pending" ? "warn" : "muted";
  return <Badge tone={tone}>{PAYMENT_LABEL[status]}</Badge>;
}

export function StageBadge({ stage, purged }: { stage: Stage; purged?: boolean }) {
  if (purged) return <Badge tone="muted">Erased</Badge>;
  const tone: Tone = stage === "completed" ? "good" : stage === "in_progress" ? "info" : "neutral";
  return <Badge tone={tone}>{STAGE_LABEL[stage]}</Badge>;
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-paper-line bg-white ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-paper-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Two-column definition list. Empty values render as a dash, visibly empty. */
export function Fields({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-soft">{label}</dt>
          <dd className="min-w-0 break-words font-medium text-ink">
            {value === undefined || value === null || value === "" ? (
              <span className="font-normal text-ink-soft">—</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Madrid",
});
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export const formatDate = (iso: string) => DATE.format(new Date(iso));
export const formatDateTime = (iso: string) => DATE_TIME.format(new Date(iso));
export const shortRef = (id: string) => id.slice(0, 8);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
