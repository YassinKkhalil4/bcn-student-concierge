import type { ReactNode } from "react";

/**
 * The cover of a marketing page.
 *
 * Navy, like the home page's hero, the footer and the guide's printed cover.
 * The rule for the whole site is that a page a visitor is being *sold* to opens
 * on cover stock, while the pages they *work* in — intake, the portal, sign-in —
 * open on paper with a ruled header, because a form is the interior of the
 * document and should not feel like another pitch.
 *
 * `label` is the small crimson-ruled caps line. It is optional and should stay
 * that way: a label above every heading on every page is what made the old site
 * read as a template.
 */
export function PageHeader({
  label,
  title,
  intro,
  children,
}: {
  label?: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <section className="on-ink">
      <div className="container-x py-16 sm:py-20 lg:py-24">
        {label && <p className="rule-label">{label}</p>}
        <h1 className={`max-w-[26ch] text-display-lg text-onink ${label ? "mt-6" : ""}`}>
          {title}
        </h1>
        {intro && (
          <p className="measure mt-6 font-serif text-lede text-onink-muted">{intro}</p>
        )}
        {children}
      </div>
    </section>
  );
}

/**
 * The header for an interior working page: intake, the portal, sign-in. Paper,
 * with a crimson cap rule instead of a dark field, so the student can see they
 * are inside the file rather than still on the sales floor.
 */
export function WorkHeader({
  label,
  title,
  intro,
  children,
}: {
  label?: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-t-3 border-accent pt-8">
      {label && (
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-accent-deep">
          {label}
        </p>
      )}
      <h1 className={`max-w-[28ch] text-display-lg text-ink ${label ? "mt-4" : ""}`}>{title}</h1>
      {intro && <p className="prose-lede measure mt-5">{intro}</p>}
      {children}
    </div>
  );
}
