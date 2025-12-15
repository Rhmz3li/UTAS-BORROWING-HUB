import { Container, Row, Col, Card, CardBody, Button, Input, InputGroup, InputGroupText, Modal, ModalHeader, ModalBody, ModalFooter, Badge, Table, Alert, Label, FormGroup } from 'reactstrap';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { FaSearch, FaCheckCircle, FaTimes, FaEye, FaCreditCard, FaExclamationTriangle, FaUndo, FaMoneyBillWave } from 'react-icons/fa';
import { toast } from 'react-toastify';


const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    fetchPayments();
  }, [currentPage, searchTerm, selectedStatus, selectedMethod]);


  const fetchPayments = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const params = {
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(selectedMethod && { payment_method: selectedMethod })
      };

      const response = await axios.get('http://localhost:5000/admin/payments', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
      });

      if (response.data.success) {
        setPayments(response.data.data);
        setTotalPages(response.data.pagination.pages);
        setTotal(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Fetch payments error:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (payment) => {
    setSelectedPayment(payment);
    setViewModalOpen(true);
  };

  const handleStatusChange = (payment) => {
    setSelectedPayment(payment);
    setStatusNotes('');
    setStatusModalOpen(true);
  };

  const updateStatus = async (newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/admin/payments/${selectedPayment._id}/status`,
        { 
          status: newStatus,
          notes: statusNotes || undefined
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success(`Payment status updated to ${newStatus}`);
      setStatusModalOpen(false);
      setSelectedPayment(null);
      setStatusNotes('');
      fetchPayments();
    } catch (error) {
      console.error('Update status error:', error);
      toast.error(error.response?.data?.message || 'Failed to update payment status');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Pending': { bg: '#fff3e0', color: '#ff9800' },
      'Completed': { bg: '#e8f5e9', color: '#4caf50' },
      'Failed': { bg: '#ffebee', color: '#f44336' },
      'Refunded': { bg: '#f3e5f5', color: '#9c27b0' }
    };
    const style = colors[status] || { bg: '#f5f5f5', color: '#666' };
    
    return (
      <Badge style={{
        background: style.bg,
        color: style.color,
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        width: 'fit-content'
      }}>
        {status === 'Completed' && <FaCheckCircle />}
        {status === 'Failed' && <FaTimes />}
        {status === 'Refunded' && <FaUndo />}
        {status}
      </Badge>
    );
  };

  const getMethodBadge = (method) => {
    const colors = {
      'Cash': { bg: '#e8f5e9', color: '#4caf50' },
      'Card': { bg: '#e3f2fd', color: '#1976d2' },
      'Online': { bg: '#fff3e0', color: '#ff9800' },
      'Bank Transfer': { bg: '#f3e5f5', color: '#9c27b0' }
    };
    const style = colors[method] || { bg: '#f5f5f5', color: '#666' };
    
    return (
      <Badge style={{
        background: style.bg,
        color: style.color,
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '600',
        width: 'fit-content'
      }}>
        {method}
      </Badge>
    );
  };

  // Calculate totals
  const totalCompleted = payments
    .filter(p => p.status === 'Completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const totalPending = payments
    .filter(p => p.status === 'Pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem' }}>
      <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div>
            <h2 style={{ color: '#333', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Payments Management
            </h2>
            <p style={{ color: '#666', margin: 0 }}>
              Manage all payments: view details, confirm, and update payment status
            </p>
          </div>
        </Col>
      </Row>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={4}>
          <Card style={{ background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)', border: 'none', color: 'white' }}>
            <CardBody className="p-3">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: '0.9' }}>Total Completed</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {totalCompleted.toFixed(2)} OMR
                  </div>
                </div>
                <FaCheckCircle style={{ fontSize: '2rem', opacity: '0.7' }} />
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={4}>
          <Card style={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', border: 'none', color: 'white' }}>
            <CardBody className="p-3">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: '0.9' }}>Total Pending</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {totalPending.toFixed(2)} OMR
                  </div>
                </div>
                <FaExclamationTriangle style={{ fontSize: '2rem', opacity: '0.7' }} />
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={4}>
          <Card style={{ background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', border: 'none', color: 'white' }}>
            <CardBody className="p-3">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: '0.9' }}>Total Payments</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {total}
                  </div>
                </div>
                <FaMoneyBillWave style={{ fontSize: '2rem', opacity: '0.7' }} />
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Row className="mb-4">
        <Col md={5}>
          <InputGroup>
            <InputGroupText>
              <FaSearch />
            </InputGroupText>
            <Input
              type="text"
              placeholder="Search by user name, email, student ID, transaction ID, or notes..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </InputGroup>
        </Col>
        <Col md={3}>
          <Input
            type="select"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Failed">Failed</option>
            <option value="Refunded">Refunded</option>
          </Input>
        </Col>
        <Col md={2}>
          <Input
            type="select"
            value={selectedMethod}
            onChange={(e) => {
              setSelectedMethod(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Methods</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Online">Online</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </Input>
        </Col>
        <Col md={2}>
          <div style={{ 
            padding: '0.5rem', 
            textAlign: 'center', 
            background: '#fff', 
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <strong style={{ color: '#1976d2' }}>{total}</strong> Total
          </div>
        </Col>
      </Row>

      {/* Payments Table */}
      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-5">
              <FaCreditCard style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
              <p style={{ color: '#666' }}>No payments found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ margin: 0 }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>User</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Amount</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Method</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Transaction ID</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Date</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment._id}>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <div>
                          <strong style={{ color: '#333' }}>
                            {payment.user_id?.full_name || 'N/A'}
                          </strong>
                          {payment.user_id?.email && (
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              {payment.user_id.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <strong style={{ color: '#4caf50', fontSize: '1.1rem' }}>
                          {payment.amount?.toFixed(2) || '0.00'} OMR
                        </strong>
                        {payment.penalty_id && (
                          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                            Penalty: {payment.penalty_id.fine_amount?.toFixed(2)} OMR
                          </div>
                        )}
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        {getMethodBadge(payment.payment_method)}
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        {payment.transaction_id ? (
                          <code style={{ fontSize: '0.85rem', color: '#666' }}>
                            {payment.transaction_id}
                          </code>
                        ) : (
                          <span style={{ color: '#999', fontStyle: 'italic' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <span style={{ color: '#666' }}>
                          {new Date(payment.created_at).toLocaleDateString()}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: '#999' }}>
                          {new Date(payment.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        {getStatusBadge(payment.status)}
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <Button
                            size="sm"
                            onClick={() => handleView(payment)}
                            style={{ background: '#1976d2', border: 'none' }}
                            title="View Details"
                          >
                            <FaEye />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleStatusChange(payment)}
                            style={{ background: '#4caf50', border: 'none' }}
                            title="Update Status"
                          >
                            <FaCheckCircle />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Row className="mt-4">
          <Col className="d-flex justify-content-center">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                style={{ background: '#1976d2', border: 'none' }}
              >
                Previous
              </Button>
              <span style={{ padding: '0.5rem 1rem', background: '#fff', borderRadius: '8px' }}>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                style={{ background: '#1976d2', border: 'none' }}
              >
                Next
              </Button>
            </div>
          </Col>
        </Row>
      )}

      {/* View Payment Modal */}
      <Modal isOpen={viewModalOpen} toggle={() => setViewModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setViewModalOpen(false)}>
          Payment Details
        </ModalHeader>
        <ModalBody>
          {selectedPayment && (
            <Row>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  User Information
                </h6>
                <p><strong>Name:</strong> {selectedPayment.user_id?.full_name || 'N/A'}</p>
                <p><strong>Email:</strong> {selectedPayment.user_id?.email || 'N/A'}</p>
                <p><strong>Student ID:</strong> {selectedPayment.user_id?.student_id || 'N/A'}</p>
                <p><strong>Phone:</strong> {selectedPayment.user_id?.phone || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Payment Information
                </h6>
                <p><strong>Amount:</strong> <span style={{ color: '#4caf50', fontWeight: 'bold', fontSize: '1.2rem' }}>
                  {selectedPayment.amount?.toFixed(2) || '0.00'} OMR
                </span></p>
                <p><strong>Method:</strong> {getMethodBadge(selectedPayment.payment_method)}</p>
                <p><strong>Status:</strong> {getStatusBadge(selectedPayment.status)}</p>
                {selectedPayment.transaction_id && (
                  <p><strong>Transaction ID:</strong> <code>{selectedPayment.transaction_id}</code></p>
                )}
                {selectedPayment.receipt_url && (
                  <p><strong>Receipt:</strong> <a href={selectedPayment.receipt_url} target="_blank" rel="noopener noreferrer">View Receipt</a></p>
                )}
              </Col>
              <Col md={12} className="mt-3">
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Penalty Information
                </h6>
                {selectedPayment.penalty_id ? (
                  <>
                    <p><strong>Penalty Type:</strong> {selectedPayment.penalty_id.penalty_type || 'N/A'}</p>
                    <p><strong>Penalty Amount:</strong> {selectedPayment.penalty_id.fine_amount?.toFixed(2) || '0.00'} OMR</p>
                    {selectedPayment.penalty_id.description && (
                      <p><strong>Description:</strong> {selectedPayment.penalty_id.description}</p>
                    )}
                  </>
                ) : (
                  <p style={{ color: '#999' }}>No penalty information available</p>
                )}
              </Col>
              <Col md={12} className="mt-3">
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Additional Information
                </h6>
                <p><strong>Created:</strong> {new Date(selectedPayment.created_at).toLocaleString()}</p>
                <p><strong>Updated:</strong> {new Date(selectedPayment.updated_at).toLocaleString()}</p>
                {selectedPayment.processed_by && (
                  <p><strong>Processed By:</strong> {selectedPayment.processed_by?.full_name || 'N/A'}</p>
                )}
                {selectedPayment.notes && (
                  <p><strong>Notes:</strong> {selectedPayment.notes}</p>
                )}
              </Col>
            </Row>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setViewModalOpen(false)}>
            Close
          </Button>
          <Button 
            color="primary" 
            onClick={() => {
              setViewModalOpen(false);
              handleStatusChange(selectedPayment);
            }}
          >
            Update Status
          </Button>
        </ModalFooter>
      </Modal>

      {/* Change Status Modal */}
      <Modal isOpen={statusModalOpen} toggle={() => setStatusModalOpen(false)}>
        <ModalHeader toggle={() => setStatusModalOpen(false)}>
          Update Payment Status
        </ModalHeader>
        <ModalBody>
          {selectedPayment && (
            <>
              <Alert color="info">
                Current Status: {getStatusBadge(selectedPayment.status)}
                <br />
                <strong>User:</strong> {selectedPayment.user_id?.full_name}
                <br />
                <strong>Amount:</strong> {selectedPayment.amount?.toFixed(2)} OMR
                <br />
                <strong>Method:</strong> {selectedPayment.payment_method}
              </Alert>
              <FormGroup>
                <Label for="statusNotes">Notes (Optional)</Label>
                <Input
                  type="textarea"
                  id="statusNotes"
                  rows="3"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Enter any notes about this status change..."
                />
              </FormGroup>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {selectedPayment.status !== 'Completed' && (
                  <Button 
                    color="success" 
                    onClick={() => updateStatus('Completed')}
                    block
                    style={{ background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)', border: 'none' }}
                  >
                    <FaCheckCircle /> Mark as Completed
                  </Button>
                )}
                {selectedPayment.status !== 'Pending' && (
                  <Button 
                    color="warning" 
                    onClick={() => updateStatus('Pending')}
                    block
                  >
                    Mark as Pending
                  </Button>
                )}
                {selectedPayment.status !== 'Failed' && (
                  <Button 
                    color="danger" 
                    onClick={() => updateStatus('Failed')}
                    block
                  >
                    <FaTimes /> Mark as Failed
                  </Button>
                )}
                {selectedPayment.status === 'Completed' && (
                  <Button 
                    color="secondary" 
                    onClick={() => updateStatus('Refunded')}
                    block
                    style={{ background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)', border: 'none' }}
                  >
                    <FaUndo /> Refund Payment
                  </Button>
                )}
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setStatusModalOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      </Container>
    </div>
  );
};

export default AdminPayments;
