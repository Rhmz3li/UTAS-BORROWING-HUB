import React, { useRef, useEffect, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Alert, Spinner } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { toast } from 'react-toastify';

const SCANNER_DIV_ID = 'resource-qr-scanner';
const API_BASE = 'http://localhost:5000';

const ResourceScanner = ({ isOpen, toggle }) => {
  const scannerRef = useRef(null);
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
          { fps: 10, qrbox: { width: 250, height: 250 } },
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

    const onScanSuccess = async (code) => {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You must be logged in');
        return;
      }
      try {
        const res = await axios.get(`${API_BASE}/resources/scan/${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success && res.data?.data?._id) {
          await stopScanner();
          toggle();
          navigate(`/resources/${res.data.data._id}`);
          toast.success('Resource found');
        } else {
          toast.error('No resource found for this code');
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'No resource found for this code');
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
