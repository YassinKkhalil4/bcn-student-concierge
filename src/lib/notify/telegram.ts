/**
 * Staff alerts via the Telegram Bot API (plain fetch, no SDK).
 *
 *   TELEGRAM_BOT_TOKEN  from @BotFather, e.g. 123456789:AA…
 *   TELEGRAM_CHAT_ID    your chat with the bot (or a group), e.g. 987654321
 *
 * Deliberately best-effort: an alert is a convenience, never part of the
 * transaction. sendTelegram() never throws and gives up after 3 seconds, so
 * a Telegram outage can never fail a Stripe webhook (which Stripe would then
 * retry) or a student's "Submit for review". The dashboard remains the record.
 *
 * Messages must never contain names, emails or document numbers: Telegram is a
 * third-party service outside the EU, and alerts show on a lock screen. Callers
 * pass the case reference and amounts only.
 */

export const TELEGRAM_TOKEN_FORMAT = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;

export function telegramConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

export async function sendTelegram(text: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Plain text (no parse_mode): nothing in a message can be misread as markup.
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      // Telegram's description ("chat not found", …) is safe to log. The URL is
      // not: it contains the bot token.
      const body = (await response.json().catch(() => ({}))) as { description?: string };
      console.error(`[telegram] alert not delivered (HTTP ${response.status}: ${body.description ?? "no detail"})`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[telegram] alert not delivered (${error instanceof Error ? error.name : "error"})`);
    return false;
  }
}
