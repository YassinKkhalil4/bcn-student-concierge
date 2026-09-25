"use client";

import { useEffect, useRef } from "react";

export interface SummarisedError {
  /** The id of the control to jump to. */
  id: string;
  /** The field's own label — never the message. See the note below. */
  label: string;
}

/**
 * What a form says when it refuses to go forward.
 *
 * Before this, pressing Continue on an invalid step did three things, none of
 * them visible: it set eight `role="alert"` messages announcing at once, it
 * left focus on <body>, and on a 375px phone it put the first of them 899px
 * below the fold. The student pressed the button and nothing appeared to
 * happen. On a six-step form behind a paid conversion that is the most
 * expensive failure on the site.
 *
 * So: one announcement, at the top, focused. The per-field messages stay
 * exactly where they were and keep their `aria-describedby` wiring, but they
 * are no longer alerts — this is the alert, and it is the only one.
 *
 * The links carry the field's LABEL and not its message. Some of our
 * validation strings already name their field ("Your name is required") and
 * some cannot ("Please choose from the list"), so listing messages would read
 * as either a stutter or a riddle depending on the field. The label is
 * unambiguous in all six languages, and the message is one jump away, sitting
 * under the input it belongs to.
 */
export function ErrorSummary({
  title,
  errors,
  attempt,
}: {
  title: string;
  errors: SummarisedError[];
  /**
   * Incremented by the parent on every rejected submit. Focus follows this and
   * not the error list, so submitting the same invalid form twice announces
   * twice — otherwise the second press really would do nothing.
   */
  attempt: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `focus()` scrolls it into view by itself, which respects the user's
    // reduced-motion setting in a way `scrollIntoView({behavior:"smooth"})`
    // would not.
    if (attempt > 0 && errors.length > 0) ref.current?.focus();
  }, [attempt, errors.length]);

  if (errors.length === 0) return null;

  // `enter-alert` is the site's vocabulary for exactly this: a block React
  // renders into existence next to content that was already there. 2px and
  // 160ms — enough to say where it came from, not enough to delay reading it,
  // which matters more here than anywhere, since this block exists to be read
  // immediately.
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="enter-alert mb-7 border border-accent/40 border-t-3 border-t-accent bg-accent-tint p-5 sm:p-6"
    >
      <h2 className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-accent-deep">
        {title}
      </h2>
      <ul className="mt-3.5 space-y-2">
        {errors.map((error) => (
          <li key={error.id}>
            <a
              href={`#${error.id}`}
              className="font-sans text-sm font-semibold leading-snug text-accent-deep underline
                         decoration-accent decoration-2 underline-offset-4 transition-colors hover:text-ink"
            >
              {error.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
