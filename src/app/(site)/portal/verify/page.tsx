import type { Metadata } from "next";
import Link from "next/link";
import { verifyLoginLinkToken } from "@/lib/portal/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Continue to your file",
  robots: { index: false, follow: false },
};

/**
 * Landing page for the emailed link. It checks the link's signature and expiry
 * but does NOT use it up: redeeming happens only when the student presses the
 * button. Email security scanners open links automatically; if opening this
 * page consumed the token, the student's single-use link would already be spent.
 */
export default async function PortalVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const link = await verifyLoginLinkToken(token);

  return (
    <div className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-md text-center">
        {link ? (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Continue to your file
            </h1>
            <p className="mt-3 text-sm text-ink-muted">This link works once.</p>
            <form action="/api/portal/verify" method="post" className="mt-8">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn-primary w-full">Open my file</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              This link has expired
            </h1>
            <p className="mt-3 text-sm text-ink-muted">
              Sign-in links last 30 minutes and work once.
            </p>
            <Link href="/portal/login" className="btn-primary mt-8 w-full">
              Send me a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
