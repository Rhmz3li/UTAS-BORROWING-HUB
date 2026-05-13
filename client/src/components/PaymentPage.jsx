import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, Table, Badge, Button, Alert, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, FormGroup, Label, Input } from "reactstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from 'axios';
import { FaCreditCard, FaCheckCircle, FaClock, FaTimesCircle, FaArrowLeft, FaReceipt, FaDollarSign } from 'react-icons/fa';
import { toast } from 'react-toastify';

const Payments = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useSelector((state) => state.auth);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [pendingAutoOpenPaymentId, setPendingAutoOpenPaymentId] = useState(location.state?.openPaymentId || null);
    const [payData, setPayData] = useState({
        card_number: '',
        card_holder: '',
        expiry_date: '',
        cvv: '',
        transaction_id: '',
        cash_notes: ''
    });

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchPayments();
    }, [user, navigate, filter]);

    useEffect(() => {
        if (!pendingAutoOpenPaymentId || loading || payments.length === 0) return;

        const matchingPayment = payments.find((payment) => payment._id === pendingAutoOpenPaymentId);
        if (!matchingPayment) return;

        openPayModal(matchingPayment);
        setPendingAutoOpenPaymentId(null);
        navigate(location.pathname, { replace: true, state: {} });
    }, [pendingAutoOpenPaymentId, loading, payments, navigate, location.pathname]);

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params = filter !== 'all' ? { status: filter } : {};
            
            const response = await axios.get('http://localhost:5000/payments/my-payments', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (response.data.success) {
                setPayments(response.data.data || []);
            }
        } catch (error) {
            console.error('Fetch payments error:', error);
            toast.error('Failed to load payments');
        } finally {
            setLoading(false);
        }
    };

    const openPayModal = (payment) => {
        setSelectedPayment(payment);
        setPayData({
            card_number: '',
            card_holder: '',
            expiry_date: '',
            cvv: '',
            transaction_id: '',
            cash_notes: ''
        });
        setPayModalOpen(true);
    };

    const passesLuhnCheck = (cardNumber) => {
        const digits = String(cardNumber || '').replace(/\D/g, '');
        if (digits.length < 13 || digits.length > 19) return false;

        let sum = 0;
        let shouldDouble = false;
        for (let i = digits.length - 1; i >= 0; i -= 1) {
            let digit = parseInt(digits.charAt(i), 10);
            if (Number.isNaN(digit)) return false;
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            shouldDouble = !shouldDouble;
        }

        return sum % 10 === 0;
    };

    const detectCardType = (cardNumber) => {
        const digits = String(cardNumber || '').replace(/\D/g, '');
        if (!digits) return null;

        if (/^4/.test(digits)) {
            return { label: 'Visa', color: '#1a1f71', bg: '#e8edff' };
        }

        if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) {
            return { label: 'MasterCard', color: '#c62828', bg: '#ffebee' };
        }

        if (/^3[47]/.test(digits)) {
            return { label: 'American Express', color: '#006fcf', bg: '#e3f2fd' };
        }

        if (/^(6011|65|64[4-9])/.test(digits)) {
            return { label: 'Discover', color: '#ef6c00', bg: '#fff3e0' };
        }

        return { label: 'Card type not recognized yet', color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' };
    };

    const cardType = detectCardType(payData.card_number);

    const handleConfirmPayDeposit = async () => {
        if (!selectedPayment) return;

        const method = selectedPayment.payment_method;
        const token = localStorage.getItem('token');
        const url = `http://localhost:5000/payments/${selectedPayment._id}/pay-deposit`;

        if (method === 'Cash') {
            try {
                await axios.post(
                    url,
                    {
                        payment_method: 'Cash',
                        transaction_id: payData.transaction_id?.trim() || undefined,
                        notes: payData.cash_notes?.trim() || selectedPayment.notes || 'Cash deposit at hub'
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success('Cash payment recorded');
                setPayModalOpen(false);
                setSelectedPayment(null);
                fetchPayments();
            } catch (error) {
                console.error('Pay deposit error:', error);
                toast.error(error.response?.data?.message || 'Failed to complete payment');
            }
            return;
        }

        // Card: validate and send card details only
        const digitsOnly = payData.card_number.replace(/\s/g, '');
        if (!passesLuhnCheck(digitsOnly)) {
            toast.error('Please enter a valid card number');
            return;
        }
        if (!/^[A-Za-z][A-Za-z\s.'-]{1,}$/.test(payData.card_holder.trim())) {
            toast.error('Please enter the card holder name as shown on the card');
            return;
        }
        if (!/^\d{2}\/\d{2}$/.test(payData.expiry_date || '')) {
            toast.error('Please enter a valid expiry date (MM/YY)');
            return;
        }
        const [mmStr, yyStr] = payData.expiry_date.split('/');
        const month = parseInt(mmStr, 10);
        const year = parseInt(yyStr, 10);
        if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            toast.error('Please enter a valid expiry month (01–12)');
            return;
        }
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        if (year < currentYear || (year === currentYear && month < currentMonth)) {
            toast.error('Card expiry date cannot be in the past');
            return;
        }
        if (!/^\d{3,4}$/.test(payData.cvv || '')) {
            toast.error('Please enter a valid 3 or 4 digit CVV');
            return;
        }

        try {
            await axios.post(
                url,
                {
                    payment_method: 'Card',
                    transaction_id: payData.transaction_id || undefined,
                    notes: selectedPayment.notes || 'Online card deposit payment',
                    card_details: {
                        card_number: digitsOnly,
                        card_holder: payData.card_holder.trim(),
                        expiry_date: payData.expiry_date,
                        cvv: payData.cvv
                    }
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(
                `Payment completed successfully. Admin has been notified to review your ${selectedPayment.payment_type === 'Reservation' ? 'reservation request' : 'borrow request'}.`
            );
            setPayModalOpen(false);
            setSelectedPayment(null);
            fetchPayments();
        } catch (error) {
            console.error('Pay deposit error:', error);
            toast.error(error.response?.data?.message || 'Failed to complete payment');
        }
    };

    const getStatusBadge = (status) => {
        const colors = {
            'Completed': { bg: '#e8f5e9', color: '#4caf50', icon: FaCheckCircle },
            'Pending': { bg: '#fff3e0', color: '#ff9800', icon: FaClock },
            'Failed': { bg: '#ffebee', color: '#f44336', icon: FaTimesCircle },
            'Refunded': { bg: '#e3f2fd', color: '#1976d2', icon: FaReceipt }
        };
        const style = colors[status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', icon: FaCreditCard };
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

    const getPaymentMethodBadge = (method) => {
        const colors = {
            'Cash': '#4caf50',
            'Card': '#1976d2',
            'Online': '#9c27b0',
            'Bank Transfer': '#ff9800'
        };
        
        return (
            <Badge style={{
                background: colors[method] || '#666',
                color: '#fff',
                padding: '0.35rem 0.7rem',
                borderRadius: '15px',
                fontSize: '0.8rem',
                fontWeight: '500'
            }}>
                {method}
            </Badge>
        );
    };

    const totalAmount = payments
        .filter(p => p.status === 'Completed')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

    const pendingAmount = payments
        .filter(p => p.status === 'Pending')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

    const pendingRequiredPayments = payments.filter(
        (p) => p.status === 'Pending' && ['Resource', 'Reservation'].includes(p.payment_type)
    );

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
                                My Payments
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                View and manage your payment history
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
                                        Total Paid
                                    </p>
                                    <h3 style={{ color: '#4caf50', margin: '0.5rem 0 0 0', fontWeight: 'bold', fontSize: '2rem' }}>
                                        {totalAmount.toFixed(2)} OMR
                                    </h3>
                                </div>
                                <div style={{
                                    background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                                    padding: '1rem',
                                    borderRadius: '15px'
                                }}>
                                    <FaDollarSign style={{ color: '#fff', fontSize: '1.8rem' }} />
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
                                        Pending Payments
                                    </p>
                                    <h3 style={{ color: '#ff9800', margin: '0.5rem 0 0 0', fontWeight: 'bold', fontSize: '2rem' }}>
                                        {pendingAmount.toFixed(2)} OMR
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
                                        Total Transactions
                                    </p>
                                    <h3 style={{ color: '#1976d2', margin: '0.5rem 0 0 0', fontWeight: 'bold', fontSize: '2rem' }}>
                                        {payments.length}
                                    </h3>
                                </div>
                                <div style={{
                                    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                    padding: '1rem',
                                    borderRadius: '15px'
                                }}>
                                    <FaCreditCard style={{ color: '#fff', fontSize: '1.8rem' }} />
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
                                <option value="all">All Payments</option>
                                <option value="Completed">Completed</option>
                                <option value="Pending">Pending</option>
                                <option value="Failed">Failed</option>
                                <option value="Refunded">Refunded</option>
                            </select>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Payments Table */}
            <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
                <CardBody style={{ padding: '1.5rem' }}>
                    <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        Payment History
                    </CardTitle>

                    {pendingRequiredPayments.length > 0 && (
                        <Alert color="warning" style={{ borderRadius: '12px', marginBottom: '1.25rem' }}>
                            <strong>Action required:</strong> You have {pendingRequiredPayments.length} pending required payment(s).
                            Please complete them to allow final admin approval.
                        </Alert>
                    )}
                    
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner color="primary" />
                            <p className="mt-3">Loading payments...</p>
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="text-center py-5">
                            <FaCreditCard size={64} style={{ color: '#ccc', marginBottom: '1rem' }} />
                            <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No Payments Found</h5>
                            <p style={{ color: 'var(--text-tertiary)' }}>
                                {filter === 'all' 
                                    ? "You don't have any payment records yet."
                                    : `No ${filter.toLowerCase()} payments found.`}
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover style={{ margin: 0 }}>
                                <thead style={{ background: 'var(--bg-tertiary)' }}>
                                    <tr>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Date</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Amount</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Payment Method</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Transaction ID</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Notes</th>
                                        <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment) => (
                                        <tr key={payment._id} style={{ transition: 'all 0.2s ease' }}>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {new Date(payment.created_at).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                                                    {payment.amount?.toFixed(2) || '0.00'} OMR
                                                </strong>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {getPaymentMethodBadge(payment.payment_method || 'Cash')}
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {getStatusBadge(payment.status)}
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                <span style={{ 
                                                    color: 'var(--text-secondary)', 
                                                    fontSize: '0.9rem',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {payment.transaction_id || 'N/A'}
                                                </span>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                    {payment.notes || '-'}
                                                </span>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {['Resource', 'Reservation'].includes(payment.payment_type) && payment.status === 'Pending' ? (
                                                    <Button
                                                        color="primary"
                                                        size="sm"
                                                        onClick={() => openPayModal(payment)}
                                                        style={{ fontWeight: '600', borderRadius: '8px' }}
                                                    >
                                                        Pay Now
                                                    </Button>
                                                ) : (
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>-</span>
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
            </Container>

            {/* Pay Deposit Modal */}
            <Modal isOpen={payModalOpen} toggle={() => setPayModalOpen(false)}>
                <ModalHeader toggle={() => setPayModalOpen(false)}>
                    Pay Security Deposit
                </ModalHeader>
                <ModalBody>
                    {selectedPayment && (
                        <>
                            <Alert color="info">
                                <strong>Amount:</strong> {selectedPayment.amount?.toFixed(2) || '0.00'} OMR
                                <br />
                                <strong>For:</strong> {selectedPayment.notes || 'Security deposit'}
                                <br />
                                <strong>Method:</strong>{' '}
                                {getPaymentMethodBadge(selectedPayment.payment_method || '—')}
                            </Alert>
                            {selectedPayment.payment_method === 'Cash' ? (
                                <>
                                    <Alert color="success" className="mb-3">
                                        <strong>Cash Payment</strong>
                                        <p className="mb-1 mt-2" style={{ fontSize: '0.95rem' }}>
                                            Pay the security deposit in person at the hub. After staff records it, confirm here so your request can proceed.
                                        </p>
                                        <p className="mb-0" style={{ fontSize: '0.95rem' }}>
                                            Pay the deposit in person at the hub, then confirm it here so your request can continue.
                                        </p>
                                        {(selectedPayment.resource_id?.location || selectedPayment.resource_id?.name) && (
                                            <p className="mt-2 mb-0">
                                                <strong>Location:</strong>{' '}
                                                {selectedPayment.resource_id?.location ||
                                                    selectedPayment.resource_id?.name ||
                                                    'IT Borrowing Hub'}
                                            </p>
                                        )}
                                    </Alert>
                                    <FormGroup>
                                        <Label>Receipt / reference (optional)</Label>
                                        <Input
                                            type="text"
                                            value={payData.transaction_id}
                                            onChange={(e) => setPayData({ ...payData, transaction_id: e.target.value })}
                                            placeholder="Receipt number or staff reference"
                                        />
                                    </FormGroup>
                                    <FormGroup>
                                        <Label>Notes (optional)</Label>
                                        <Input
                                            type="text"
                                            value={payData.cash_notes}
                                            onChange={(e) => setPayData({ ...payData, cash_notes: e.target.value })}
                                            placeholder="Any note for staff"
                                        />
                                    </FormGroup>
                                </>
                            ) : (
                                <>
                                    <FormGroup>
                                        <Label>Card Number *</Label>
                                        <Input
                                            type="text"
                                            maxLength="19"
                                            value={payData.card_number}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\s/g, '');
                                                if (/^\d*$/.test(val) && val.length <= 16) {
                                                    const parts = val.match(/\d{1,4}/g) || [];
                                                    setPayData({ ...payData, card_number: parts.join(' ') });
                                                }
                                            }}
                                            placeholder="1234 5678 9012 3456"
                                        />
                                        {cardType && (
                                            <div
                                                style={{
                                                    marginTop: '0.5rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    padding: '0.3rem 0.65rem',
                                                    borderRadius: '999px',
                                                    background: cardType.bg,
                                                    color: cardType.color,
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                <FaCreditCard style={{ fontSize: '0.75rem' }} />
                                                {cardType.label}
                                            </div>
                                        )}
                                    </FormGroup>
                                    <Row>
                                        <Col md={6}>
                                            <FormGroup>
                                                <Label>Card Holder *</Label>
                                                <Input
                                                    type="text"
                                                    value={payData.card_holder}
                                                    onChange={(e) => setPayData({ ...payData, card_holder: e.target.value })}
                                                    placeholder="Name on card"
                                                />
                                            </FormGroup>
                                        </Col>
                                        <Col md={3}>
                                            <FormGroup>
                                                <Label>Expiry (MM/YY) *</Label>
                                                <Input
                                                    type="text"
                                                    maxLength="5"
                                                    value={payData.expiry_date}
                                                    onChange={(e) => {
                                                        let v = e.target.value.replace(/\D/g, '');
                                                        if (v.length >= 2) {
                                                            v = v.substring(0, 2) + '/' + v.substring(2, 4);
                                                        }
                                                        setPayData({ ...payData, expiry_date: v });
                                                    }}
                                                    placeholder="MM/YY"
                                                />
                                            </FormGroup>
                                        </Col>
                                        <Col md={3}>
                                            <FormGroup>
                                                <Label>CVV *</Label>
                                                <Input
                                                    type="password"
                                                    maxLength="4"
                                                    value={payData.cvv}
                                                    onChange={(e) => {
                                                        const v = e.target.value.replace(/\D/g, '').substring(0, 4);
                                                        setPayData({ ...payData, cvv: v });
                                                    }}
                                                    placeholder="123"
                                                />
                                            </FormGroup>
                                        </Col>
                                    </Row>
                                    <FormGroup>
                                        <Label>Transaction ID (optional)</Label>
                                        <Input
                                            type="text"
                                            value={payData.transaction_id}
                                            onChange={(e) => setPayData({ ...payData, transaction_id: e.target.value })}
                                            placeholder="Reference from bank / gateway"
                                        />
                                    </FormGroup>
                                </>
                            )}
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={() => setPayModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button color="primary" onClick={handleConfirmPayDeposit}>
                        {selectedPayment?.payment_method === 'Cash'
                            ? 'Confirm Cash Payment'
                            : 'Pay Now'}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default Payments;
