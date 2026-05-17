import React, { useRef, useEffect, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Alert, Spinner, FormGroup, Label, Input } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { createAndStartScanner, normalizeScanCode, shouldAcceptScan } from '../utils/scannerUtils';

const SCANNER_DIV_ID = 'resource-qr-scanner';
const API_BASE = 'http://localhost:5000';

const ResourceScanner = ({ isOpen, toggle, canOpenAddDeviceWhenUnknown = false }) => {
  const scannerRef = useRef(null);
  const processingScanRef = useRef(false);
  const lastScanRef = useRef({ code: '', at: 0 });
  const toggleRef = useRef(toggle);
  const navigateRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const lookupByCodeRef = useRef(null);
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

  useEffect(() => {
    if (!isOpen) {
      processingScanRef.current = false;
      lastScanRef.current = { code: '', at: 0 };
      stopScanner();
      setError(null);
      setManualCode('');
      setStarting(false);
      return;
    }

    let cancelled = false;

    const processCode = async (rawCode) => {
      const code = normalizeScanCode(rawCode);
      if (!code || processingScanRef.current) return;
      if (!shouldAcceptScan(lastScanRef, code)) return;

      processingScanRef.current = true;
      await stopScanner();

      const token = localStorage.getItem('token');
      if (!token) {
        processingScanRef.current = false;
        toast.error('You must be logged in');
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/resources/scan/${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success && res.data?.data?._id) {
          toggleRef.current();
          if (canOpenAddDeviceWhenUnknown) {
            navigateRef.current('/admin/resources', { state: { openEditResource: res.data.data } });
            toast.success('Resource found — opening edit form');
          } else {
            navigateRef.current(`/resources/${res.data.data._id}`);
            toast.success('Resource found');
          }
        } else if (canOpenAddDeviceWhenUnknown) {
          toggleRef.current();
          navigateRef.current('/admin/resources', { state: { openAddFromScan: code } });
          toast.info('Code not found. Opening add device form.');
        } else {
          toast.error('No resource found for this code');
          processingScanRef.current = false;
        }
      } catch (err) {
        if (canOpenAddDeviceWhenUnknown && err.response?.status === 404) {
          toggleRef.current();
          navigateRef.current('/admin/resources', { state: { openAddFromScan: code } });
          toast.info('Code not found. Opening add device form.');
        } else {
          toast.error(err.response?.data?.message || 'No resource found for this code');
          processingScanRef.current = false;
        }
      }
    };

    lookupByCodeRef.current = processCode;

    const startScan = async () => {
      setStarting(true);
      setError(null);
      try {
        if (cancelled || scannerRef.current) return;
        const html5QrCode = await createAndStartScanner(SCANNER_DIV_ID, (decoded) => {
          if (!cancelled) processCode(decoded);
        });
        if (cancelled) {
          await html5QrCode.stop().catch(() => {});
          return;
        }
        scannerRef.current = html5QrCode;
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to open camera. Allow camera access or enter the code manually below.');
          toast.error('Failed to start camera');
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    startScan();

    return () => {
      cancelled = true;
      lookupByCodeRef.current = null;
      stopScanner();
    };
  }, [isOpen, canOpenAddDeviceWhenUnknown]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="md" centered>
      <ModalHeader toggle={toggle}>Scan QR / Barcode – Find Resource</ModalHeader>
      <ModalBody>
        <p className="small text-muted mb-2">
          Use a printed QR label when possible. Scanning from another screen often fails. Or type the code below.
        </p>
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
        </div>
        <FormGroup className="mt-3 mb-0">
          <Label className="small">Or enter barcode / QR value</Label>
          <div className="d-flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. UBH-…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCode.trim()) lookupByCodeRef.current?.(manualCode);
              }}
            />
            <Button
              color="primary"
              outline
              disabled={!manualCode.trim() || processingScanRef.current}
              onClick={() => lookupByCodeRef.current?.(manualCode)}
            >
              Look up
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
