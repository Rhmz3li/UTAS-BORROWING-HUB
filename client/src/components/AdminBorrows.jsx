import { Container, Row, Col, Card, CardBody, Button, Input, InputGroup, InputGroupText, Modal, ModalHeader, ModalBody, ModalFooter, Badge, Table, Alert, Form, FormGroup, Label } from 'reactstrap';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { FaSearch, FaUndo, FaEye, FaExclamationTriangle, FaCheckCircle, FaClock, FaBookOpen, FaHourglassHalf, FaTimesCircle, FaCheck, FaDollarSign, FaFileInvoice, FaUser, FaCalendar, FaCalendarTimes, FaInfoCircle, FaEdit, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';


const AdminBorrows = () => {
  const [borrows, setBorrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedBorrow, setSelectedBorrow] = useState(null);
  const [returnData, setReturnData] = useState({
    condition_on_return: 'Good',
    status: 'Returned', // 'Returned' or 'Lost'
    notes: ''
  });
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchBorrows();
  }, [currentPage, searchTerm, selectedStatus]);


  const fetchBorrows = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus && { status: selectedStatus })
      };

      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/admin/borrows', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        setBorrows(response.data.data || []);
        setTotalPages(response.data.pagination?.pages || 1);
        setTotal(response.data.pagination?.total || 0);
      } else {
        setBorrows([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (error) {
      console.error('Fetch borrows error:', error);
      toast.error('Failed to load borrows');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (borrow) => {
    setSelectedBorrow(borrow);
    setViewModalOpen(true);
  };

  const handleReturn = (borrow) => {
    setSelectedBorrow(borrow);
    setReturnData({
      condition_on_return: borrow.condition_on_borrow || 'Good',
      status: 'Returned',
      notes: ''
    });
    setReturnModalOpen(true);
  };

  const handleApprove = async (borrowId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Show confirmation dialog
      const confirmApproval = window.confirm(
        'Are you sure you want to approve this borrow request?\n\n' +
        'Once approved:\n' +
        '- The borrow will become Active\n' +
        '- Resource quantity will be decreased\n' +
        '- User will be notified\n' +
        '- Borrow period will start from today'
      );

      if (!confirmApproval) {
        return;
      }

      const response = await axios.put(
        `http://localhost:5000/admin/borrows/${borrowId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Borrow approved successfully! User has been notified.');
        fetchBorrows();
      }
    } catch (error) {
      console.error('Approve error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to approve borrow';
      toast.error(errorMessage);
      
      // Show detailed error if available
      if (error.response?.data?.pendingPenalties) {
        toast.warning(`User has ${error.response.data.pendingPenalties} pending penalty(ies)`);
      }
    }
  };

  const handleReject = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `http://localhost:5000/admin/borrows/${selectedBorrow._id}/reject`,
        { reason: rejectReason },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Borrow request rejected successfully. User has been notified.');
        setRejectModalOpen(false);
        setSelectedBorrow(null);
        setRejectReason('');
        fetchBorrows();
      }
    } catch (error) {
      console.error('Reject error:', error);
      toast.error(error.response?.data?.message || 'Failed to reject borrow');
    }
  };

  const handleDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `http://localhost:5000/admin/borrows/${selectedBorrow._id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Borrow record deleted successfully');
        setDeleteModalOpen(false);
        setSelectedBorrow(null);
        fetchBorrows();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete borrow');
    }
  };

  const confirmReturn = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Prepare data for return
      const returnPayload = {
        condition_on_return: returnData.status === 'Lost' ? null : returnData.condition_on_return,
        status: returnData.status, // 'Returned' or 'Lost'
        notes: returnData.notes
      };
      
      const response = await axios.put(
        `http://localhost:5000/borrow/${selectedBorrow._id}/return`,
        returnPayload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        if (returnData.status === 'Lost') {
          toast.success('Resource marked as lost');
          toast.info('A penalty for the full replacement cost has been applied');
        } else {
          toast.success('Resource returned successfully');
        }
        if (response.data.penalty) {
          toast.warning(`Penalty created: ${response.data.penalty.fine_amount} OMR - ${response.data.penalty.description}`);
        }
        setReturnModalOpen(false);
        setSelectedBorrow(null);
        setReturnData({ condition_on_return: 'Good', status: 'Returned', notes: '' });
        fetchBorrows();
      }
    } catch (error) {
      console.error('Return error:', error);
      toast.error(error.response?.data?.message || 'Failed to return resource');
    }
  };

  const getStatusBadge = (status, dueDate) => {
    const isOverdue = status === 'Active' && new Date(dueDate) < new Date();
    const actualStatus = isOverdue ? 'Overdue' : status;
    
    const statusConfig = {
      'PendingApproval': { 
        bg: '#fff3e0', 
        color: '#ff9800', 
        text: 'Pending Approval',
        icon: <FaHourglassHalf />
      },
      'Active': { 
        bg: '#e8f5e9', 
        color: '#4caf50', 
        text: 'Approved (Active)',
        icon: <FaCheckCircle />
      },
      'Returned': { 
        bg: '#e3f2fd', 
        color: '#1976d2', 
        text: 'Returned',
        icon: <FaCheckCircle />
      },
      'Overdue': { 
        bg: '#ffebee', 
        color: '#f44336', 
        text: 'Overdue',
        icon: <FaExclamationTriangle />
      },
      'Lost': { 
        bg: '#fce4ec', 
        color: '#e91e63', 
        text: 'Lost',
        icon: <FaTimesCircle />
      }
    };
    
    const config = statusConfig[actualStatus] || { 
      bg: '#f5f5f5', 
      color: '#666', 
      text: actualStatus,
      icon: null
    };
    
    return (
      <Badge style={{
        background: config.bg,
        color: config.color,
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        width: 'fit-content'
      }}>
        {config.icon}
        {config.text}
      </Badge>
    );
  };

  const calculateDaysLate = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem' }}>
      <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div>
            <h2 style={{ color: '#333', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Borrows Management
            </h2>
            <p style={{ color: '#666', margin: 0 }}>
              Manage all borrows: approve pending requests, view details, return resources, and track overdue items
            </p>
          </div>
        </Col>
      </Row>

      {/* Filters */}
      <Row className="mb-4">
        <Col md={6}>
          <InputGroup>
            <InputGroupText>
              <FaSearch />
            </InputGroupText>
            <Input
              type="text"
              placeholder="Search by user name, email, or resource name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </InputGroup>
        </Col>
        <Col md={4}>
          <Input
            type="select"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="PendingApproval">Pending Approval</option>
            <option value="Active">Active</option>
            <option value="Returned">Returned</option>
            <option value="Overdue">Overdue</option>
            <option value="Lost">Lost</option>
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

      {/* Borrows Table */}
      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : borrows.length === 0 ? (
            <div className="text-center py-5">
              <FaBookOpen style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
              <p style={{ color: '#666' }}>No borrows found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ margin: 0 }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaBookOpen /> Device
                      </div>
                    </th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaUser /> User
                      </div>
                    </th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaCalendar /> Borrow Date
                      </div>
                    </th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaCalendarTimes /> Return Date
                      </div>
                    </th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaInfoCircle /> Status
                      </div>
                    </th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaDollarSign /> Fine
                      </div>
                    </th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaFileInvoice /> Payment
                      </div>
                    </th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <FaEdit /> Actions
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {borrows.map((borrow) => {
                    const daysLate = borrow.status === 'Active' ? calculateDaysLate(borrow.due_date) : 0;
                    const isOverdue = daysLate > 0;
                    const penalty = borrow.penalty || null;
                    const fineAmount = penalty?.fine_amount || 0;
                    const paymentStatus = penalty?.status || 'Not Required';
                    
                    return (
                      <tr key={borrow._id} style={isOverdue ? { background: '#fff3e0' } : {}}>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <div>
                            <strong style={{ color: '#333', fontSize: '0.95rem' }}>
                              {borrow.resource_id?.name || 'N/A'}
                            </strong>
                            {borrow.resource_id?.category && (
                              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                {borrow.resource_id.category}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <div>
                            <strong style={{ color: '#333', fontSize: '0.95rem' }}>
                              {borrow.user_id?.full_name || 'Not specified'}
                            </strong>
                            {borrow.user_id?.email && (
                              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                {borrow.user_id.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <span style={{ color: '#666', fontSize: '0.9rem' }}>
                            {new Date(borrow.borrow_date).toLocaleDateString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric'
                            })}
                          </span>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <span style={{ color: isOverdue ? '#f44336' : '#666', fontSize: '0.9rem' }}>
                            {borrow.return_date 
                              ? new Date(borrow.return_date).toLocaleDateString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: 'numeric'
                                })
                              : new Date(borrow.due_date).toLocaleDateString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: 'numeric'
                                })}
                          </span>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          {getStatusBadge(borrow.status, borrow.due_date)}
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          {fineAmount > 0 ? (
                            <strong style={{ color: '#333', fontSize: '0.95rem' }}>
                              {fineAmount.toFixed(2)} OMR
                            </strong>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          {paymentStatus === 'Paid' ? (
                            <Badge style={{
                              background: '#e8f5e9',
                              color: '#4caf50',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '20px',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              width: 'fit-content'
                            }}>
                              <FaCheckCircle style={{ fontSize: '0.8rem' }} />
                              Paid
                            </Badge>
                          ) : paymentStatus === 'Pending' ? (
                            <Badge style={{
                              background: '#fff3e0',
                              color: '#ff9800',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '20px',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              width: 'fit-content'
                            }}>
                              <FaClock style={{ fontSize: '0.8rem' }} />
                              Pending
                            </Badge>
                          ) : (
                            <Badge style={{
                              background: '#f5f5f5',
                              color: '#999',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '20px',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              width: 'fit-content'
                            }}>
                              Not Required
                            </Badge>
                          )}
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {borrow.status === 'PendingApproval' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(borrow._id)}
                                  style={{ 
                                    background: '#4caf50', 
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.4rem 0.8rem'
                                  }}
                                  title="Approve Borrow"
                                >
                                  <FaCheck style={{ fontSize: '0.85rem' }} /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedBorrow(borrow);
                                    setRejectModalOpen(true);
                                  }}
                                  style={{ 
                                    background: '#ff9800', 
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.4rem 0.8rem'
                                  }}
                                  title="Reject Borrow"
                                >
                                  <FaTimesCircle style={{ fontSize: '0.85rem' }} /> Reject
                                </Button>
                              </>
                            )}
                            {borrow.status === 'Active' && (
                              <Button
                                size="sm"
                                onClick={() => handleReturn(borrow)}
                                style={{ 
                                  background: '#1976d2', 
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.4rem 0.8rem'
                                }}
                                title="Mark as Returned / Update Status"
                              >
                                <FaEdit style={{ fontSize: '0.85rem' }} /> Mark Return
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleView(borrow)}
                              style={{ 
                                background: '#1976d2', 
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.4rem 0.8rem'
                              }}
                              title="View Details"
                            >
                              <FaEye style={{ fontSize: '0.85rem' }} />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedBorrow(borrow);
                                setDeleteModalOpen(true);
                              }}
                              style={{ 
                                background: '#f44336', 
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.4rem 0.8rem'
                              }}
                              title="Delete Record"
                            >
                              <FaTrash style={{ fontSize: '0.85rem' }} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* View Borrow Modal */}
      <Modal isOpen={viewModalOpen} toggle={() => setViewModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setViewModalOpen(false)}>
          Borrow Details
        </ModalHeader>
        <ModalBody>
          {selectedBorrow && (
            <Row>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  User Information
                </h6>
                <p><strong>Name:</strong> {selectedBorrow.user_id?.full_name || 'N/A'}</p>
                <p><strong>Email:</strong> {selectedBorrow.user_id?.email || 'N/A'}</p>
                <p><strong>Student ID:</strong> {selectedBorrow.user_id?.student_id || 'N/A'}</p>
                <p><strong>Phone:</strong> {selectedBorrow.user_id?.phone || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Resource Information
                </h6>
                <p><strong>Name:</strong> {selectedBorrow.resource_id?.name || 'N/A'}</p>
                <p><strong>Category:</strong> {selectedBorrow.resource_id?.category || 'N/A'}</p>
                <p><strong>Barcode:</strong> {selectedBorrow.resource_id?.barcode || 'N/A'}</p>
                <p><strong>QR Code:</strong> {selectedBorrow.resource_id?.qr_code || 'N/A'}</p>
              </Col>
              <Col md={12} className="mt-3">
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Borrow Information
                </h6>
                <Row>
                  <Col md={6}>
                    <p><strong>Borrow Date:</strong> {new Date(selectedBorrow.borrow_date).toLocaleString()}</p>
                    <p><strong>Due Date:</strong> {new Date(selectedBorrow.due_date).toLocaleString()}</p>
                    <p><strong>Status:</strong> {getStatusBadge(selectedBorrow.status, selectedBorrow.due_date)}</p>
                  </Col>
                  <Col md={6}>
                    <p><strong>Condition on Borrow:</strong> {selectedBorrow.condition_on_borrow}</p>
                    <p><strong>Condition on Return:</strong> {selectedBorrow.condition_on_return || 'N/A'}</p>
                    {selectedBorrow.return_date && (
                      <p><strong>Return Date:</strong> {new Date(selectedBorrow.return_date).toLocaleString()}</p>
                    )}
                    {selectedBorrow.notes && (
                      <p><strong>Notes:</strong> {selectedBorrow.notes}</p>
                    )}
                  </Col>
                </Row>
                {selectedBorrow.status === 'Active' && calculateDaysLate(selectedBorrow.due_date) > 0 && (
                  <Alert color="warning" className="mt-3">
                    <FaExclamationTriangle /> This borrow is {calculateDaysLate(selectedBorrow.due_date)} days overdue!
                  </Alert>
                )}
              </Col>
            </Row>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setViewModalOpen(false)}>
            Close
          </Button>
          {selectedBorrow?.status === 'PendingApproval' && (
            <>
              <Button 
                color="success" 
                onClick={() => {
                  setViewModalOpen(false);
                  handleApprove(selectedBorrow._id);
                }}
              >
                <FaCheck /> Approve Borrow
              </Button>
              <Button 
                color="warning" 
                onClick={() => {
                  setViewModalOpen(false);
                  setRejectModalOpen(true);
                }}
              >
                <FaTimesCircle /> Reject
              </Button>
            </>
          )}
          {selectedBorrow?.status === 'Active' && (
            <Button 
              color="success" 
              onClick={() => {
                setViewModalOpen(false);
                handleReturn(selectedBorrow);
              }}
            >
              <FaEdit /> Mark Return
            </Button>
          )}
        </ModalFooter>
      </Modal>

      {/* Return Resource Modal */}
      <Modal isOpen={returnModalOpen} toggle={() => setReturnModalOpen(false)}>
        <ModalHeader toggle={() => setReturnModalOpen(false)}>
          Return Resource
        </ModalHeader>
        <Form onSubmit={(e) => { e.preventDefault(); confirmReturn(); }}>
          <ModalBody>
            {selectedBorrow && (
              <>
                <Alert color="info">
                  Returning: <strong>{selectedBorrow.resource_id?.name}</strong>
                  <br />
                  Borrowed by: <strong>{selectedBorrow.user_id?.full_name}</strong>
                </Alert>
                <FormGroup>
                  <Label>Return Status *</Label>
                  <Input
                    type="select"
                    value={returnData.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      setReturnData({ 
                        ...returnData, 
                        status: newStatus,
                        condition_on_return: newStatus === 'Lost' ? null : (returnData.condition_on_return || 'Good')
                      });
                    }}
                    required
                  >
                    <option value="Returned">Returned</option>
                    <option value="Lost">Lost (Resource Missing)</option>
                  </Input>
                  {returnData.status === 'Lost' && (
                    <Alert color="danger" className="mt-2">
                      <FaExclamationTriangle /> <strong>Warning:</strong> Selecting "Lost" will apply a full replacement cost penalty based on the resource's replacement cost.
                    </Alert>
                  )}
                </FormGroup>
                {returnData.status === 'Returned' && (
                  <FormGroup>
                    <Label>Condition on Return *</Label>
                    <Input
                      type="select"
                      value={returnData.condition_on_return || 'Good'}
                      onChange={(e) => {
                        const condition = e.target.value;
                        setReturnData({ ...returnData, condition_on_return: condition });
                      }}
                      required
                    >
                      <option value="Excellent">Excellent - No damage</option>
                      <option value="Good">Good - Minor wear</option>
                      <option value="Fair">Fair - Moderate damage (25 OMR penalty)</option>
                      <option value="Poor">Poor - Severe damage (50 OMR penalty)</option>
                    </Input>
                    {returnData.condition_on_return === 'Fair' && (
                      <Alert color="warning" className="mt-2">
                        <FaExclamationTriangle /> A penalty of <strong>25 OMR</strong> will be applied for moderate damage.
                      </Alert>
                    )}
                    {returnData.condition_on_return === 'Poor' && (
                      <Alert color="danger" className="mt-2">
                        <FaExclamationTriangle /> <strong>Warning:</strong> A penalty of <strong>50 OMR</strong> will be applied for severe damage.
                      </Alert>
                    )}
                  </FormGroup>
                )}
                <FormGroup>
                  <Label>Notes</Label>
                  <Input
                    type="textarea"
                    rows="3"
                    value={returnData.notes}
                    onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                    placeholder="Additional notes about the return..."
                  />
                </FormGroup>
                {selectedBorrow.status === 'Active' && calculateDaysLate(selectedBorrow.due_date) > 0 && returnData.status === 'Returned' && (
                  <Alert color="warning">
                    <FaExclamationTriangle /> This resource is {calculateDaysLate(selectedBorrow.due_date)} day(s) overdue.
                    A late return penalty of {(calculateDaysLate(selectedBorrow.due_date) * 0.5).toFixed(2)} OMR will be applied.
                  </Alert>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" color="secondary" onClick={() => setReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" style={{ background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)', border: 'none' }}>
              <FaCheckCircle /> Confirm Return
            </Button>
          </ModalFooter>
        </Form>
      </Modal>

      {/* Reject Borrow Modal */}
      <Modal isOpen={rejectModalOpen} toggle={() => setRejectModalOpen(false)}>
        <ModalHeader toggle={() => setRejectModalOpen(false)}>
          Reject Borrow Request
        </ModalHeader>
        <ModalBody>
          {selectedBorrow && (
            <>
              <Alert color="warning">
                Are you sure you want to reject this borrow request?
                <br />
                <strong>{selectedBorrow.user_id?.full_name}</strong> requested to borrow <strong>{selectedBorrow.resource_id?.name}</strong>
              </Alert>
              <FormGroup className="mt-3">
                <Label>Rejection Reason (Optional)</Label>
                <Input
                  type="textarea"
                  rows="3"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                />
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => {
            setRejectModalOpen(false);
            setRejectReason('');
          }}>
            Cancel
          </Button>
          <Button 
            color="danger" 
            onClick={handleReject}
            style={{ background: '#ff9800', border: 'none' }}
          >
            <FaTimesCircle /> Reject Request
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Borrow Modal */}
      <Modal isOpen={deleteModalOpen} toggle={() => setDeleteModalOpen(false)}>
        <ModalHeader toggle={() => setDeleteModalOpen(false)}>
          Delete Borrow Record
        </ModalHeader>
        <ModalBody>
          {selectedBorrow && (
            <Alert color="danger">
              <strong>Warning:</strong> This action cannot be undone!
              <br /><br />
              Are you sure you want to delete this borrow record?
              <br />
              <strong>User:</strong> {selectedBorrow.user_id?.full_name}
              <br />
              <strong>Resource:</strong> {selectedBorrow.resource_id?.name}
              <br />
              <strong>Status:</strong> {selectedBorrow.status}
              {selectedBorrow.status === 'Active' && (
                <div className="mt-2" style={{ color: '#d32f2f', fontWeight: '600' }}>
                  ⚠️ Active borrows will have their resource quantity restored!
                </div>
              )}
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button 
            color="danger" 
            onClick={handleDelete}
          >
            <FaTrash /> Delete Record
          </Button>
        </ModalFooter>
      </Modal>
      </Container>
    </div>
  );
};

export default AdminBorrows;
