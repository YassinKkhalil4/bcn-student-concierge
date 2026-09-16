/**
 * Who provides this service — the identification a Spanish information-society
 * service provider must show permanently and directly (Ley 34/2002, LSSI,
 * art. 10): legal name, NIF, registered address, and a contact email.
 *
 * The same legal entity is the GDPR data controller named in the privacy
 * notice, and should match the INVOICE_ISSUER_* values on every factura.
 *
 * DELIBERATELY EMPTY until the real registration details are supplied. Do not
 * put placeholders here: a made-up NIF on a live site is worse than none. The
 * footer shows each field as soon as it has a value, and the privacy notice
 * names the legal entity once `legalName` is set.
 */
export const PROVIDER = {
  /** Denominación social, exactly as registered (e.g. with "S.L."). */
  legalName: "",
  /** NIF / CIF. */
  taxId: "",
  /** Domicilio social, in full. */
  registeredAddress: "",
  /** A monitored contact address. */
  email: "",
} as const;

export type ProviderField = keyof typeof PROVIDER;
export const PROVIDER_FIELDS = ["legalName", "taxId", "registeredAddress", "email"] as const satisfies readonly ProviderField[];

/** The controller as the privacy notice names it: the legal entity once known. */
export function controllerName(brand: string): string {
  return PROVIDER.legalName ? `${PROVIDER.legalName} (${brand})` : brand;
}
