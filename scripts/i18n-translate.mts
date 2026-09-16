/**
 * Translate messages/en/*.json into es, ca, fr, it and de with DeepL.
 *
 *   npm run i18n:translate            # only strings that are new or changed
 *   npm run i18n:translate -- --all   # everything again
 *   npm run i18n:check                # verify catalogues, translate nothing
 *
 * The key is read from DEEPL_API_KEY (.env.local; never committed). The
 * translated catalogues ARE committed: the site never calls DeepL at runtime.
 *
 * What the script protects, so a translation cannot break the site or mislead
 * a student:
 *   - official names (Padrón, NIE, TIE, Modelo 790, EX-17, EX-18, …) stay
 *     exactly as written — they are what the student will see on Spanish forms;
 *   - ICU placeholders ({name}) and rich-text tags (<strong>…</strong>) come
 *     back intact, or the string fails validation;
 *   - URLs and email addresses are never touched.
 *
 * Human corrections go in scripts/i18n-overrides.json ({ "fr": { "intake.x.y":
 * "…" } }) and always win over DeepL. messages/.i18n-lock.json records the
 * source each translation was made from, so edited English is re-translated
 * and nothing else is.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { PROTECTED_TERMS, TARGETS, problems, protect, restore, typography, type Target } from "../src/i18n/protection.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const MESSAGES = path.join(ROOT, "messages");
const LOCK_FILE = path.join(MESSAGES, ".i18n-lock.json");
const OVERRIDES_FILE = path.join(ROOT, "scripts", "i18n-overrides.json");
const API = "https://api-free.deepl.com/v2";

const CONTEXT =
  "Website of BCN Student Concierge, an administrative agency in Barcelona that helps international " +
  "university students with Spanish residency paperwork: city registration (Padrón), NIE, TIE card, " +
  "EX-17 and EX-18 forms, police appointments. The reader IS THE STUDENT — already in Barcelona, " +
  "a few weeks after arriving — not their parent. Address them directly. Clear, precise, direct, " +
  "never patronising. Not legal advice.";

/**
 * Package names are brand names — the same in every language, and the same as
 * on the invoice. Their "name" and "shortName" are both the English short name
 * (a leading "The" reads oddly in front of another language's article).
 */
function brandName(ns: string, key: string, english: Flat): string | undefined {
  const m = ns === "pricing" ? /^tiers\.([^.]+)\.(name|shortName)$/.exec(key) : null;
  return m ? english.get(`tiers.${m[1]}.shortName`) : undefined;
}

/** What each catalogue is, so DeepL knows what kind of text it is reading. */
const NAMESPACE_CONTEXT: Record<string, string> = {
  common: "Site header, footer and notices shown on every page.",
  home: "Marketing home page.",
  pricing: "Service packages and prices page.",
  guide: "Download page for a free PDF guide for international students in Barcelona.",
  legal: "Legal pages (privacy notice, terms of service). Precise legal register.",
  intake: "A multi-step secure web form: field labels, hints, buttons, status and error messages.",
  portal: "The student's private file page after signing in: buttons, instructions, status messages.",
  guides: "A printed guide for the police appointment day, and steps to pay a fee at a bank ATM.",
  validation: "Error messages shown under a form field; {field} is replaced by the field's label.",
  email: "A transactional sign-in email.",
};

/**
 * DeepL has no formality setting for Catalan. Barcelona's own administration
 * addresses the public in the plural "vós" forms, and so do we. Italian gets
 * formal address from DeepL, but drifted between «Lei» and «voi» by section.
 */
/**
 * Register, per language and per namespace.
 *
 * The marketing pages (home, pricing, triage) address a student directly and
 * informally, because that is how a service speaks to a nineteen-year-old in
 * Spanish, Catalan, Italian and German — formal address there reads as a bank
 * letter. French keeps «vous», which is what a service uses even with students.
 *
 * The transactional and legal pages (intake, portal, legal, guides, email) keep
 * the formal register they were written in: an instruction attached to a
 * government form, and a contract, are not the place to change voice.
 */
const MARKETING_NAMESPACES = new Set(["home", "pricing", "triage"]);

const REGISTER_FORMAL: Partial<Record<Target, string>> = {
  ca: "Address the reader formally with the second-person plural (vós) forms: «Introduïu», «el vostre», «Pugeu».",
  it: "Address the reader consistently and only with the formal singular «Lei» (Suo, La, Le); never «voi» or «tu».",
};

