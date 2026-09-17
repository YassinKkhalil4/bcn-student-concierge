/**
 * A page's structured data, as one `<script type="application/ld+json">`.
 *
 * No nonce, deliberately. A JSON-LD block is a data block, not executable
 * script: CSP's `script-src` does not apply to it, and the page's own strict
 * nonce CSP lets it through untouched. Putting a nonce on it anyway breaks
 * hydration — the browser scrubs the attribute's value out of the DOM once the
 * document is parsed (a CSP protection in its own right), so React compares the
 * server's `nonce="…"` against the client's `nonce=""` and reports a mismatch
 * on every page load.
 *
 * `json` comes from src/lib/structured-data.ts via `JSON.stringify`, and every
 * `<` is escaped below, so no message catalogue can close the tag early.
 */
export function JsonLd({ json }: { json: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json.replace(/</g, "\\u003c") }}
    />
  );
}
