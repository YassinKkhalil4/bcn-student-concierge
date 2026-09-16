import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TIERS, tierPriceCents, formatEur, SERVICE_ROUTES, type ServiceRoute } from "@/lib/pricing";
import { controllerName } from "@/lib/provider";
import { Clause } from "./LegalPage";

type LegalDoc = "scope" | "privacy" | "terms";

interface ClauseData {
  heading: string;
  paragraphs: string[];
  /** Insert the package price list after this paragraph (terms §2). */
  priceListAfter?: number;
}

const link = (href: string) => (chunks: ReactNode) => (
  <Link href={href} className="text-olive underline">{chunks}</Link>
);

/** Tags the legal texts may use; anything else in a message is a bug. */
const TAGS = {
  strong: (chunks: ReactNode) => <span className="font-medium text-ink">{chunks}</span>,
  scopeLink: link("/legal"),
  privacyLink: link("/privacy"),
  termsLink: link("/terms"),
  mail: (chunks: ReactNode) => (
    <a href="mailto:privacy@bcnstudent.com" className="text-olive underline">{chunks}</a>
  ),
};

/** Renders a legal document's clauses from messages/<locale>/legal.json. */
export function LegalClauses({ doc }: { doc: LegalDoc }) {
  const t = useTranslations(`legal.${doc}`);
  const tp = useTranslations("pricing.tiers");
  const tc = useTranslations("pricing.card");
  // Each package is listed once per route: the two prices are two different
  // contractual fees, and terms §2 must state both.
  const routeLabel: Record<ServiceRoute, string> = {
    eu: tc("routeEu"),
    "non-eu": tc("routeNonEu"),
  };
  const clauses = t.raw("clauses") as ClauseData[];
  // The privacy notice names the legal entity as controller once it is known.
  const controller = controllerName(useTranslations("common")("brand"));

  return clauses.map((clause, i) => (
    <Clause key={clause.heading} heading={clause.heading}>
      {clause.paragraphs.map((_, j) => (
        <FragmentWithList key={j} showList={clause.priceListAfter === j}>
          <p>{t.rich(`clauses.${i}.paragraphs.${j}`, { ...TAGS, controller })}</p>
          <ul className="ml-5 list-disc space-y-1.5">
            {TIERS.flatMap((tier) =>
              SERVICE_ROUTES.map((route) => {
                return (
                  <li key={`${tier.id}:${route}`}>
                    {t.rich("priceLine", {
                      name: tp(`${tier.id}.name`),
                      route: routeLabel[route],
                      price: formatEur(tierPriceCents(tier, route)),
                      strong: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
                    })}
                  </li>
                );
              }),
            )}
          </ul>
        </FragmentWithList>
      ))}
    </Clause>
  ));
}

/** The paragraph, and the price list only where the clause asks for it. */
function FragmentWithList({ showList, children }: { showList: boolean; children: [ReactNode, ReactNode] }) {
  return (
    <>
      {children[0]}
      {showList && children[1]}
    </>
  );
}
