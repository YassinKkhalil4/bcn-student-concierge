/**
 * The site's four marks.
 *
 * The same check glyph had been pasted by hand into the home page, the pricing
 * card and the triage page, in three slightly different sizes, so a change to
 * one never reached the others. They live here now.
 *
 * These are stroked geometry rather than an icon package on purpose: the
 * deployment is a standalone Next bundle on a single VPS behind a strict CSP,
 * and four polylines do not justify a dependency in that supply chain. If the
 * set ever grows past a handful, install @phosphor-icons/react and delete this
 * file rather than adding a fifth path by hand.
 *
 * Stroke weight is 2 at a 20-unit viewBox everywhere, so the marks sit at the
 * same optical weight as Archivo's semibold next to them.
 */

type MarkProps = { className?: string };

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function CheckMark({ className }: MarkProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 10.5 8 15 16.5 5" />
    </svg>
  );
}

export function ArrowMark({ className }: MarkProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 10h13M11 5l5 5-5 5" />
    </svg>
  );
}

export function DownloadMark({ className }: MarkProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M3.5 17h13" />
    </svg>
  );
}

/** Used where a step is complete, inside a progress marker. */
export function TickMark({ className }: MarkProps) {
  return (
    <svg {...base} className={className} strokeWidth={2.5}>
      <path d="M4 10.5 8 14.5 16 5.5" />
    </svg>
  );
}
