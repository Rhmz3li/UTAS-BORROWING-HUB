import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, Table, Badge, Button, Alert, Spinner } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchReservations, deleteReservation } from "../redux/reducers/reservationReducer";
import { FaCalendarCheck, FaArrowLeft, FaTimes, FaCheckCircle, FaClock, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';

const MyReservations = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const { reservations, isLoading } = useSelector((state) => state.reservations);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        dispatch(fetchReservations());
    }, [dispatch, user, navigate]);

    const handleCancel = async (reservationId) => {
        if (window.confirm('Are you sure you want to cancel this reservation?')) {
            try {
                await dispatch(deleteReservation(reservationId)).unwrap();
                toast.success('Reservation cancelled successfully!');
                dispatch(fetchReservations());
            } catch (error) {
                toast.error(error || 'Failed to cancel reservation');
            }
        }
    };

    const filteredReservations = Array.isArray(reservations) ? reservations.filter(reservation => {
        if (filter === 'all') return true;
        return reservation.status === filter;
    }) : [];

    const getStatusBadge = (status, expiryDate) => {
        const isExpired = status === 'Pending' && expiryDate && new Date(expiryDate) < new Date();
        const actualStatus = isExpired ? 'Expired' : status;
        
        const colors = {
            'Pending': { bg: '#fff3e0', color: '#ff9800', icon: FaClock },
            'Confirmed': { bg: '#e8f5e9', color: '#4caf50', icon: FaCheckCircle },
            'Completed': { bg: '#e3f2fd', color: '#1976d2', icon: FaCheckCircle },
            'Cancelled': { bg: '#ffebee', color: '#f44336', icon: FaTimes },
            'Expired': { bg: '#fce4ec', color: '#e91e63', icon: FaExclamationTriangle }
        };
        const style = colors[actualStatus] || { bg: '#f5f5f5', color: '#666', icon: FaInfoCircle };
        const Icon = style.icon;
        
        return (
            <Badge style={{
                background: style.bg,
                color: style.color,
                padding: '0.4rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: 'fit-content'
            }}>
                <Icon style={{ fontSize: '0.8rem' }} />
                {actualStatus}
            </Badge>
        );
    };

    return (
<<<<<<< HEAD
        <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'var(--bg-secondary)', padding: '2rem', transition: 'all 0.3s ease' }}>
=======
        <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', transition: 'all 0.3s ease' }}>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
            <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Button
                                onClick={() => navigate('/home')}
                                style={{
<<<<<<< HEAD
                                    background: 'var(--card-bg)',
=======
                                    background: '#fff',
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                    color: '#667eea',
                                    border: '2px solid #667eea',
                                    borderRadius: '10px',
                                    padding: '0.5rem 1.5rem',
                                    fontWeight: '600',
                                    marginBottom: '1rem'
                                }}
                            >
                                <FaArrowLeft className="me-2" />Back
                            </Button>
