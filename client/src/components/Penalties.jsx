import { Container, Row, Col, Card, CardBody, CardTitle, Table, Badge, Button, Alert, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input } from "reactstrap";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from 'axios';
import { FaExclamationTriangle, FaClock, FaCheckCircle, FaTimesCircle, FaArrowLeft, FaDollarSign, FaFileInvoice, FaCreditCard } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { CARD_NETWORK_META } from '../constants/cardNetworkOptions';
import { generateClientTransactionId } from '../utils/generateClientTransactionId';
import {
    formatPanInput,
    maxPanDigitsForNetwork,
    inferCardNetworkFromPanDigits,
    getEffectiveCardNetwork,
    validateCardNumberForNetwork,
    validateCvvMcVisa
} from '../utils/cardValidation';

const Penalties = () => {
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const [penalties, setPenalties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedPenalty, setSelectedPenalty] = useState(null);
    const [paymentData, setPaymentData] = useState({
        payment_method: 'Cash',
        amount: 0,
        transaction_id: '',
        notes: '',
        card_number: '',
        card_network: '',
        card_holder: '',
        expiry_date: '',
        cvv: ''
    });

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
        const colors = {
            'Late Return': '#ff9800',
            'Damage': '#f44336',
            'Loss': '#9c27b0'
        };
        
        return (
            <Badge style={{
                background: colors[type] || '#666',
                color: '#fff',
                padding: '0.35rem 0.7rem',
                borderRadius: '15px',
                fontSize: '0.8rem',
                fontWeight: '500'
            }}>
                {type}
            </Badge>
        );
    };

    const getDamageLevelBadge = (level) => {
        if (!level) return null;
        
        const colors = {
            'Minor': '#4caf50',
            'Moderate': '#ff9800',
            'Severe': '#f44336',
            'Total Loss': '#9c27b0'
        };
        
        return (
            <Badge style={{
                background: colors[level] || '#666',
                color: '#fff',
                padding: '0.25rem 0.6rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '500'
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
        setSelectedPenalty(penalty);
        setPaymentData({
            payment_method: 'Cash',
            amount: penalty.fine_amount,
            transaction_id: generateClientTransactionId(),
            notes: '',
            card_number: '',
            card_network: '',
            card_holder: '',
            expiry_date: '',
            cvv: ''
        });
        setPaymentModalOpen(true);
    };

    const handleCreatePayment = async () => {
        try {
            const token = localStorage.getItem('token');
            
            if (paymentData.amount < selectedPenalty.fine_amount) {
                toast.error(`Payment amount must be at least ${selectedPenalty.fine_amount} OMR`);
                return;
            }

            let resolvedCardNetwork = paymentData.card_network;
            let resolvedPanDigits = '';

            // Validate card details if payment method is Card
            if (paymentData.payment_method === 'Card') {
                if (!paymentData.card_network) {
                    toast.error('Please select your card type');
                    return;
                }
                resolvedPanDigits = paymentData.card_number.replace(/\s/g, '');
                resolvedCardNetwork = getEffectiveCardNetwork(paymentData.card_number, paymentData.card_network);
                const panCheck = validateCardNumberForNetwork(paymentData.card_number, paymentData.card_network);
                if (!panCheck.ok) {
                    toast.error(panCheck.message);
                    return;
                }
                if (!paymentData.card_holder || paymentData.card_holder.trim().length < 2) {
                    toast.error('Please enter card holder name');
                    return;
                }
                if (!paymentData.expiry_date || !/^\d{2}\/\d{2}$/.test(paymentData.expiry_date)) {
                    toast.error('Please enter a valid expiry date (MM/YY)');
                    return;
                }
                const cvvCheck = validateCvvMcVisa(paymentData.cvv);
                if (!cvvCheck.ok) {
                    toast.error(cvvCheck.message);
                    return;
                }
            }

            // Prepare payment data
            const paymentPayload = {
                penalty_id: selectedPenalty._id,
                amount: paymentData.amount,
                payment_method: paymentData.payment_method,
                transaction_id: paymentData.transaction_id || undefined,
                notes: paymentData.notes || undefined
            };

            // Add card details if payment method is Card
            if (paymentData.payment_method === 'Card') {
                paymentPayload.card_details = {
                    card_network: resolvedCardNetwork,
                    card_number: resolvedPanDigits,
                    card_holder: paymentData.card_holder.trim(),
                    expiry_date: paymentData.expiry_date,
                    cvv: paymentData.cvv
                };
            }

            const response = await axios.post(
                'http://localhost:5000/payments',
                paymentPayload,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (response.data.success) {
                toast.success('Payment submitted successfully!');
                setPaymentModalOpen(false);
                setSelectedPenalty(null);
                setPaymentData({ 
                    payment_method: 'Cash', 
                    amount: 0, 
                    transaction_id: '', 
                    notes: '',
                    card_number: '',
                    card_network: '',
                    card_holder: '',
                    expiry_date: '',
                    cvv: ''
                });
                fetchPenalties();
            }
        } catch (error) {
            console.error('Payment error:', error);
            toast.error(error.response?.data?.message || 'Failed to submit payment');
        }
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
                                                        Pay Now
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
                                Please visit the Payments page to settle your outstanding penalties.
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

            {/* Payment Modal */}
            <Modal
                isOpen={paymentModalOpen}
                toggle={() => setPaymentModalOpen(false)}
                centered
                size="lg"
                contentClassName="border-0 shadow-lg rounded-4 overflow-hidden"
            >
                <ModalHeader
                    toggle={() => setPaymentModalOpen(false)}
                    close={
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={() => setPaymentModalOpen(false)}
                            aria-label="Close"
                        />
                    }
                    className="border-0 text-white"
                    style={{
                        background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                        padding: '1.25rem 1.5rem'
                    }}
                >
                    <span className="d-flex align-items-center gap-2 fw-semibold">
                        <FaCreditCard /> Pay penalty
                    </span>
                </ModalHeader>
                <ModalBody className="px-4 py-4" style={{ background: 'var(--card-bg)' }}>
                    {selectedPenalty && (
                        <>
                            <Alert color="info" className="rounded-3 border-0">
                                <strong>Penalty details</strong>
                                <div style={{ marginTop: '0.5rem' }} className="small">
                                    <strong>Resource:</strong> {selectedPenalty.borrow_id?.resource_id?.name || 'N/A'}
                                    <br />
                                    <strong>Penalty type:</strong> {selectedPenalty.penalty_type}
                                    <br />
                                    <strong>Amount due:</strong>{' '}
                                    <span style={{ color: '#f44336', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        {selectedPenalty.fine_amount?.toFixed(2)} OMR
                                    </span>
                                    {selectedPenalty.description && (
                                        <>
                                            <br />
                                            <strong>Description:</strong> {selectedPenalty.description}
                                        </>
                                    )}
                                </div>
                            </Alert>

                            <FormGroup className="mb-4">
                                <Label className="small text-uppercase fw-bold mb-2" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                                    Transaction reference
                                </Label>
                                <div
                                    className="rounded-3 px-3 py-2 border"
                                    style={{
                                        borderColor: 'var(--border-color)',
                                        background: 'var(--bg-tertiary)',
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                        fontSize: '0.8rem',
                                        wordBreak: 'break-all',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    {paymentData.transaction_id}
                                </div>
                                <small className="d-block mt-2" style={{ color: 'var(--text-tertiary)' }}>
                                    Auto-generated by the system for this payment.
                                </small>
                            </FormGroup>

                            <Form>
                                <FormGroup>
                                    <Label>Payment method *</Label>
                                    <Input
                                        type="select"
                                        value={paymentData.payment_method}
                                        onChange={(e) => setPaymentData({ 
                                            ...paymentData, 
                                            payment_method: e.target.value,
                                            card_number: e.target.value !== 'Card' ? '' : paymentData.card_number,
                                            card_network: e.target.value !== 'Card' ? '' : paymentData.card_network,
                                            card_holder: e.target.value !== 'Card' ? '' : paymentData.card_holder,
                                            expiry_date: e.target.value !== 'Card' ? '' : paymentData.expiry_date,
                                            cvv: e.target.value !== 'Card' ? '' : paymentData.cvv
                                        })}
                                        required
                                        className="rounded-3"
                                        style={{ borderColor: 'var(--border-color)' }}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Card">Card</option>
                                    </Input>
                                </FormGroup>
                                
                                {paymentData.payment_method === 'Card' && (
                                    <>
                                        <FormGroup className="mb-4">
                                            <Label className="fw-semibold mb-2">Card type *</Label>
                                            <div
                                                className="d-flex rounded-3 p-1 gap-1"
                                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                                                role="group"
                                                aria-label="Card type"
                                            >
                                                {['Visa', 'Mastercard'].map((network) => {
                                                    const active = paymentData.card_network === network;
                                                    const meta = CARD_NETWORK_META[network];
                                                    return (
                                                        <button
                                                            key={network}
                                                            type="button"
                                                            className="flex-fill border-0 py-2 px-2 rounded-2 fw-semibold"
                                                            style={{
                                                                background: active ? 'var(--card-bg)' : 'transparent',
                                                                color: active ? meta.color : 'var(--text-secondary)',
                                                                boxShadow: active ? '0 2px 10px rgba(0,0,0,0.08)' : 'none'
                                                            }}
                                                            onClick={() => {
                                                                const max = maxPanDigitsForNetwork(network);
                                                                const raw = paymentData.card_number.replace(/\D/g, '');
                                                                setPaymentData({
                                                                    ...paymentData,
                                                                    card_network: network,
                                                                    card_number: formatPanInput(raw, max)
                                                                });
                                                            }}
                                                        >
                                                            {network}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </FormGroup>
                                        <FormGroup>
                                            <Label>Card number *</Label>
                                            <small className="d-block mb-2" style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                                Visa: <strong>16</strong> digits starting with <strong>4</strong> (type can switch from the number). Mastercard: <strong>16</strong> digits, prefix 51–55 or 2221–2720.
                                            </small>
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={19}
                                                value={paymentData.card_number}
                                                onChange={(e) => {
                                                    const max = maxPanDigitsForNetwork(
                                                        paymentData.card_network || 'Visa'
                                                    );
                                                    const raw = e.target.value.replace(/\D/g, '');
                                                    const inferred = inferCardNetworkFromPanDigits(raw);
                                                    setPaymentData({
                                                        ...paymentData,
                                                        card_number: formatPanInput(raw, max),
                                                        ...(inferred ? { card_network: inferred } : {})
                                                    });
                                                }}
                                                placeholder={
                                                    paymentData.card_network === 'Mastercard'
                                                        ? '16 digits, e.g. 51xx …'
                                                        : '16 digits starting with 4'
                                                }
                                                required
                                                className="rounded-3"
                                                style={{
                                                    letterSpacing: '0.1em',
                                                    borderColor: 'var(--border-color)'
                                                }}
                                            />
                                            {paymentData.card_network && CARD_NETWORK_META[paymentData.card_network] && (
                                                <div className="mt-2">
                                                    <span
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem',
                                                            padding: '0.3rem 0.65rem',
                                                            borderRadius: '999px',
                                                            background: CARD_NETWORK_META[paymentData.card_network].bg,
                                                            color: CARD_NETWORK_META[paymentData.card_network].color,
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        <FaCreditCard style={{ fontSize: '0.75rem' }} />
                                                        {CARD_NETWORK_META[paymentData.card_network].label}
                                                    </span>
                                                </div>
                                            )}
                                        </FormGroup>
                                        <Row>
                                            <Col md={6}>
                                                <FormGroup>
                                                    <Label>Card Holder Name *</Label>
                                                    <Input
                                                        type="text"
                                                        value={paymentData.card_holder}
                                                        onChange={(e) => setPaymentData({ ...paymentData, card_holder: e.target.value.toUpperCase() })}
                                                        placeholder="JOHN DOE"
                                                        required
                                                    />
                                                </FormGroup>
                                            </Col>
                                            <Col md={3}>
                                                <FormGroup>
                                                    <Label>Expiry Date *</Label>
                                                    <Input
                                                        type="text"
                                                        maxLength="5"
                                                        value={paymentData.expiry_date}
                                                        onChange={(e) => {
                                                            let value = e.target.value.replace(/\D/g, '');
                                                            if (value.length >= 2) {
                                                                value = value.substring(0, 2) + '/' + value.substring(2, 4);
                                                            }
                                                            if (value.length <= 5) {
                                                                setPaymentData({ ...paymentData, expiry_date: value });
                                                            }
                                                        }}
                                                        placeholder="MM/YY"
                                                        required
                                                    />
                                                </FormGroup>
                                            </Col>
                                            <Col md={3}>
                                                <FormGroup>
                                                    <Label>CVV *</Label>
                                                    <Input
                                                        type="password"
                                                        maxLength="3"
                                                        inputMode="numeric"
                                                        value={paymentData.cvv}
                                                        onChange={(e) => {
                                                            const value = e.target.value.replace(/\D/g, '').substring(0, 3);
                                                            setPaymentData({ ...paymentData, cvv: value });
                                                        }}
                                                        placeholder="•••"
                                                        required
                                                    />
                                                </FormGroup>
                                            </Col>
                                        </Row>
                                    </>
                                )}
                                <FormGroup>
                                    <Label>Amount (OMR) *</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min={selectedPenalty.fine_amount}
                                        value={paymentData.amount}
                                        onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                                        required
                                    />
                                    <small className="text-muted">
                                        Minimum amount: {selectedPenalty.fine_amount?.toFixed(2)} OMR
                                    </small>
                                </FormGroup>
                                <FormGroup>
                                    <Label>Notes (Optional)</Label>
                                    <Input
                                        type="textarea"
                                        rows="3"
                                        value={paymentData.notes}
                                        onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                                        placeholder="Additional notes about this payment..."
                                    />
                                </FormGroup>
                            </Form>
                        </>
                    )}
                </ModalBody>
                <ModalFooter className="border-0 pt-0 pb-4 px-4" style={{ background: 'var(--card-bg)' }}>
                    <Button color="light" className="rounded-pill px-4 border" onClick={() => setPaymentModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button 
                        color="success" 
                        className="rounded-pill px-4 shadow-sm"
                        onClick={handleCreatePayment}
                        disabled={
                            paymentData.amount < (selectedPenalty?.fine_amount || 0) ||
                            (paymentData.payment_method === 'Card' && (
                                !paymentData.card_network ||
                                !paymentData.card_number ||
                                                paymentData.card_number.replace(/\s/g, '').length < 16 ||
                                !paymentData.card_holder ||
                                !paymentData.expiry_date ||
                                !paymentData.cvv ||
                                paymentData.cvv.length !== 3
                            ))
                        }
                        style={{ fontWeight: '600' }}
                    >
                        <FaCreditCard className="me-2" />
                        Submit Payment
                    </Button>
                </ModalFooter>
            </Modal>
            </Container>
        </div>
    );
};

export default Penalties;
