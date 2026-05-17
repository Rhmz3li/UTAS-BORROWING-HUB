import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
];

/** Normalize scanned text (QR may contain URLs or extra whitespace). */
export function normalizeScanCode(raw) {
  let s = String(raw ?? '')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  try {
    s = s.normalize('NFC');
  } catch {
    /* ignore */
  }

  const mongoId = s.match(/([a-fA-F0-9]{24})/);
  if (/^https?:\/\//i.test(s) && mongoId) {
    return mongoId[1];
  }
  const pathId = s.match(/\/resources\/([a-fA-F0-9]{24})(?:\?|#|\/|$)/i);
  if (pathId) return pathId[1];

  return s;
}

/** Prefer rear / external camera for QR on labels; fallback to last listed device. */
export function pickPreferredCamera(cameras) {
  if (!cameras?.length) return { facingMode: 'environment' };
  const label = (c) => String(c.label || '').toLowerCase();
  const back = cameras.find((c) => /back|rear|environment|خلف/i.test(label(c)));
  if (back) return back.id;
  const external = cameras.find((c) => /usb|external|hd/i.test(label(c)));
  if (external) return external.id;
  if (cameras.length > 1) return cameras[cameras.length - 1].id;
  return cameras[0].id;
}

export function getScanRegionConfig() {
  return {
    fps: 12,
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const edge = Math.min(viewfinderWidth, viewfinderHeight);
      const size = Math.max(200, Math.floor(edge * 0.75));
      return { width: size, height: size };
    },
    aspectRatio: 1,
    disableFlip: false,
  };
}

/** Wait until modal layout has non-zero size before starting the camera. */
export function waitForScannerMount(elementId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = () => {
      const el = document.getElementById(elementId);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        resolve(el);
        return;
      }
      attempts += 1;
      if (attempts > 40) {
        reject(new Error('Scanner view not ready. Close and open the scan window again.'));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function createAndStartScanner(elementId, onDecoded) {
  await waitForScannerMount(elementId);

  const cameras = await Html5Qrcode.getCameras();
  const cameraId = pickPreferredCamera(cameras);

  const html5QrCode = new Html5Qrcode(elementId, {
    formatsToSupport: SCAN_FORMATS,
    verbose: false,
  });

  await html5QrCode.start(
    cameraId,
    getScanRegionConfig(),
    (decodedText) => onDecoded(decodedText),
    () => {}
  );

  return html5QrCode;
}

/** Ignore duplicate reads of the same code within a short window. */
export function shouldAcceptScan(lastScanRef, code, cooldownMs = 2500) {
  if (!code) return false;
  const now = Date.now();
  const prev = lastScanRef.current;
  if (prev.code === code && now - prev.at < cooldownMs) return false;
  lastScanRef.current = { code, at: now };
  return true;
}
