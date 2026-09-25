import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: { default: "Cases", template: "%s · Staff · BCN Student Concierge" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await isAdmin();

  return (
    <div className="min-h-screen bg-paper-dim">
      <header className="border-b border-paper-line bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="font-sans text-base font-semibold text-ink">BCN Student Concierge</span>
            <span className="text-xs font-medium uppercase tracking-wider text-ink-soft">Staff</span>
          </Link>
          {signedIn && (
            <div className="flex items-center gap-5">
              <Link href="/admin/guide" className="text-sm text-ink-muted hover:text-ink">Guide conversion</Link>
              <form action="/api/admin/logout" method="post">
                <button type="submit" className="text-sm text-ink-muted hover:text-ink">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
