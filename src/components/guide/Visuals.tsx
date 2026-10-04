import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Block, GanttTone, Owner, Tone } from "@/lib/guide/types";
import { CheckMark } from "@/components/icons";
import { Inline } from "./Inline";

/*
 * The guide's charts, as responsive components.
 *
 * Each one is drawn from the PDF's own page (the route map, the 90-day chart,
 * the cost bars, the workload bars) and takes plain data from the chapter, so
 * the web page and the PDF show the same thing. They are built from divs and
 * percentages rather than an image or a chart library: they reflow on a phone,
 * scale with the reader's text size, and every number is real text a screen
 * reader and a search engine can read.
 */

type Of<K extends Block["kind"]> = Extract<Block, { kind: K }>;

const TONE: Record<Tone, { solid: string; soft: string; text: string }> = {
  eu: { solid: "bg-[var(--g-eu)]", soft: "bg-[var(--g-eu-bg)]", text: "text-[var(--g-eu)]" },
  non: { solid: "bg-[var(--g-non)]", soft: "bg-[var(--g-non-bg)]", text: "text-[var(--g-non)]" },
  all: { solid: "bg-[var(--g-grey)]", soft: "bg-[var(--g-sand)]", text: "text-ink-muted" },
};

export function Chip({ tone, children }: { tone: Tone | "free" | "red"; children: ReactNode }) {
  const c =
    tone === "free"
      ? "bg-[var(--g-teal-bg)] text-[var(--g-teal)]"
      : tone === "red"
        ? "bg-[var(--g-red-bg)] text-[var(--g-red)]"
        : `${TONE[tone].soft} ${TONE[tone].text}`;
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-2 py-1 font-sans text-[0.6875rem] font-bold uppercase leading-none tracking-wider ${c}`}>
      {children}
    </span>
  );
}

const cardBox = "border border-paper-edge bg-white";
const mono = "font-mono";
const caption = "font-mono text-xs uppercase tracking-wider text-ink-soft";

// ── Route A and Route B ────────────────────────────────────────────────────

export function RouteCards({ block }: { block: Of<"routecards"> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {block.items.map((r) => (
        <article key={r.label} className={`${cardBox} border-t-4 ${r.tone === "eu" ? "border-t-[var(--g-eu)]" : "border-t-[var(--g-non)]"} flex flex-col px-5 py-5`}>
          <Chip tone={r.tone}>{r.label}</Chip>
          <h3 className="mt-3 font-sans text-xl font-bold tracking-tight text-ink">{r.title}</h3>
          <p className="prose-body mt-2">
            <Inline text={r.lede} />
          </p>
          <dl className="mt-4 border-t border-paper-line">
            {r.rows.map((row) => (
              <div key={row.k} className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-paper-line py-2 sm:grid-cols-[7.5rem_1fr]">
                <dt className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-soft">{row.k}</dt>
                <dd className="font-serif text-read text-ink">
                  <Inline text={row.v} />
                </dd>
              </div>
            ))}
          </dl>
          <Link href={r.href} className={`mt-4 font-mono text-sm font-bold underline-offset-4 hover:underline ${TONE[r.tone].text}`}>
            {r.cta} →
          </Link>
        </article>
      ))}
    </div>
  );
}

// ── The route map ──────────────────────────────────────────────────────────

export function Swimlanes({ block }: { block: Of<"swimlanes"> }) {
  return (
    <div className="space-y-4">
      {block.lanes.map((lane) => {
        const n = lane.stops.length;
        const track = lane.tone === "all" ? "bg-[var(--g-rail)]" : TONE[lane.tone].solid;
        const ring = lane.tone === "all" ? "border-[var(--g-grey)]" : lane.tone === "eu" ? "border-[var(--g-eu)]" : "border-[var(--g-non)]";
        return (
          <section key={lane.chip} className={`${cardBox} px-4 py-4 sm:px-5`}>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Chip tone={lane.tone}>{lane.chip}</Chip>
              <h3 className="font-sans text-base font-bold tracking-tight text-ink">{lane.name}</h3>
              <span className="text-sm text-ink-soft">{lane.sub}</span>
            </header>

            {/* Phone: a vertical rail. */}
            <ol className="relative mt-4 space-y-3 border-l-2 pl-5 md:hidden" style={{ borderColor: "var(--g-track)" }}>
              {lane.stops.map((s, i) => (
                <li key={i} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[1.78rem] top-1 h-3 w-3 rounded-full border-2 bg-white ${s.mark === "deadline" ? "border-[var(--g-red)]" : ring} ${s.mark === "final" ? track : ""}`}
                  />
                  <span className="block font-sans text-sm font-bold text-ink">{s.label}</span>
                  {s.sub && <span className={`block font-mono text-xs ${s.mark === "deadline" ? "font-bold text-[var(--g-red)]" : "text-ink-soft"}`}>{s.sub}</span>}
                </li>
              ))}
              {lane.wait && (
                <li className="g-hatch mt-2 px-2 py-1 font-mono text-[0.6875rem] font-bold text-onink">{lane.wait.label}</li>
              )}
            </ol>

            {/* Wider: stops along a line. */}
            <div className="mt-5 hidden md:block">
              <div className="relative">
                <div className={`absolute top-[7px] h-[3px] ${track}`} style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />
                <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                  {lane.stops.map((s, i) => (
                    <li key={i} className="flex flex-col items-center px-1 text-center">
                      <span
                        aria-hidden
                        className={`h-[17px] w-[17px] rounded-full border-[3px] bg-white ${s.mark === "deadline" ? "border-[var(--g-red)]" : ring} ${s.mark === "final" ? track : ""}`}
                      />
                      <span className="mt-2 font-sans text-xs font-bold leading-tight text-ink">{s.label}</span>
                      {s.sub && <span className={`mt-1 font-mono text-[0.6875rem] ${s.mark === "deadline" ? "font-bold text-[var(--g-red)]" : "text-ink-soft"}`}>{s.sub}</span>}
                    </li>
                  ))}
                </ol>
              </div>
              {lane.wait && (
                <div className="relative mt-3 h-8">
                  <div
                    className="g-hatch absolute top-0 h-2 opacity-80"
                    style={{ left: `${((lane.wait.from + 0.5) / n) * 100}%`, right: `${100 - ((lane.wait.to + 0.5) / n) * 100}%` }}
                  />
                  <span className="absolute top-3 font-mono text-[0.6875rem] font-bold text-ink-muted" style={{ left: `${((lane.wait.from + 0.5) / n) * 100}%` }}>
                    {lane.wait.label}
                  </span>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Route A against Route B ────────────────────────────────────────────────

export function Bars2({ block }: { block: Of<"bars2"> }) {
  return (
    <section className={`${cardBox} px-4 py-4 sm:px-5`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-sans text-base font-bold tracking-tight text-ink">{block.title}</h3>
        <span className="flex gap-4 font-sans text-xs font-bold text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-[var(--g-eu)]" />{block.legend[0]}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-[var(--g-non)]" />{block.legend[1]}</span>
        </span>
      </header>
      <div className="mt-3 divide-y divide-paper-line border-t border-paper-line">
        {block.rows.map((row) => (
          <div key={row.label} className="grid gap-2 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <div>
              <div className="font-sans text-sm font-bold text-ink">{row.label}</div>
              {row.sub && <div className="text-xs text-ink-soft">{row.sub}</div>}
            </div>
            {"chips" in row ? (
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="eu">{row.chips[0]}</Chip>
                <Chip tone="non">{row.chips[1]}</Chip>
              </div>
            ) : (
              <div className="space-y-1.5">
                {([["eu", row.eu], ["non", row.non]] as const).map(([tone, bar]) => (
                  <div key={tone} className="flex items-center gap-3">
                    <div className="h-3.5 flex-1 bg-[var(--g-track)]">
                      <div className={`h-full ${TONE[tone].solid}`} style={{ width: `${bar.pct}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs font-bold text-ink">{bar.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── The first 90 days, to scale ────────────────────────────────────────────

const GANTT: Record<GanttTone, string> = {
  legal: "bg-[var(--g-red)]",
  blocks: "bg-[var(--g-amber-2)]",
  easy: "bg-[var(--g-teal-2)]",
  nobody: "g-hatch",
};

export function Gantt({ block }: { block: Of<"gantt"> }) {
  return (
    <section className={`${cardBox} px-4 py-4 sm:px-5`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-sans text-base font-bold tracking-tight text-ink">{block.title}</h3>
        <span className="text-xs text-ink-soft">{block.sub}</span>
      </header>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs font-bold text-ink">
        {block.legend.map((l) => (
          <li key={l.tone} className="inline-flex items-center gap-1.5">
            <i className={`h-2.5 w-3.5 ${GANTT[l.tone]}`} />
            {l.label}
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-paper-line">
        {block.rows.map((r) => {
          const left = (r.from / 90) * 100;
          const width = Math.max(((r.to - r.from) / 90) * 100, 2.2);
          return (
            <div key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-paper-line py-2 md:grid-cols-[13rem_1fr_3.5rem] md:gap-x-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-sans text-sm font-bold text-ink">
                  {r.label}
                  {r.tag && <Chip tone={r.tag.tone}>{r.tag.label}</Chip>}
                </div>
                <div className="text-xs text-ink-soft">{r.sub}</div>
              </div>
              <div className="text-right font-mono text-xs font-bold md:order-3">
                <span className={r.mark ? "text-[var(--g-red)]" : "text-ink"}>{r.value}</span>
              </div>
              <div className="relative col-span-2 h-[18px] bg-[var(--g-track)] md:col-span-1 md:order-2">
                <div className={`absolute inset-y-0 ${GANTT[r.tone]}`} style={{ left: `${left}%`, width: `${width}%` }} />
                {r.mark && <div className="absolute -inset-y-[7px] w-[3px] bg-ink" style={{ left: `calc(${(r.to / 90) * 100}% - 1.5px)` }} />}
              </div>
            </div>
          );
        })}
        <div className="grid md:grid-cols-[13rem_1fr_3.5rem] md:gap-x-4">
          <span className="hidden md:block" />
          <div className="relative mt-2 h-4 font-mono text-[0.6875rem] text-ink-soft" aria-hidden>
            {[0, 30, 60, 90].map((d) => (
              <span key={d} className="absolute whitespace-nowrap" style={d === 90 ? { right: 0 } : d === 0 ? { left: 0 } : { left: `${(d / 90) * 100}%`, transform: "translateX(-50%)" }}>
                {d === 0 ? block.axisStart : d}
              </span>
            ))}
          </div>
        </div>
      </div>
      {block.note && <p className="mt-4 text-sm text-ink-soft">{block.note}</p>}
    </section>
  );
}

// ── NIE, TIE, padrón, expediente ───────────────────────────────────────────

const GLYPHS = [
  "M9 4 7 20M17 4l-2 16M4 9h16M3 15h16", // #
  "M3 6h18v12H3zM7 11h3M7 14h6M15 10h3v4h-3z", // card
  "M6 3h9l4 4v14H6zM9 12h7M9 16h7", // certificate
  "M3 11 12 4l9 7v9H5v-9", // house
  "M3 6h7l2 2h9v11H3z", // folder
];

export function Terms({ block }: { block: Of<"terms"> }) {
  return (
    <div className={cardBox}>
      <div className="hidden grid-cols-[13rem_1fr_1fr] gap-4 border-b-2 border-ink px-5 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-soft md:grid">
        {block.head.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      <div className="divide-y divide-paper-line">
        {block.rows.map((r, i) => (
          <div key={r.term} className="grid gap-3 px-5 py-4 md:grid-cols-[13rem_1fr_1fr] md:gap-4">
            <div className="flex gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center bg-[var(--g-sand)] text-ink" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={GLYPHS[i % GLYPHS.length]} />
                </svg>
              </span>
              <div>
                <div className="font-sans text-lg font-extrabold leading-tight tracking-tight text-ink">{r.term}</div>
                <div lang="es" className="mt-0.5 font-mono text-[0.6875rem] leading-snug text-ink-soft">{r.native}</div>
              </div>
            </div>
            <div>
              <div className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-ink-soft">{r.kind}</div>
              {r.what.map((w) => (
                <p key={w} className="prose-body mt-1">
                  <Inline text={w} />
                </p>
              ))}
            </div>
            <div>
              {r.remember.map((w) => (
                <p key={w} className="prose-body">
                  <Inline text={w} />
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Who controls each step ────────────────────────────────────────────────

const OWNER: Record<Owner, { box: string; dot: string }> = {
  you: { box: "border-t-[var(--g-teal)] bg-[var(--g-teal-bg)]", dot: "bg-[var(--g-teal)]" },
  nobody: { box: "border-t-[var(--g-slate)] bg-[var(--g-nobody-bg)]", dot: "g-hatch" },
  office: { box: "border-t-[var(--g-amber-2)] bg-[var(--g-amber-bg)]", dot: "bg-[var(--g-amber-2)]" },
};

export function Controls({ block }: { block: Of<"controls"> }) {
  return (
    <section className={`${cardBox} px-4 py-4 sm:px-5`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-sans text-base font-bold tracking-tight text-ink">{block.title}</h3>
        <ul className="flex gap-4 font-sans text-xs font-bold text-ink">
          {block.legend.map((l) => (
            <li key={l.owner} className="inline-flex items-center gap-1.5">
              <i className={`h-2.5 w-2.5 rounded-full ${OWNER[l.owner].dot}`} />
              {l.label}
            </li>
          ))}
        </ul>
      </header>
      <ol className="mt-3 grid gap-2 sm:grid-cols-5">
        {block.steps.map((s) => (
          <li key={s.n} className={`border-t-4 px-3 py-3 ${OWNER[s.owner].box}`}>
            <div className="font-sans text-sm font-bold text-ink">{s.n}</div>
            <div className="mt-0.5 text-xs text-ink-muted">{s.sub}</div>
          </li>
        ))}
      </ol>
      {block.next && (
        <p className="mt-3 text-xs text-ink-muted">
          <Inline text={block.next} />
        </p>
      )}
    </section>
  );
}

// ── The appointment-day kit ───────────────────────────────────────────────

export function Kit({ block }: { block: Of<"kit"> }) {
  const { checklist: c, photo: p } = block;
  return (
    <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
      <section className={`${cardBox} px-5 py-5`}>
        <header className="flex items-center justify-between gap-2">
          <h3 className="font-sans text-lg font-bold tracking-tight text-ink">{c.title}</h3>
          <Chip tone="non">{c.count}</Chip>
        </header>
        <ul className="mt-3 space-y-2.5">
          {c.items.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-1 h-4 w-4 flex-none border-2 border-ink bg-white" aria-hidden />
              <span className="prose-body">
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className={`${cardBox} px-5 py-5`}>
        <h3 className="font-sans text-lg font-bold tracking-tight text-ink">{p.title}</h3>
        <div className="mt-3 flex gap-4">
          <div className="flex h-28 w-[5.5rem] flex-none items-end justify-center overflow-hidden border-2 border-ink bg-white" aria-hidden>
            <svg viewBox="0 0 60 80" className="h-full w-full">
              <ellipse cx="30" cy="30" rx="12" ry="14" fill="var(--g-skin)" />
              <path d="M6 80c0-18 10-26 24-26s24 8 24 26z" fill="var(--g-skin)" />
            </svg>
          </div>
          <div>
            <div className="font-sans text-2xl font-extrabold tracking-tight text-ink">{p.size}</div>
            <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
              {p.rules.map((r) => (
                <li key={r}>
                  <Inline text={r} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 bg-[var(--g-teal-bg)] px-3 py-2 text-sm text-ink">
          <Inline text={p.note} />
        </p>
      </section>
    </div>
  );
}

// ── Strips on a shared scale ──────────────────────────────────────────────

const SEG: Record<string, string> = {
  red: "bg-[var(--g-red)] text-onink",
  teal: "bg-[var(--g-teal)] text-onink",
  ink: "bg-ink text-onink",
  purple: "bg-[var(--g-non-bg)] text-[var(--g-non)] border border-dashed border-[var(--g-non)]",
  amber: "bg-transparent text-[var(--g-amber)] border border-dashed border-[var(--g-amber-2)]",
  grey: "bg-[var(--g-track)] text-ink-muted",
  gap: "g-hatch-red text-onink",
};

export function Strips({ block }: { block: Of<"strips"> }) {
  return (
    <section className={`${cardBox} px-4 py-4 sm:px-5`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--g-teal)]">{block.title}</h3>
        {block.tag && <span className="text-xs text-ink-soft">{block.tag}</span>}
      </header>
      <div className="mt-3 space-y-3">
        {block.rows.map((row) => (
          <div key={row.label} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
            <div className="font-sans text-sm font-bold text-ink">{row.label}</div>
            <div className="relative h-8 bg-[var(--g-track)]/60">
              {row.segs.map((s, i) => (
                <div
                  key={i}
                  className={`absolute inset-y-0 flex items-center overflow-hidden px-2 font-mono text-[0.625rem] font-bold uppercase leading-tight tracking-wide sm:text-[0.6875rem] ${SEG[s.tone]}`}
                  style={{ left: `${s.from}%`, width: `${s.to - s.from}%` }}
                >
                  {s.text}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {block.note && (
        <p className="prose-body mt-4">
          <Inline text={block.note} />
        </p>
      )}
    </section>
  );
}

// ── Booking to renewal ────────────────────────────────────────────────────

const FLOW_ICON: Record<string, string> = {
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  pin: "M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  mail: "M3 6h18v12H3zM3 7l9 7 9-7",
  renew: "M20 12a8 8 0 1 1-3-6.2M20 4v5h-5",
};

export function Flow({ block }: { block: Of<"flow"> }) {
  return (
    <section className={`${cardBox} px-4 py-4 sm:px-5`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-sans text-base font-bold tracking-tight text-ink">{block.title}</h3>
        <span className="text-xs text-ink-soft">{block.aside}</span>
      </header>
      <ol className="mt-4 grid gap-5 sm:grid-cols-4 sm:gap-3">
        {block.steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
            {i < block.steps.length - 1 && (
              <span aria-hidden className="absolute left-5 top-10 hidden h-[calc(100%-1rem)] border-l-2 border-dashed border-ink max-sm:block sm:left-[calc(50%+1.6rem)] sm:top-5 sm:h-0 sm:w-[calc(100%-3.2rem)] sm:border-l-0 sm:border-t-2" />
            )}
            <span className={`relative flex h-10 w-10 flex-none items-center justify-center rounded-full text-onink ${i === 2 ? "bg-[var(--g-teal)]" : i === 3 ? "bg-[var(--g-amber-2)]" : "bg-ink"}`} aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={FLOW_ICON[s.icon]} />
              </svg>
            </span>
            <div>
              <div className="font-sans text-sm font-bold text-ink">{s.title}</div>
              <p className="mt-1 text-sm text-ink-muted">
                <Inline text={s.body} />
              </p>
              {s.tag && <div className="mt-1.5"><Chip tone="non">{s.tag}</Chip></div>}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-paper-line pt-4">
        <span className="font-sans text-sm font-bold text-ink">{block.example.label}</span>
        <span className="inline-flex items-center gap-1.5 bg-[var(--g-red-bg)] px-2.5 py-1 font-mono text-sm text-[var(--g-red)]"><b aria-hidden>✕</b> {block.example.bad}</span>
        <span className="inline-flex items-center gap-1.5 bg-[var(--g-teal-bg)] px-2.5 py-1 font-mono text-sm text-[var(--g-teal)]"><CheckMark className="h-3.5 w-3.5" /> {block.example.good}</span>
      </div>
    </section>
  );
}

// ── What the paperwork costs ──────────────────────────────────────────────

export function CostBars({ block }: { block: Of<"costbars"> }) {
  const scale = 70;
  return (
    <section className={`${cardBox} px-4 py-4 sm:px-5`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-sans text-base font-bold tracking-tight text-ink">{block.title}</h3>
        <span className="text-sm text-ink-muted"><Inline text={block.total} /></span>
      </header>
      <div className="mt-3 divide-y divide-paper-line border-t border-paper-line">
        {block.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 py-2.5 md:grid-cols-[15rem_5.5rem_1fr_4.5rem] md:gap-x-4">
            <div className="font-sans text-sm text-ink">{r.label}</div>
            <div className="md:order-2 md:col-start-2"><Chip tone={r.tag.tone}>{r.tag.label}</Chip></div>
            <div className="relative col-span-2 h-3.5 bg-[var(--g-track)] md:order-3 md:col-span-1 md:col-start-3">
              {r.tag.tone === "free" ? (
                <span className="absolute inset-y-0 left-2 font-mono text-[0.625rem] font-bold leading-[0.875rem] text-[var(--g-teal)]">{r.value}</span>
              ) : (
                <>
                  <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${(r.min / scale) * 100}%` }} />
                  {r.max > r.min && (
                    <div className="absolute inset-y-0 bg-[var(--g-bar-grey)]" style={{ left: `${(r.min / scale) * 100}%`, width: `${((r.max - r.min) / scale) * 100}%` }} />
                  )}
                </>
              )}
            </div>
            <div className="text-right font-mono text-xs font-bold text-ink md:order-4 md:col-start-4">{r.value}</div>
          </div>
        ))}
        <div className="hidden md:grid md:grid-cols-[15rem_5.5rem_1fr_4.5rem] md:gap-x-4">
          <span /><span />
          <div className="relative mt-2 h-4 font-mono text-[0.6875rem] text-ink-soft" aria-hidden>
            {block.axis.map((a) => (
              <span key={a} className="absolute -translate-x-1/2" style={{ left: `${(a / scale) * 100}%` }}>€{a}</span>
            ))}
          </div>
        </div>
      </div>
      <ul className="mt-3 flex gap-4 text-xs font-bold text-ink">
        <li className="inline-flex items-center gap-1.5"><i className="h-2.5 w-3.5 bg-ink" />{block.legend[0]}</li>
        <li className="inline-flex items-center gap-1.5"><i className="h-2.5 w-3.5 bg-[var(--g-bar-grey)]" />{block.legend[1]}</li>
      </ul>
      <p className="mt-3 text-sm text-ink-soft">{block.note}</p>
    </section>
  );
}

export function Cycle({ block }: { block: Of<"cycle"> }) {
  return (
    <figure className={`${cardBox} px-4 py-4 sm:px-5`}>
      <figcaption className={caption}>{block.label}</figcaption>
      <div className="mt-3 space-y-2">
        {block.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-3">
            <span className="text-sm text-ink-soft">{r.label}</span>
            <span className="flex flex-wrap gap-1" aria-hidden>
              {Array.from({ length: r.count }, (_, i) => (
                <i key={i} className={`h-3.5 w-3.5 ${r.extra && i === r.count - 1 ? "bg-[var(--g-red)]" : "bg-ink"}`} />
              ))}
            </span>
            <span className={`text-right font-mono text-xs font-bold ${r.extra ? "text-[var(--g-red)]" : "text-ink"}`}>{r.count}×</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

// ── Counts ────────────────────────────────────────────────────────────────

export function Workload({ block }: { block: Of<"workload"> }) {
  const max = Math.max(...block.rows.map((r) => r.d + r.s + r.v));
  const parts = [
    { key: "d", cls: "bg-[var(--g-eu)]" },
    { key: "s", cls: "bg-[var(--g-amber-2)]" },
    { key: "v", cls: "bg-[var(--g-red)]" },
  ] as const;
  return (
    <section className={`${cardBox} px-4 py-4 sm:px-5`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-sans text-base font-bold tracking-tight text-ink">{block.title}</h3>
        <span className="text-xs text-ink-soft">{block.sub}</span>
      </header>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink">
        {block.legend.map((l, i) => (
          <li key={l} className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-3.5 ${parts[i]!.cls}`} />{l}</li>
        ))}
      </ul>
      <div className="mt-3 divide-y divide-paper-line border-t border-paper-line">
        {block.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 py-2.5 md:grid-cols-[10rem_1fr_4.5rem]">
            <div className="font-sans text-sm font-bold text-ink">{r.label}</div>
            <div className="text-right font-mono text-xs text-ink-muted md:order-3">{r.total}</div>
            <div className="col-span-2 flex h-6 md:order-2 md:col-span-1" style={{ width: `${((r.d + r.s + r.v) / max) * 100}%`, minWidth: "30%" }}>
              {parts.map(({ key, cls }) => {
                const n = r[key];
                return n ? (
                  <span key={key} className={`flex items-center justify-center font-mono text-[0.6875rem] font-bold text-onink ${cls}`} style={{ flexGrow: n, flexBasis: 0 }}>
                    {n}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-soft"><Inline text={block.note} /></p>
    </section>
  );
}

// ── Big numbers ───────────────────────────────────────────────────────────

const STAT: Record<string, { top: string; big: string }> = {
  teal: { top: "border-t-[var(--g-teal)]", big: "text-[var(--g-teal)]" },
  ink: { top: "border-t-ink", big: "text-ink" },
  amber: { top: "border-t-[var(--g-amber-2)]", big: "text-[var(--g-amber)]" },
};

export function StatCards({ block }: { block: Of<"statcards"> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {block.items.map((s) => (
        <article key={s.unit} className={`${cardBox} border-t-4 px-5 py-5 ${STAT[s.tone]!.top}`}>
          <div className={`font-sans text-5xl font-extrabold leading-none tracking-tight ${STAT[s.tone]!.big}`}>{s.big}</div>
          <div className="mt-2 font-sans text-lg font-bold leading-tight text-ink">{s.unit}</div>
          {s.ruler && (
            <div className="mt-3 space-y-1.5" aria-hidden>
              <div className="flex items-center gap-2 text-xs text-ink-soft"><span className="w-16 shrink-0">{s.ruler.oldLabel}</span><i className="h-2 bg-[var(--g-old)]" style={{ width: "40%" }} /><b className="font-mono text-ink">{s.ruler.old}</b></div>
              <div className="flex items-center gap-2 text-xs text-ink-soft"><span className="w-16 shrink-0">{s.ruler.nowLabel}</span><i className="h-2 bg-[var(--g-teal)]" style={{ width: "60%" }} /><b className="font-mono text-ink">{s.ruler.now}</b></div>
            </div>
          )}
          <div className="mt-3 space-y-3">
            {s.body.map((b) => (
              <p key={b} className="prose-body"><Inline text={b} /></p>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function Numbers({ block }: { block: Of<"numbers"> }) {
  return (
    <section className="bg-ink px-5 py-5 text-onink">
      <h3 className="font-sans text-lg font-bold tracking-tight">{block.title}</h3>
      <dl className="mt-3 divide-y divide-ink-line border-t border-ink-line">
        {block.rows.map((r) => (
          <div key={r.n} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 py-2.5">
            <dt className={`${mono} text-3xl font-extrabold leading-none tracking-tight text-onink`}>{r.n}</dt>
            <dd className="text-sm text-onink-muted">{r.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── The packages ──────────────────────────────────────────────────────────

export function Packages({ block }: { block: Of<"packages"> }) {
  return (
    <div className="space-y-5">
      <section className={`${cardBox} relative overflow-x-auto`}>
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead>
            <tr className="align-bottom">
              <th scope="col" className="w-[44%] px-4 py-4 text-xs font-normal text-ink-soft">
                {block.terms.map((t) => (
                  <span key={t} className="block">{t}</span>
                ))}
              </th>
              {block.tiers.map((t, i) => (
                <th key={t.name} scope="col" className={`px-3 py-4 text-center ${i === 1 ? "bg-ink text-onink" : ""}`}>
                  {t.badge && <span className="mb-1 inline-block bg-accent px-1.5 py-0.5 font-sans text-[0.625rem] font-bold uppercase tracking-wider text-onink">{t.badge}</span>}
                  <span className="block font-sans text-base font-extrabold leading-tight">{t.name}</span>
                  <span className={`block text-xs font-normal ${i === 1 ? "text-onink-muted" : "text-ink-soft"}`}>{t.sub}</span>
                  <span className="mt-2 block font-sans text-xl font-extrabold">{t.eu} / {t.non}</span>
                  <span className={`block font-mono text-[0.625rem] font-bold tracking-wider ${i === 1 ? "text-onink-soft" : "text-ink-soft"}`}>{block.routes[0]} / {block.routes[1]}</span>
                </th>
              ))}
            </tr>
          </thead>
          {block.sections.map((sec) => (
            <tbody key={sec.title}>
              <tr>
                <th colSpan={3} scope="colgroup" className="border-b-2 border-ink px-4 pb-1.5 pt-4 text-left font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-accent">{sec.title}</th>
              </tr>
              {sec.rows.map((row) => (
                <tr key={row.label} className="border-b border-paper-line">
                  <td className="px-4 py-2 text-ink"><Inline text={row.label} /></td>
                  {row.has.map((has, i) => (
                    <td key={i} className={`px-3 py-2 text-center ${i === 1 ? "bg-accent-tint" : ""}`}>
                      {has ? <CheckMark className="mx-auto h-4 w-4 text-[var(--g-teal)]" /> : <span aria-hidden className="text-paper-edge">—</span>}
                      <span className="sr-only">{has ? "✓" : "—"}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </section>
      <section>
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-accent">{block.addonsTitle}</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {block.addons.map((a) => (
            <li key={a.name} className={`${cardBox} px-4 py-3`}>
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="font-sans text-sm font-bold text-ink">{a.name}</h4>
                <span className="font-mono text-sm font-bold text-ink">{a.price}</span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">{a.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
