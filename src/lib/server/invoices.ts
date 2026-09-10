import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { generateToken, openJson, sealJson } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import {
  cases,
  invoiceCounters,
  invoices,
  type InvoiceIssuer,
  type InvoiceRow,
  type InvoiceSeries,
} from "@/lib/db/schema";
import { invoiceIssuer } from "@/lib/invoicing/issuer";
import { IVA_RATE_BP, formatInvoiceNumber, madridYear, splitGross } from "@/lib/invoicing/numbering";

/**
 * Facturas: issuing, rectifying and reading invoices.
 *
 * Every write runs in ONE transaction that first locks the case row. That
 * single lock gives both guarantees the law and Stripe's delivery model need:
 *   - duplicate webhook deliveries for the same payment are serialised, and
 *     the second finds the first's invoice instead of issuing another;
 *   - the counter increment and the invoice insert commit or roll back
 *     together, so a failed insert never burns a number (no gaps).
 */

/** Who paid — from Stripe's customer_details, NOT the student's intake: the
 *  payer is often a parent or a company. Stored encrypted. */
export interface BillingDetails {
  name: string;
  email: string | null;
  taxId: { type: string; value: string } | null;
  address: {
    line1: string | null;
    line2: string | null;
    postalCode: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  series: InvoiceSeries;
  issuedAt: string;
  description: string;
  baseCents: number;
  ivaRateBp: number;
  ivaCents: number;
  totalCents: number;
  caseId: string;
  rectifiesId: string | null;
  reason: string | null;
}

export interface Invoice extends InvoiceSummary {
  issuer: InvoiceIssuer;
  billing: BillingDetails;
  /** Number of the invoice a rectificativa corrects. */
  rectifiesNumber: string | null;
}

const billingAad = (invoiceId: string) => `invoice:${invoiceId}:billing`;

function toSummary(row: InvoiceRow): InvoiceSummary {
  return {
    id: row.id,
    number: row.number,
    series: row.series,
    issuedAt: row.issuedAt.toISOString(),
    description: row.description,
    baseCents: row.baseCents,
    ivaRateBp: row.ivaRateBp,
    ivaCents: row.ivaCents,
    totalCents: row.totalCents,
    caseId: row.caseId,
    rectifiesId: row.rectifiesId,
    reason: row.reason,
  };
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

/** Take the next number in a series for the year — inside the caller's transaction. */
async function nextSequence(tx: Tx, series: InvoiceSeries, year: number): Promise<number> {
  const [row] = await tx
    .insert(invoiceCounters)
    .values({ series, year, last: 1 })
    .onConflictDoUpdate({
      target: [invoiceCounters.series, invoiceCounters.year],
      set: { last: sql`${invoiceCounters.last} + 1` },
    })
    .returning({ last: invoiceCounters.last });
  return row!.last;
}

async function lockCase(tx: Tx, caseId: string): Promise<void> {
  const locked = await tx.select({ id: cases.id }).from(cases).where(eq(cases.id, caseId)).for("update");
  if (locked.length === 0) throw new Error(`Case ${caseId} not found`);
}

export interface IssueResult {
  invoice: InvoiceSummary;
  /** False when this payment already had its invoice (a repeated webhook). */
  created: boolean;
}

/**
 * Issue the invoice for a paid Checkout Session. Idempotent per session: call
 * it on every delivery of checkout.session.completed.
 */
export async function issueInvoiceForCheckout(input: {
  caseId: string;
  stripeSessionId: string;
  grossCents: number;
  description: string;
  billing: BillingDetails;
  issuedAt: Date;
}): Promise<IssueResult> {
  if (input.grossCents <= 0) throw new Error("An invoice needs a positive amount");
  // Read the issuer BEFORE the transaction: if it is not configured we must
  // fail without having taken a number.
  const issuer = invoiceIssuer();
  const db = await getDb();

  return db.transaction(async (tx) => {
    await lockCase(tx, input.caseId);

    const [existing] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.series, "INV"), eq(invoices.stripeSessionId, input.stripeSessionId)))
      .limit(1);
    if (existing) return { invoice: toSummary(existing), created: false };

    const year = madridYear(input.issuedAt);
    const sequence = await nextSequence(tx, "INV", year);
    const id = generateToken();
    const [row] = await tx
      .insert(invoices)
      .values({
        id,
        number: formatInvoiceNumber("INV", year, sequence),
        series: "INV",
        year,
        sequence,
        caseId: input.caseId,
        issuedAt: input.issuedAt,
        description: input.description,
        ...splitGross(input.grossCents),
        ivaRateBp: IVA_RATE_BP,
        issuer,
        billingEnvelope: sealJson(input.billing, billingAad(id)),
        stripeSessionId: input.stripeSessionId,
      })
      .returning();
    return { invoice: toSummary(row!), created: true };
  });
}

