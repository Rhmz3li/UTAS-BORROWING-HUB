import React, { useRef, useEffect, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Alert, Spinner, Card, CardBody, FormGroup, Label, Input } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { toast } from 'react-toastify';

const SCANNER_DIV_ID = 'scan-update-status-scanner';
const API_BASE = 'http://localhost:5000';

const ScanAndUpdateStatus = ({ isOpen, toggle }) => {
  const scannerRef = useRef(null);
  const [step, setStep] = useState('scan');
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [resource, setResource] = useState(null);
  const [activeBorrow, setActiveBorrow] = useState(null);
  const [returnModal, setReturnModal] = useState(false);
  const [conditionOnReturn, setConditionOnReturn] = useState('Good');
  const [loading, setLoading] = useState(false);
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

  const reset = () => {
    setStep('scan');
    setResource(null);
    setActiveBorrow(null);
    setError(null);
    setReturnModal(false);
    setConditionOnReturn('Good');
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      reset();
      return;
    }
    if (step !== 'scan') return;
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
        if (res.data?.success && res.data?.data) {
          await stopScanner();
          setResource(res.data.data);
          setActiveBorrow(res.data.activeBorrow || null);
          setStep('result');
          setError(null);
        } else {
          // Barcode not found – open Add New Resource with barcode pre-filled
          await stopScanner();
          toggle();
          navigate('/admin/resources', { state: { openAddWithBarcode: code } });
        }
      } catch (err) {
        if (err.response?.status === 404) {
          // Barcode not found – open Add New Resource with barcode pre-filled
          await stopScanner();
          toggle();
          navigate('/admin/resources', { state: { openAddWithBarcode: code } });
        } else {
          toast.error(err.response?.data?.message || 'Scan failed. Please try again.');
        }
      }
    };

    startScan();
    return () => {
      mounted = false;
      stopScanner();
    };
  }, [isOpen, step]);

  const handleReturn = async () => {
    if (!activeBorrow || !resource) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.put(
        `${API_BASE}/borrow/${activeBorrow._id}/return`,
        { condition_on_return: conditionOnReturn, status: 'Returned' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Return recorded');
      setReturnModal(false);
      setActiveBorrow(null);
      setResource((r) => r ? { ...r, status: 'Available' } : null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record return');
    } finally {
      setLoading(false);
    }
  };

  const handleLost = async () => {
    if (!activeBorrow || !window.confirm('Mark this resource as lost? A penalty will be created.')) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.put(
        `${API_BASE}/borrow/${activeBorrow._id}/return`,
        { status: 'Lost' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Resource marked as lost');
      setActiveBorrow(null);
      setResource((r) => r ? { ...r, status: 'Lost' } : null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update lost status');
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (newStatus) => {
    if (!resource) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.put(
        `${API_BASE}/resources/${resource._id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResource((r) => r ? { ...r, status: newStatus } : null);
      toast.success(newStatus === 'Maintenance' ? 'Resource set to Maintenance' : 'Status updated to Available');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const goToDetail = () => {
    if (resource?._id) {
      toggle();
      navigate(`/resources/${resource._id}`);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} toggle={toggle} size="md" centered>
        <ModalHeader toggle={toggle}>
          {step === 'scan' ? 'Scan & Update Status' : 'Update Resource Status'}
        </ModalHeader>
        <ModalBody>
          {step === 'scan' && (
            <>
              {error && <Alert color="danger">{error}</Alert>}
              {starting && (
                <div className="text-center py-4">
                  <Spinner />
                  <p className="mt-2 mb-0">Starting camera...</p>
                </div>
              )}
              <div id={SCANNER_DIV_ID} style={{ minHeight: starting ? 0 : 250, overflow: 'hidden' }} />
            </>
          )}

          {step === 'result' && resource && (
            <>
              <Card className="mb-3">
                <CardBody>
                  <h6 className="mb-1">{resource.name}</h6>
                  <p className="text-muted small mb-1">Status: <strong>{resource.status}</strong></p>
                  {resource.barcode && <p className="text-muted small mb-0">Barcode: {resource.barcode}</p>}
                  {activeBorrow && (
                    <div className="mt-2 p-2 bg-light rounded">
                      <p className="mb-0 small">
                        <strong>Borrowed by:</strong> {activeBorrow.user_id?.full_name || activeBorrow.user_id?.email}
                      </p>
                      <p className="mb-0 small">
                        <strong>Due date:</strong>{' '}
                        {activeBorrow.due_date ? new Date(activeBorrow.due_date).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>

              <div className="d-flex flex-wrap gap-2">
                {activeBorrow && (
                  <>
                    <Button color="success" onClick={() => setReturnModal(true)} disabled={loading}>Confirm Return</Button>
                    <Button color="danger" outline onClick={handleLost} disabled={loading}>Mark Lost</Button>
                  </>
                )}
                <Button color="warning" outline onClick={() => handleStatus('Maintenance')} disabled={loading}>Maintenance</Button>
                <Button color="primary" outline onClick={() => handleStatus('Available')} disabled={loading}>Available</Button>
                <Button color="secondary" outline onClick={goToDetail}>View Details</Button>
                <Button color="light" outline onClick={() => { reset(); setStep('scan'); }}>Scan Another Resource</Button>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggle}>Close</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={returnModal} toggle={() => setReturnModal(false)} size="sm" centered>
        <ModalHeader toggle={() => setReturnModal(false)}>Confirm Return</ModalHeader>
        <ModalBody>
          <FormGroup>
            <Label>Condition on return</Label>
            <Input type="select" value={conditionOnReturn} onChange={(e) => setConditionOnReturn(e.target.value)}>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </Input>
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setReturnModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleReturn} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Record Return'}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default ScanAndUpdateStatus;
