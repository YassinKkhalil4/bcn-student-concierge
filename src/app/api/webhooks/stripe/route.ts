import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { billingFromSession, constructWebhookEvent } from "@/lib/server/stripe";
import { findCaseIdByPaymentIntent, getCase, updateCase } from "@/lib/server/storage";
import { issueInvoiceForCheckout, issueRefundRectification } from "@/lib/server/invoices";
import { getTier, tierPriceCents, routeForForm } from "@/lib/pricing";
import { notifyPaymentReceived } from "@/lib/notify/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver.
 *
 * Two non-negotiables:
 *  1. The RAW body must be passed to signature verification. Parsing it as JSON
 *     first re-serializes it and the signature will never match. Next's App
 *     Router does not consume the body for us, so `request.text()` is correct.
 *  2. Handlers must be idempotent. Stripe retries on any non-2xx and can
 *     deliver the same event more than once even on success.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(raw, signature);
  } catch (error) {
    // A verification failure is either a misconfigured secret or a forgery.
    console.warn("[stripe] webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const caseId = session.client_reference_id ?? session.metadata?.caseId;
        // `payment_status` is authoritative; a completed session with an async
        // payment method can still be unpaid.
        if (!caseId || session.payment_status !== "paid") break;

        const record = await getCase(caseId);
        if (!record) break;

        if (record.paymentStatus !== "paid") {
          await updateCase(caseId, {
            paymentStatus: "paid",
            stripeSessionId: session.id,
            // Stored so a later refund can be matched: `charge.refunded` carries
            // the PaymentIntent id, not the Checkout Session's metadata.
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent?.id ?? null),
          });
        }

        // ALWAYS ensure the invoice exists — even when the case was already
        // marked paid. If issuing failed on an earlier delivery (say, the
        // issuer was not configured yet), Stripe's retry must still produce
        // it; returning early on "already paid" would lose it for good.
        // issueInvoiceForCheckout is idempotent per session.
        if (session.currency !== "eur" || !session.amount_total) {
          throw new Error(`Unexpected checkout amount for case ${record.ref}`);
        }
        const tier = getTier(record.tierId);
        // The expected amount depends on the EU / non-EU route, which is fixed
        // by the case's own formId — the same derivation checkout priced from.
        const route = routeForForm(record.formId);
        if (tier && session.amount_total !== tierPriceCents(tier, route)) {
          // Invoice what was actually charged, but make the gap visible.
          console.warn(`[invoice] ${record.ref}: charged ${session.amount_total} differs from tier price`);
        }
        const result = await issueInvoiceForCheckout({
          caseId,
          stripeSessionId: session.id,
          grossCents: session.amount_total,
          description: `Servicio de acompañamiento administrativo — ${tier?.name ?? record.tierId}`,
          billing: billingFromSession(session),
          // When Stripe recorded the payment, not when this delivery arrived:
          // a retry hours later must not move the invoice date.
          issuedAt: new Date(event.created * 1000),
        });
        // Created exactly once per payment, so staff are notified exactly once.
        if (result.created) {
          await notifyPaymentReceived({
            ref: record.ref,
            totalCents: session.amount_total,
            packageName: tier?.name.replace(/^The /, "") ?? record.tierId,
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!paymentIntentId) break;
        const caseId = await findCaseIdByPaymentIntent(paymentIntentId);
        if (!caseId) break;

        // `refunded` is true only for a FULL refund. A partial refund (e.g. a
        // goodwill discount) leaves the engagement paid and active…
        if (charge.refunded) await updateCase(caseId, { paymentStatus: "refunded" });
        // …but EVERY refund changes the taxable base, so each one needs a
        // factura rectificativa. amount_refunded is cumulative; the
        // rectification covers only what is not rectified yet.
        await issueRefundRectification({
          caseId,
          refundedTotalCents: charge.amount_refunded,
          issuedAt: new Date(event.created * 1000),
        });
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (error) {
    // Return 500 so Stripe retries — losing a payment confirmation is worse
    // than processing it twice, which the idempotency check above absorbs.
    console.error("[stripe] handler error", event.type, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
