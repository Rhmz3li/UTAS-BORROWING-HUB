import { Container, Row, Col, Card, CardBody, Button, Input, InputGroup, InputGroupText, Modal, ModalHeader, ModalBody, ModalFooter, Badge, Table, Alert } from 'reactstrap';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { FaSearch, FaCheckCircle, FaTimes, FaEye, FaCalendarCheck, FaExclamationTriangle, FaClock, FaBox, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';


const AdminReservations = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  useEffect(() => {
    fetchReservations();
  }, [currentPage, searchTerm, selectedStatus]);


  const fetchReservations = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus && { status: selectedStatus })
      };

      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/admin/reservations', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        setReservations(response.data.data);
        setTotalPages(response.data.pagination.pages);
        setTotal(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Fetch reservations error:', error);
      toast.error('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (reservation) => {
    setSelectedReservation(reservation);
    setViewModalOpen(true);
  };

  const handleConfirm = (reservation) => {
    setSelectedReservation(reservation);
    setConfirmModalOpen(true);
  };

  const handleCancel = (reservation) => {
    setSelectedReservation(reservation);
    setCancelModalOpen(true);
  };

  const handleApproveBorrow = async (reservationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/admin/reservations/${reservationId}/approve-borrow`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Reservation approved and converted to borrow successfully!');
        fetchReservations();
      }
    } catch (error) {
      console.error('Approve-borrow error:', error);
      toast.error(error.response?.data?.message || 'Failed to convert reservation to borrow');
    }
  };

  const handleDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `http://localhost:5000/admin/reservations/${selectedReservation._id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Reservation deleted successfully');
        setDeleteModalOpen(false);
        setSelectedReservation(null);
        fetchReservations();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete reservation');
    }
  };

  const confirmReservation = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/admin/reservations/${selectedReservation._id}/confirm`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Reservation confirmed successfully');
      setConfirmModalOpen(false);
      setSelectedReservation(null);
      fetchReservations();
    } catch (error) {
      console.error('Confirm error:', error);
      toast.error(error.response?.data?.message || 'Failed to confirm reservation');
    }
  };

  const cancelReservation = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/reservations/${selectedReservation._id}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Reservation cancelled successfully');
      setCancelModalOpen(false);
      setSelectedReservation(null);
      fetchReservations();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel reservation');
    }
  };

  const getStatusBadge = (status, expiryDate) => {
    const isExpired = status === 'Pending' && new Date(expiryDate) < new Date();
    const actualStatus = isExpired ? 'Expired' : status;
    
    const colors = {
      'Pending': { bg: '#fff3e0', color: '#ff9800' },
      'Confirmed': { bg: '#e8f5e9', color: '#4caf50' },
      'Cancelled': { bg: '#ffebee', color: '#f44336' },
      'Expired': { bg: '#fce4ec', color: '#e91e63' },
      'Completed': { bg: '#e3f2fd', color: '#1976d2' }
    };
    const style = colors[actualStatus] || { bg: '#f5f5f5', color: '#666' };
    
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
        {isExpired && <FaExclamationTriangle />}
        {actualStatus}
      </Badge>
    );
  };

  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem' }}>
      <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div>
            <h2 style={{ color: '#333', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Reservations Management
            </h2>
            <p style={{ color: '#666', margin: 0 }}>
              Manage all reservations: view details, confirm, and cancel reservations
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
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Expired">Expired</option>
            <option value="Completed">Completed</option>
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

      {/* Reservations Table */}
      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-5">
              <FaCalendarCheck style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
              <p style={{ color: '#666' }}>No reservations found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ margin: 0 }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>User</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Resource</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Reservation Date</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Pickup Date</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Expiry Date</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => {
                    const expired = isExpired(reservation.expiry_date);
                    
                    return (
                      <tr 
                        key={reservation._id} 
                        style={expired && reservation.status === 'Pending' ? { background: '#fff3e0' } : {}}
                      >
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <div>
                            <strong style={{ color: '#333' }}>
                              {reservation.user_id?.full_name || 'N/A'}
                            </strong>
                            {reservation.user_id?.email && (
                              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                {reservation.user_id.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <div>
                            <strong style={{ color: '#333' }}>
                              {reservation.resource_id?.name || 'N/A'}
                            </strong>
                            {reservation.resource_id?.category && (
                              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                {reservation.resource_id.category}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <span style={{ color: '#666' }}>
                            {new Date(reservation.reservation_date).toLocaleDateString()}
                          </span>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <span style={{ color: '#666' }}>
                            {new Date(reservation.pickup_date).toLocaleDateString()}
                          </span>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: expired ? '#f44336' : '#666' }}>
                              {new Date(reservation.expiry_date).toLocaleDateString()}
                            </span>
                            {expired && <FaExclamationTriangle style={{ color: '#f44336' }} />}
                          </div>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          {getStatusBadge(reservation.status, reservation.expiry_date)}
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <Button
                              size="sm"
                              onClick={() => handleView(reservation)}
                              style={{ background: '#1976d2', border: 'none' }}
                              title="View Details"
                            >
                              <FaEye />
                            </Button>
                            {reservation.status === 'Pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleConfirm(reservation)}
                                  style={{ background: '#4caf50', border: 'none' }}
                                  title="Confirm Reservation"
                                >
                                  <FaCheckCircle /> Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleCancel(reservation)}
                                  style={{ background: '#f44336', border: 'none' }}
                                  title="Cancel Reservation"
                                >
                                  <FaTimes /> Cancel
                                </Button>
                              </>
                            )}
                            {reservation.status === 'Confirmed' && (
                              <Button
                                size="sm"
                                onClick={() => handleApproveBorrow(reservation._id)}
                                style={{ background: '#667eea', border: 'none' }}
                                title="Convert to Borrow"
                              >
                                <FaBox /> Approve Borrow
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedReservation(reservation);
                                setDeleteModalOpen(true);
                              }}
                              style={{ background: '#f44336', border: 'none' }}
                              title="Delete Reservation"
                            >
                              <FaTrash />
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

      {/* View Reservation Modal */}
      <Modal isOpen={viewModalOpen} toggle={() => setViewModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setViewModalOpen(false)}>
          Reservation Details
        </ModalHeader>
        <ModalBody>
          {selectedReservation && (
            <Row>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  User Information
                </h6>
                <p><strong>Name:</strong> {selectedReservation.user_id?.full_name || 'N/A'}</p>
                <p><strong>Email:</strong> {selectedReservation.user_id?.email || 'N/A'}</p>
                <p><strong>Student ID:</strong> {selectedReservation.user_id?.student_id || 'N/A'}</p>
                <p><strong>Phone:</strong> {selectedReservation.user_id?.phone || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Resource Information
                </h6>
                <p><strong>Name:</strong> {selectedReservation.resource_id?.name || 'N/A'}</p>
                <p><strong>Category:</strong> {selectedReservation.resource_id?.category || 'N/A'}</p>
                <p><strong>Barcode:</strong> {selectedReservation.resource_id?.barcode || 'N/A'}</p>
                <p><strong>QR Code:</strong> {selectedReservation.resource_id?.qr_code || 'N/A'}</p>
              </Col>
              <Col md={12} className="mt-3">
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>
                  Reservation Information
                </h6>
                <Row>
                  <Col md={6}>
                    <p><strong>Reservation Date:</strong> {new Date(selectedReservation.reservation_date).toLocaleString()}</p>
                    <p><strong>Pickup Date:</strong> {new Date(selectedReservation.pickup_date).toLocaleString()}</p>
                    <p><strong>Status:</strong> {getStatusBadge(selectedReservation.status, selectedReservation.expiry_date)}</p>
                  </Col>
                  <Col md={6}>
                    <p><strong>Expiry Date:</strong> {new Date(selectedReservation.expiry_date).toLocaleString()}</p>
                    {selectedReservation.notes && (
                      <p><strong>Notes:</strong> {selectedReservation.notes}</p>
                    )}
                    {isExpired(selectedReservation.expiry_date) && selectedReservation.status === 'Pending' && (
                      <Alert color="warning" className="mt-2">
                        <FaExclamationTriangle /> This reservation has expired!
                      </Alert>
                    )}
                  </Col>
                </Row>
              </Col>
            </Row>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setViewModalOpen(false)}>
            Close
          </Button>
          {selectedReservation?.status === 'Pending' && (
            <>
              <Button 
                color="success" 
                onClick={() => {
                  setViewModalOpen(false);
                  handleConfirm(selectedReservation);
                }}
              >
                <FaCheckCircle /> Confirm
              </Button>
              <Button 
                color="danger" 
                onClick={() => {
                  setViewModalOpen(false);
                  handleCancel(selectedReservation);
                }}
              >
                <FaTimes /> Cancel
              </Button>
            </>
          )}
          {selectedReservation?.status === 'Confirmed' && (
            <Button 
              color="primary" 
              onClick={() => {
                setViewModalOpen(false);
                handleApproveBorrow(selectedReservation._id);
              }}
            >
              <FaBox /> Convert to Borrow
            </Button>
          )}
        </ModalFooter>
      </Modal>

      {/* Confirm Reservation Modal */}
      <Modal isOpen={confirmModalOpen} toggle={() => setConfirmModalOpen(false)}>
        <ModalHeader toggle={() => setConfirmModalOpen(false)}>
          Confirm Reservation
        </ModalHeader>
        <ModalBody>
          {selectedReservation && (
            <Alert color="info">
              Are you sure you want to confirm this reservation?
              <br />
              <strong>User:</strong> {selectedReservation.user_id?.full_name}
              <br />
              <strong>Resource:</strong> {selectedReservation.resource_id?.name}
              <br />
              <strong>Pickup Date:</strong> {new Date(selectedReservation.pickup_date).toLocaleDateString()}
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setConfirmModalOpen(false)}>
            Cancel
          </Button>
          <Button 
            color="success" 
            onClick={confirmReservation}
            style={{ background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)', border: 'none' }}
          >
            <FaCheckCircle /> Confirm
          </Button>
        </ModalFooter>
      </Modal>

      {/* Cancel Reservation Modal */}
      <Modal isOpen={cancelModalOpen} toggle={() => setCancelModalOpen(false)}>
        <ModalHeader toggle={() => setCancelModalOpen(false)}>
          Cancel Reservation
        </ModalHeader>
        <ModalBody>
          {selectedReservation && (
            <Alert color="warning">
              Are you sure you want to cancel this reservation?
              <br />
              <strong>User:</strong> {selectedReservation.user_id?.full_name}
              <br />
              <strong>Resource:</strong> {selectedReservation.resource_id?.name}
              <br />
              This action cannot be undone.
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setCancelModalOpen(false)}>
            No, Keep It
          </Button>
          <Button 
            color="danger" 
            onClick={cancelReservation}
            style={{ background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)', border: 'none' }}
          >
            <FaTimes /> Yes, Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Reservation Modal */}
      <Modal isOpen={deleteModalOpen} toggle={() => setDeleteModalOpen(false)}>
        <ModalHeader toggle={() => setDeleteModalOpen(false)}>
          Delete Reservation
        </ModalHeader>
        <ModalBody>
          {selectedReservation && (
            <Alert color="danger">
              <strong>Warning:</strong> This action cannot be undone!
              <br /><br />
              Are you sure you want to delete this reservation?
              <br />
              <strong>User:</strong> {selectedReservation.user_id?.full_name}
              <br />
              <strong>Resource:</strong> {selectedReservation.resource_id?.name}
              <br />
              <strong>Status:</strong> {selectedReservation.status}
              {selectedReservation.status === 'Confirmed' && (
                <div className="mt-2" style={{ color: '#d32f2f', fontWeight: '600' }}>
                  ⚠️ Confirmed reservations will have their resource quantity restored!
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
            <FaTrash /> Delete Reservation
          </Button>
        </ModalFooter>
      </Modal>
      </Container>
    </div>
  );
};

export default AdminReservations;
