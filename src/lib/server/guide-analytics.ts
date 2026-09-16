import { sql } from "drizzle-orm";
import { generateToken } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import { guideDownloads, type Locale } from "@/lib/db/schema";
import type { GuideSource } from "@/lib/attribution";

/**
 * First-party analytics for the guide. The event is recorded by the download
 * route itself, so it needs no script on the page and counts a forwarded
 * direct link the same as a click on /guide.
 */
export async function recordGuideDownload(event: {
  visitorId: string;
  source: GuideSource | null;
  locale: Locale | null;
  at?: Date;
}): Promise<void> {
  const db = await getDb();
  await db.insert(guideDownloads).values({
    id: generateToken(),
    visitorId: event.visitorId,
    source: event.source,
    locale: event.locale,
    downloadedAt: event.at ?? new Date(),
  });
}

export interface GuideConversionRow {
  /** null: downloads that came through no school link. */
  source: GuideSource | null;
  /** Every download event, repeats included. */
  downloads: number;
  /** Distinct browsers that downloaded: the denominator. */
  downloaders: number;
  /** Of those, how many then sent a free-triage enquiry. */
  triaged: number;
  /** Of those, how many opened a case (intake), and how many paid. */
  intakes: number;
  paid: number;
  /** triaged / downloaders, 0–1. */
  triageRate: number;
}

/**
 * Download → triage conversion, per source — the metric the guide exists for.
 *
 * A downloader is counted once, under the first school link they downloaded
 * through. They count as triaged when an enquiry carries their download id,
 * which it can only do if they downloaded first (the id is issued by the
 * download). Optional `since` limits it to downloads from that moment.
 */
export async function guideConversionBySource(since?: Date): Promise<GuideConversionRow[]> {
  const db = await getDb();
  const from = since ? sql`WHERE downloaded_at >= ${since.toISOString()}::timestamptz` : sql``;
  const result = await db.execute(sql`
    WITH downloader AS (
      SELECT
        visitor_id,
        (array_agg(source ORDER BY downloaded_at) FILTER (WHERE source IS NOT NULL))[1] AS source,
        count(*) AS downloads
      FROM guide_downloads
      ${from}
      GROUP BY visitor_id
    )
    SELECT
      d.source,
      sum(d.downloads)::int AS downloads,
      count(*)::int AS downloaders,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM triage_enquiries t WHERE t.guide_visitor_id = d.visitor_id
      ))::int AS triaged,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM cases c WHERE c.guide_visitor_id = d.visitor_id
      ))::int AS intakes,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM cases c WHERE c.guide_visitor_id = d.visitor_id AND c.payment_status = 'paid'
      ))::int AS paid
    FROM downloader d
    GROUP BY d.source
    ORDER BY downloaders DESC, d.source NULLS LAST
  `);
  const rows = (result as unknown as { rows: Omit<GuideConversionRow, "triageRate">[] }).rows;
  return rows.map((r) => {
    const downloaders = Number(r.downloaders);
    const triaged = Number(r.triaged);
    return {
      source: r.source,
      downloads: Number(r.downloads),
      downloaders,
      triaged,
      intakes: Number(r.intakes),
      paid: Number(r.paid),
      triageRate: downloaders ? triaged / downloaders : 0,
    };
  });
}
