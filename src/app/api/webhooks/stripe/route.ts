import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/server/stripe";
import { findCaseIdByPaymentIntent, getCase, updateCase } from "@/lib/server/storage";

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
        if (!caseId) break;

        const record = await getCase(caseId);
        // Idempotency: a repeated delivery is a no-op, not a double-fulfilment.
        if (!record || record.paymentStatus === "paid") break;

        // `payment_status` is authoritative; a completed session with an async
        // payment method can still be unpaid.
        if (session.payment_status === "paid") {
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
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        // `refunded` is true only for a FULL refund. A partial refund (e.g. a
        // goodwill discount) leaves the engagement paid and active.
        if (!charge.refunded) break;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!paymentIntentId) break;
        const caseId = await findCaseIdByPaymentIntent(paymentIntentId);
        if (caseId) await updateCase(caseId, { paymentStatus: "refunded" });
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
