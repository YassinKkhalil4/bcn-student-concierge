import { Link } from "@/i18n/navigation";
import { parseInline } from "@/lib/guide/text";

/**
 * A guide string as React nodes. Built from parsed tokens, never injected as
 * HTML, so no string in the content can add markup of its own. Links go through
 * the locale-aware Link, so a reader in Spanish stays in Spanish.
 */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((n, i) =>
        n.t === "strong" ? (
          <strong key={i} className="font-semibold text-ink">
            {n.v}
          </strong>
        ) : n.t === "em" ? (
          <em key={i}>{n.v}</em>
        ) : n.t === "link" ? (
          <Link key={i} href={n.href} className="text-accent-deep underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
            {n.v}
          </Link>
        ) : (
          <span key={i}>{n.v}</span>
        ),
      )}
    </>
  );
}
