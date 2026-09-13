import Stripe from "stripe";
import { getTier, tierPrice, type ServiceRoute, type Tier } from "@/lib/pricing";
import type { BillingDetails } from "./invoices";
import type { Locale } from "@/lib/db/schema";
import { localizedPath } from "@/i18n/routing";

/**
 * Stripe Checkout. Card and Apple Pay are both served by the `card` payment
 * method type — Apple Pay appears automatically on eligible devices once the
 * domain is verified in the Stripe dashboard (docs/SECURITY.md lists the step).
 */

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  }
  return client;
}

/**
 * IVA is charged as an explicit, separately-stated line item rather than being
 * folded into the unit price. A Spanish invoice must show the taxable base and
 * the cuota separately, so the customer sees the same breakdown Stripe records.
 *
 * The alternative — Stripe Tax with `tax_behavior: "exclusive"` — is the better
 * long-term choice once the business registers for OSS/VIES, because it handles
 * reverse-charge for EU-resident payers. Until then, a flat 21% is correct for
 * a service supplied and consumed in Spain.
 */
export function buildLineItems(
  tier: Tier,
  route: ServiceRoute,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const { baseCents, ivaCents } = tierPrice(tier, route);
  return [
    {
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: baseCents,
        product_data: {
          name: tier.name,
          description: tier.tagline,
        },
      },
    },
    {
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: ivaCents,
        product_data: {
          name: "IVA (21%)",
          description: `Statutory Spanish VAT on ${tier.name}`,
        },
      },
    },
  ];
}

export interface CheckoutParams {
  tierId: string;
  /**
   * EU/EEA/Swiss or not. Derived by the caller from the case's stored formId,
   * never sent by the browser: the route decides the price.
   */
  route: ServiceRoute;
  caseId: string;
  customerEmail: string;
  origin: string;
  /** The student's language: Stripe's page and our return pages use it. */
  locale: Locale;
}

/**
 * Stripe Checkout has no Catalan. Spanish is the closer fallback for someone
 * who chose Catalan than English is.
 */
const STRIPE_LOCALES: Record<Locale, Stripe.Checkout.SessionCreateParams.Locale> = {
  en: "en",
  es: "es",
  ca: "es",
  fr: "fr",
  it: "it",
  de: "de",
};

export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<Stripe.Checkout.Session> {
  const tier = getTier(params.tierId);
  if (!tier) throw new Error(`Unknown tier: ${params.tierId}`);

  return stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: buildLineItems(tier, params.route),
    customer_email: params.customerEmail,
    // The case id is the join key between Stripe and our records. It is an
    // opaque token, never an email or a name — Stripe metadata is visible to
    // everyone with dashboard access and should carry no personal data.
    client_reference_id: params.caseId,
    metadata: { caseId: params.caseId, tierId: tier.id, route: params.route },
    locale: STRIPE_LOCALES[params.locale],
    success_url: `${params.origin}${localizedPath(params.locale, "/intake/complete")}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.origin}${localizedPath(params.locale, "/portal")}?checkout=cancelled`,
    // Spanish invoicing: the payer's name and address go on the factura.
    billing_address_collection: "required",
    // Lets a company paying for a student enter its tax ID (Stripe collects
    // business IDs only; private payers need none on a Spanish invoice).
    tax_id_collection: { enabled: true },
    // Stripe's own invoices are deliberately OFF. We issue the factura, with
    // Spanish correlative numbering; a Stripe invoice as well would mean two
    // invoices, differently numbered, for one sale.
  });
}

/**
 * The payer, as entered at checkout. Deliberately not the student's intake:
 * the payer is often a parent or a company.
 */
export function billingFromSession(session: Stripe.Checkout.Session): BillingDetails {
  const d = session.customer_details;
  // Present when a business entered a tax ID; not in every API version's types.
  const businessName = (d as { business_name?: string | null } | null)?.business_name;
  const tax = d?.tax_ids?.[0];
  const a = d?.address;
  return {
    name: (businessName || d?.name || d?.email || "").trim() || "—",
    email: d?.email ?? null,
    taxId: tax?.value ? { type: tax.type, value: tax.value } : null,
    address: a
      ? {
          line1: a.line1 ?? null,
          line2: a.line2 ?? null,
          postalCode: a.postal_code ?? null,
          city: a.city ?? null,
          state: a.state ?? null,
          country: a.country ?? null,
        }
      : null,
  };
}

/**
 * Verify a webhook. NEVER trust the event body without this: the endpoint is
 * public, and an unverified handler lets anyone mark any case as paid.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe().webhooks.constructEvent(payload, signature, secret);
}
