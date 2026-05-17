import React, { useEffect } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, ListGroup, ListGroupItem, Badge, Button } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchNotifications, updateNotification } from "../redux/reducers/notificationReducer";
import { FaBell, FaArrowLeft, FaInfoCircle, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const Notifications = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const { notifications, isLoading } = useSelector((state) => state.notifications);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        dispatch(fetchNotifications());
    }, [dispatch, user, navigate]);

    const getNotificationIcon = (type) => {
        switch(type) {
            case 'Success': return FaCheckCircle;
            case 'Warning': return FaExclamationTriangle;
            default: return FaInfoCircle;
        }
    };

    const getNotificationColor = (type) => {
        switch(type) {
            case 'Success': return 'success';
            case 'Warning': return 'warning';
            case 'Error': return 'danger';
            default: return 'info';
        }
    };

    const getNotificationRoute = (notification) => {
        switch (notification?.related_type) {
            case 'Payment':
                return '/payments';
            case 'Penalty':
                return '/penalties';
            case 'Borrow':
                return '/my-borrows';
            case 'Reservation':
                return '/reservations';
            default:
                return null;
        }
    };

    const handleNotificationClick = async (notification) => {
        try {
            if (!notification?.is_read) {
                await dispatch(updateNotification({ id: notification._id, notificationData: {} }));
            }
        } catch (error) {
            // Ignore mark-as-read errors to avoid blocking navigation.
        }

        const route = getNotificationRoute(notification);
        if (route) {
            navigate(route);
        }
    };

    return (
        <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'var(--bg-secondary)', padding: '2rem', transition: 'all 0.3s ease' }}>
            <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <div className="d-flex align-items-center">
                        <Button color="link" className="me-3" onClick={() => navigate('/home')}>
                            <FaArrowLeft /> Back
                        </Button>
                        <h2 className="mb-0" style={{ color: 'var(--text-primary)' }}>Notifications</h2>
                    </div>
                </Col>
            </Row>

            {isLoading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-warning" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : (
                <Card className="border-0 shadow-sm" style={{ backgroundColor: 'var(--card-bg)' }}>
                    <CardBody style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}>
                        {Array.isArray(notifications?.notifications || notifications) && (notifications?.notifications || notifications).length > 0 ? (
                            <ListGroup flush>
                                {(notifications?.notifications || notifications).map((notification) => {
                                    const NotificationIcon = getNotificationIcon(notification.type);
                                    const color = getNotificationColor(notification.type);
                                    return (
                                        <ListGroupItem
                                            key={notification._id}
                                            className="d-flex align-items-start"
                                            onClick={() => handleNotificationClick(notification)}
                                            style={{ cursor: 'pointer', backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                                        >
                                            <NotificationIcon className={`me-3 mt-1 text-${color}`} size={20} />
                                            <div className="flex-grow-1">
                                                <div className="d-flex justify-content-between align-items-start mb-1">
                                                    <strong style={{ color: 'var(--text-primary)' }}>{notification.title}</strong>
                                                    {!notification.is_read && (
                                                        <Badge color="primary">New</Badge>
                                                    )}
                                                </div>
                                                <p className="mb-1" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{notification.message}</p>
                                                <small style={{ color: 'var(--text-secondary)' }}>
                                                    {notification.created_at ? new Date(notification.created_at).toLocaleString() : 'N/A'}
                                                </small>
                                            </div>
                                        </ListGroupItem>
                                    );
                                })}
                            </ListGroup>
                        ) : (
                            <div className="text-center py-5">
                                <FaBell size={64} className="text-muted mb-3 opacity-25" />
                                <p className="text-muted">No notifications</p>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}
            </Container>
        </div>
    );
};

export default Notifications;

