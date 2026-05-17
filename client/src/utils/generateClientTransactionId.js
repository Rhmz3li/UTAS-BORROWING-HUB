/**
 * Unique reference generated in the browser for payment records (sent as transaction_id).
 */
export function generateClientTransactionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `UBH-${crypto.randomUUID()}`;
    }
    return `UBH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
