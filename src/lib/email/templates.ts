import { escapeHtml, type Email } from "./send";

/**
 * Email bodies. Plain, text-first, no tracking pixels or remote images — a
 * sign-in email must look exactly like what it is.
 */

export function loginLinkEmail(to: string, links: { ref: string; url: string }[]): Email {
  const many = links.length > 1;
  const intro = many
    ? "Here are your sign-in links — one for each file under this email address."
    : "Here is your sign-in link for your BCN Student Concierge file.";
  const footer =
    "Each link works once and expires in 30 minutes. If you did not ask to sign in, " +
    "you can ignore this email — nobody can use it without access to your inbox.";

  const text = [
    intro,
    "",
    ...links.flatMap((l) => [many ? `File ${l.ref}:` : "", l.url, ""]).filter((line, i, a) => line || a[i - 1]),
    footer,
    "",
    "BCN Student Concierge · bcnstudent.com",
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0F1613;line-height:1.5;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:16px;font-weight:600;margin:0 0 16px">BCN Student Concierge</p>
<p>${escapeHtml(intro)}</p>
${links
  .map(
    (l) => `<p style="margin:20px 0">${many ? `<span style="color:#4A5551;font-size:13px">File ${escapeHtml(l.ref)}</span><br>` : ""}<a href="${escapeHtml(l.url)}" style="display:inline-block;background:#2F4F3E;color:#FBFAF7;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Open my file</a></p>`,
  )
  .join("\n")}
<p style="color:#4A5551;font-size:13px">${escapeHtml(footer)}</p>
<p style="color:#7C8783;font-size:12px;margin-top:32px">BCN Student Concierge · bcnstudent.com</p>
</body></html>`;

  return { to, subject: "Your sign-in link — BCN Student Concierge", text, html };
}
