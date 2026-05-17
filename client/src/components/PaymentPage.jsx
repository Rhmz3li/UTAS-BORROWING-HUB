import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, Table, Badge, Button, Alert, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, FormGroup, Label, Input, FormFeedback } from "reactstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from 'axios';
import { FaCreditCard, FaCheckCircle, FaClock, FaTimesCircle, FaArrowLeft, FaReceipt, FaDollarSign } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { CARD_NETWORK_META } from '../constants/cardNetworkOptions';
import { generateClientTransactionId } from '../utils/generateClientTransactionId';
import {
    formatPanInput,
    maxPanDigitsForNetwork,
    inferCardNetworkFromPanDigits,
    getEffectiveCardNetwork,
    validateCardNumberFull,
    validateCardHolderName,
    validateCvvMcVisa,
    normalizeCardPanDigits,
    sanitizeCardHolderInput,
    validateCardNumberUsageLimit,
    MAX_CARD_NUMBER_USAGE
} from '../utils/cardValidation';

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
        card_network: 'Visa',
        card_number: '',
        card_holder: '',
        expiry_date: '',
        cvv: '',
        transaction_id: ''
    });
    const [cardNumberError, setCardNumberError] = useState('');
    const [cardHolderError, setCardHolderError] = useState('');
    const [checkingCardUsage, setCheckingCardUsage] = useState(false);

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
            card_network: '',
            card_number: '',
            card_holder: '',
            expiry_date: '',
            cvv: '',
            transaction_id: generateClientTransactionId(),
            cash_notes: ''
        });
        setCardNumberError('');
        setCardHolderError('');
        setPayModalOpen(true);
    };

    const fetchCardUsageStatus = async (digitsOnly, paymentId) => {
        const token = localStorage.getItem('token');
        if (!token || digitsOnly.length < 13) {
            return { allowed: true, usageCount: 0, remaining: MAX_CARD_NUMBER_USAGE };
        }
        const response = await axios.post(
            'http://localhost:5000/payments/check-card-usage',
            {
                card_number: digitsOnly,
                exclude_payment_id: paymentId || undefined
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    };

    const verifyCardUsageLimit = async (digitsOnly) => {
        try {
            setCheckingCardUsage(true);
            const status = await fetchCardUsageStatus(digitsOnly, selectedPayment?._id);
            const limitCheck = validateCardNumberUsageLimit(status?.usageCount ?? 0);
            if (!limitCheck.ok) {
                setCardNumberError(limitCheck.message);
                return { ok: false, message: limitCheck.message };
            }
            setCardNumberError('');
            return { ok: true };
        } catch (error) {
            console.error('Card usage check error:', error);
            const message = 'Could not verify card usage limit. Try again.';
            toast.error(message);
            return { ok: false, message };
        } finally {
            setCheckingCardUsage(false);
        }
    };

    const handleCardNumberBlur = async () => {
        const digits = normalizeCardPanDigits(payData.card_number);
        if (digits.length !== 16) return;
        const network = payData.card_network || 'Visa';
        const panCheck = validateCardNumberFull(payData.card_number, network);
        if (!panCheck.ok) {
            setCardNumberError(panCheck.message);
            return;
        }
        await verifyCardUsageLimit(digits);
    };

    const handleCardHolderBlur = () => {
        const check = validateCardHolderName(payData.card_holder);
        setCardHolderError(check.ok ? '' : check.message);
    };

    const selectedCardMeta = payData.card_network ? CARD_NETWORK_META[payData.card_network] : null;

    const handleConfirmPayDeposit = async () => {
        if (!selectedPayment) return;

        const method = selectedPayment.payment_method;
        const token = localStorage.getItem('token');
        const url = `http://localhost:5000/payments/${selectedPayment._id}/pay-deposit`;

        if (method === 'Cash') {
            try {
                const response = await axios.post(
                    url,
                    {
                        payment_method: 'Cash',
                        transaction_id: payData.transaction_id?.trim() || undefined,
                        notes: payData.cash_notes?.trim() || selectedPayment.notes || 'Cash deposit at hub'
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success(
                    response.data?.message ||
                        'Cash payment submitted. An administrator will confirm after you pay at the hub.'
                );
                setPayModalOpen(false);
                setSelectedPayment(null);
                fetchPayments();
            } catch (error) {
                console.error('Pay deposit error:', error);
                toast.error(error.response?.data?.message || 'Failed to complete payment');
            }
            return;
        }

        if (!payData.card_network) {
            toast.error('Please select your card type');
            return;
        }

        const holderCheck = validateCardHolderName(payData.card_holder);
        if (!holderCheck.ok) {
            setCardHolderError(holderCheck.message);
            toast.error(holderCheck.message);
            return;
        }
        setCardHolderError('');

        const panCheck = validateCardNumberFull(payData.card_number, payData.card_network);
        if (!panCheck.ok) {
            setCardNumberError(panCheck.message);
            toast.error(panCheck.message);
            return;
        }

        const digitsOnly = panCheck.digits;
        const usageCheck = await verifyCardUsageLimit(digitsOnly);
        if (!usageCheck.ok) {
            toast.error(usageCheck.message || `This card cannot be used more than ${MAX_CARD_NUMBER_USAGE} times.`);
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
        const cvvCheck = validateCvvMcVisa(payData.cvv);
        if (!cvvCheck.ok) {
            toast.error(cvvCheck.message);
            return;
        }

        const cardNetwork = getEffectiveCardNetwork(payData.card_number, payData.card_network);

        try {
            await axios.post(
                url,
                {
                    payment_method: 'Card',
                    transaction_id: payData.transaction_id || undefined,
                    notes: selectedPayment.notes || 'Online card deposit payment',
                    card_details: {
                        card_network: cardNetwork,
                        card_number: digitsOnly,
                        card_holder: holderCheck.value,
                        expiry_date: payData.expiry_date,
                        cvv: payData.cvv
                    }
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const followUp =
                selectedPayment.payment_type === 'Penalty'
                    ? 'penalty payment'
                    : selectedPayment.payment_type === 'Reservation'
                        ? 'reservation request'
                        : 'borrow request';
            toast.success(
                `Payment completed successfully. Admin has been notified to review your ${followUp}.`
            );
            setPayModalOpen(false);
            setSelectedPayment(null);
            fetchPayments();
        } catch (error) {
            console.error('Pay deposit error:', error);
            const msg = error.response?.data?.message || 'Failed to complete payment';
            if (/card.*used|more than \d+ time/i.test(msg)) {
                setCardNumberError(msg);
            }
            toast.error(msg);
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
            'Cash': { bg: '#e8f5e9', color: '#2e7d32' },
            'Card': { bg: '#e3f2fd', color: '#1565c0' },
            'Online': { bg: '#f3e5f5', color: '#7b1fa2' },
            'Bank Transfer': { bg: '#fff3e0', color: '#e65100' }
        };
        const style = colors[method] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' };
        
        return (
            <Badge style={{
                background: style.bg,
                color: style.color,
                padding: '0.35rem 0.7rem',
                borderRadius: '15px',
                fontSize: '0.8rem',
                fontWeight: '600'
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
        (p) => p.status === 'Pending' && ['Resource', 'Reservation', 'Penalty'].includes(p.payment_type)
    );

    const getPayModalTitle = (payment) => {
        if (!payment) return 'Complete Payment';
        if (payment.payment_type === 'Penalty') return 'Pay Penalty';
        if (payment.payment_type === 'Reservation') return 'Pay Security Deposit';
        return 'Pay Security Deposit';
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
                                                {['Resource', 'Reservation', 'Penalty'].includes(payment.payment_type) &&
                                                payment.status === 'Pending' &&
                                                !(payment.payment_method === 'Cash' && payment.cash_submitted_at) ? (
                                                    <Button
                                                        color="primary"
                                                        size="sm"
                                                        onClick={() => openPayModal(payment)}
                                                        style={{ fontWeight: '600', borderRadius: '8px' }}
                                                    >
                                                        {payment.payment_method === 'Cash' ? 'Submit Cash' : 'Pay Now'}
                                                    </Button>
                                                ) : payment.status === 'Pending' &&
                                                  payment.payment_method === 'Cash' &&
                                                  payment.cash_submitted_at ? (
                                                    <Badge
                                                        style={{
                                                            background: '#fff3e0',
                                                            color: '#ff9800',
                                                            padding: '0.4rem 0.75rem',
                                                            borderRadius: '8px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        Awaiting admin
                                                    </Badge>
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
            <Modal
                isOpen={payModalOpen}
                toggle={() => setPayModalOpen(false)}
                centered
                size="lg"
                contentClassName="border-0 shadow-lg rounded-4 overflow-hidden"
            >
                <ModalHeader
                    toggle={() => setPayModalOpen(false)}
                    close={
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={() => setPayModalOpen(false)}
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
                        <FaCreditCard /> {getPayModalTitle(selectedPayment)}
                    </span>
                </ModalHeader>
                <ModalBody className="px-4 py-4" style={{ background: 'var(--card-bg)' }}>
                    {selectedPayment && (
                        <>
                            <div
                                className="rounded-4 p-3 mb-4 border"
                                style={{
                                    borderColor: 'var(--border-color)',
                                    background: 'linear-gradient(145deg, rgba(21, 101, 192, 0.08), rgba(13, 71, 161, 0.04))'
                                }}
                            >
                                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                                    <div>
                                        <div className="small text-uppercase fw-bold" style={{ color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
                                            Amount due
                                        </div>
                                        <div className="fs-3 fw-bold" style={{ color: 'var(--text-primary)' }}>
                                            {selectedPayment.amount?.toFixed(2) || '0.00'}{' '}
                                            <span className="fs-6 fw-semibold">OMR</span>
                                        </div>
                                    </div>
                                    <div>{getPaymentMethodBadge(selectedPayment.payment_method || '—')}</div>
                                </div>
                                <hr className="my-3 opacity-25" />
                                <div className="small" style={{ color: 'var(--text-secondary)' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>For:</strong>{' '}
                                    {selectedPayment.notes ||
                                        (selectedPayment.payment_type === 'Penalty'
                                            ? 'Penalty payment'
                                            : 'Security deposit')}
                                </div>
                            </div>

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
                                    {payData.transaction_id}
                                </div>
                                <small className="d-block mt-2" style={{ color: 'var(--text-tertiary)' }}>
                                    Auto-generated by the system for this payment.
                                </small>
                            </FormGroup>

                            {selectedPayment.payment_method === 'Cash' ? (
                                <>
                                    <Alert color="success" className="rounded-3 border-0 mb-4" style={{ background: 'rgba(76, 175, 80, 0.12)', color: 'var(--text-primary)' }}>
                                        <strong>Cash payment</strong>
                                        <p className="mb-0 mt-2 small" style={{ lineHeight: 1.5 }}>
                                            Pay in person at the hub, then click the button below so staff are notified.
                                            An <strong>administrator will confirm</strong> your payment in Payments Management after receiving the cash.
                                        </p>
                                        {(selectedPayment.resource_id?.location || selectedPayment.resource_id?.name) && (
                                            <p className="mt-3 mb-0 small">
                                                <strong>Location:</strong>{' '}
                                                {selectedPayment.resource_id?.location ||
                                                    selectedPayment.resource_id?.name ||
                                                    'IT Borrowing Hub'}
                                            </p>
                                        )}
                                    </Alert>
                                    <FormGroup>
                                        <Label>Notes for staff (optional)</Label>
                                        <Input
                                            type="text"
                                            value={payData.cash_notes}
                                            onChange={(e) => setPayData({ ...payData, cash_notes: e.target.value })}
                                            placeholder="e.g. receipt number from desk"
                                            className="rounded-3"
                                            style={{ borderColor: 'var(--border-color)' }}
                                        />
                                    </FormGroup>
                                </>
                            ) : (
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
                                                const active = payData.card_network === network;
                                                const meta = CARD_NETWORK_META[network];
                                                return (
                                                    <button
                                                        key={network}
                                                        type="button"
                                                        className="flex-fill border-0 py-2 px-2 rounded-2 fw-semibold transition-all"
                                                        style={{
                                                            background: active ? 'var(--card-bg)' : 'transparent',
                                                            color: active ? meta.color : 'var(--text-secondary)',
                                                            boxShadow: active ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
                                                            transform: active ? 'scale(1.02)' : 'none'
                                                        }}
                                                        onClick={() => {
                                                            const max = maxPanDigitsForNetwork(network);
                                                            const raw = payData.card_number.replace(/\D/g, '');
                                                            setPayData({
                                                                ...payData,
                                                                card_network: network,
                                                                card_number: formatPanInput(raw, max)
                                                            });
                                                            setCardNumberError('');
                                                            if (raw.length === 16) {
                                                                const check = validateCardNumberFull(
                                                                    formatPanInput(raw, max),
                                                                    network
                                                                );
                                                                if (!check.ok) setCardNumberError(check.message);
                                                            }
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
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="cc-number"
                                            maxLength={19}
                                            invalid={!!cardNumberError}
                                            className="rounded-3"
                                            style={{ borderColor: 'var(--border-color)', letterSpacing: '0.08em' }}
                                            value={payData.card_number}
                                            onChange={(e) => {
                                                const max = maxPanDigitsForNetwork(
                                                    payData.card_network || 'Visa'
                                                );
                                                const raw = e.target.value.replace(/\D/g, '');
                                                const inferred = inferCardNetworkFromPanDigits(raw);
                                                setPayData({
                                                    ...payData,
                                                    card_number: formatPanInput(raw, max),
                                                    ...(inferred ? { card_network: inferred } : {})
                                                });
                                                setCardNumberError('');
                                            }}
                                            onBlur={handleCardNumberBlur}
                                            placeholder={
                                                payData.card_network === 'Mastercard'
                                                    ? '16 digits starting with 55'
                                                    : '16 digits starting with 4'
                                            }
                                        />
                                        {cardNumberError && <FormFeedback className="d-block">{cardNumberError}</FormFeedback>}
                                        {selectedCardMeta && (
                                            <div className="mt-2">
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        padding: '0.35rem 0.75rem',
                                                        borderRadius: '999px',
                                                        background: selectedCardMeta.bg,
                                                        color: selectedCardMeta.color,
                                                        fontSize: '0.8rem',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    <FaCreditCard style={{ fontSize: '0.75rem' }} />
                                                    {selectedCardMeta.label}
                                                </span>
                                            </div>
                                        )}
                                    </FormGroup>
                                    <Row className="g-3">
                                        <Col md={6}>
                                            <FormGroup className="mb-0">
                                                <Label>Card holder *</Label>
                                                <Input
                                                    type="text"
                                                    className="rounded-3"
                                                    invalid={!!cardHolderError}
                                                    style={{ borderColor: 'var(--border-color)' }}
                                                    value={payData.card_holder}
                                                    onChange={(e) => {
                                                        setPayData({
                                                            ...payData,
                                                            card_holder: sanitizeCardHolderInput(e.target.value)
                                                        });
                                                        setCardHolderError('');
                                                    }}
                                                    onBlur={handleCardHolderBlur}
                                                    placeholder="Name on card (letters only)"
                                                    autoComplete="cc-name"
                                                />
                                                {cardHolderError && (
                                                    <FormFeedback className="d-block">{cardHolderError}</FormFeedback>
                                                )}
                                            </FormGroup>
                                        </Col>
                                        <Col md={3}>
                                            <FormGroup className="mb-0">
                                                <Label>Expiry (MM/YY) *</Label>
                                                <Input
                                                    type="text"
                                                    maxLength="5"
                                                    className="rounded-3"
                                                    style={{ borderColor: 'var(--border-color)' }}
                                                    value={payData.expiry_date}
                                                    onChange={(e) => {
                                                        let v = e.target.value.replace(/\D/g, '');
                                                        if (v.length >= 2) {
                                                            v = `${v.substring(0, 2)}/${v.substring(2, 4)}`;
                                                        }
                                                        setPayData({ ...payData, expiry_date: v });
                                                    }}
                                                    placeholder="MM/YY"
                                                />
                                            </FormGroup>
                                        </Col>
                                        <Col md={3}>
                                            <FormGroup className="mb-0">
                                                <Label>CVV *</Label>
                                                <Input
                                                    type="password"
                                                    maxLength="3"
                                                    className="rounded-3"
                                                    style={{ borderColor: 'var(--border-color)' }}
                                                    value={payData.cvv}
                                                    onChange={(e) => {
                                                        const v = e.target.value.replace(/\D/g, '').substring(0, 3);
                                                        setPayData({ ...payData, cvv: v });
                                                    }}
                                                    placeholder="•••"
                                                    inputMode="numeric"
                                                />
                                            </FormGroup>
                                        </Col>
                                    </Row>
                                </>
                            )}
                        </>
                    )}
                </ModalBody>
                <ModalFooter
                    className="border-0 pt-0 pb-4 px-4 d-flex justify-content-end gap-2"
                    style={{ background: 'var(--card-bg)' }}
                >
                    <Button color="light" className="rounded-pill px-4 border" onClick={() => setPayModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        color="primary"
                        className="rounded-pill px-4 shadow-sm"
                        onClick={handleConfirmPayDeposit}
                        disabled={checkingCardUsage}
                    >
                        {checkingCardUsage
                            ? 'Checking card…'
                            : selectedPayment?.payment_method === 'Cash'
                              ? 'Submit for admin confirmation'
                              : 'Pay now'}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default Payments;
