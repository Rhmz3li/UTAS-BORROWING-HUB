/** Server-side card validation (mirrors client/src/utils/cardValidation.js). */

export function normalizeCardPanDigits(rawPan) {
    return String(rawPan || '').replace(/\D/g, '');
}

export function isVisaFormat(digits) {
    const d = normalizeCardPanDigits(digits);
    return /^4\d{15}$/.test(d);
}

export function isMastercardFormat(digits) {
    const d = normalizeCardPanDigits(digits);
    return /^55\d{14}$/.test(d);
}

export function hasExcessiveRepeatedDigits(digits) {
    const d = normalizeCardPanDigits(digits);
    if (!d) return false;
    return /(\d)\1{3,}/.test(d);
}

export function validateCardHolderName(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed || trimmed.length < 2) {
        return { ok: false, message: 'Please enter a valid card holder name.' };
    }
    if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(trimmed)) {
        return { ok: false, message: 'Please enter a valid card holder name.' };
    }
    return { ok: true, value: trimmed };
}

export function validateCardNumberFull(rawPan, selectedNetwork) {
    if (selectedNetwork !== 'Visa' && selectedNetwork !== 'Mastercard') {
        return { ok: false, message: 'Select Visa or Mastercard.' };
    }

    const digits = normalizeCardPanDigits(rawPan);
    if (!digits || digits.length !== 16 || !/^\d+$/.test(digits)) {
        return { ok: false, message: 'Please enter a valid card number.' };
    }

    if (hasExcessiveRepeatedDigits(digits)) {
        return {
            ok: false,
            message: 'Card number cannot contain the same digit more than 3 times in a row.'
        };
    }

    if (selectedNetwork === 'Visa' && !isVisaFormat(digits)) {
        return { ok: false, message: 'Selected card type does not match the card number.' };
    }
    if (selectedNetwork === 'Mastercard' && !isMastercardFormat(digits)) {
        return { ok: false, message: 'Selected card type does not match the card number.' };
    }

    return { ok: true, digits };
}
