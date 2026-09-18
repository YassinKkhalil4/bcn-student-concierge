import { escapeHtml, type Email } from "./send";
import type { ServerTranslator } from "@/i18n/messages";

/**
 * Email bodies. Plain, text-first, no tracking pixels or remote images — a
 * sign-in email must look exactly like what it is.
 */

/**
 * `t` is the "email" catalogue in the language the student was using when they
 * asked for the link.
 */
export function loginLinkEmail(
  to: string,
  links: { ref: string; url: string }[],
  t: ServerTranslator,
  locale: string,
): Email {
  const many = links.length > 1;
  const intro = t(many ? "loginLink.introMany" : "loginLink.introOne");
  const footer = t("loginLink.footer");
  const fileLabel = (ref: string) => t("loginLink.file", { ref });

  const text = [
    intro,
    "",
    ...links.flatMap((l) => [many ? `${fileLabel(l.ref)}:` : "", l.url, ""]).filter((line, i, a) => line || a[i - 1]),
    footer,
    "",
    "BCN Student Concierge · bcnstudent.com",
  ].join("\n");

  const html = `<!doctype html><html lang="${escapeHtml(locale)}"><body style="font-family:Archivo,system-ui,-apple-system,Segoe UI,sans-serif;color:#16202B;line-height:1.55;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:13px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 20px"><span style="display:inline-block;width:12px;height:12px;background:#C2263C;vertical-align:-1px;margin-right:8px"></span>BCN Student Concierge</p>
<p>${escapeHtml(intro)}</p>
${links
  .map(
    (l) => `<p style="margin:20px 0">${many ? `<span style="color:#47515E;font-size:13px">${escapeHtml(fileLabel(l.ref))}</span><br>` : ""}<a href="${escapeHtml(l.url)}" style="display:inline-block;background:#C2263C;color:#FBFAF7;padding:12px 22px;text-decoration:none;font-weight:700">${escapeHtml(t("loginLink.button"))}</a></p>`,
  )
  .join("\n")}
<p style="color:#47515E;font-size:13px">${escapeHtml(footer)}</p>
<p style="color:#626B77;font-size:12px;margin-top:32px;border-top:1px solid #E3DED3;padding-top:16px">BCN Student Concierge · bcnstudent.com</p>
</body></html>`;

  return { to, subject: t("loginLink.subject"), text, html };
}
