import { Container, Row, Col, Card, CardBody, CardTitle, Table, Badge, Button, Alert, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input } from "reactstrap";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from 'axios';
import { FaExclamationTriangle, FaClock, FaCheckCircle, FaTimesCircle, FaArrowLeft, FaDollarSign, FaFileInvoice, FaCreditCard } from 'react-icons/fa';
import { toast } from 'react-toastify';

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
        const style = colors[status] || { bg: '#f5f5f5', color: '#666', icon: FaExclamationTriangle };
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
            transaction_id: '',
            notes: '',
            card_number: '',
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

            // Validate card details if payment method is Card
            if (paymentData.payment_method === 'Card') {
                if (!paymentData.card_number || paymentData.card_number.replace(/\s/g, '').length < 13) {
                    toast.error('Please enter a valid card number');
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
                if (!paymentData.cvv || paymentData.cvv.length < 3) {
                    toast.error('Please enter a valid CVV');
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
                    card_number: paymentData.card_number.replace(/\s/g, ''), // Store without spaces
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
                                My Penalties
                            </h2>
                            <p style={{ color: '#666', margin: 0 }}>
                                View and manage your penalty records
                            </p>
                        </div>
                    </div>
                </Col>
            </Row>

            {/* Statistics Cards */}
            <Row className="mb-4">
                <Col md={4} className="mb-3">
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                        <CardBody style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: '#666', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
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
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                        <CardBody style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: '#666', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
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
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                        <CardBody style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: '#666', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
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
            <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                <CardBody style={{ padding: '1.5rem' }}>
                    <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1.5rem', color: '#2c3e50' }}>
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
                            <h5 style={{ color: '#666', marginBottom: '0.5rem' }}>No Penalties Found</h5>
                            <p style={{ color: '#999' }}>
                                {filter === 'all' 
                                    ? "You don't have any penalty records yet."
                                    : `No ${filter.toLowerCase()} penalties found.`}
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover style={{ margin: 0 }}>
                                <thead style={{ background: '#f8f9fa' }}>
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
                                                    <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>
                                                        {penalty.borrow_id?.resource_id?.name || 'N/A'}
                                                    </strong>
                                                    {penalty.borrow_id?.resource_id?.category && (
                                                        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                                            {penalty.borrow_id.resource_id.category}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {getPenaltyTypeBadge(penalty.penalty_type)}
                                                {penalty.days_late > 0 && (
                                                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
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
                                                        <div style={{ fontSize: '0.9rem', color: '#666', maxWidth: '200px' }}>
                                                            {penalty.description}
                                                        </div>
                                                    )}
                                                    {penalty.borrow_id?.due_date && (
                                                        <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem' }}>
                                                            Due: {new Date(penalty.borrow_id.due_date).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                    {penalty.borrow_id?.return_date && (
                                                        <div style={{ fontSize: '0.85rem', color: '#999' }}>
                                                            Returned: {new Date(penalty.borrow_id.return_date).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                <strong style={{ color: '#2c3e50', fontSize: '1.1rem' }}>
                                                    {penalty.fine_amount?.toFixed(2) || '0.00'} OMR
                                                </strong>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {getStatusBadge(penalty.status)}
                                                {penalty.paid_at && (
                                                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                                                        Paid: {new Date(penalty.paid_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {penalty.waived_reason && (
                                                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
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
            <Modal isOpen={paymentModalOpen} toggle={() => setPaymentModalOpen(false)} size="lg">
                <ModalHeader toggle={() => setPaymentModalOpen(false)}>
                    <FaCreditCard className="me-2" />
                    Pay Penalty
                </ModalHeader>
                <ModalBody>
                    {selectedPenalty && (
                        <>
                            <Alert color="info">
                                <strong>Penalty Details:</strong>
                                <br />
                                <div style={{ marginTop: '0.5rem' }}>
                                    <strong>Resource:</strong> {selectedPenalty.borrow_id?.resource_id?.name || 'N/A'}
                                    <br />
                                    <strong>Penalty Type:</strong> {selectedPenalty.penalty_type}
                                    <br />
                                    <strong>Amount Due:</strong> <span style={{ color: '#f44336', fontWeight: 'bold', fontSize: '1.1rem' }}>{selectedPenalty.fine_amount?.toFixed(2)} OMR</span>
                                    {selectedPenalty.description && (
                                        <>
                                            <br />
                                            <strong>Description:</strong> {selectedPenalty.description}
                                        </>
                                    )}
                                </div>
                            </Alert>
                            <Form>
                                <FormGroup>
                                    <Label>Payment Method *</Label>
                                    <Input
                                        type="select"
                                        value={paymentData.payment_method}
                                        onChange={(e) => setPaymentData({ 
                                            ...paymentData, 
                                            payment_method: e.target.value,
                                            // Reset card details when changing payment method
                                            card_number: e.target.value !== 'Card' ? '' : paymentData.card_number,
                                            card_holder: e.target.value !== 'Card' ? '' : paymentData.card_holder,
                                            expiry_date: e.target.value !== 'Card' ? '' : paymentData.expiry_date,
                                            cvv: e.target.value !== 'Card' ? '' : paymentData.cvv
                                        })}
                                        required
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Card">Card</option>
                                        <option value="Online">Online Payment</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                    </Input>
                                </FormGroup>
                                
                                {/* Card Details - Only show when Card is selected */}
                                {paymentData.payment_method === 'Card' && (
                                    <>
                                        <FormGroup>
                                            <Label>Card Number *</Label>
                                            <Input
                                                type="text"
                                                maxLength="19"
                                                value={paymentData.card_number ? 
                                                    paymentData.card_number.match(/\d{1,4}/g)?.join(' ').substring(0, 19) || paymentData.card_number 
                                                    : ''}
                                                onChange={(e) => {
                                                    const inputValue = e.target.value.replace(/\s/g, '');
                                                    if (/^\d*$/.test(inputValue) && inputValue.length <= 16) {
                                                        setPaymentData({ ...paymentData, card_number: inputValue });
                                                    }
                                                }}
                                                placeholder="1234 5678 9012 3456"
                                                required
                                                style={{
                                                    letterSpacing: '0.1em'
                                                }}
                                            />
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
                                                        maxLength="4"
                                                        value={paymentData.cvv}
                                                        onChange={(e) => {
                                                            const value = e.target.value.replace(/\D/g, '').substring(0, 4);
                                                            setPaymentData({ ...paymentData, cvv: value });
                                                        }}
                                                        placeholder="123"
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
                                {paymentData.payment_method !== 'Cash' && (
                                    <FormGroup>
                                        <Label>Transaction ID</Label>
                                        <Input
                                            type="text"
                                            value={paymentData.transaction_id}
                                            onChange={(e) => setPaymentData({ ...paymentData, transaction_id: e.target.value })}
                                            placeholder="Enter transaction ID or reference number"
                                        />
                                    </FormGroup>
                                )}
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
                <ModalFooter>
                    <Button color="secondary" onClick={() => setPaymentModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button 
                        color="success" 
                        onClick={handleCreatePayment}
                        disabled={
                            paymentData.amount < (selectedPenalty?.fine_amount || 0) ||
                            (paymentData.payment_method === 'Card' && (
                                !paymentData.card_number || 
                                paymentData.card_number.replace(/\s/g, '').length < 13 ||
                                !paymentData.card_holder ||
                                !paymentData.expiry_date ||
                                !paymentData.cvv
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
