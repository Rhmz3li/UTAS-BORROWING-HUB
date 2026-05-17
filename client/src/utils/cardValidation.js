/**
 * Card validation for Visa / Mastercard payments.
 */

/** Max completed payments allowed per unique card number (system-wide). */
export const MAX_CARD_NUMBER_USAGE = 3;

export const CARD_HOLDER_NAME_ERROR = 'Please enter a valid card holder name.';
export const CARD_NUMBER_INVALID_ERROR = 'Please enter a valid card number.';
export const CARD_TYPE_MISMATCH_ERROR = 'Selected card type does not match the card number.';
export const CARD_NUMBER_REPEAT_ERROR =
    'Card number cannot contain the same digit more than 3 times in a row.';

export function normalizeCardPanDigits(rawPan) {
    return String(rawPan || '').replace(/\D/g, '');
}

/** Keep only letters and spaces for card holder input. */
export function sanitizeCardHolderInput(value) {
    return String(value || '')
        .replace(/[^A-Za-z\s]/g, '')
        .replace(/\s{2,}/g, ' ');
}

/** Visa: 16 digits, must start with 4. */
export function isVisaFormat(digits) {
    const d = normalizeCardPanDigits(digits);
    return /^4\d{15}$/.test(d);
}

/** Mastercard: 16 digits, must start with 55. */
export function isMastercardFormat(digits) {
    const d = normalizeCardPanDigits(digits);
    return /^55\d{14}$/.test(d);
}

/** @deprecated Use isMastercardFormat */
export function isMastercardBin16(digits) {
    return isMastercardFormat(digits);
}

/** No run of 4+ identical digits (max 3 in a row). */
export function hasExcessiveRepeatedDigits(digits) {
    const d = normalizeCardPanDigits(digits);
    if (!d) return false;
    return /(\d)\1{3,}/.test(d);
}

export function maxPanDigitsForNetwork(network) {
    if (network === 'Mastercard') return 16;
    if (network === 'Visa') return 16;
    return 16;
}

export function inferCardNetworkFromPanDigits(digits) {
    const d = normalizeCardPanDigits(digits);
    if (!d.length) return null;
    if (d.startsWith('4')) return 'Visa';
    if (d.startsWith('55')) return 'Mastercard';
    return null;
}

export function getEffectiveCardNetwork(rawPan, selectedNetwork) {
    const digits = normalizeCardPanDigits(rawPan);
    if (digits.length !== 16) return selectedNetwork;
    return inferCardNetworkFromPanDigits(digits) || selectedNetwork;
}

export function validateCardHolderName(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed || trimmed.length < 2) {
        return { ok: false, message: CARD_HOLDER_NAME_ERROR };
    }
    if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(trimmed)) {
        return { ok: false, message: CARD_HOLDER_NAME_ERROR };
    }
    return { ok: true, value: trimmed };
}

/**
 * Full PAN validation: 16 digits, Visa starts with 4, Mastercard with 55,
 * no digit repeated 4+ times consecutively, matches selected network.
 */
export function validateCardNumberFull(rawPan, selectedNetwork) {
    if (selectedNetwork !== 'Visa' && selectedNetwork !== 'Mastercard') {
        return { ok: false, message: 'Select Visa or Mastercard.' };
    }

    const digits = normalizeCardPanDigits(rawPan);
    if (!digits || digits.length !== 16 || !/^\d+$/.test(digits)) {
        return { ok: false, message: CARD_NUMBER_INVALID_ERROR };
    }

    if (hasExcessiveRepeatedDigits(digits)) {
        return { ok: false, message: CARD_NUMBER_REPEAT_ERROR };
    }

    if (selectedNetwork === 'Visa' && !isVisaFormat(digits)) {
        return { ok: false, message: CARD_TYPE_MISMATCH_ERROR };
    }
    if (selectedNetwork === 'Mastercard' && !isMastercardFormat(digits)) {
        return { ok: false, message: CARD_TYPE_MISMATCH_ERROR };
    }

    return { ok: true, digits };
}

/** @deprecated Use validateCardNumberFull */
export function validateCardNumberForNetwork(rawPan, network) {
    return validateCardNumberFull(rawPan, network);
}

export function validateCvvMcVisa(cvv) {
    const c = String(cvv || '').replace(/\D/g, '');
    if (c.length !== 3) {
        return { ok: false, message: 'CVV must be exactly 3 digits for Visa / Mastercard.' };
    }
    return { ok: true };
}

export function formatPanInput(rawDigits, maxDigits) {
    const d = String(rawDigits || '').replace(/\D/g, '').slice(0, maxDigits);
    const parts = d.match(/\d{1,4}/g) || [];
    return parts.join(' ');
}

export function validateCardNumberUsageLimit(usageCount) {
    const count = Number(usageCount) || 0;
    if (count >= MAX_CARD_NUMBER_USAGE) {
        return {
            ok: false,
            message: `This card number has already been used ${count} time(s). The same card cannot be used more than ${MAX_CARD_NUMBER_USAGE} times.`
        };
    }
    return { ok: true };
}