const REGISTER_INFORMAL: Partial<Record<Target, string>> = {
  es: "Address the student informally in the second person singular («tú»): «tienes», «tu cita».",
  ca: "Address the student informally in the second person singular («tu»): «tens», «la teva cita». Never the «vós» forms.",
  fr: "Keep the formal «vous»: a service addresses a student that way in French.",
  it: "Address the student informally in the second person singular («tu»): «hai», «il tuo appuntamento». Never «Lei».",
  de: "Address the student informally («du»): «du hast», «dein Termin». Never «Sie».",
};

const REGISTER = (ns: string): Partial<Record<Target, string>> =>
  MARKETING_NAMESPACES.has(ns) ? REGISTER_INFORMAL : REGISTER_FORMAL;

// ───────────────────────── catalogue plumbing ─────────────────────────

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Flat = Map<string, string>;

function flatten(value: Json, prefix: string, out: Flat): Flat {
  if (typeof value === "string") out.set(prefix, value);
  else if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** Rebuild the English file's exact shape, taking each leaf from `flat`. */
function rebuild(shape: Json, prefix: string, flat: Flat): Json {
  if (typeof shape === "string") return flat.get(prefix) ?? shape;
  if (Array.isArray(shape)) return shape.map((v, i) => rebuild(v, `${prefix}.${i}`, flat));
  if (shape && typeof shape === "object")
    return Object.fromEntries(
      Object.entries(shape).map(([k, v]) => [k, rebuild(v, prefix ? `${prefix}.${k}` : k, flat)]),
    );
  return shape;
}

const readJson = (file: string): Json => JSON.parse(readFileSync(file, "utf8")) as Json;
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

// ───────────────────────── DeepL ─────────────────────────

async function call(key: string, pathname: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${pathname}`, {
      ...init,
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(60_000),
    });
    // 429 (too many requests) and 5xx are worth a retry; nothing else is.
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`DeepL ${pathname} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res;
  }
}

/** A throwaway glossary mapping every protected term to itself. */
async function createGlossary(key: string, target: Target): Promise<string> {
  const entries = PROTECTED_TERMS.map((t) => `${t}\t${t}`).join("\n");
  const res = await call(key, "/glossaries", {
    method: "POST",
    body: JSON.stringify({ name: `bcn-protected-${target}`, source_lang: "en", target_lang: target, entries, entries_format: "tsv" }),
  });
  return ((await res.json()) as { glossary_id: string }).glossary_id;
}

async function deleteGlossary(key: string, id: string): Promise<void> {
  await call(key, `/glossaries/${id}`, { method: "DELETE" }).catch(() => {});
}

async function deepl(
  texts: string[],
  opts: { target: Target; from: "EN" | "ES"; context: string; glossary?: string },
  key: string,
): Promise<string[]> {
  const res = await call(key, "/translate", {
    method: "POST",
    body: JSON.stringify({
      text: texts,
      source_lang: opts.from,
      target_lang: opts.target.toUpperCase(),
      tag_handling: "xml",
      ignore_tags: ["keep"],
      // Formal address (vous, Sie, usted, Lei): this is a paperwork service.
      // Catalan has no formality setting at DeepL; see REGISTER.
      ...(opts.target === "ca" ? {} : { formality: "prefer_more" }),
      ...(opts.glossary ? { glossary_id: opts.glossary } : {}),
      model_type: "prefer_quality_optimized",
      context: opts.context,
    }),
  });
  return ((await res.json()) as { translations: { text: string }[] }).translations.map((t) => t.text);
}

/** "fields.nie.hint" → "fields.nie": strings in one section are sent together. */
const sectionOf = (key: string) => key.split(".").slice(0, -1).join(".") || "(top)";

// ───────────────────────── main ─────────────────────────

