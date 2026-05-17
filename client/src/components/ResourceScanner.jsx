import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Alert, Spinner, FormGroup, Label, Input } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { createAndStartScanner, normalizeScanCode, shouldAcceptScan } from '../utils/scannerUtils';
import { Html5QrcodeSupportedFormats } from 'html5-qrcode';

const SCANNER_DIV_ID = 'resource-qr-scanner';
const API_BASE = 'http://localhost:5000';

const ResourceScanner = ({ isOpen, toggle, canOpenAddDeviceWhenUnknown = false }) => {
  const scannerRef = useRef(null);
  const processingScanRef = useRef(false);
  const lastScanRef = useRef({ code: '', at: 0 });
  const toggleRef = useRef(toggle);
  const navigateRef = useRef(null);
  const cancelledRef = useRef(false);
  const startScannerRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const navigate = useNavigate();

  toggleRef.current = toggle;
  navigateRef.current = navigate;

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    const instance = scannerRef.current;
    scannerRef.current = null;
    try {
      await instance.stop();
      instance.clear();
    } catch (e) {
      /* already stopped */
    }
  };

  const startScannerCamera = useCallback(async () => {
    if (cancelledRef.current || scannerRef.current) return;
    setStarting(true);
    setError(null);
    try {
      const html5QrCode = await createAndStartScanner(SCANNER_DIV_ID, ({ text, format }) => {
        if (!cancelledRef.current) {
          lookupByCodeRef.current?.(text, format, { fromCamera: true });
        }
      });
      if (cancelledRef.current) {
        await html5QrCode.stop().catch(() => {});
        return;
      }
      scannerRef.current = html5QrCode;
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err?.message || 'Unable to open camera. Allow camera access or enter the code manually below.');
        toast.error('Failed to start camera');
      }
    } finally {
      if (!cancelledRef.current) setStarting(false);
    }
  }, []);

  startScannerRef.current = startScannerCamera;

  const lookupByCodeRef = useRef(null);

  const resumeAfterFailedLookup = async (message) => {
    if (message) toast.error(message);
    processingScanRef.current = false;
    setLookupBusy(false);
    if (isOpen && !cancelledRef.current) {
      await startScannerRef.current?.();
    }
  };

  const finishWithNavigation = async (navigateFn) => {
    await stopScanner();
    processingScanRef.current = false;
    setLookupBusy(false);
    toggleRef.current();
    navigateFn();
  };

  useEffect(() => {
    if (!isOpen) {
      cancelledRef.current = true;
      processingScanRef.current = false;
      lastScanRef.current = { code: '', at: 0 };
      stopScanner();
      setError(null);
      setManualCode('');
      setLookupBusy(false);
      setStarting(false);
      return;
    }

    cancelledRef.current = false;

    const processCode = async (rawCode, scanFormat, { fromCamera = false, force = false } = {}) => {
      const code = normalizeScanCode(rawCode);
      if (!code || processingScanRef.current) return;
      if (fromCamera && !force && !shouldAcceptScan(lastScanRef, code)) return;

      processingScanRef.current = true;
      setLookupBusy(true);
      if (fromCamera) await stopScanner();

      const token = localStorage.getItem('token');
      if (!token) {
        await resumeAfterFailedLookup('You must be logged in');
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/resources/scan/${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const resource = res.data?.data;
        if (res.data?.success && resource?._id) {
          await finishWithNavigation(() => {
            if (canOpenAddDeviceWhenUnknown) {
              navigateRef.current('/admin/resources', { state: { openEditResource: resource } });
              toast.success(`Found: ${resource.name}`);
            } else {
              navigateRef.current(`/resources/${resource._id}`);
              toast.success('Resource found');
            }
          });
          return;
        }

        if (canOpenAddDeviceWhenUnknown) {
          const isQR = scanFormat === Html5QrcodeSupportedFormats.QR_CODE;
          await finishWithNavigation(() => {
            navigateRef.current('/admin/resources', {
              state: isQR ? { openAddWithQRCode: code } : { openAddWithBarcode: code },
            });
            toast.info(
              `No resource matches "${code}". Add-device form opened — set the same value as Barcode or QR code.`
            );
          });
          return;
        }

        await resumeAfterFailedLookup(`No resource found for "${code}". Check Barcode / QR / Name in Resource Management.`);
      } catch (err) {
        if (canOpenAddDeviceWhenUnknown && err.response?.status === 404) {
          const isQR = scanFormat === Html5QrcodeSupportedFormats.QR_CODE;
          await finishWithNavigation(() => {
            navigateRef.current('/admin/resources', {
              state: isQR ? { openAddWithQRCode: code } : { openAddWithBarcode: code },
            });
            toast.info(
              `No resource matches "${code}". Add-device form opened — set the same value as Barcode or QR code.`
            );
          });
          return;
        }
        await resumeAfterFailedLookup(
          err.response?.data?.message || `Lookup failed for "${code}". Try manual entry or a printed label.`
        );
      }
    };

    lookupByCodeRef.current = processCode;
    startScannerCamera();

    return () => {
      cancelledRef.current = true;
      lookupByCodeRef.current = null;
      stopScanner();
    };
  }, [isOpen, canOpenAddDeviceWhenUnknown, startScannerCamera]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="md" centered>
      <ModalHeader toggle={toggle}>Scan QR / Barcode – Find Resource</ModalHeader>
      <ModalBody>
        {error && <Alert color="danger">{error}</Alert>}
        <div style={{ position: 'relative', minHeight: 280 }}>
          <div
            id={SCANNER_DIV_ID}
            style={{ minHeight: 280, width: '100%', overflow: 'hidden', borderRadius: 8, background: '#111' }}
          />
          {starting && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
                borderRadius: 8,
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <Spinner color="light" />
              <p className="mt-2 mb-0 text-white small">Starting camera...</p>
            </div>
          )}
          {lookupBusy && !starting && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.45)',
                borderRadius: 8,
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <Spinner color="light" size="sm" />
            </div>
          )}
        </div>
        <FormGroup className="mt-3 mb-0">
          <Label className="small">Or enter barcode / QR / asset name</Label>
          <div className="d-flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. UBH-… or barcode value"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCode.trim()) {
                  lookupByCodeRef.current?.(manualCode, null, { force: true });
                }
              }}
            />
            <Button
              color="primary"
              outline
              disabled={!manualCode.trim() || lookupBusy}
              onClick={() => lookupByCodeRef.current?.(manualCode, null, { force: true })}
            >
              {lookupBusy ? '…' : 'Look up'}
            </Button>
          </div>
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
};

export default ResourceScanner;
