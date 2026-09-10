import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession } from "@/lib/server/stripe";
import { getCase, updateCase } from "@/lib/server/storage";
import { getTier } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limiting for this route is enforced in src/middleware.ts, so a new
// route cannot ship unprotected by omission.

const bodySchema = z.object({
  caseId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
});

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const record = await getCase(parsed.data.caseId);
  if (!record || record.purgedAt) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  if (record.paymentStatus === "paid") {
    return NextResponse.json({ error: "This case is already paid" }, { status: 409 });
  }

  /**
   * The price comes from the server-side tier table keyed by the tier stored on
   * the case — never from the request body. A client-supplied amount is the
   * classic e-commerce flaw: it lets anyone buy the €1,100 tier for €1.
   */
  const tier = getTier(record.tierId);
  if (!tier) {
    return NextResponse.json({ error: "Invalid service tier" }, { status: 400 });
  }

  // Build the return URL from a configured origin, not from the Host or Origin
  // header, which an attacker controls and could use to redirect the customer
  // to a lookalike confirmation page after a real payment.
  const origin = process.env.PUBLIC_ORIGIN;
  if (!origin) {
    console.error("[checkout] PUBLIC_ORIGIN is not configured");
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 500 });
  }

  try {
    const session = await createCheckoutSession({
      tierId: tier.id,
      caseId: record.id,
      customerEmail: record.intake.contact.email,
      origin,
    });
    await updateCase(record.id, { stripeSessionId: session.id });
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("[checkout] session creation failed", error);
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 500 });
  }
}
