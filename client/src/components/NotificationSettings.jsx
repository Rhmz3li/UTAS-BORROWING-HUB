import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardBody, Button, Input, Spinner } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { FaBell, FaArrowLeft, FaSave, FaMobileAlt, FaEnvelope, FaCheckCircle, FaTimesCircle, FaCalendarDay, FaCalendarCheck, FaBoxOpen, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';

const API_BASE = 'http://localhost:5000';

const NOTIFICATION_OPTIONS = [
  { key: 'borrowApproval', label: 'Borrow approval notifications', icon: FaCheckCircle, iconColor: '#28a745' },
  { key: 'borrowRejection', label: 'Borrow rejection notifications', icon: FaTimesCircle, iconColor: '#dc3545' },
  { key: 'dueDateReminder', label: 'Due date reminders', icon: FaCalendarDay, iconColor: '#fd7e14' },
  { key: 'reservationConfirmation', label: 'Reservation confirmation', icon: FaCalendarCheck, iconColor: '#007bff' },
  { key: 'reservationAvailable', label: 'Resource available (reserved)', icon: FaBoxOpen, iconColor: '#17a2b8' },
  { key: 'penalty', label: 'Penalty notifications', icon: FaExclamationTriangle, iconColor: '#ffc107' }
];

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/profile/notification-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data?.data) setPrefs(res.data.data);
      else setPrefs({});
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load notification settings');
      setPrefs({});
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key, channel) => {
    if (!prefs) return;
    setPrefs(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { inApp: true, email: true }),
        [channel]: !(prev[key] && prev[key][channel])
      }
    }));
  };

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = JSON.parse(JSON.stringify(prefs));
      await axios.put(`${API_BASE}/profile/notification-settings`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('Notification settings saved');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save settings';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', transition: 'all 0.3s ease' }}>
      <Container fluid className="py-4">
        <Row className="mb-4">
          <Col>
            <div className="d-flex align-items-center">
              <Button color="link" className="me-3 p-0" onClick={() => navigate('/home')}>
                <FaArrowLeft /> Back
              </Button>
              <h2 className="mb-0 d-flex align-items-center gap-2">
                <FaBell /> Notification Settings
              </h2>
            </div>
          </Col>
        </Row>

        <Card className="border-0 shadow-sm rounded-3 overflow-hidden">
          <CardBody className="p-0">
            <div className="p-4 pb-0">
              <p className="text-muted mb-0 small">
                Choose which notifications you want and how to receive them: <strong>In-App</strong> (bell icon) and/or <strong>Email</strong>.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner /> <span className="ms-2">Loading settings...</span>
              </div>
            ) : prefs ? (
              <>
                {/* Header row */}
                <div
                  className="d-none d-md-flex align-items-center px-4 py-3 text-muted small text-uppercase fw-bold"
                  style={{ background: 'rgba(0,0,0,.04)', borderBottom: '1px solid rgba(0,0,0,.06)' }}
                >
                  <div style={{ flex: '1 1 50%' }}>Notification type</div>
                  <div className="d-flex align-items-center justify-content-center gap-4" style={{ flex: '0 0 220px' }}>
                    <span className="d-flex align-items-center gap-1">
                      <FaMobileAlt /> In-App
                    </span>
                    <span className="d-flex align-items-center gap-1">
                      <FaEnvelope /> Email
                    </span>
                  </div>
                </div>

                {NOTIFICATION_OPTIONS.map(({ key, label, icon: Icon, iconColor }, idx) => (
                  <div
                    key={key}
                    className="d-flex flex-wrap align-items-center px-4 py-3 gap-3"
                    style={{
                      borderBottom: idx < NOTIFICATION_OPTIONS.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.02)'
                    }}
                  >
                    <div className="d-flex align-items-center gap-3 flex-grow-1 min-w-0">
                      <div
                        className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
                        style={{ width: 40, height: 40, background: `${iconColor}18`, color: iconColor }}
                      >
                        <Icon size={18} />
                      </div>
                      <span className="fw-medium text-dark">{label}</span>
                    </div>
                    <div className="d-flex align-items-center gap-4">
                      <label className="d-flex align-items-center gap-2 mb-0 cursor-pointer" style={{ cursor: 'pointer' }}>
                        <Input
                          type="checkbox"
                          className="form-check-input"
                          checked={!!(prefs[key] && prefs[key].inApp !== false)}
                          onChange={() => handleToggle(key, 'inApp')}
                        />
                        <span className="small text-muted d-md-none">In-App</span>
                      </label>
                      <label className="d-flex align-items-center gap-2 mb-0 cursor-pointer" style={{ cursor: 'pointer' }}>
                        <Input
                          type="checkbox"
                          className="form-check-input"
                          checked={!!(prefs[key] && prefs[key].email !== false)}
                          onChange={() => handleToggle(key, 'email')}
                        />
                        <span className="small text-muted d-md-none">Email</span>
                      </label>
                    </div>
                  </div>
                ))}

                <div className="p-4 pt-3 d-flex justify-content-end" style={{ background: 'rgba(0,0,0,.02)', borderTop: '1px solid rgba(0,0,0,.06)' }}>
                  <Button color="primary" size="lg" className="rounded-pill px-4 shadow-sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />}
                    Save settings
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted mb-0 p-4">Could not load settings. Try again later.</p>
            )}
          </CardBody>
        </Card>
      </Container>
    </div>
  );
};

export default NotificationSettings;
