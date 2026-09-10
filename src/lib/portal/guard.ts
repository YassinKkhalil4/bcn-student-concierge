import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_COOKIE, verifyPortalSession } from "./session";

/**
 * Second gate for the student portal, run inside every portal page, route
 * handler and server action (middleware is the first). Returns the case id the
 * session is bound to — handlers use THIS, never a case id from the request
 * body, so a student can only ever act on their own file.
 */
export async function portalCaseId(): Promise<string | null> {
  return verifyPortalSession((await cookies()).get(PORTAL_COOKIE)?.value);
}

export async function requirePortalCaseId(): Promise<string> {
  const caseId = await portalCaseId();
  if (!caseId) redirect("/portal/login");
  return caseId;
}
