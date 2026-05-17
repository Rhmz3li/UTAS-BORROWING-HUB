import React, { useRef, useEffect, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Alert, Spinner } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import axios from 'axios';
import { toast } from 'react-toastify';

const SCANNER_DIV_ID = 'resource-qr-scanner';
const API_BASE = 'http://localhost:5000';

const SCAN_FORMATS = [
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

function normalizeScanCode(raw) {
  let s = String(raw ?? '')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  try {
    s = s.normalize('NFC');
  } catch (e) {
    /* ignore */
  }
  return s;
}

const ResourceScanner = ({ isOpen, toggle, canOpenAddDeviceWhenUnknown = false }) => {
  const scannerRef = useRef(null);
  const processingScanRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();

  const stopScanner = async () => {
    if (!scannerRef.current || !scanning) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch (e) {}
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setError(null);
      return;
    }
    let mounted = true;

    const startScan = async () => {
      setStarting(true);
      setError(null);
      try {
        const cameras = await Html5Qrcode.getCameras();
        const cameraId = cameras?.length > 0 ? cameras[0].id : { facingMode: 'environment' };
        if (!document.getElementById(SCANNER_DIV_ID) || !mounted) return;

        const html5QrCode = new Html5Qrcode(SCANNER_DIV_ID);
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            formatsToSupport: SCAN_FORMATS,
          },
          (decodedText) => {
            if (mounted && scannerRef.current) onScanSuccess(decodedText);
          },
          () => {}
        );
        if (mounted) setScanning(true);
      } catch (err) {
        if (mounted) {
          setError(err?.message || 'Unable to open camera. Please check permissions.');
          toast.error('Failed to start camera');
        }
      } finally {
        if (mounted) setStarting(false);
      }
    };

    const onScanSuccess = async (rawCode) => {
      const code = normalizeScanCode(rawCode);
      if (!code || processingScanRef.current) return;
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You must be logged in');
        return;
      }
      processingScanRef.current = true;
      try {
        const res = await axios.get(`${API_BASE}/resources/scan/${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success && res.data?.data?._id) {
          await stopScanner();
          toggle();
          navigate(`/resources/${res.data.data._id}`);
          toast.success('Resource found');
        } else if (canOpenAddDeviceWhenUnknown) {
          await stopScanner();
          toggle();
          navigate('/admin/resources', { state: { openAddFromScan: code } });
          toast.info(`Code not found. Opening add device — same value set for barcode and QR.`);
        } else {
          toast.error('No resource found for this code');
        }
      } catch (err) {
        if (canOpenAddDeviceWhenUnknown && err.response?.status === 404) {
          await stopScanner();
          toggle();
          navigate('/admin/resources', { state: { openAddFromScan: code } });
          toast.info(`Code not found. Opening add device — same value set for barcode and QR.`);
        } else {
          toast.error(err.response?.data?.message || 'No resource found for this code');
        }
      } finally {
        processingScanRef.current = false;
      }
    };

    startScan();
    return () => {
      mounted = false;
      stopScanner();
    };
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="md" centered>
      <ModalHeader toggle={toggle}>Scan QR / Barcode – Find Resource</ModalHeader>
      <ModalBody>
        <p className="small text-muted mb-2">Camera supports QR and common 1D barcodes (e.g. Code 128).</p>
        {error && <Alert color="danger">{error}</Alert>}
        {starting && (
          <div className="text-center py-4">
            <Spinner />
            <p className="mt-2 mb-0">Starting camera...</p>
          </div>
        )}
        <div id={SCANNER_DIV_ID} style={{ minHeight: starting ? 0 : 250, overflow: 'hidden' }} />
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
};

export default ResourceScanner;
