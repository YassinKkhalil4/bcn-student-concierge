import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { portalCaseId } from "@/lib/portal/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in to your file",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, { tone: "ok" | "err"; text: string }> = {
  sent: {
    tone: "ok",
    text: "If there is a file under that email address, a sign-in link is on its way. It works once and expires in 30 minutes — check your spam folder if it has not arrived in a few minutes.",
  },
  email: { tone: "err", text: "Please enter a valid email address." },
  link: { tone: "err", text: "That sign-in link has expired or was already used. Request a new one below." },
  locked: { tone: "err", text: "Too many attempts. Please wait 15 minutes and try again." },
};

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (await portalCaseId()) redirect("/portal");
  const params = await searchParams;
  const message = params.sent ? MESSAGES.sent : params.error ? MESSAGES[params.error] : undefined;

  return (
    <div className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Your file</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
          Sign in to your file
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Enter the email address you used on the intake form. We will email you a
          one-time link — no password needed.
        </p>

        {message && (
          <p
            role={message.tone === "err" ? "alert" : "status"}
            className={`mt-6 rounded-lg px-4 py-3 text-sm ${
              message.tone === "ok" ? "bg-olive/10 text-olive" : "bg-terracotta/5 text-terracotta"
            }`}
          >
            {message.text}
          </p>
        )}

        <form action="/api/portal/login" method="post" className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="field-label">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              className="field-input"
            />
          </div>
          <button type="submit" className="btn-primary w-full">Email me a sign-in link</button>
        </form>
      </div>
    </div>
  );
}
