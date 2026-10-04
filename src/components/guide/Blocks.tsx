import Link from "next/link";
import type { Block } from "@/lib/guide/types";
import { CheckMark } from "@/components/icons";
import { Inline } from "./Inline";

const CALLOUT: Record<"key" | "note" | "warning", { box: string; label: string; name: string }> = {
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

function BlockView({ block }: { block: Block }) {
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
          <p className={`font-mono text-xs font-medium uppercase tracking-wider ${c.label}`}>{c.name}</p>
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
          {block.title && <h3 className="font-sans text-lg font-bold tracking-tight text-ink">{block.title}</h3>}
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
              {card.label && <p className="font-mono text-xs font-medium uppercase tracking-wider text-accent">{card.label}</p>}
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
            <table className="w-full min-w-[22rem] border-collapse text-left text-sm">
              {block.caption && (
                <caption className="pb-2 text-left font-sans text-base font-bold tracking-tight text-ink">
                  {block.caption}
                </caption>
              )}
              <thead>
                <tr className="border-b-2 border-ink">
                  {block.head.map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 font-sans font-bold text-ink">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-b border-paper-line align-top">
                    {row.map((cell, j) => (
                      <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-medium text-ink" : "text-ink-muted"}`}>
                        <Inline text={cell} />
                      </td>
                    ))}
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
          <dl className="mt-3 border-t-2 border-ink">
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
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-8">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}
