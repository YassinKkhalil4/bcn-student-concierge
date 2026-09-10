import Link from "next/link";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Services & pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-bone-line/70 bg-bone/85 backdrop-blur">
      <div className="container-x flex h-[72px] items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            BCN Student Concierge
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/intake" className="btn-primary">
            Begin intake
          </Link>
        </nav>

        <Link href="/intake" className="btn-primary md:hidden">
          Begin
        </Link>
      </div>
    </header>
  );
}
