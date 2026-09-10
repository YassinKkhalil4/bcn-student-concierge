import Stripe from "stripe";
import { getTier, priceWithIva, type Tier } from "@/lib/pricing";

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
export function buildLineItems(tier: Tier): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const { baseCents, ivaCents } = priceWithIva(tier.basePriceCents);
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
  caseId: string;
  customerEmail: string;
  origin: string;
}

export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<Stripe.Checkout.Session> {
  const tier = getTier(params.tierId);
  if (!tier) throw new Error(`Unknown tier: ${params.tierId}`);

  return stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: buildLineItems(tier),
    customer_email: params.customerEmail,
    // The case id is the join key between Stripe and our records. It is an
    // opaque token, never an email or a name — Stripe metadata is visible to
    // everyone with dashboard access and should carry no personal data.
    client_reference_id: params.caseId,
    metadata: { caseId: params.caseId, tierId: tier.id },
    success_url: `${params.origin}/intake/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.origin}/pricing?checkout=cancelled`,
    // Spanish invoicing: collect the billing address for the factura.
    billing_address_collection: "required",
    invoice_creation: { enabled: true },
  });
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
