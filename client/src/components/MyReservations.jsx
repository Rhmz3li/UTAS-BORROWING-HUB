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
        <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', transition: 'all 0.3s ease' }}>
            <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Button
                                onClick={() => navigate('/home')}
                                style={{
                                    background: '#fff',
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
                            <h2 style={{ color: '#2c3e50', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                My Reservations
                            </h2>
                            <p style={{ color: '#666', margin: 0 }}>
                                View and manage your resource reservations
                            </p>
                        </div>
                    </div>
                </Col>
            </Row>

            {/* Filter */}
            <Row className="mb-4">
                <Col md={4}>
                    <Card className="border-0 shadow-sm">
                        <CardBody className="p-3">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    fontSize: '1rem',
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
                <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                    <CardBody style={{ padding: '1.5rem' }}>
                        <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1.5rem', color: '#2c3e50' }}>
                            Reservation History
                        </CardTitle>
                        {filteredReservations.length > 0 ? (
                            <div className="table-responsive">
                                <Table hover style={{ margin: 0 }}>
                                    <thead style={{ background: '#f8f9fa' }}>
                                        <tr>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Resource</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Reservation Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Pickup Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Expiry Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Actions</th>
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
                                                    style={isExpired ? { background: '#fff3e0' } : {}}
                                                >
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <div>
                                                            <FaCalendarCheck className="me-2" style={{ color: '#4facfe' }} />
                                                            <strong style={{ color: '#333' }}>
                                                                {reservation.resource_id?.name || 'Unknown'}
                                                            </strong>
                                                            {reservation.resource_id?.category && (
                                                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                                                    {reservation.resource_id.category}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <span style={{ color: '#666' }}>
                                                            {reservation.reservation_date ? new Date(reservation.reservation_date).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            }) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <span style={{ color: '#666', fontWeight: '600' }}>
                                                            {reservation.pickup_date ? new Date(reservation.pickup_date).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            }) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ color: isExpired ? '#f44336' : '#666' }}>
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
                                <h5 style={{ color: '#666', marginBottom: '0.5rem' }}>No Reservations Found</h5>
                                <p style={{ color: '#999' }}>
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