async function main() {
  const args = new Set(process.argv.slice(2));
  const all = args.has("--all");
  const checkOnly = args.has("--check");
  const key = process.env.DEEPL_API_KEY;
  if (!checkOnly && !key) throw new Error("DEEPL_API_KEY is not set (put it in .env.local)");

  const namespaces = readdirSync(path.join(MESSAGES, "en"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  const lock = (existsSync(LOCK_FILE) ? readJson(LOCK_FILE) : {}) as Record<string, Record<string, string>>;
  const overrides = (existsSync(OVERRIDES_FILE) ? readJson(OVERRIDES_FILE) : {}) as Record<
    string,
    Record<string, string>
  >;
  const failures: string[] = [];
  let characters = 0;
  const glossaries = new Map<Target, string>();

  // Spanish first: Catalan is translated FROM the Spanish, a much closer pair
  // than English→Catalan (which garbled "DNI, NIE card" into "student card").
  try {
    for (const target of TARGETS) {
      lock[target] ??= {};
      const targetLock = lock[target]!;
      mkdirSync(path.join(MESSAGES, target), { recursive: true });

      for (const ns of namespaces) {
        const shape = readJson(path.join(MESSAGES, "en", `${ns}.json`));
        const english = flatten(shape, "", new Map());
        const spanish =
          target === "ca" ? flatten(readJson(path.join(MESSAGES, "es", `${ns}.json`)), "", new Map()) : null;
        /** What this language is translated from, and the fingerprint of that. */
        const sourceOf = (k: string) => spanish?.get(k) ?? english.get(k)!;
        const fingerprint = (k: string) =>
          hash(spanish ? `${english.get(k)}\n${spanish.get(k)}` : english.get(k)!);

        const file = path.join(MESSAGES, target, `${ns}.json`);
        const existing = existsSync(file) ? flatten(readJson(file), "", new Map()) : new Map<string, string>();
        const result: Flat = new Map();
        const todo: string[] = [];

        for (const k of english.keys()) {
          const id = `${ns}.${k}`;
          const override = overrides[target]?.[id] ?? brandName(ns, k, english);
          if (override !== undefined) result.set(k, override);
          else if (!all && existing.has(k) && targetLock[id] === fingerprint(k)) result.set(k, existing.get(k)!);
          else todo.push(k);
        }

        if (todo.length && !checkOnly) {
          const sections = new Map<string, string[]>();
          for (const k of todo) sections.set(sectionOf(k), [...(sections.get(sectionOf(k)) ?? []), k]);
          for (const [section, keys] of sections) {
            const context = [CONTEXT, NAMESPACE_CONTEXT[ns], `Section: ${ns}.${section}.`, REGISTER(ns)[target]]
              .filter(Boolean)
              .join(" ");
            for (let i = 0; i < keys.length; i += 40) {
              const batch = keys.slice(i, i + 40);
              const prepared = batch.map((k) => protect(sourceOf(k)));
              characters += prepared.reduce((n, p) => n + p.text.length, 0);
              if (!spanish && !glossaries.has(target)) glossaries.set(target, await createGlossary(key!, target));
              const translated = await deepl(
                prepared.map((p) => p.text),
                { target, from: spanish ? "ES" : "EN", context, glossary: glossaries.get(target) },
                key!,
              );
              batch.forEach((k, j) => {
                result.set(k, restore(translated[j]!, prepared[j]!.names, target));
                targetLock[`${ns}.${k}`] = fingerprint(k);
              });
            }
          }
          console.log(`${target}/${ns}: translated ${todo.length} string(s)`);
        } else if (todo.length) {
          failures.push(...todo.map((k) => `${target} ${ns}.${k}: not translated, or its source changed`));
        }

        for (const [k, value] of result) result.set(k, typography(value, target));
        for (const [k, text] of english) {
          const translated = result.get(k);
          if (translated === undefined) continue;
          for (const p of problems(text, translated, target)) failures.push(`${target} ${ns}.${k}: ${p}`);
        }
        if (!checkOnly) writeFileSync(file, `${JSON.stringify(rebuild(shape, "", result), null, 2)}\n`);
      }
      // The free plan holds one glossary at a time.
      const id = glossaries.get(target);
      if (id) {
        glossaries.delete(target);
        await deleteGlossary(key!, id);
      }
    }
  } finally {
    for (const id of glossaries.values()) await deleteGlossary(key!, id);
    if (!checkOnly) writeFileSync(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`);
  }

  if (!checkOnly) {
    // Forget lock entries for strings that no longer exist in English.
    for (const target of TARGETS) {
      for (const id of Object.keys(lock[target] ?? {})) {
        const [ns, ...rest] = id.split(".");
        const file = path.join(MESSAGES, "en", `${ns}.json`);
        if (!existsSync(file) || !flatten(readJson(file), "", new Map()).has(rest.join("."))) delete lock[target]![id];
      }
    }
    writeFileSync(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`Sent ${characters.toLocaleString("en")} characters to DeepL.`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} problem(s) — fix with scripts/i18n-overrides.json:\n${failures.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("All catalogues valid.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
