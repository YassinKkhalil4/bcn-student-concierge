import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createCheckoutSession } from "@/lib/server/stripe";
import { getCase, updateCase } from "@/lib/server/storage";
import { getTier, routeForForm } from "@/lib/pricing";
import { portalCaseId } from "@/lib/portal/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



export async function POST(request: Request): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, "checkout");
  if (limited) return limited;

  // The case comes from the signed session, never from the request body.
  const caseId = await portalCaseId();
  if (!caseId) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  const record = await getCase(caseId);
  if (!record || record.purgedAt || !record.intake) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  if (record.paymentStatus === "paid") {
    return NextResponse.json({ error: "This case is already paid" }, { status: 409 });
  }

  /**
   * The price comes from the server-side tier table keyed by the tier stored on
   * the case — never from the request body. A client-supplied amount is the
   * classic e-commerce flaw: it lets anyone buy the top tier for €1.
   *
   * The same applies to the EU / non-EU route, which is the second half of the
   * price: it is derived from the formId the server itself computed from the
   * student's nationality at intake, so a browser cannot ask for the cheaper
   * EU price on a non-EU case.
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
      route: routeForForm(record.formId),
      caseId: record.id,
      customerEmail: record.intake.contact.email,
      origin,
      locale: record.locale,
    });
    await updateCase(record.id, { stripeSessionId: session.id });
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("[checkout] session creation failed", error);
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 500 });
  }
}