<<<<<<< HEAD
                            <h2 style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                My Reservations
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
=======
                            <h2 style={{ color: '#2c3e50', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                My Reservations
                            </h2>
                            <p style={{ color: '#666', margin: 0 }}>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                View and manage your resource reservations
                            </p>
                        </div>
                    </div>
                </Col>
            </Row>

            {/* Filter */}
            <Row className="mb-4">
                <Col md={4}>
<<<<<<< HEAD
                    <Card className="border-0 shadow-sm" style={{ backgroundColor: 'var(--card-bg)' }}>
=======
                    <Card className="border-0 shadow-sm">
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                        <CardBody className="p-3">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                style={{
                                    width: '100%',
<<<<<<< HEAD
                                    border: '2px solid var(--input-border)',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    fontSize: '1rem',
                                    backgroundColor: 'var(--input-bg)',
                                    color: 'var(--text-primary)',
=======
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    fontSize: '1rem',
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Reservations</option>
                                <option value="Pending">Pending</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {isLoading ? (
                <div className="text-center py-5">
                    <Spinner color="primary" />
                    <p className="mt-3">Loading reservations...</p>
                </div>
            ) : (
<<<<<<< HEAD
                <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
                    <CardBody style={{ padding: '1.5rem', backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}>
                        <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
=======
                <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                    <CardBody style={{ padding: '1.5rem' }}>
                        <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1.5rem', color: '#2c3e50' }}>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                            Reservation History
                        </CardTitle>
                        {filteredReservations.length > 0 ? (
                            <div className="table-responsive">
<<<<<<< HEAD
                                <Table hover style={{ margin: 0, color: 'var(--text-primary)', backgroundColor: 'var(--card-bg)' }}>
                                    <thead style={{ background: 'var(--bg-tertiary)' }}>
                                        <tr>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Resource</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Reservation Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Pickup Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Expiry Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Status</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Actions</th>
=======
                                <Table hover style={{ margin: 0 }}>
                                    <thead style={{ background: '#f8f9fa' }}>
                                        <tr>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Resource</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Reservation Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Pickup Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Expiry Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Actions</th>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredReservations.map((reservation) => {
                                            const isExpired = reservation.status === 'Pending' && 
                                                reservation.expiry_date && 
                                                new Date(reservation.expiry_date) < new Date();
                                            
                                            return (
                                                <tr 
                                                    key={reservation._id}
<<<<<<< HEAD
                                                    style={isExpired ? { background: 'rgba(255, 152, 0, 0.12)' } : {}}
=======
                                                    style={isExpired ? { background: '#fff3e0' } : {}}
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                                >
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <div>
                                                            <FaCalendarCheck className="me-2" style={{ color: '#4facfe' }} />
<<<<<<< HEAD
                                                            <strong style={{ color: 'var(--text-primary)' }}>
                                                                {reservation.resource_id?.name || 'Unknown'}
                                                            </strong>
                                                            {reservation.resource_id?.category && (
                                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
=======
                                                            <strong style={{ color: '#333' }}>
                                                                {reservation.resource_id?.name || 'Unknown'}
                                                            </strong>
                                                            {reservation.resource_id?.category && (
                                                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                                                    {reservation.resource_id.category}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
<<<<<<< HEAD
                                                        <span style={{ color: 'var(--text-secondary)' }}>
=======
                                                        <span style={{ color: '#666' }}>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                                            {reservation.reservation_date ? new Date(reservation.reservation_date).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            }) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
<<<<<<< HEAD
                                                        <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
=======
                                                        <span style={{ color: '#666', fontWeight: '600' }}>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                                            {reservation.pickup_date ? new Date(reservation.pickup_date).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            }) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
<<<<<<< HEAD
                                                            <span style={{ color: isExpired ? '#f44336' : 'var(--text-secondary)' }}>
=======
                                                            <span style={{ color: isExpired ? '#f44336' : '#666' }}>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                                                {reservation.expiry_date ? new Date(reservation.expiry_date).toLocaleDateString('en-US', {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                }) : 'N/A'}
                                                            </span>
                                                            {isExpired && <FaExclamationTriangle style={{ color: '#f44336' }} />}
                                                        </div>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        {getStatusBadge(reservation.status, reservation.expiry_date)}
                                                        {reservation.requires_payment && (reservation.payment_amount || 0) > 0 && (
                                                            <div style={{ fontSize: '0.8rem', color: reservation.payment_status === 'Paid' ? '#2e7d32' : '#ff9800', marginTop: '0.35rem' }}>
                                                                Deposit: {reservation.payment_status === 'Paid' ? 'Paid' : 'Pending'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        {['Pending', 'Confirmed'].includes(reservation.status) && (
                                                            <Button 
                                                                color="danger" 
                                                                size="sm" 
                                                                onClick={() => handleCancel(reservation._id)}
                                                                style={{
                                                                    background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                                                                    border: 'none',
                                                                    borderRadius: '8px'
                                                                }}
                                                            >
                                                                <FaTimes className="me-1" />Cancel
                                                            </Button>
                                                        )}
                                                        {reservation.status === 'Confirmed' && (
                                                            <Alert color="info" className="mt-2 mb-0" style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
                                                                <FaInfoCircle className="me-1" />
                                                                Waiting for admin approval to convert to borrow
                                                            </Alert>
                                                        )}
                                                        {reservation.status === 'Pending' && reservation.requires_payment && (reservation.payment_amount || 0) > 0 && reservation.payment_status !== 'Paid' && (
                                                            <Alert color="warning" className="mt-2 mb-0" style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
                                                                <FaInfoCircle className="me-1" />
                                                                Complete your payment from the Payments page so the admin can review this reservation.
                                                            </Alert>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-5">
                                <FaCalendarCheck size={64} style={{ color: '#ccc', marginBottom: '1rem' }} />
<<<<<<< HEAD
                                <h5 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Reservations Found</h5>
                                <p style={{ color: 'var(--text-secondary)' }}>
=======
                                <h5 style={{ color: '#666', marginBottom: '0.5rem' }}>No Reservations Found</h5>
                                <p style={{ color: '#999' }}>
>>>>>>> 35becb7682d593832e8cb015522800f8b9873185
                                    {filter === 'all' 
                                        ? "You don't have any reservations yet."
                                        : `No ${filter.toLowerCase()} reservations found.`}
                                </p>
                                <Button 
                                    color="info" 
                                    onClick={() => navigate('/resources')}
                                    style={{
                                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.75rem 1.5rem',
                                        marginTop: '1rem'
                                    }}
                                >
                                    <FaCalendarCheck className="me-2" />Make Reservation
                                </Button>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}
            </Container>
        </div>
    );
};

export default MyReservations;

