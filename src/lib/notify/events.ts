/**
 * Staff notifications for case events. The Telegram transport arrives in
 * Phase 4; until then these are deliberate no-ops so callers are wired now.
 */
export async function notifyDocumentsSubmitted(_caseId: string): Promise<void> {}
export async function notifyPaymentReceived(_caseId: string): Promise<void> {}