/**
 * Issue a factura rectificativa for money refunded on a case's payment.
 *
 * Takes the CUMULATIVE refunded amount (Stripe's charge.amount_refunded) and
 * rectifies only the part not already rectified. So it is idempotent across
 * repeated deliveries, and it handles several partial refunds correctly: each
 * produces one rectificativa for its own amount. Returns null when there is
 * nothing new to rectify.
 */
export async function issueRefundRectification(input: {
  caseId: string;
  refundedTotalCents: number;
  issuedAt: Date;
}): Promise<IssueResult | null> {
  const issuer = invoiceIssuer();
  const db = await getDb();

  return db.transaction(async (tx) => {
    await lockCase(tx, input.caseId);

    const [original] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.caseId, input.caseId), eq(invoices.series, "INV")))
      .orderBy(asc(invoices.issuedAt))
      .limit(1);
    if (!original) return null; // a refund before any invoice: nothing to correct

    const [{ rectified }] = (await tx
      .select({ rectified: sql<number>`COALESCE(-SUM(${invoices.totalCents}), 0)`.mapWith(Number) })
      .from(invoices)
      .where(eq(invoices.rectifiesId, original.id))) as [{ rectified: number }];

    // Never rectify more than was invoiced, whatever Stripe reports.
    const target = Math.min(input.refundedTotalCents, original.totalCents);
    const delta = target - rectified;
    if (delta <= 0) return null;

    const billing = openJson<BillingDetails>(original.billingEnvelope, billingAad(original.id));
    const year = madridYear(input.issuedAt);
    const sequence = await nextSequence(tx, "RECT", year);
    const id = generateToken();
    const [row] = await tx
      .insert(invoices)
      .values({
        id,
        number: formatInvoiceNumber("RECT", year, sequence),
        series: "RECT",
        year,
        sequence,
        caseId: input.caseId,
        rectifiesId: original.id,
        reason: target === original.totalCents ? "Devolución total" : "Devolución parcial",
        issuedAt: input.issuedAt,
        description: `Rectificación de la factura ${original.number}: ${original.description}`,
        ...splitGross(-delta),
        ivaRateBp: IVA_RATE_BP,
        issuer,
        billingEnvelope: sealJson(billing, billingAad(id)),
      })
      .returning();
    return { invoice: toSummary(row!), created: true };
  });
}

export async function listInvoicesForCase(caseId: string): Promise<InvoiceSummary[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.caseId, caseId))
    .orderBy(asc(invoices.issuedAt));
  return rows.map(toSummary);
}

async function hydrate(rows: InvoiceRow[]): Promise<Invoice[]> {
  const db = await getDb();
  const originals = new Map<string, string>();
  for (const id of new Set(rows.map((r) => r.rectifiesId).filter((x): x is string => Boolean(x)))) {
    const [o] = await db.select({ number: invoices.number }).from(invoices).where(eq(invoices.id, id));
    if (o) originals.set(id, o.number);
  }
  return rows.map((row) => ({
    ...toSummary(row),
    issuer: row.issuer,
    billing: openJson<BillingDetails>(row.billingEnvelope, billingAad(row.id)),
    rectifiesNumber: row.rectifiesId ? (originals.get(row.rectifiesId) ?? null) : null,
  }));
}

export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(invoiceId)) return null;
  const db = await getDb();
  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  return rows.length ? (await hydrate(rows))[0]! : null;
}

/** Invoices issued in [from, to), in number order within each series — the gestor's view. */
export async function listInvoicesForExport(from: Date, to: Date): Promise<Invoice[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(invoices)
    .where(and(gte(invoices.issuedAt, from), lt(invoices.issuedAt, to)))
    .orderBy(asc(invoices.series), asc(invoices.year), asc(invoices.sequence));
  return hydrate(rows);
}
