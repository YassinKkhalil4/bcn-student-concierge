/**
 * Spanish identity and tax numbers, with their check characters.
 *
 * A typo in an ID number on an official form gets the form refused at the
 * counter, weeks later. Checking the control character catches almost every
 * single-character slip at the moment of typing instead.
 */

const LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

const normalize = (v: string) => v.replace(/[\s.-]/g, "").toUpperCase();

/** DNI: 8 digits + control letter (number mod 23). */
export function isValidDni(value: string): boolean {
  const v = normalize(value);
  if (!/^\d{8}[A-Z]$/.test(v)) return false;
  return LETTERS[Number(v.slice(0, 8)) % 23] === v[8];
}

/** NIE: X/Y/Z + 7 digits + control letter, with X=0, Y=1, Z=2. */
export function isValidNie(value: string): boolean {
  const v = normalize(value);
  if (!/^[XYZ]\d{7}[A-Z]$/.test(v)) return false;
  const body = Number(`${"XYZ".indexOf(v[0]!)}${v.slice(1, 8)}`);
  return LETTERS[body % 23] === v[8];
}

/**
 * CIF (company tax number): entity letter + 7 digits + control character.
 * Digits in odd positions are doubled and their digits summed; the control is
 * (10 - total mod 10) mod 10, written as a digit or as "JABCDEFGHI"[control].
 * Entity types P, Q, R, S, N, W always use the letter; A, B, E, H always the
 * digit; the rest accept either.
 *
 * Verified against published CIFs: A46103834, A28015865.
 */
export function isValidCif(value: string): boolean {
  const v = normalize(value);
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(v);
  if (!m) return false;
  const [, entity, digits, control] = m as unknown as [string, string, string, string];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = d * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += d;
    }
  }
  const expected = (10 - (sum % 10)) % 10;
  const asLetter = "JABCDEFGHI"[expected]!;
  if ("PQRSNW".includes(entity)) return control === asLetter;
  if ("ABEH".includes(entity)) return control === String(expected);
  return control === String(expected) || control === asLetter;
}

/** A person's Spanish ID: DNI or NIE. */
export function isValidPersonalId(value: string): boolean {
  return isValidDni(value) || isValidNie(value);
}

/** Any Spanish tax number: DNI and NIE for people, CIF for companies. */
export function isValidSpanishTaxId(value: string): boolean {
  return isValidDni(value) || isValidNie(value) || isValidCif(value);
}

/** Canonical form for printing: no spaces, dots or dashes; uppercase. */
export function formatSpanishId(value: string): string {
  return normalize(value);
}
