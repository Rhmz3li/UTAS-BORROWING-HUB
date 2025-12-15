import { Container, Row, Col, Card, CardBody, Button, Input, InputGroup, InputGroupText, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Badge, Table, Alert } from 'reactstrap';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaBox, FaEye, FaTimes, FaLaptop, FaMobileAlt, FaFlask, FaBook, FaVideo, FaFolder, FaBuilding, FaGraduationCap, FaMicroscope, FaCogs, FaBriefcase, FaPalette } from 'react-icons/fa';
import { toast } from 'react-toastify';


const AdminResources = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [collegeStats, setCollegeStats] = useState({});
  const [availableCategories, setAvailableCategories] = useState(['IT', 'Electronics', 'Lab Equipment', 'Books', 'Media', 'Other']);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'IT',
    college: 'General',
    department: '',
    status: 'Available',
    location: '',
    condition: 'Good',
    max_borrow_days: 7,
    total_quantity: 1,
    available_quantity: 1,
    barcode: '',
    qr_code: '',
    image: ''
  });

  useEffect(() => {
    fetchResources();
    fetchCollegeStats();
    fetchAvailableCategories();
  }, [currentPage, searchTerm, selectedCategory, selectedCollege, selectedStatus]);

  const fetchAvailableCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/resources', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          limit: 1000 // Get all resources to extract unique categories
        }
      });

      if (response.data.success) {
        const categories = new Set(['IT', 'Electronics', 'Lab Equipment', 'Books', 'Media', 'Other']);
        response.data.data.forEach(resource => {
          if (resource.category) {
            categories.add(resource.category);
          }
        });
        setAvailableCategories(Array.from(categories).sort());
      }
    } catch (error) {
      console.error('Fetch categories error:', error);
    }
  };


  const fetchResources = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const params = {
        page: currentPage,
        limit: 10,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedCollege && { college: selectedCollege }),
        ...(selectedStatus && { status: selectedStatus })
      };

      const response = await axios.get('http://localhost:5000/resources', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
      });

      if (response.data.success) {
        setResources(response.data.data);
        setTotalPages(response.data.pagination.pages);
        setTotal(response.data.pagination.total);
      } else {
        toast.error(response.data.message || 'Failed to load resources');
        setResources([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (error) {
      console.error('Fetch resources error:', error);
      toast.error(error.response?.data?.message || 'Failed to load resources');
      setResources([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollegeStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const colleges = ['General', 'Information Technology', 'Science', 'Engineering', 'Business Studies', 'Creative Industries'];
      const stats = {};

      // Fetch count for each college
      for (const college of colleges) {
        try {
          const response = await axios.get('http://localhost:5000/resources', {
            headers: {
              Authorization: `Bearer ${token}`
            },
            params: {
              college: college,
              limit: 1
            }
          });
          if (response.data.success) {
            stats[college] = response.data.pagination.total || 0;
          }
        } catch (error) {
          stats[college] = 0;
        }
      }

      setCollegeStats(stats);
    } catch (error) {
      console.error('Fetch college stats error:', error);
    }
  };

  const handleAddNew = () => {
    setSelectedResource(null);
    setFormData({
      name: '',
      description: '',
      category: 'IT',
      college: 'General',
      status: 'Available',
      location: '',
      condition: 'Good',
      max_borrow_days: 7,
      total_quantity: 1,
      available_quantity: 1,
      barcode: '',
      qr_code: '',
      image: ''
    });
    setModalOpen(true);
  };

  const handleEdit = (resource) => {
    setSelectedResource(resource);
    setFormData({
      name: resource.name || '',
      description: resource.description || '',
      category: resource.category || 'IT',
      college: resource.college || 'General',
      department: resource.department || '',
      status: resource.status || 'Available',
      location: resource.location || '',
      condition: resource.condition || 'Good',
      max_borrow_days: resource.max_borrow_days || 7,
      total_quantity: resource.total_quantity || 1,
      available_quantity: resource.available_quantity || 1,
      barcode: resource.barcode || '',
      qr_code: resource.qr_code || '',
      image: resource.image || ''
    });
    setModalOpen(true);
  };

  const handleView = (resource) => {
    setSelectedResource(resource);
    setViewModalOpen(true);
  };

  const handleDelete = (resource) => {
    setSelectedResource(resource);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/resources/${selectedResource._id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      toast.success('Resource deleted successfully');
      setDeleteModalOpen(false);
      setSelectedResource(null);
      fetchResources();
      fetchCollegeStats();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete resource');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Add new category to available categories if it doesn't exist
      if (formData.category && !availableCategories.includes(formData.category.trim())) {
        setAvailableCategories([...availableCategories, formData.category.trim()].sort());
      }
      
      if (selectedResource) {
        // Update
        await axios.put(`http://localhost:5000/resources/${selectedResource._id}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        toast.success('Resource updated successfully');
      } else {
        // Create
        await axios.post('http://localhost:5000/resources', formData, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        toast.success('Resource created successfully');
      }
      
      setModalOpen(false);
      setSelectedResource(null);
      fetchResources();
      fetchCollegeStats();
      fetchAvailableCategories(); // Refresh categories after adding/updating resource
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.message || 'Failed to save resource');
    }
  };

  const handleStatusToggle = async (resource) => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = resource.status === 'Available' ? 'Maintenance' : 'Available';
      
      await axios.put(`http://localhost:5000/resources/${resource._id}`, {
        ...resource,
        status: newStatus
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      toast.success(`Resource ${newStatus === 'Available' ? 'activated' : 'deactivated'} successfully`);
      fetchResources();
      fetchCollegeStats();
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error('Failed to update resource status');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Available': { bg: '#e8f5e9', color: '#4caf50' },
      'Borrowed': { bg: '#fff3e0', color: '#ff9800' },
      'Reserved': { bg: '#e3f2fd', color: '#1976d2' },
      'Maintenance': { bg: '#ffebee', color: '#f44336' },
      'Lost': { bg: '#fce4ec', color: '#e91e63' }
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

  const getCollegeIcon = (college) => {
    const icons = {
      'General': FaBuilding,
      'Information Technology': FaLaptop,
      'Science': FaMicroscope,
      'Engineering': FaCogs,
      'Business Studies': FaBriefcase,
      'Creative Industries': FaPalette
    };
    return icons[college] || FaBuilding;
  };

  const getCollegeColor = (college) => {
    const colors = {
      'General': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '#667eea' },
      'Information Technology': { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', icon: '#f5576c' },
      'Science': { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '#4facfe' },
      'Engineering': { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '#43e97b' },
      'Business Studies': { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '#fa709a' },
      'Creative Industries': { bg: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', icon: '#30cfd0' }
    };
    return colors[college] || { bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', icon: '#a8edea' };
  };

  const handleCollegeClick = (college) => {
    setSelectedCollege(college === selectedCollege ? '' : college);
    setCurrentPage(1);
  };

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem' }}>
      <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ color: '#333', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Resources Management
              </h2>
              <p style={{ color: '#666', margin: 0 }}>
                Manage all resources: add, edit, delete, and update status
              </p>
            </div>
            <Button
              onClick={handleAddNew}
              style={{
                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FaPlus /> Add New Resource
            </Button>
          </div>
        </Col>
      </Row>

      {/* College Statistics Cards */}
      <Row className="mb-4">
        <Col>
          <h5 style={{ color: '#333', fontWeight: '600', marginBottom: '1rem' }}>
            Resources by College
          </h5>
        </Col>
      </Row>
      <Row className="mb-4">
        {['General', 'Information Technology', 'Science', 'Engineering', 'Business Studies', 'Creative Industries'].map((college) => {
          const Icon = getCollegeIcon(college);
          const colors = getCollegeColor(college);
          const count = collegeStats[college] || 0;
          const isSelected = selectedCollege === college;

          return (
            <Col md={6} lg={4} xl={2} key={college} className="mb-3">
              <Card
                style={{
                  background: isSelected ? colors.bg : '#fff',
                  border: isSelected ? 'none' : '1px solid #e0e0e0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: isSelected ? '0 4px 15px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  height: '100%'
                }}
                onClick={() => handleCollegeClick(college)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  }
                }}
              >
                <CardBody style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{
                    fontSize: '2rem',
                    color: isSelected ? '#fff' : colors.icon,
                    marginBottom: '0.75rem',
                    display: 'flex',
                    justifyContent: 'center'
                  }}>
                    <Icon />
                  </div>
                  <h6 style={{
                    color: isSelected ? '#fff' : '#333',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem',
                    lineHeight: '1.3'
                  }}>
                    {college}
                  </h6>
                  <div style={{
                    fontSize: '1.75rem',
                    fontWeight: 'bold',
                    color: isSelected ? '#fff' : colors.icon,
                    marginTop: '0.5rem'
                  }}>
                    {count}
                  </div>
                  <small style={{
                    color: isSelected ? 'rgba(255,255,255,0.9)' : '#666',
                    fontSize: '0.75rem'
                  }}>
                    {count === 1 ? 'Resource' : 'Resources'}
                  </small>
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>


      {/* Filters */}
      <Row className="mb-4">
        <Col md={4}>
          <InputGroup>
            <InputGroupText>
              <FaSearch />
            </InputGroupText>
            <Input
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </InputGroup>
        </Col>
        <Col md={3}>
          <div style={{ position: 'relative' }}>
            <Input
              type="text"
              list="filter-category-list"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter by category..."
              style={{
                paddingRight: '2.5rem'
              }}
            />
            <datalist id="filter-category-list">
              <option value="">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <div style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#666',
              fontSize: '0.85rem'
            }}>
              <FaBox />
            </div>
            {selectedCategory && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedCategory('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: '35px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#666',
                  padding: '0',
                  fontSize: '0.75rem'
                }}
                title="Clear filter"
              >
                <FaTimes />
              </Button>
            )}
          </div>
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
            <option value="Available">Available</option>
            <option value="Borrowed">Borrowed</option>
            <option value="Reserved">Reserved</option>
            <option value="Maintenance">Maintenance</option>
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

      {/* Resources Table */}
      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : resources.length === 0 ? (
            <div className="text-center py-5">
              <FaBox style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
              <p style={{ color: '#666' }}>No resources found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ margin: 0 }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Name</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Serial Number</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Category</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Status</th>
                    <th style={{ border: 'none', padding: '1rem', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((resource) => (
                    <tr key={resource._id}>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <div>
                          <strong style={{ color: '#333', fontSize: '0.95rem' }}>{resource.name}</strong>
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <span style={{ color: '#666', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {resource.barcode || resource.qr_code || 'N/A'}
                        </span>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <Badge style={{ 
                          background: '#e3f2fd', 
                          color: '#1976d2', 
                          padding: '0.4rem 0.8rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          {resource.category}
                        </Badge>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        {getStatusBadge(resource.status)}
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <Button
                            size="sm"
                            onClick={() => handleEdit(resource)}
                            style={{ 
                              background: '#1976d2', 
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.8rem'
                            }}
                            title="Edit"
                          >
                            <FaEdit style={{ fontSize: '0.85rem' }} />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDelete(resource)}
                            style={{ 
                              background: '#f44336', 
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.8rem'
                            }}
                            title="Delete"
                          >
                            <FaTrash style={{ fontSize: '0.85rem' }} />
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

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setModalOpen(false)}>
          {selectedResource ? 'Edit Resource' : 'Add New Resource'}
        </ModalHeader>
        <Form onSubmit={handleSubmit}>
          <ModalBody>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Resource Name *</Label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Category *</Label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type="text"
                      list="category-list"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Type or select a category..."
                      required
                      style={{
                        paddingRight: '2.5rem'
                      }}
                    />
                    <datalist id="category-list">
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                    <div style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: '#666',
                      fontSize: '0.85rem'
                    }}>
                      <FaBox />
                    </div>
                  </div>
                  {formData.category && !availableCategories.includes(formData.category) && (
                    <small style={{ color: '#1976d2', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      ✓ New category will be added: "{formData.category}"
                    </small>
                  )}
                </FormGroup>
                <FormGroup>
                  <Label>College *</Label>
                  <Input
                    type="select"
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    required
                  >
                    <option value="General">General</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Science">Science</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Business Studies">Business Studies</option>
                    <option value="Creative Industries">Creative Industries</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Department</Label>
              <Input
                type="select"
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="">Select Department</option>
                <option value="College of Information Technology">College of Information Technology</option>
                <option value="College of Science">College of Science</option>
                <option value="College of Engineering">College of Engineering</option>
                <option value="College of Business Studies">College of Business Studies</option>
                <option value="College of Creative Industries">College of Creative Industries</option>
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>Description</Label>
              <Input
                type="textarea"
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </FormGroup>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Status *</Label>
                  <Input
                    type="select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    required
                  >
                    <option value="Available">Available</option>
                    <option value="Borrowed">Borrowed</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Lost">Lost</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Condition</Label>
                  <Input
                    type="select"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={4}>
                <FormGroup>
                  <Label>Total Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.total_quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setFormData({ 
                        ...formData, 
                        total_quantity: val,
                        available_quantity: Math.min(formData.available_quantity, val)
                      });
                    }}
                    required
                  />
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label>Available Quantity *</Label>
                  <Input
                    type="number"
                    min="0"
                    max={formData.total_quantity}
                    value={formData.available_quantity}
                    onChange={(e) => setFormData({ ...formData, available_quantity: parseInt(e.target.value) || 0 })}
                    required
                  />
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label>Max Borrow Days</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.max_borrow_days}
                    onChange={(e) => setFormData({ ...formData, max_borrow_days: parseInt(e.target.value) || 7 })}
                  />
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Location</Label>
                  <Input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Image URL</Label>
                  <Input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Barcode</Label>
                  <Input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>QR Code</Label>
                  <Input
                    type="text"
                    value={formData.qr_code}
                    onChange={(e) => setFormData({ ...formData, qr_code: e.target.value })}
                  />
                </FormGroup>
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button type="button" color="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" style={{ background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)', border: 'none' }}>
              {selectedResource ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewModalOpen} toggle={() => setViewModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setViewModalOpen(false)}>
          Resource Details
        </ModalHeader>
        <ModalBody>
          {selectedResource && (
            <Row>
              <Col md={6}>
                <p><strong>Name:</strong> {selectedResource.name}</p>
                <p><strong>Category:</strong> {selectedResource.category}</p>
                <p><strong>Status:</strong> {getStatusBadge(selectedResource.status)}</p>
                <p><strong>Condition:</strong> {selectedResource.condition}</p>
                <p><strong>Location:</strong> {selectedResource.location || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <p><strong>Total Quantity:</strong> {selectedResource.total_quantity}</p>
                <p><strong>Available Quantity:</strong> {selectedResource.available_quantity}</p>
                <p><strong>Max Borrow Days:</strong> {selectedResource.max_borrow_days}</p>
                <p><strong>Barcode:</strong> {selectedResource.barcode || 'N/A'}</p>
                <p><strong>QR Code:</strong> {selectedResource.qr_code || 'N/A'}</p>
              </Col>
              {selectedResource.description && (
                <Col md={12}>
                  <p><strong>Description:</strong></p>
                  <p>{selectedResource.description}</p>
                </Col>
              )}
              {selectedResource.image && (
                <Col md={12}>
                  <p><strong>Image:</strong></p>
                  <img src={selectedResource.image} alt={selectedResource.name} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                </Col>
              )}
            </Row>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setViewModalOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} toggle={() => setDeleteModalOpen(false)}>
        <ModalHeader toggle={() => setDeleteModalOpen(false)}>
          Confirm Delete
        </ModalHeader>
        <ModalBody>
          <Alert color="warning">
            Are you sure you want to delete <strong>{selectedResource?.name}</strong>?
            <br />
            This action cannot be undone.
          </Alert>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button color="danger" onClick={confirmDelete}>
            Delete
          </Button>
        </ModalFooter>
      </Modal>
      </Container>
    </div>
  );
};

export default AdminResources;
