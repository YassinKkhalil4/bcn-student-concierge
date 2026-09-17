/**
 * JSON-LD for the public pages.
 *
 * Why it is here at all: robots.txt invites answer engines in (`ai-input=yes`,
 * `search=yes`) and the site already serves them Markdown. Structured data is
 * the other half of that bargain — it states, in a form a machine does not
 * have to infer from prose, what this business is, what it sells, what each
 * package costs, and which questions the home page answers.
 *
 * Two rules, both borrowed from the rest of the codebase:
 *
 *   1. Prices come from the tier table (src/lib/pricing.ts), never from a
 *      string in a catalogue. Structured data that quotes a stale price is a
 *      published price, and it is the one a student will hold us to.
 *   2. Provider fields (legal name, NIF, address, email) are emitted only
 *      once they have a value — the same rule as the footer. A placeholder
 *      organisation in machine-readable form is worse than silence.
 */
import { TIERS } from "@/lib/pricing";
import { PROVIDER } from "@/lib/provider";
import { siteOrigin, type PublicPage } from "@/lib/agents/pages";
import { localizedPath } from "@/i18n/routing";

type Json = Record<string, unknown>;

/** Drops keys whose value is empty, so no placeholder is ever published. */
function compact(object: Json): Json {
  return Object.fromEntries(
    Object.entries(object).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)),
  );
}

const ORG_ID = () => `${siteOrigin()}/#organization`;

/**
 * The business. `ProfessionalService` rather than `LegalService`: we are
 * neither a law firm nor a gestoría, and the disclaimer on every page says so.
 * `knowsAbout` carries the terms students actually search for.
 */
export function organization(brand: string, description: string): Json {
  return compact({
    "@type": "ProfessionalService",
    "@id": ORG_ID(),
    name: brand,
    legalName: PROVIDER.legalName || undefined,
    taxID: PROVIDER.taxId || undefined,
    email: PROVIDER.email || undefined,
    url: siteOrigin(),
    description,
    areaServed: { "@type": "AdministrativeArea", name: "Barcelona, Spain" },
    address: compact({
      "@type": "PostalAddress",
      addressLocality: "Barcelona",
      addressCountry: "ES",
      streetAddress: PROVIDER.registeredAddress || undefined,
    }),
    knowsAbout: [
      "TIE (Tarjeta de Identidad de Extranjero)",
      "EX-17",
      "EX-18",
      "Certificado de Registro de Ciudadano de la Unión",
      "Padrón municipal registration",
      "Modelo 790 Código 012",
      "cita previa for Extranjería and Policía Nacional",
    ],
    availableLanguage: ["en", "es", "ca", "fr", "it", "de"],
  });
}

/** The site itself, so an engine names it correctly in a citation. */
export function website(brand: string, locale: string): Json {
  return {
    "@type": "WebSite",
    "@id": `${siteOrigin()}/#website`,
    name: brand,
    url: `${siteOrigin()}${localizedPath(locale, "/")}`,
    inLanguage: locale,
    publisher: { "@id": ORG_ID() },
  };
}

/**
 * The packages, priced from the tier table. Two offers per tier where the EU
 * and non-EU routes differ, because they are genuinely two prices and a single
 * averaged figure would be a false one.
 */
export function serviceOffers(names: Record<string, { name: string; tagline: string }>, locale: string): Json {
  const url = `${siteOrigin()}${localizedPath(locale, "/pricing")}`;
  return {
    "@type": "Service",
    "@id": `${siteOrigin()}/#service`,
    serviceType: "Residency document preparation and appointment booking for international students",
    provider: { "@id": ORG_ID() },
    areaServed: { "@type": "AdministrativeArea", name: "Barcelona, Spain" },
    audience: { "@type": "EducationalAudience", educationalRole: "student" },
    offers: TIERS.flatMap((tier) => {
      const copy = names[tier.id];
      const routes = tier.priceCents.eu === tier.priceCents["non-eu"] ? (["eu"] as const) : (["eu", "non-eu"] as const);
      return routes.map((route) =>
        compact({
          "@type": "Offer",
          name: routes.length === 1 ? copy?.name : `${copy?.name} — ${route === "eu" ? "EU/EEA/Swiss route" : "non-EU route"}`,
          description: copy?.tagline,
          price: (tier.priceCents[route] / 100).toFixed(2),
          priceCurrency: "EUR",
          url,
          category: route === "eu" ? "EU/EEA/Swiss route" : "Non-EU route",
          availability: "https://schema.org/InStock",
        }),
      );
    }),
  };
}

/** The home-page FAQ, verbatim. Never a summary: a paraphrase is a new claim. */
export function faqPage(items: { q: string; a: string }[]): Json {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbs(trail: { name: string; page: PublicPage }[], locale: string): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: `${siteOrigin()}${localizedPath(locale, step.page)}`,
    })),
  };
}

/** One `@graph` per page: several nodes, one script, no duplicated @ids. */
export function graph(...nodes: Json[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes });
}
