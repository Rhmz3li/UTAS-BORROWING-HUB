import { Container, Row, Col, Card, CardBody, Button, Input, InputGroup, InputGroupText, Modal, ModalHeader, ModalBody, ModalFooter, Badge, Table, Alert, Label, FormGroup } from 'reactstrap';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { FaSearch, FaCheckCircle, FaTimes, FaEye, FaMoneyBillWave, FaExclamationTriangle, FaBan } from 'react-icons/fa';
import { toast } from 'react-toastify';


const AdminPenalties = () => {
  const [penalties, setPenalties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [waiveModalOpen, setWaiveModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState(null);
  const [waiveReason, setWaiveReason] = useState('');

  useEffect(() => {
    fetchPenalties();
  }, [currentPage, searchTerm, selectedStatus, selectedType]);


  const fetchPenalties = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(selectedType && { penalty_type: selectedType })
      };

      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/admin/penalties', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        setPenalties(response.data.data);
        setTotalPages(response.data.pagination.pages);
        setTotal(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Fetch penalties error:', error);
      toast.error('Failed to load penalties');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (penalty) => {
    setSelectedPenalty(penalty);
    setViewModalOpen(true);
  };

  const handleWaive = (penalty) => {
    setSelectedPenalty(penalty);
    setWaiveReason('');
    setWaiveModalOpen(true);
  };

  const handleStatusChange = (penalty) => {
    setSelectedPenalty(penalty);
    setStatusModalOpen(true);
  };

  const waivePenalty = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/admin/penalties/${selectedPenalty._id}/status`,
        {
          status: 'Waived',
          waived_reason: waiveReason || 'Waived by administrator'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Penalty waived successfully');
      setWaiveModalOpen(false);
      setSelectedPenalty(null);
      setWaiveReason('');
      fetchPenalties();
    } catch (error) {
      console.error('Waive error:', error);
      toast.error(error.response?.data?.message || 'Failed to waive penalty');
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/admin/penalties/${selectedPenalty._id}/status`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success(`Penalty status updated to ${newStatus}`);
      setStatusModalOpen(false);
      setSelectedPenalty(null);
      fetchPenalties();
    } catch (error) {
      console.error('Update status error:', error);
      toast.error(error.response?.data?.message || 'Failed to update penalty status');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Pending': { bg: '#fff3e0', color: '#ff9800' },
      'Paid': { bg: '#e8f5e9', color: '#4caf50' },
      'Waived': { bg: '#e1f5fe', color: '#0288d1' },
      'Cancelled': { bg: '#ffebee', color: '#f44336' }
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
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type) => {
    const colors = {
      'Late Return': { bg: '#fff3e0', color: '#ff9800' },
      'Damage': { bg: '#ffebee', color: '#f44336' },
      'Loss': { bg: '#f3e5f5', color: '#9c27b0' }
    };
    const style = colors[type] || { bg: '#f5f5f5', color: '#666' };
    
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
        {type}
      </Badge>
    );
  };

  const getDamageLevelBadge = (level) => {
    if (!level) return null;
    const colors = {
      'Minor': { bg: '#fff3e0', color: '#ff9800' },
      'Moderate': { bg: '#ffebee', color: '#f44336' },
      'Severe': { bg: '#f3e5f5', color: '#9c27b0' },
      'Total Loss': { bg: '#212121', color: '#fff' }
    };
    const style = colors[level] || { bg: '#f5f5f5', color: '#666' };
    
    return (
      <Badge style={{
        background: style.bg,
        color: style.color,
        padding: '0.25rem 0.5rem',
        borderRadius: '8px',
        fontSize: '0.75rem',
        fontWeight: '500'
      }}>
        {level}
      </Badge>
    );
  };

  // Calculate total pending amount
  const totalPendingAmount = penalties
    .filter(p => p.status === 'Pending')
    .reduce((sum, p) => sum + (p.fine_amount || 0), 0);

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem' }}>
      <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div>
            <h2 style={{ color: '#333', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Penalties Management
            </h2>
            <p style={{ color: '#666', margin: 0 }}>
              Manage all penalties: view details, update status, and waive penalties
            </p>
          </div>
        </Col>
        {totalPendingAmount > 0 && (
          <Col md="auto">
            <Card style={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', border: 'none', color: 'white' }}>
              <CardBody className="p-3">
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Total Pending</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {totalPendingAmount.toFixed(2)} OMR
                </div>
              </CardBody>
            </Card>
          </Col>
        )}
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
              placeholder="Search by user name, email, student ID, or description..."
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
            <option value="Paid">Paid</option>
            <option value="Waived">Waived</option>
            <option value="Cancelled">Cancelled</option>
          </Input>
        </Col>
        <Col md={2}>
          <Input
            type="select"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="Late Return">Late Return</option>
            <option value="Damage">Damage</option>
            <option value="Loss">Loss</option>
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

      {/* Penalties Table */}
      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : penalties.length === 0 ? (
            <div className="text-center py-5">
              <FaMoneyBillWave style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
              <p style={{ color: '#666' }}>No penalties found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ margin: 0 }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>User</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Type</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Amount</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Details</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Created</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {penalties.map((penalty) => (
                    <tr key={penalty._id}>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <div>
                          <strong style={{ color: '#333' }}>
                            {penalty.user_id?.full_name || 'N/A'}
                          </strong>
                          {penalty.user_id?.email && (
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              {penalty.user_id.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        {getTypeBadge(penalty.penalty_type)}
                        {penalty.damage_level && (
                          <div className="mt-1">
                            {getDamageLevelBadge(penalty.damage_level)}
                          </div>
                        )}
                        {penalty.days_late > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                            {penalty.days_late} day{penalty.days_late !== 1 ? 's' : ''} late
                          </div>
                        )}
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <strong style={{ color: '#f44336', fontSize: '1.1rem' }}>
                          {penalty.fine_amount?.toFixed(2) || '0.00'} OMR
                        </strong>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <div style={{ maxWidth: '200px' }}>
                          {penalty.description && (
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              {penalty.description.length > 50 
                                ? `${penalty.description.substring(0, 50)}...` 
                                : penalty.description}
                            </div>
                          )}
                          {penalty.borrow_id?.resource_id?.name && (
                            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                              Resource: {penalty.borrow_id.resource_id.name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <span style={{ color: '#666' }}>
                          {new Date(penalty.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        {getStatusBadge(penalty.status)}
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <Button
                            size="sm"
                            onClick={() => handleView(penalty)}
                            style={{ background: '#1976d2', border: 'none' }}
                            title="View Details"
                          >
                            <FaEye />
                          </Button>
                          {penalty.status === 'Pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleWaive(penalty)}
                                style={{ background: '#0288d1', border: 'none' }}
                                title="Waive Penalty"
                              >
                                <FaBan />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleStatusChange(penalty)}
                                style={{ background: '#4caf50', border: 'none' }}
                                title="Mark as Paid"
                              >
                                <FaCheckCircle />
                              </Button>
                            </>
                          )}
                          {penalty.status !== 'Pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(penalty)}
                              style={{ background: '#666', border: 'none' }}
                              title="Change Status"
                            >
                              <FaTimes />
                            </Button>
                          )}
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

      {/* View Penalty Modal */}
      <Modal isOpen={viewModalOpen} toggle={() => setViewModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setViewModalOpen(false)}>
          Penalty Details
        </ModalHeader>
        <ModalBody>
          {selectedPenalty && (
            <Row>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  User Information
                </h6>
                <p><strong>Name:</strong> {selectedPenalty.user_id?.full_name || 'N/A'}</p>
                <p><strong>Email:</strong> {selectedPenalty.user_id?.email || 'N/A'}</p>
                <p><strong>Student ID:</strong> {selectedPenalty.user_id?.student_id || 'N/A'}</p>
                <p><strong>Phone:</strong> {selectedPenalty.user_id?.phone || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Penalty Information
                </h6>
                <p><strong>Type:</strong> {getTypeBadge(selectedPenalty.penalty_type)}</p>
                <p><strong>Amount:</strong> <span style={{ color: '#f44336', fontWeight: 'bold', fontSize: '1.2rem' }}>
                  {selectedPenalty.fine_amount?.toFixed(2) || '0.00'} OMR
                </span></p>
                <p><strong>Status:</strong> {getStatusBadge(selectedPenalty.status)}</p>
                {selectedPenalty.damage_level && (
                  <p><strong>Damage Level:</strong> {getDamageLevelBadge(selectedPenalty.damage_level)}</p>
                )}
                {selectedPenalty.days_late > 0 && (
                  <p><strong>Days Late:</strong> {selectedPenalty.days_late} day{selectedPenalty.days_late !== 1 ? 's' : ''}</p>
                )}
              </Col>
              <Col md={12} className="mt-3">
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Additional Information
                </h6>
                {selectedPenalty.description && (
                  <p><strong>Description:</strong> {selectedPenalty.description}</p>
                )}
                {selectedPenalty.borrow_id?.resource_id?.name && (
                  <p><strong>Resource:</strong> {selectedPenalty.borrow_id.resource_id.name}</p>
                )}
                {selectedPenalty.borrow_id?.due_date && (
                  <p><strong>Due Date:</strong> {new Date(selectedPenalty.borrow_id.due_date).toLocaleDateString()}</p>
                )}
                {selectedPenalty.borrow_id?.return_date && (
                  <p><strong>Return Date:</strong> {new Date(selectedPenalty.borrow_id.return_date).toLocaleDateString()}</p>
                )}
                <p><strong>Created:</strong> {new Date(selectedPenalty.created_at).toLocaleString()}</p>
                {selectedPenalty.paid_at && (
                  <p><strong>Paid At:</strong> {new Date(selectedPenalty.paid_at).toLocaleString()}</p>
                )}
                {selectedPenalty.waived_by && (
                  <>
                    <p><strong>Waived By:</strong> {selectedPenalty.waived_by?.full_name || 'N/A'}</p>
                    <p><strong>Waived Reason:</strong> {selectedPenalty.waived_reason || 'N/A'}</p>
                  </>
                )}
              </Col>
            </Row>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setViewModalOpen(false)}>
            Close
          </Button>
          {selectedPenalty?.status === 'Pending' && (
            <>
              <Button 
                color="info" 
                onClick={() => {
                  setViewModalOpen(false);
                  handleWaive(selectedPenalty);
                }}
              >
                <FaBan /> Waive
              </Button>
              <Button 
                color="success" 
                onClick={() => {
                  setViewModalOpen(false);
                  updateStatus('Paid');
                }}
              >
                <FaCheckCircle /> Mark as Paid
              </Button>
            </>
          )}
        </ModalFooter>
      </Modal>

      {/* Waive Penalty Modal */}
      <Modal isOpen={waiveModalOpen} toggle={() => setWaiveModalOpen(false)}>
        <ModalHeader toggle={() => setWaiveModalOpen(false)}>
          Waive Penalty
        </ModalHeader>
        <ModalBody>
          {selectedPenalty && (
            <>
              <Alert color="info">
                Are you sure you want to waive this penalty?
                <br />
                <strong>User:</strong> {selectedPenalty.user_id?.full_name}
                <br />
                <strong>Amount:</strong> {selectedPenalty.fine_amount?.toFixed(2)} OMR
                <br />
                <strong>Type:</strong> {selectedPenalty.penalty_type}
              </Alert>
              <FormGroup>
                <Label for="waiveReason">Reason (Optional)</Label>
                <Input
                  type="textarea"
                  id="waiveReason"
                  rows="3"
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="Enter reason for waiving this penalty..."
                />
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setWaiveModalOpen(false)}>
            Cancel
          </Button>
          <Button 
            color="info" 
            onClick={waivePenalty}
            style={{ background: 'linear-gradient(135deg, #0288d1 0%, #0277bd 100%)', border: 'none' }}
          >
            <FaBan /> Waive Penalty
          </Button>
        </ModalFooter>
      </Modal>

      {/* Change Status Modal */}
      <Modal isOpen={statusModalOpen} toggle={() => setStatusModalOpen(false)}>
        <ModalHeader toggle={() => setStatusModalOpen(false)}>
          Change Penalty Status
        </ModalHeader>
        <ModalBody>
          {selectedPenalty && (
            <>
              <Alert color="info">
                Current Status: {getStatusBadge(selectedPenalty.status)}
                <br />
                <strong>User:</strong> {selectedPenalty.user_id?.full_name}
                <br />
                <strong>Amount:</strong> {selectedPenalty.fine_amount?.toFixed(2)} OMR
              </Alert>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedPenalty.status !== 'Pending' && (
                  <Button 
                    color="warning" 
                    onClick={() => updateStatus('Pending')}
                    block
                  >
                    Mark as Pending
                  </Button>
                )}
                {selectedPenalty.status !== 'Paid' && (
                  <Button 
                    color="success" 
                    onClick={() => updateStatus('Paid')}
                    block
                  >
                    Mark as Paid
                  </Button>
                )}
                {selectedPenalty.status !== 'Waived' && (
                  <Button 
                    color="info" 
                    onClick={() => {
                      setStatusModalOpen(false);
                      handleWaive(selectedPenalty);
                    }}
                    block
                  >
                    Waive Penalty
                  </Button>
                )}
                {selectedPenalty.status !== 'Cancelled' && (
                  <Button 
                    color="danger" 
                    onClick={() => updateStatus('Cancelled')}
                    block
                  >
                    Cancel Penalty
                  </Button>
                )}
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setStatusModalOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
      </Container>
    </div>
  );
};

export default AdminPenalties;
