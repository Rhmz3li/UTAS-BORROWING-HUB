import { Container, Row, Col, Card, CardBody, CardTitle, Table, Badge, Button, Alert, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, FormGroup, Label, Input } from "reactstrap";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from 'axios';
import { FaExclamationTriangle, FaClock, FaCheckCircle, FaTimesCircle, FaArrowLeft, FaDollarSign, FaFileInvoice, FaCreditCard, FaMoneyBillWave } from 'react-icons/fa';
import { toast } from 'react-toastify';

const Penalties = () => {
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const [penalties, setPenalties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [methodModalOpen, setMethodModalOpen] = useState(false);
    const [selectedPenalty, setSelectedPenalty] = useState(null);
    const [selectedMethod, setSelectedMethod] = useState('Cash');
    const [startingPayment, setStartingPayment] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchPenalties();
    }, [user, navigate, filter]);

    const fetchPenalties = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }
            
            const params = filter !== 'all' ? { status: filter } : {};
            
            const response = await axios.get('http://localhost:5000/penalties/my-penalties', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (Array.isArray(response.data)) {
                setPenalties(response.data);
            } else if (response.data && response.data.success && response.data.data) {
                setPenalties(response.data.data);
            } else if (response.data && response.data.data) {
                setPenalties(response.data.data);
            } else {
                setPenalties([]);
            }
        } catch (error) {
            console.error('Fetch penalties error:', error);
            if (error.response?.status === 401) {
                navigate('/login');
            } else {
                toast.error(error.response?.data?.message || 'Failed to load penalties');
            }
            setPenalties([]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const colors = {
            'Paid': { bg: '#e8f5e9', color: '#4caf50', icon: FaCheckCircle },
            'Pending': { bg: '#fff3e0', color: '#ff9800', icon: FaClock },
            'Waived': { bg: '#e3f2fd', color: '#1976d2', icon: FaFileInvoice },
            'Cancelled': { bg: '#ffebee', color: '#f44336', icon: FaTimesCircle }
        };
        const style = colors[status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', icon: FaExclamationTriangle };
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
                {status}
            </Badge>
        );
    };

    const getPenaltyTypeBadge = (type) => {
        const palette = {
            'Late Return': { bg: '#fff3e0', color: '#e65100' },
            'Damage': { bg: '#ffebee', color: '#c62828' },
            'Loss': { bg: '#f3e5f5', color: '#7b1fa2' }
        };
        const style = palette[type] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' };

        return (
            <Badge style={{
                background: style.bg,
                color: style.color,
                padding: '0.35rem 0.7rem',
                borderRadius: '15px',
                fontSize: '0.8rem',
                fontWeight: '600'
            }}>
                {type}
            </Badge>
        );
    };

    const getDamageLevelBadge = (level) => {
        if (!level) return null;

        const palette = {
            'Minor': { bg: '#e8f5e9', color: '#2e7d32' },
            'Moderate': { bg: '#fff3e0', color: '#e65100' },
            'Severe': { bg: '#ffebee', color: '#c62828' },
            'Total Loss': { bg: '#f3e5f5', color: '#7b1fa2' }
        };
        const style = palette[level] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' };

        return (
            <Badge style={{
                background: style.bg,
                color: style.color,
                padding: '0.25rem 0.6rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600'
            }}>
                {level}
            </Badge>
        );
    };

    const totalAmount = penalties
        .filter(p => p.status === 'Pending')
        .reduce((sum, p) => sum + (p.fine_amount || 0), 0);

    const paidAmount = penalties
        .filter(p => p.status === 'Paid')
        .reduce((sum, p) => sum + (p.fine_amount || 0), 0);

    const totalPenalties = penalties.length;

    const handlePayPenalty = (penalty) => {
        const pendingPayment = penalty.latest_payment;
        if (pendingPayment?.status === 'Pending') {
            navigate('/payments', { state: { openPaymentId: pendingPayment._id } });
            return;
        }
        setSelectedPenalty(penalty);
        setSelectedMethod('Cash');
        setMethodModalOpen(true);
    };

    const confirmPenaltyPaymentMethod = async () => {
        if (!selectedPenalty) return;
        try {
            setStartingPayment(true);
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `http://localhost:5000/penalties/${selectedPenalty._id}/start-payment`,
                { payment_method: selectedMethod },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data.success) {
                setMethodModalOpen(false);
                const paymentId = response.data.data?._id;
                toast.info('Complete your payment on the next screen (same as security deposits).');
                navigate('/payments', { state: { openPaymentId: paymentId } });
                setSelectedPenalty(null);
            }
        } catch (error) {
            console.error('Start penalty payment error:', error);
            toast.error(error.response?.data?.message || 'Failed to start penalty payment');
        } finally {
            setStartingPayment(false);
        }
    };

    const getPaymentStatusBadge = (payment) => {
        if (!payment) return null;
        const colors = {
            Pending: { bg: '#fff3e0', color: '#ff9800', text: 'Payment pending' },
            Completed: { bg: '#e8f5e9', color: '#4caf50', text: 'Payment completed' },
            Failed: { bg: '#ffebee', color: '#f44336', text: 'Payment cancelled' },
            Refunded: { bg: '#e3f2fd', color: '#1976d2', text: 'Payment refunded' }
        };
        const style = colors[payment.status] || { bg: 'var(--bg-tertiary)', color: '#666', text: payment.status };
        return (
            <Badge
                style={{
                    background: style.bg,
                    color: style.color,
                    padding: '0.3rem 0.65rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    marginTop: '0.35rem',
                    display: 'inline-block'
                }}
            >
                {style.text} ({payment.payment_method})
            </Badge>
        );
    };

    return (
        <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'var(--bg-secondary)', padding: '2rem', transition: 'all 0.3s ease' }}>
            <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Button
                                onClick={() => navigate('/home')}
                                style={{
                                    background: 'var(--card-bg)',
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
                            <h2 style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                My Penalties
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                View and manage your penalty records
                            </p>
                        </div>
                    </div>
                </Col>
            </Row>

            {/* Statistics Cards */}
            <Row className="mb-4">
                <Col md={4} className="mb-3">
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
                        <CardBody style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                                        Pending Amount
                                    </p>
                                    <h3 style={{ color: '#ff9800', margin: '0.5rem 0 0 0', fontWeight: 'bold', fontSize: '2rem' }}>
                                        {totalAmount.toFixed(2)} OMR
                                    </h3>
                                </div>
                                <div style={{
                                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                    padding: '1rem',
                                    borderRadius: '15px'
                                }}>
                                    <FaClock style={{ color: '#fff', fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
                        <CardBody style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                                        Total Paid
                                    </p>
                                    <h3 style={{ color: '#4caf50', margin: '0.5rem 0 0 0', fontWeight: 'bold', fontSize: '2rem' }}>
                                        {paidAmount.toFixed(2)} OMR
                                    </h3>
                                </div>
                                <div style={{
                                    background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                                    padding: '1rem',
                                    borderRadius: '15px'
                                }}>
                                    <FaCheckCircle style={{ color: '#fff', fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
                        <CardBody style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                                        Total Penalties
                                    </p>
                                    <h3 style={{ color: '#1976d2', margin: '0.5rem 0 0 0', fontWeight: 'bold', fontSize: '2rem' }}>
                                        {totalPenalties}
                                    </h3>
                                </div>
                                <div style={{
                                    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                    padding: '1rem',
                                    borderRadius: '15px'
                                }}>
                                    <FaExclamationTriangle style={{ color: '#fff', fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Filter */}
            <Row className="mb-4">
                <Col md={4}>
                    <Card className="border-0 shadow-sm" style={{ backgroundColor: 'var(--card-bg)' }}>
                        <CardBody className="p-3">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    border: '2px solid var(--input-border)',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    backgroundColor: 'var(--input-bg)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <option value="all">All Penalties</option>
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                                <option value="Waived">Waived</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Penalties Table */}
            <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
                <CardBody style={{ padding: '1.5rem' }}>
                    <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        Penalty History
                    </CardTitle>
                    
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner color="primary" />
                            <p className="mt-3">Loading penalties...</p>
                        </div>
                    ) : penalties.length === 0 ? (
                        <div className="text-center py-5">
                            <FaExclamationTriangle size={64} style={{ color: '#ccc', marginBottom: '1rem' }} />
                            <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No Penalties Found</h5>
                            <p style={{ color: 'var(--text-tertiary)' }}>
                                {filter === 'all' 
                                    ? "You don't have any penalty records yet."
                                    : `No ${filter.toLowerCase()} penalties found.`}
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover style={{ margin: 0 }}>
                                <thead style={{ background: 'var(--bg-tertiary)' }}>
                                    <tr>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Date</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Resource</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Penalty Type</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Details</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Amount</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {penalties.map((penalty) => (
                                        <tr key={penalty._id} style={{ transition: 'all 0.2s ease' }}>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {new Date(penalty.created_at).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                <div>
                                                    <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
                                                        {penalty.borrow_id?.resource_id?.name || 'N/A'}
                                                    </strong>
                                                    {penalty.borrow_id?.resource_id?.category && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                                            {penalty.borrow_id.resource_id.category}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {getPenaltyTypeBadge(penalty.penalty_type)}
                                                {penalty.days_late > 0 && (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                                        {penalty.days_late} day{penalty.days_late > 1 ? 's' : ''} late
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                <div>
                                                    {penalty.damage_level && (
                                                        <div style={{ marginBottom: '0.5rem' }}>
                                                            {getDamageLevelBadge(penalty.damage_level)}
                                                        </div>
                                                    )}
                                                    {penalty.description && (
                                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                                                            {penalty.description}
                                                        </div>
                                                    )}
                                                    {penalty.borrow_id?.due_date && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                                                            Due: {new Date(penalty.borrow_id.due_date).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                    {penalty.borrow_id?.return_date && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                                            Returned: {new Date(penalty.borrow_id.return_date).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                                                    {penalty.fine_amount?.toFixed(2) || '0.00'} OMR
                                                </strong>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {getStatusBadge(penalty.status)}
                                                {getPaymentStatusBadge(penalty.latest_payment)}
                                                {penalty.paid_at && (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                                        Paid: {new Date(penalty.paid_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {penalty.waived_reason && (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                                        Reason: {penalty.waived_reason}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                                                {penalty.status === 'Pending' && (
                                                    <Button
                                                        color="success"
                                                        size="sm"
                                                        onClick={() => handlePayPenalty(penalty)}
                                                        style={{
                                                            borderRadius: '8px',
                                                            padding: '0.5rem 1rem',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        <FaCreditCard className="me-2" />
                                                        {penalty.latest_payment?.status === 'Pending'
                                                            ? 'Continue Payment'
                                                            : 'Pay Now'}
                                                    </Button>
                                                )}
                                                {penalty.status === 'Paid' && (
                                                    <Badge style={{
                                                        background: '#e8f5e9',
                                                        color: '#4caf50',
                                                        padding: '0.5rem 1rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        <FaCheckCircle className="me-1" />
                                                        Paid
                                                    </Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Payment Info Alert */}
            {totalAmount > 0 && (
                <Alert color="warning" style={{ borderRadius: '15px', marginTop: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <FaDollarSign size={24} />
                        <div>
                            <strong>You have pending penalties totaling {totalAmount.toFixed(2)} OMR</strong>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                Choose Cash or Card on each penalty, then complete payment on <strong>My Payments</strong> (same steps as security deposits).
                            </p>
                            <Button
                                color="warning"
                                onClick={() => navigate('/payments')}
                                style={{
                                    marginTop: '1rem',
                                    borderRadius: '10px',
                                    fontWeight: '600'
                                }}
                            >
                                Go to Payments
                            </Button>
                        </div>
                    </div>
                </Alert>
            )}

            {/* Choose Cash or Card — then complete on My Payments */}
            <Modal
                isOpen={methodModalOpen}
                toggle={() => setMethodModalOpen(false)}
                centered
            >
                <ModalHeader
                    toggle={() => setMethodModalOpen(false)}
                    close={
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={() => setMethodModalOpen(false)}
                            aria-label="Close"
                        />
                    }
                >
                    Choose payment method
                </ModalHeader>
                <ModalBody style={{ background: 'var(--card-bg)' }}>
                    {selectedPenalty && (
                        <>
                            <Alert color="info" className="rounded-3">
                                <strong>{selectedPenalty.penalty_type}</strong> —{' '}
                                {selectedPenalty.fine_amount?.toFixed(2)} OMR
                                <br />
                                <small>
                                    {selectedPenalty.borrow_id?.resource_id?.name || 'Resource'} — complete payment on My Payments next.
                                </small>
                            </Alert>
                            <FormGroup>
                                <Label>How will you pay? *</Label>
                                <Input
                                    type="select"
                                    value={selectedMethod}
                                    onChange={(e) => setSelectedMethod(e.target.value)}
                                    className="rounded-3"
                                >
                                    <option value="Cash">Cash at the hub</option>
                                    <option value="Card">Card (Visa / Mastercard)</option>
                                </Input>
                            </FormGroup>
                        </>
                    )}
                </ModalBody>
                <ModalFooter style={{ background: 'var(--card-bg)' }}>
                    <Button color="secondary" onClick={() => setMethodModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        color="primary"
                        onClick={confirmPenaltyPaymentMethod}
                        disabled={startingPayment}
                    >
                        {startingPayment ? 'Please wait…' : 'Continue to payment'}
                    </Button>
                </ModalFooter>
            </Modal>
            </Container>
        </div>
    );
};

export default Penalties;
