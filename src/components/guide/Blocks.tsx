import { Link } from "@/i18n/navigation";
import type { Block } from "@/lib/guide/types";
import { CheckMark } from "@/components/icons";
import { Inline } from "./Inline";
import { Bars2, Chip, Controls, CostBars, Cycle, Flow, Gantt, Kit, Numbers, Packages, RouteCards, StatCards, Strips, Swimlanes, Terms, Workload } from "./Visuals";

const CALLOUT: Record<"key" | "note" | "warning" | "tip", { box: string; label: string; name: string }> = {
  tip: { box: "border-l-4 border-[var(--g-teal)] bg-[var(--g-teal-bg)]", label: "text-[var(--g-teal)]", name: "Good news" },
  key: { box: "border-l-4 border-ink bg-paper-dim", label: "text-ink", name: "Worth keeping" },
  note: { box: "border-l-4 border-paper-edge bg-paper-dim", label: "text-ink-muted", name: "Good to know" },
  warning: { box: "border-l-4 border-accent bg-accent-tint", label: "text-accent-deep", name: "Watch out" },
};

const para = "prose-body";

function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((p, i) => (
        <p key={i} className={`${para} ${i ? "mt-3" : ""}`}>
          <Inline text={p} />
        </p>
      ))}
    </>
  );
}

type Labels = { key: string; note: string; warning: string; tip: string };

function BlockView({ block, callouts }: { block: Block; callouts?: Labels }) {
  switch (block.kind) {
    case "p":
      return (
        <p className={para}>
          <Inline text={block.text} />
        </p>
      );
    case "h3":
      return <h3 className="mt-4 font-sans text-xl font-bold tracking-tight text-ink">{block.text}</h3>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={`${para} space-y-2 pl-5 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-accent`}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case "callout": {
      const c = CALLOUT[block.tone];
      return (
        <aside className={`${c.box} px-5 py-4 sm:px-6`}>
          <p className={`font-mono text-xs font-medium uppercase tracking-wider ${c.label}`}>{callouts?.[block.tone] ?? c.name}</p>
          <h3 className="mt-1 font-sans text-lg font-bold tracking-tight text-ink">{block.title}</h3>
          <div className="mt-2">
            <Paragraphs items={block.body} />
          </div>
        </aside>
      );
    }
    case "steps":
      return (
        <ol className="border-t-2 border-ink">
          {block.items.map((step, i) => (
            <li key={i} className="flex gap-4 border-b border-paper-line py-5 sm:gap-6">
              <span className="w-8 flex-none pt-0.5 font-mono text-sm font-medium text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="font-sans text-lg font-bold tracking-tight text-ink">{step.title}</h3>
                <div className="mt-2">
                  <Paragraphs items={step.body} />
                </div>
                {step.tags && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {step.tags.map((tag) => (
                      <li key={tag} className="border border-paper-edge px-2 py-0.5 font-mono text-xs text-ink-muted">
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      );
    case "checklist":
      return (
        <div className="border border-paper-edge bg-white px-5 py-5 sm:px-6">
          {block.title && (
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-sans text-lg font-bold tracking-tight text-ink">{block.title}</h3>
              {block.count && <Chip tone="non">{block.count}</Chip>}
            </div>
          )}
          <ul className={`${block.title ? "mt-3" : ""} space-y-2.5`}>
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-3">
                <CheckMark className="mt-1 h-4 w-4 flex-none text-accent" />
                <span className="prose-body">
                  <Inline text={item} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "cards":
      return (
        <div className="grid gap-px border border-paper-edge bg-paper-edge sm:grid-cols-2">
          {block.items.map((card, i) => (
            <div key={i} className="flex flex-col bg-paper px-5 py-5 sm:px-6">
              {(card.label || card.tag) && (
                <div className="flex items-center justify-between gap-2">
                  {card.label && <p className="font-mono text-xs font-medium uppercase tracking-wider text-accent">{card.label}</p>}
                  {card.tag && <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-ink-soft">{card.tag}</span>}
                </div>
              )}
              {card.effort && (
                <span className="mt-1 flex gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((n) => (
                    <i key={n} className={`h-1.5 w-5 ${n <= card.effort! ? "bg-ink" : "bg-paper-line"}`} />
                  ))}
                </span>
              )}
              <h3 className="mt-1 font-sans text-lg font-bold tracking-tight text-ink">{card.title}</h3>
              {card.subtitle && <p className="mt-1 text-sm text-ink-muted">{card.subtitle}</p>}
              <div className="mt-2 flex-1">
                <Paragraphs items={card.body} />
              </div>
              {card.href && (
                <Link href={card.href} className="btn-quiet mt-4 self-start">
                  {card.cta ?? "Read this chapter"}
                </Link>
              )}
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <figure>
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse text-left text-sm ${block.head.length >= 3 ? "min-w-[30rem]" : "min-w-[20rem]"}`}>
              {block.caption && (
                <caption className="pb-2 text-left font-sans text-base font-bold tracking-tight text-ink">
                  {block.caption}
                </caption>
              )}
              <thead>
                <tr className="border-b-2 border-ink">
                  {block.head.map((h, hi) => (
                    <th key={h} scope="col" className={`py-2 pr-4 font-sans font-bold text-ink ${block.blankLastColumn && hi === block.head.length - 1 ? "hidden sm:table-cell" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-b border-paper-line align-top">
                    {row.map((cell, j) => (
                      <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-medium text-ink" : "text-ink-muted"} ${block.blankLastColumn && j === 1 ? "whitespace-nowrap" : ""}`}>
                        <Inline text={cell} />
                      </td>
                    ))}
                    {block.blankLastColumn && <td className="hidden w-28 py-2 sm:table-cell"><span className="block h-px translate-y-5 bg-ink" aria-hidden /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && (
            <figcaption className="mt-3 text-sm text-ink-soft">
              <Inline text={block.note} />
            </figcaption>
          )}
        </figure>
      );
    case "phrases":
      return (
        <div>
          <h3 className="font-sans text-lg font-bold tracking-tight text-ink">{block.title}</h3>
          <div className="mt-3 hidden grid-cols-2 gap-6 border-b border-paper-line pb-1 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-soft sm:grid">
            <span>{block.head[0]}</span>
            <span>{block.head[1]}</span>
          </div>
          <dl className="border-t-2 border-ink sm:border-t-0">
            {block.rows.map((r) => (
              <div key={r.spanish} className="grid gap-1 border-b border-paper-line py-3 sm:grid-cols-2 sm:gap-6">
                <dt lang="es" className="font-serif text-read text-ink">
                  {r.spanish}
                </dt>
                <dd className="text-ink-muted">{r.english}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "routecards":
      return <RouteCards block={block} />;
    case "swimlanes":
      return <Swimlanes block={block} />;
    case "bars2":
      return <Bars2 block={block} />;
    case "gantt":
      return <Gantt block={block} />;
    case "terms":
      return <Terms block={block} />;
    case "controls":
      return <Controls block={block} />;
    case "kit":
      return <Kit block={block} />;
    case "strips":
      return <Strips block={block} />;
    case "flow":
      return <Flow block={block} />;
    case "costbars":
      return <CostBars block={block} />;
    case "cycle":
      return <Cycle block={block} />;
    case "workload":
      return <Workload block={block} />;
    case "statcards":
      return <StatCards block={block} />;
    case "numbers":
      return <Numbers block={block} />;
    case "packages":
      return <Packages block={block} />;
  }
}

export function Blocks({ blocks, callouts }: { blocks: Block[]; callouts?: Labels }) {
  return (
    <div className="space-y-8">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} callouts={callouts} />
      ))}
    </div>
  );
}
