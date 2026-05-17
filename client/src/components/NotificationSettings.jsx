import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardBody, Button, Input, Spinner } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  FaBell,
  FaArrowLeft,
  FaSave,
  FaEnvelope,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarDay,
  FaCalendarCheck,
  FaBoxOpen,
  FaExclamationTriangle,
  FaGlobe
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { API_BASE } from '../config';

const NOTIFICATION_OPTIONS = [
  { key: 'borrowApproval', label: 'Borrow approval notifications', icon: FaCheckCircle, iconColor: '#28a745' },
  { key: 'borrowRejection', label: 'Borrow rejection notifications', icon: FaTimesCircle, iconColor: '#dc3545' },
  { key: 'dueDateReminder', label: 'Due date reminders', icon: FaCalendarDay, iconColor: '#fd7e14' },
  { key: 'reservationConfirmation', label: 'Reservation confirmation', icon: FaCalendarCheck, iconColor: '#007bff' },
  { key: 'reservationAvailable', label: 'Resource available (reserved)', icon: FaBoxOpen, iconColor: '#17a2b8' },
  { key: 'penalty', label: 'Penalty notifications', icon: FaExclamationTriangle, iconColor: '#ffc107' }
];

const mergePrefsFromServer = (data) => {
  const merged = {};
  for (const { key } of NOTIFICATION_OPTIONS) {
    const row = data && typeof data[key] === 'object' ? data[key] : {};
    merged[key] = {
      inApp: row.inApp !== false,
      email: row.email !== false
    };
  }
  return merged;
};

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
      if (res.data?.success && res.data?.data) {
        setPrefs(mergePrefsFromServer(res.data.data));
      } else {
        setPrefs(mergePrefsFromServer({}));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load notification settings');
      setPrefs(mergePrefsFromServer({}));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key, channel) => {
    if (!prefs) return;
    setPrefs((prev) => ({
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
      const res = await axios.put(`${API_BASE}/profile/notification-settings`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.data?.data) {
        setPrefs(mergePrefsFromServer(res.data.data));
      }
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
    <div
      style={{
        marginLeft: '280px',
        minHeight: '100vh',
        background: 'var(--bg-secondary)',
        padding: '2rem',
        transition: 'all 0.3s ease'
      }}
    >
      <Container fluid className="py-4">
        <Row className="mb-4">
          <Col>
            <div className="d-flex align-items-center">
              <Button color="link" className="me-3 p-0" onClick={() => navigate('/home')}>
                <FaArrowLeft /> Back
              </Button>
              <h2 className="mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <FaBell /> Notification Settings
              </h2>
            </div>
          </Col>
        </Row>

        <Card className="border-0 shadow-sm rounded-4 overflow-hidden" style={{ backgroundColor: 'var(--card-bg)' }}>
          <CardBody className="p-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}>
            <div className="mb-4">
              <p className="mb-0" style={{ color: 'var(--text-secondary)' }}>
                Choose how you want to be notified for each type. <strong>Website</strong> means messages in the hub
                (bell icon). <strong>Email</strong> means messages to your registered email address.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner /> <span className="ms-2">Loading settings...</span>
              </div>
            ) : prefs ? (
              <>
                <div className="d-flex flex-column gap-3">
                  {NOTIFICATION_OPTIONS.map(({ key, label, icon: Icon, iconColor }) => (
                    <div
                      key={key}
                      className="rounded-4 p-3 p-md-4 d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-3 gap-lg-4"
                      style={{
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-tertiary)'
                      }}
                    >
                      <div className="d-flex align-items-center gap-3 flex-grow-1 min-w-0">
                        <div
                          className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
                          style={{ width: 48, height: 48, background: `${iconColor}22`, color: iconColor }}
                          aria-hidden
                        >
                          <Icon size={20} />
                        </div>
                        <span className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                          {label}
                        </span>
                      </div>

                      <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-shrink-0">
                        <div
                          className="d-flex align-items-center justify-content-between gap-3 px-3 py-2 rounded-3"
                          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', minWidth: 0 }}
                        >
                          <span className="small d-flex align-items-center gap-2 mb-0 text-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            <FaGlobe aria-hidden /> Website
                          </span>
                          <Input
                            type="switch"
                            role="switch"
                            id={`ns-${key}-inapp`}
                            className="m-0"
                            checked={prefs[key]?.inApp !== false}
                            onChange={() => handleToggle(key, 'inApp')}
                            aria-label={`Website notifications for ${label}`}
                          />
                        </div>
                        <div
                          className="d-flex align-items-center justify-content-between gap-3 px-3 py-2 rounded-3"
                          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', minWidth: 0 }}
                        >
                          <span className="small d-flex align-items-center gap-2 mb-0 text-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            <FaEnvelope aria-hidden /> Email
                          </span>
                          <Input
                            type="switch"
                            role="switch"
                            id={`ns-${key}-email`}
                            className="m-0"
                            checked={prefs[key]?.email !== false}
                            onChange={() => handleToggle(key, 'email')}
                            aria-label={`Email notifications for ${label}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 d-flex justify-content-end border-top" style={{ borderColor: 'var(--border-color)' }}>
                  <Button color="primary" size="lg" className="rounded-pill px-4 shadow-sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />}
                    Save settings
                  </Button>
                </div>
              </>
            ) : (
              <p className="mb-0" style={{ color: 'var(--text-secondary)' }}>
                Could not load settings. Try again later.
              </p>
            )}
          </CardBody>
        </Card>
      </Container>
    </div>
  );
};

export default NotificationSettings;
