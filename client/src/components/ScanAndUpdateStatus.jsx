import React, { useRef, useEffect, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Alert, Spinner, Card, CardBody, FormGroup, Label, Input } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { createAndStartScanner, normalizeScanCode, shouldAcceptScan } from '../utils/scannerUtils';

const SCANNER_DIV_ID = 'scan-update-status-scanner';
const API_BASE = 'http://localhost:5000';

const ScanAndUpdateStatus = ({ isOpen, toggle }) => {
  const scannerRef = useRef(null);
  const processingScanRef = useRef(false);
  const [step, setStep] = useState('scan');
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [resource, setResource] = useState(null);
  const [activeBorrow, setActiveBorrow] = useState(null);
  const [returnModal, setReturnModal] = useState(false);
  const [conditionOnReturn, setConditionOnReturn] = useState('Good');
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const canFinalizeBorrow = activeBorrow && ['Claimed', 'Active', 'Overdue', 'PendingReturn'].includes(activeBorrow.status);
  const navigate = useNavigate();
  const lastScanRef = useRef({ code: '', at: 0 });
  const toggleRef = useRef(toggle);
  const navigateRef = useRef(navigate);

  toggleRef.current = toggle;
  navigateRef.current = navigate;

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    const instance = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    try {
      await instance.stop();
      instance.clear();
    } catch (e) {
      /* already stopped */
    }
  };

  const reset = () => {
    setStep('scan');
    setResource(null);
    setActiveBorrow(null);
    setError(null);
    setReturnModal(false);
    setConditionOnReturn('Good');
    setManualCode('');
  };

  const lookupByCodeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      reset();
      return;
    }
    if (step !== 'scan') return;
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
        if (res.data?.success && res.data?.data) {
          setResource(res.data.data);
          setActiveBorrow(res.data.activeBorrow || null);
          setStep('result');
          setError(null);
        } else {
          toggleRef.current();
          navigateRef.current('/admin/resources', { state: { openAddFromScan: code } });
          toast.info('Code not found. Opening add device form.');
        }
      } catch (err) {
        if (err.response?.status === 404) {
          toggleRef.current();
          navigateRef.current('/admin/resources', { state: { openAddFromScan: code } });
          toast.info('Code not found. Opening add device form.');
        } else {
          toast.error(err.response?.data?.message || 'Scan failed. Please try again.');
          processingScanRef.current = false;
          if (!cancelled && !scannerRef.current) startScan();
        }
      }
    };

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
        setScanning(true);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to open camera. Allow camera access or enter the code manually below.');
          toast.error('Failed to start camera');
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    lookupByCodeRef.current = processCode;
    startScan();
    return () => {
      cancelled = true;
      lookupByCodeRef.current = null;
      stopScanner();
    };
  }, [isOpen, step]);

  const refreshScanSnapshot = async (resObj) => {
    if (!resObj?._id) return;
    const token = localStorage.getItem('token');
    const lookup = resObj.qr_code || resObj.barcode || resObj._id;
    try {
      const res = await axios.get(`${API_BASE}/resources/scan/${encodeURIComponent(lookup)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && res.data?.data) {
        setResource(res.data.data);
        setActiveBorrow(res.data.activeBorrow || null);
      }
    } catch {
      /* keep last local state */
    }
  };

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
      await refreshScanSnapshot(resource);
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
      await refreshScanSnapshot(resource);
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
      await refreshScanSnapshot(resource);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const goToEditResource = () => {
    if (resource?._id) {
      toggle();
      navigate('/admin/resources', { state: { openEditResource: resource } });
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
              <p className="small text-muted mb-2">
                Use a printed QR label when possible. Scanning from another phone screen often fails. Or type the code below.
              </p>
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
                    disabled={!manualCode.trim()}
                    onClick={() => lookupByCodeRef.current?.(manualCode)}
                  >
                    Look up
                  </Button>
                </div>
              </FormGroup>
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
                        <strong>Borrow status:</strong> {activeBorrow.status}
                      </p>
                      <p className="mb-0 small">
                        <strong>Due date:</strong>{' '}
                        {activeBorrow.due_date ? new Date(activeBorrow.due_date).toLocaleDateString() : '-'}
                      </p>
                      {activeBorrow.status === 'Approved' && (
                        <p className="mb-0 small text-primary">
                          This item is approved for pickup but has not been physically claimed yet.
                        </p>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>

              <div className="d-flex flex-wrap gap-2">
                {canFinalizeBorrow && (
                  <>
                    <Button color="success" onClick={() => setReturnModal(true)} disabled={loading}>Confirm Return</Button>
                    <Button color="danger" outline onClick={handleLost} disabled={loading}>Mark Lost</Button>
                  </>
                )}
                <Button color="warning" outline onClick={() => handleStatus('Maintenance')} disabled={loading}>Maintenance</Button>
                <Button color="primary" outline onClick={() => handleStatus('Available')} disabled={loading}>Available</Button>
                <Button color="secondary" outline onClick={goToEditResource}>Edit Resource</Button>
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
