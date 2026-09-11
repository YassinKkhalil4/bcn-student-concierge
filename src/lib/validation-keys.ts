/**
 * Validation messages travel as KEYS, not sentences: the schema runs on the
 * server and in the browser, but the student reads the result in their own
 * language. A message is "v.<key>" optionally followed by "|name=value" params,
 * e.g. "v.tooLong|max=60". The form turns it into a sentence with
 * messages/<locale>/validation.json, naming the field it belongs to.
 */

export function vkey(key: string, params?: Record<string, string | number>): string {
  const query = params ? new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : "";
  return query ? `v.${key}|${query}` : `v.${key}`;
}

export function parseVKey(message: string): { key: string; params: Record<string, string> } | null {
  if (!message.startsWith("v.")) return null;
  const [key, query] = message.slice(2).split("|", 2) as [string, string | undefined];
  return { key, params: Object.fromEntries(new URLSearchParams(query ?? "")) };
}

/**
 * Turn a schema message into a sentence. `t` is the "validation" namespace;
 * `field` the translated label of the input it belongs to. Messages that are
 * not keys (e.g. from a library) are shown as they are.
 */
export function translateIssue(
  message: string,
  field: string,
  // Loosely typed so a namespaced next-intl translator (whose key type is the
  // union of catalogue keys) can be passed straight in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any, values?: any) => string,
): string {
  const parsed = parseVKey(message);
  return parsed ? t(parsed.key, { ...parsed.params, field }) : message;
}
