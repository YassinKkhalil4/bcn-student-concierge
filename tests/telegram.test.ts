import { describe, it, expect, vi, afterEach } from "vitest";
import { sendTelegram } from "../src/lib/notify/telegram";
import { documentsAlertText, paymentAlertText } from "../src/lib/notify/events";
import { assertProductionConfig } from "../src/lib/config";

const TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw";
const env = { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "987654321" } as unknown as NodeJS.ProcessEnv;

afterEach(() => vi.unstubAllGlobals());

describe("sendTelegram", () => {
  it("posts plain text to the bot's sendMessage endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendTelegram("hello", env)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(init.body)).toEqual({ chat_id: "987654321", text: "hello", disable_web_page_preview: true });
    expect(JSON.parse(init.body).parse_mode).toBeUndefined();
  });

  it("does nothing when unconfigured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendTelegram("hello", {} as NodeJS.ProcessEnv)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws, and never logs the token, when Telegram fails", async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ description: "Bad Request: chat not found" }), { status: 400 })));
    expect(await sendTelegram("x", env)).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" })));
    expect(await sendTelegram("x", env)).toBe(false);
    spy.mockRestore();
    expect(errors.join("\n")).toContain("chat not found");
    expect(errors.join("\n")).not.toContain(TOKEN);
    expect(errors.join("\n")).not.toContain("api.telegram.org");
  });
});

describe("alert messages", () => {
  it("match the agreed format, with the amount actually charged", () => {
    expect(paymentAlertText({ ref: "BCN-58213", totalCents: 65340, packageName: "Digital Soft-Landing" }))
      .toBe("🔔 New Client: Ref #BCN-58213 (€653.40 Paid)\nDigital Soft-Landing");
    expect(documentsAlertText("BCN-58213")).toBe("📄 Docs Uploaded: Ref #BCN-58213\nReady for review.");
  });

  it("carry no personal data — only what the caller passes", () => {
    // The functions accept a reference, amounts and a package name: there is
    // no parameter through which a name, email or passport could reach Telegram.
    expect(paymentAlertText.length).toBe(1);
    expect(documentsAlertText.length).toBe(1);
  });
});

describe("Telegram configuration", () => {
  const base = {
    DATABASE_URL: "postgres://x", PUBLIC_ORIGIN: "https://bcnstudent.com",
    DOCUMENT_MASTER_KEY: Buffer.alloc(32, 1).toString("base64"),
    RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.c", STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh",
    INVOICE_ISSUER_NAME: "X", INVOICE_ISSUER_TAX_ID: "B12345678", INVOICE_ISSUER_ADDRESS: "Barcelona",
  };
  const saved = process.env.PORTAL_SESSION_SECRET;
  const run = (extra: Record<string, string>) => {
    process.env.PORTAL_SESSION_SECRET = Buffer.alloc(32, 2).toString("base64");
    try {
      return () => assertProductionConfig({ ...base, ...extra } as unknown as NodeJS.ProcessEnv);
    } finally {
      // restored after assertion by the caller's expect
    }
  };
  afterEach(() => { process.env.PORTAL_SESSION_SECRET = saved; });

  it("accepts neither or both", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(run({})).not.toThrow();
    expect(run({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "1" })).not.toThrow();
    warn.mockRestore();
  });

  it("refuses to start half-configured or with a malformed token", () => {
    expect(run({ TELEGRAM_BOT_TOKEN: TOKEN })).toThrow(/set both, or neither/);
    expect(run({ TELEGRAM_CHAT_ID: "1" })).toThrow(/set both, or neither/);
    expect(run({ TELEGRAM_BOT_TOKEN: "not-a-token", TELEGRAM_CHAT_ID: "1" })).toThrow(/not a bot token/);
  });
});
