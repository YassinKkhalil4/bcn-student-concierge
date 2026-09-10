import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifySessionToken } from "./session";

/**
 * Second gate, run inside every admin page, route handler and server action.
 * Middleware is the first gate; this one exists so a matcher mistake cannot
 * expose data on its own.
 */
export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** For pages and server actions: bounce to login. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
