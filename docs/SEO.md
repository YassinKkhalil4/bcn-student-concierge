# Search strategy

How this site earns organic traffic, what changed in September 2026, and what
is still missing. Companion to `docs/DEPLOY.md` and `docs/SECURITY.md`.

## Who we are trying to reach

One person: an international student who has already landed in Barcelona, or
lands next month, and has just worked out that the paperwork is real. They
search in English far more often than in Spanish, because their Spanish is not
yet good enough to search in it. They search on a phone, at night, after
somebody at their university told them about a deadline.

They do not search for "administrative facilitation". Nobody does. They search
for the thing in front of them: `TIE appointment Barcelona`, `how long do I
have to apply for TIE`, `padron Barcelona student`, `how to pay modelo 790`.
Every title and heading on the site now uses those words instead of the legal
category name, which stays where it belongs, in the disclaimer.

## What was already right

Three things, and they are the reason this strategy is about content rather
than repair:

- `robots.txt` (`src/app/robots.txt/route.ts`) opens the marketing and legal
  pages to answer engines with Content Signals, and closes everything holding
  a student's data to every crawler.
- Every public page answers `Accept: text/markdown` and has a `.md` address,
  generated from the same catalogues and the same price table as the page. An
  assistant reads clean Markdown instead of scraping HTML, and cannot quote a
  stale price.
- The sitemap lists all six languages with reciprocal `hreflang` alternates,
  and next-intl's middleware repeats the set in an RFC 8288 `Link` header.

## What we changed

**Canonical URLs on every public page.** `src/lib/seo.ts` gives each page a
self-referencing canonical plus the full hreflang set including `x-default`.
Before this the site had hreflang in two places and a canonical in none, and
Google honours hreflang only when the canonical is a member of the hreflang
set. All three sources derive from `localizedPath`, so they cannot disagree,
and a disagreement makes Google drop the pair.

**Structured data.** `src/lib/structured-data.ts` emits one `@graph` per page:
`ProfessionalService` for the business, `WebSite`, `Service` carrying one
`Offer` per package per route, `FAQPage` for the home page questions, and
`BreadcrumbList` on pricing. Offer prices come from `TIERS`, so a price change
in `src/lib/pricing.ts` moves the published price with it. Provider fields
(legal name, NIF, address) appear once `src/lib/provider.ts` has them, and not
before, on the same reasoning as the footer: a made-up NIF in machine-readable
form is worse than none.

**Titles that no longer compete.** `/`, `/triage` and `/guide` all opened with
the sentence "You've been here two weeks. The clock started the day you
landed." Three pages fighting for one query is three pages losing it. Each
page now leads with its own job. The root layout's fallback title, "Frictionless
Arrivals in Barcelona", named nothing a student searches for and is gone.

**The four commitments in the Markdown view.** An assistant asked "is this
service any good?" can now quote the fixed fee and the six-week refund from
`/index.md` instead of inferring them from marketing prose.

## Page and query map

Volumes are not in here. Nobody has Search Console access on this domain yet,
and a number invented for a planning document is worse than a blank. Confirm
each row against Search Console and a keyword tool before spending on it.

| Page | Primary intent | Query shapes |
|---|---|---|
| `/` | "who can do this for me" | `TIE help Barcelona`, `student residency paperwork Barcelona` |
| `/triage` | "am I late" | `how long to apply for TIE after arriving`, `TIE deadline 30 days` |
| `/pricing` | "what does this cost" | `TIE gestoria cost Barcelona`, `how much to do padron` |
| `/guide` | "explain the whole thing" | `international student Barcelona paperwork guide` |

Non-EU and EU are two different searchers with two different vocabularies
(`TIE`, `EX-17`, fingerprints, versus `certificado de registro`, `EX-18`,
`CUE`). The site prices them apart already. It does not yet separate them in
search, which is the first thing worth testing.

## The gap worth closing

The 21-page guide answers most of these queries. It is a PDF, so search engines
read almost none of it, and an answer engine reads none of it at all.

Carve it into HTML pages, one per section it already has, and link each to
`/triage`. The facts are written and the business has dated them ("checked 10
September 2026, next review 15 January 2027"). Nothing has to be invented, and
nothing should be: none of this copy should carry a claim about Spanish
immigration procedure that somebody at the company has not checked.

Candidate pages, in the order a student needs them:

1. The 30-day clock, and what starts it
2. NIE, TIE, padrón, expediente: four words that are not interchangeable
3. Registering your address when the flat is not in your name
4. Paying Modelo 790 Código 012 in cash, step by step
5. The EU registration certificate, for EU/EEA/Swiss students
6. When the appointment will not come in time

Page 4 already exists as copy, in `messages/en/guides.json`, and no public page
renders it. It is also the one page here that deserves `HowTo` structured data.

Two rules for these pages. Every one must state the scope-of-service
disclaimer, because a page that reads as immigration advice is a page that
creates liability. And every one must give away the answer: the guide already
tells readers they can do all of this themselves, and the business sells to the
ones who read that and decide they would rather not.

## Measuring it

- Verify the domain in Search Console and submit `https://bcnstudent.com/sitemap.xml`.
- The conversion is a triage submission, not a page view. Everything upstream
  is a leading indicator.
- Per-school links (`/guide?s=esade`) already survive 30 days in a cookie
  (`src/lib/attribution.ts`), so a triage can name where the reader came from.
- Watch which of the six languages produce triages. Six catalogues is six
  maintenance burdens, and a language that produces nothing over two intakes
  is worth a conversation.

## Two defects found while doing this

**`scripts/i18n-overrides.json` is stale.** Thirty entries quoted the retired
tier names (Administrative Baseline, Digital Soft-Landing, Turnkey Relocation),
addressed the student's parent rather than the student, or answered a question
the FAQ no longer asks in that position. Overrides always win over DeepL, so
the next `npm run i18n:translate` would have reverted the pricing page to
product names that no longer exist. Those thirty are removed. The rest of the
file has not been audited.

**Overrides keyed by array index are fragile.** `home.faq.items.4.q` points at
whatever question sits fourth today. Three Catalan entries had drifted onto
different questions before this work started. Keying them by content, or
turning `faq.items` into a keyed object, would stop it happening again.
