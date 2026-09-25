import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/guard";
import { adminConfigured } from "@/lib/admin/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  invalid: "Incorrect password.",
  locked: "Too many attempts. Wait 15 minutes and try again.",
  unconfigured: "Admin access is not configured on this server.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  const configured = adminConfigured();
  const message = !configured ? ERRORS.unconfigured : error ? ERRORS[error] : undefined;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="border border-paper-line bg-white p-7">
        <h1 className="font-sans text-xl font-semibold text-ink">Staff sign in</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Access to client files and identity documents.</p>

        {message && (
          <p role="alert" className="mt-5 bg-accent-tint px-3 py-2 text-sm font-medium text-accent-deep">
            {message}
          </p>
        )}

        {configured ? (
          <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="field-label">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                autoFocus
                maxLength={256}
                className="field-input"
              />
            </div>
            <button type="submit" className="btn-primary w-full">Sign in</button>
          </form>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-ink-soft">
            Set <code>ADMIN_PASSWORD_HASH</code> (generate with{" "}
            <code>npm run admin:hash-password</code>) and <code>ADMIN_SESSION_SECRET</code>{" "}
            (<code>openssl rand -base64 32</code>), then restart.
          </p>
        )}
      </div>
    </div>
  );
}
