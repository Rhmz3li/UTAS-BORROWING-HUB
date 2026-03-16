import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, Table, Badge, Button, Alert, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, FormGroup, Label, Input } from "reactstrap";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from 'axios';
import { FaCreditCard, FaCheckCircle, FaClock, FaTimesCircle, FaArrowLeft, FaReceipt, FaDollarSign } from 'react-icons/fa';
import { toast } from 'react-toastify';

const Payments = () => {
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [payData, setPayData] = useState({
        card_number: '',
        card_holder: '',
        expiry_date: '',
        cvv: '',
        transaction_id: ''
    });

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchPayments();
    }, [user, navigate, filter]);

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
            transaction_id: ''
        });
        setPayModalOpen(true);
    };

    const handleConfirmPayDeposit = async () => {
        if (!selectedPayment) return;

        // Basic client-side validation for card data
        const digitsOnly = payData.card_number.replace(/\s/g, '');
        if (!digitsOnly || digitsOnly.length < 13 || digitsOnly.length > 16) {
            toast.error('Please enter a valid card number (13–16 digits)');
            return;
        }
        if (!payData.card_holder || payData.card_holder.trim().length < 2) {
            toast.error('Please enter card holder name');
            return;
        }
        if (!/^\d{2}\/\d{2}$/.test(payData.expiry_date || '')) {
            toast.error('Please enter a valid expiry date (MM/YY)');
            return;
        } else {
            // Check that expiry date is not in the past
            const [mmStr, yyStr] = payData.expiry_date.split('/');
            const month = parseInt(mmStr, 10);
            const year = parseInt(yyStr, 10);

            // Basic month range check
            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
                toast.error('Please enter a valid expiry month (01–12)');
                return;
            }

            const now = new Date();
            const currentYear = now.getFullYear() % 100; // last two digits
            const currentMonth = now.getMonth() + 1; // 1-12

            if (year < currentYear || (year === currentYear && month < currentMonth)) {
                toast.error('Card expiry date cannot be in the past');
                return;
            }
        }
        if (!payData.cvv || payData.cvv.length < 3) {
            toast.error('Please enter a valid CVV');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `http://localhost:5000/payments/${selectedPayment._id}/pay-deposit`,
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
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            toast.success('Payment completed successfully!');
            setPayModalOpen(false);
            setSelectedPayment(null);
            fetchPayments();
        } catch (error) {
            console.error('Pay deposit error:', error);
            const msg = error.response?.data?.message || 'Failed to complete payment';
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
        const style = colors[status] || { bg: '#f5f5f5', color: '#666', icon: FaCreditCard };
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
                                My Payments
                            </h2>
                            <p style={{ color: '#666', margin: 0 }}>
                                View and manage your payment history
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
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                        <CardBody style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: '#666', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
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
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                        <CardBody style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: '#666', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
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
            <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                <CardBody style={{ padding: '1.5rem' }}>
                    <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1.5rem', color: '#2c3e50' }}>
                        Payment History
                    </CardTitle>
                    
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner color="primary" />
                            <p className="mt-3">Loading payments...</p>
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="text-center py-5">
                            <FaCreditCard size={64} style={{ color: '#ccc', marginBottom: '1rem' }} />
                            <h5 style={{ color: '#666', marginBottom: '0.5rem' }}>No Payments Found</h5>
                            <p style={{ color: '#999' }}>
                                {filter === 'all' 
                                    ? "You don't have any payment records yet."
                                    : `No ${filter.toLowerCase()} payments found.`}
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover style={{ margin: 0 }}>
                                <thead style={{ background: '#f8f9fa' }}>
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
                                                <strong style={{ color: '#2c3e50', fontSize: '1.1rem' }}>
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
                                                    color: '#666', 
                                                    fontSize: '0.9rem',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {payment.transaction_id || 'N/A'}
                                                </span>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                <span style={{ color: '#666', fontSize: '0.9rem' }}>
                                                    {payment.notes || '-'}
                                                </span>
                                            </td>
                                            <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                {payment.payment_type === 'Resource' && payment.status === 'Pending' ? (
                                                    <Button
                                                        color="primary"
                                                        size="sm"
                                                        onClick={() => openPayModal(payment)}
                                                        style={{ fontWeight: '600', borderRadius: '8px' }}
                                                    >
                                                        Pay Deposit
                                                    </Button>
                                                ) : (
                                                    <span style={{ color: '#999', fontSize: '0.85rem' }}>-</span>
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
                            </Alert>
                            <FormGroup>
                                <Label>Card Number *</Label>
                                <Input
                                    type="text"
                                    maxLength="19"
                                    value={payData.card_number}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\s/g, '');
                                        if (/^\d*$/.test(val) && val.length <= 16) {
                                            // format as XXXX XXXX ...
                                            const parts = val.match(/\d{1,4}/g) || [];
                                            setPayData({ ...payData, card_number: parts.join(' ') });
                                        }
                                    }}
                                    placeholder="1234 5678 9012 3456"
                                />
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
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={() => setPayModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button color="primary" onClick={handleConfirmPayDeposit}>
                        Pay Now
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default Payments;
