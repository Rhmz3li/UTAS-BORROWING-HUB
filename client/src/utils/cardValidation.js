/**
 * Card validation for Visa / Mastercard (light client-side checks).
 */

export function isMastercardBin16(digits) {
    const d = String(digits || '').replace(/\D/g, '');
    if (d.length !== 16) return false;
    if (/^5[1-5]\d{14}$/.test(d)) return true;
    const p4 = parseInt(d.slice(0, 4), 10);
    if (/^2/.test(d) && !Number.isNaN(p4) && p4 >= 2221 && p4 <= 2720) return true;
    return false;
}

/** Visa: exactly 16 digits, starts with 4. */
export function isVisaFormat(digits) {
    const d = String(digits || '').replace(/\D/g, '');
    return /^4\d{15}$/.test(d);
}

export function maxPanDigitsForNetwork(network) {
    if (network === 'Mastercard') return 16;
    if (network === 'Visa') return 16;
    return 16;
}

/**
 * Guess Visa vs Mastercard from the digits entered (reduces wrong card-type vs PAN).
 * @param {string} digits — digits only
 * @returns {'Visa'|'Mastercard'|null}
 */
export function inferCardNetworkFromPanDigits(digits) {
    const d = String(digits || '').replace(/\D/g, '');
    if (!d.length) return null;
    if (d.charAt(0) === '4') return 'Visa';
    if (d.charAt(0) === '5' && d.length >= 2) {
        const second = parseInt(d.charAt(1), 10);
        if (!Number.isNaN(second) && second >= 1 && second <= 5) return 'Mastercard';
        return null;
    }
    if (d.charAt(0) === '2' && d.length >= 4) {
        const p4 = parseInt(d.slice(0, 4), 10);
        if (!Number.isNaN(p4) && p4 >= 2221 && p4 <= 2720) return 'Mastercard';
    }
    return null;
}

/** When PAN is complete, prefer BIN-inferred network over a mismatched toggle. */
export function getEffectiveCardNetwork(rawPan, selectedNetwork) {
    const digits = String(rawPan || '').replace(/\D/g, '');
    if (digits.length !== 16) return selectedNetwork;
    return inferCardNetworkFromPanDigits(digits) || selectedNetwork;
}

/**
 * @param {string} rawPan — digits or spaced groups
 * @param {'Visa'|'Mastercard'} network
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateCardNumberForNetwork(rawPan, network) {
    const digits = String(rawPan || '').replace(/\D/g, '');
    if (network !== 'Visa' && network !== 'Mastercard') {
        return { ok: false, message: 'Select Visa or Mastercard.' };
    }
    const effectiveNetwork = getEffectiveCardNetwork(rawPan, network);
    if (effectiveNetwork === 'Visa' && !isVisaFormat(digits)) {
        return { ok: false, message: 'Visa must be exactly 16 digits and start with 4.' };
    }
    if (effectiveNetwork === 'Mastercard' && !isMastercardBin16(digits)) {
        return {
            ok: false,
            message: 'Mastercard must be 16 digits with a valid prefix (51–55 or 2221–2720).'
        };
    }
    return { ok: true };
}

/**
 * Visa / Mastercard use 3-digit CVV on the back.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateCvvMcVisa(cvv) {
    const c = String(cvv || '').replace(/\D/g, '');
    if (c.length !== 3) {
        return { ok: false, message: 'CVV must be exactly 3 digits for Visa / Mastercard.' };
    }
    return { ok: true };
}

/** Format PAN with spaces; trims to maxDigits. */
export function formatPanInput(rawDigits, maxDigits) {
    const d = String(rawDigits || '').replace(/\D/g, '').slice(0, maxDigits);
    const parts = d.match(/\d{1,4}/g) || [];
    return parts.join(' ');
}
