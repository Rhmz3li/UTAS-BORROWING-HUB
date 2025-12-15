import { Container, Row, Col, Card, CardBody, Button, Input, InputGroup, InputGroupText, Modal, ModalHeader, ModalBody, ModalFooter, Badge, Table, Alert } from 'reactstrap';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { FaSearch, FaEdit, FaUserCheck, FaUserTimes, FaUserShield, FaUserGraduate, FaUserTie, FaUserCog, FaEye, FaBan, FaTrash, FaUserPlus } from 'react-icons/fa';
import { toast } from 'react-toastify';


const AdminUsers = () => {
  const { user: currentUser } = useSelector((state) => state.auth);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [updateData, setUpdateData] = useState({
    status: '',
    role: ''
  });
  const [newUserData, setNewUserData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'Student',
    student_id: '',
    employee_id: '',
    identification_id: '',
    phone: '',
    department: '',
    status: 'Active'
  });

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, selectedRole, selectedStatus]);


  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedRole && { role: selectedRole }),
        ...(selectedStatus && { status: selectedStatus })
      };

      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        setUsers(response.data.data);
        setTotalPages(response.data.pagination.pages);
        setTotal(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (user) => {
    setSelectedUser(user);
    setViewModalOpen(true);
  };

  const handleStatusChange = (user) => {
    setSelectedUser(user);
    setUpdateData({
      status: user.status,
      role: user.role
    });
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/admin/users/${selectedUser._id}/status`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User updated successfully');
      setStatusModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDelete = (user) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      // Prevent admin from deleting themselves
      if (selectedUser._id === currentUser?._id) {
        toast.error('You cannot delete your own account');
        setDeleteModalOpen(false);
        setSelectedUser(null);
        return;
      }

      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/admin/users/${selectedUser._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted successfully');
      setDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleAddUser = async () => {
    try {
      // Validate required fields
      if (!newUserData.full_name || !newUserData.email || !newUserData.password) {
        toast.error('Please fill in all required fields (Name, Email, Password)');
        return;
      }

      // Set identification_id based on role
      const userPayload = { ...newUserData };
      if (userPayload.role === 'Student') {
        userPayload.identification_id = userPayload.student_id || userPayload.identification_id;
        delete userPayload.employee_id; // Remove employee_id for Students
      } else {
        userPayload.identification_id = userPayload.employee_id || userPayload.identification_id || userPayload.student_id;
        delete userPayload.student_id; // Remove student_id for non-Students if employee_id exists
      }

      // Remove empty fields
      Object.keys(userPayload).forEach(key => {
        if (userPayload[key] === '' || userPayload[key] === null || userPayload[key] === undefined) {
          delete userPayload[key];
        }
      });

      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/register', userPayload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // After successful creation, update status if needed
      if (userPayload.status && userPayload.status !== 'Active') {
        const userId = response.data.user?._id || response.data.user?.id;
        if (userId) {
          await axios.put(`http://localhost:5000/admin/users/${userId}/status`, 
            { status: userPayload.status }, 
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      }

      toast.success('User created successfully');
      setAddUserModalOpen(false);
      setNewUserData({
        full_name: '',
        email: '',
        password: '',
        role: 'Student',
        student_id: '',
        employee_id: '',
        identification_id: '',
        phone: '',
        department: '',
        status: 'Active'
      });
      fetchUsers();
    } catch (error) {
      console.error('Add user error:', error);
      toast.error(error.response?.data?.message || 'Failed to create user');
    }
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'Admin': return FaUserShield;
      case 'Assistant': return FaUserCog;
      case 'Staff': return FaUserTie;
      case 'Student': return FaUserGraduate;
      default: return FaUserCheck;
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'Admin': return { bg: '#f44336', color: '#fff' };
      case 'Assistant': return { bg: '#ff9800', color: '#fff' };
      case 'Staff': return { bg: '#2196f3', color: '#fff' };
      case 'Student': return { bg: '#4caf50', color: '#fff' };
      default: return { bg: '#9e9e9e', color: '#fff' };
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Active': { bg: '#e8f5e9', color: '#4caf50' },
      'Inactive': { bg: '#fff3e0', color: '#ff9800' },
      'Suspended': { bg: '#ffebee', color: '#f44336' }
    };
    const style = colors[status] || { bg: '#f5f5f5', color: '#666' };
    
    return (
      <Badge style={{
        background: style.bg,
        color: style.color,
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '600'
      }}>
        {status}
      </Badge>
    );
  };

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem' }}>
      <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: '#333', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Users Management
              </h2>
              <p style={{ color: '#666', margin: 0 }}>
                Manage all users: view details, update status and roles
              </p>
            </div>
            <Button
              color="primary"
              onClick={() => setAddUserModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                padding: '0.5rem 1.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '600'
              }}
            >
              <FaUserPlus /> Add New User
            </Button>
          </div>
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
              placeholder="Search by name, email, or student ID..."
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
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Assistant">Assistant</option>
            <option value="Staff">Staff</option>
            <option value="Student">Student</option>
          </Input>
        </Col>
        <Col md={2}>
          <Input
            type="select"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
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

      {/* Users Table */}
      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-5">
              <FaUserCheck style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
              <p style={{ color: '#666' }}>No users found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ margin: 0 }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>User</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Email</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Role</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>ID</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Department</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const RoleIcon = getRoleIcon(user.role);
                    const roleColor = getRoleColor(user.role);
                    return (
                      <tr key={user._id}>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: roleColor.bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: roleColor.color
                            }}>
                              <RoleIcon />
                            </div>
                            <div>
                              <strong style={{ color: '#333' }}>{user.full_name}</strong>
                              {user.phone && (
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                  {user.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <span style={{ color: '#666' }}>{user.email}</span>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <Badge style={{
                            background: roleColor.bg,
                            color: roleColor.color,
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}>
                            {user.role}
                          </Badge>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          {getStatusBadge(user.status)}
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <span style={{ color: '#666' }}>
                            {user.role === 'Student' 
                              ? (user.student_id || user.identification_id || 'N/A')
                              : (user.employee_id || user.identification_id || user.student_id || 'N/A')
                            }
                          </span>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                          <span style={{ color: '#666' }}>{user.department || 'N/A'}</span>
                        </td>
                        <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <Button
                              size="sm"
                              onClick={() => handleView(user)}
                              style={{ background: '#1976d2', border: 'none' }}
                              title="View Details"
                            >
                              <FaEye />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(user)}
                              style={{ background: '#ff9800', border: 'none' }}
                              title="Change Status/Role"
                            >
                              <FaEdit />
                            </Button>
                            {user.status === 'Active' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setUpdateData({ ...updateData, status: 'Suspended' });
                                  handleUpdateStatus();
                                }}
                                style={{ background: '#f44336', border: 'none' }}
                                title="Suspend User"
                              >
                                <FaBan />
                              </Button>
                            )}
                            {user._id !== currentUser?._id && (
                              <Button
                                size="sm"
                                onClick={() => handleDelete(user)}
                                style={{ background: '#d32f2f', border: 'none' }}
                                title="Delete User"
                              >
                                <FaTrash />
                              </Button>
                            )}
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

      {/* View User Modal */}
      <Modal isOpen={viewModalOpen} toggle={() => setViewModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setViewModalOpen(false)}>
          User Details
        </ModalHeader>
        <ModalBody>
          {selectedUser && (
            <Row>
              <Col md={6}>
                <p><strong>Full Name:</strong> {selectedUser.full_name}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Phone:</strong> {selectedUser.phone || 'N/A'}</p>
                <p><strong>Student ID:</strong> {selectedUser.student_id || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <p><strong>Role:</strong> 
                  <Badge style={{
                    background: getRoleColor(selectedUser.role).bg,
                    color: getRoleColor(selectedUser.role).color,
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.75rem'
                  }}>
                    {selectedUser.role}
                  </Badge>
                </p>
                <p><strong>Status:</strong> {getStatusBadge(selectedUser.status)}</p>
                <p><strong>Department:</strong> {selectedUser.department || 'N/A'}</p>
                <p><strong>Created:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </Col>
            </Row>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setViewModalOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* Update Status/Role Modal */}
      <Modal isOpen={statusModalOpen} toggle={() => setStatusModalOpen(false)}>
        <ModalHeader toggle={() => setStatusModalOpen(false)}>
          Update User Status & Role
        </ModalHeader>
        <ModalBody>
          {selectedUser && (
            <>
              <Alert color="info">
                Updating: <strong>{selectedUser.full_name}</strong> ({selectedUser.email})
              </Alert>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Status
                </label>
                <Input
                  type="select"
                  value={updateData.status}
                  onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </Input>
              </div>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Role
                </label>
                <Input
                  type="select"
                  value={updateData.role}
                  onChange={(e) => setUpdateData({ ...updateData, role: e.target.value })}
                >
                  <option value="Student">Student</option>
                  <option value="Staff">Staff</option>
                  <option value="Assistant">Assistant</option>
                  <option value="Admin">Admin</option>
                </Input>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setStatusModalOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateStatus}
            style={{ background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)', border: 'none' }}
          >
            Update
          </Button>
        </ModalFooter>
      </Modal>

      {/* Add User Modal */}
      <Modal isOpen={addUserModalOpen} toggle={() => setAddUserModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setAddUserModalOpen(false)}>
          Add New User
        </ModalHeader>
        <ModalBody>
          <Row>
            <Col md={6}>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Full Name <span style={{ color: 'red' }}>*</span>
                </label>
                <Input
                  type="text"
                  value={newUserData.full_name}
                  onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
            </Col>
            <Col md={6}>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Email <span style={{ color: 'red' }}>*</span>
                </label>
                <Input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="user@utas.edu.om"
                />
              </div>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Password <span style={{ color: 'red' }}>*</span>
                </label>
                <Input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
            </Col>
            <Col md={6}>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Phone
                </label>
                <Input
                  type="text"
                  value={newUserData.phone}
                  onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Role <span style={{ color: 'red' }}>*</span>
                </label>
                <Input
                  type="select"
                  value={newUserData.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setNewUserData({ 
                      ...newUserData, 
                      role: role,
                      // Clear ID fields when role changes
                      student_id: role === 'Student' ? newUserData.student_id : '',
                      employee_id: role !== 'Student' ? newUserData.employee_id : ''
                    });
                  }}
                >
                  <option value="Student">Student</option>
                  <option value="Staff">Staff</option>
                  <option value="Assistant">Assistant</option>
                  <option value="Admin">Admin</option>
                </Input>
              </div>
            </Col>
            <Col md={6}>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Status <span style={{ color: 'red' }}>*</span>
                </label>
                <Input
                  type="select"
                  value={newUserData.status}
                  onChange={(e) => setNewUserData({ ...newUserData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </Input>
              </div>
            </Col>
          </Row>
          <Row>
            {newUserData.role === 'Student' ? (
              <Col md={6}>
                <div className="mb-3">
                  <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    Student ID
                  </label>
                  <Input
                    type="text"
                    value={newUserData.student_id}
                    onChange={(e) => {
                      const studentId = e.target.value;
                      setNewUserData({ 
                        ...newUserData, 
                        student_id: studentId,
                        identification_id: studentId || newUserData.identification_id
                      });
                    }}
                    placeholder="e.g., 16J20107"
                  />
                </div>
              </Col>
            ) : (
              <Col md={6}>
                <div className="mb-3">
                  <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    Employee ID
                  </label>
                  <Input
                    type="text"
                    value={newUserData.employee_id}
                    onChange={(e) => {
                      const employeeId = e.target.value;
                      setNewUserData({ 
                        ...newUserData, 
                        employee_id: employeeId,
                        identification_id: employeeId || newUserData.identification_id
                      });
                    }}
                    placeholder="Enter employee ID"
                  />
                </div>
              </Col>
            )}
            <Col md={6}>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Identification ID
                </label>
                <Input
                  type="text"
                  value={newUserData.identification_id}
                  onChange={(e) => setNewUserData({ ...newUserData, identification_id: e.target.value })}
                  placeholder="Auto-filled or enter manually"
                />
              </div>
            </Col>
          </Row>
          <Row>
            <Col md={12}>
              <div className="mb-3">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  Department
                </label>
                <Input
                  type="text"
                  value={newUserData.department}
                  onChange={(e) => setNewUserData({ ...newUserData, department: e.target.value })}
                  placeholder="e.g., College of Information Technology"
                />
              </div>
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => {
            setAddUserModalOpen(false);
            setNewUserData({
              full_name: '',
              email: '',
              password: '',
              role: 'Student',
              student_id: '',
              employee_id: '',
              identification_id: '',
              phone: '',
              department: '',
              status: 'Active'
            });
          }}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onClick={handleAddUser}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none'
            }}
          >
            Create User
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} toggle={() => setDeleteModalOpen(false)}>
        <ModalHeader toggle={() => setDeleteModalOpen(false)}>
          Delete User
        </ModalHeader>
        <ModalBody>
          {selectedUser && (
            <>
              <Alert color="danger">
                <strong>Warning!</strong> This action cannot be undone.
              </Alert>
              <div className="mt-3">
                <p>Are you sure you want to delete this user?</p>
                <div style={{ 
                  background: '#f5f5f5', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  marginTop: '1rem'
                }}>
                  <p style={{ margin: 0, marginBottom: '0.5rem' }}>
                    <strong>Name:</strong> {selectedUser.full_name}
                  </p>
                  <p style={{ margin: 0, marginBottom: '0.5rem' }}>
                    <strong>Email:</strong> {selectedUser.email}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Role:</strong> {selectedUser.role}
                  </p>
                </div>
                {selectedUser._id === currentUser?._id && (
                  <Alert color="warning" className="mt-3">
                    You cannot delete your own account!
                  </Alert>
                )}
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete}
            style={{ background: '#d32f2f', border: 'none' }}
            disabled={selectedUser?._id === currentUser?._id}
          >
            Delete User
          </Button>
        </ModalFooter>
      </Modal>
      </Container>
    </div>
  );
};

export default AdminUsers;
