import { Container, Row, Col, Card, CardBody, Button, Input, InputGroup, InputGroupText, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Badge, Table, Alert, Spinner, FormFeedback } from 'reactstrap';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaBox, FaEye, FaTimes, FaLaptop, FaMobileAlt, FaFlask, FaBook, FaVideo, FaFolder, FaBuilding, FaGraduationCap, FaMicroscope, FaCogs, FaBriefcase, FaPalette, FaQrcode } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { QRCodeSVG } from 'qrcode.react';


const AdminResources = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [validatingCodes, setValidatingCodes] = useState(false);
  const [identifiersLocked, setIdentifiersLocked] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const VALID_COLLEGES = [
    'General',
    'Information Technology',
    'Science',
    'Engineering',
    'Business Studies',
    'Creative Industries'
  ];
  const VALID_STATUSES = ['Available', 'Borrowed', 'Reserved', 'Maintenance', 'Lost'];
  const VALID_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

  const clearFieldError = (field) => {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  /** Letters, numbers, hyphen, underscore; 3–64 chars (e.g. UBH-ABC123XY). */
  const IDENTIFIER_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;

  const validateBarcodeQrFields = (barcodeRaw, qrRaw) => {
    const errors = {};
    const barcode = String(barcodeRaw || '').trim();
    const qrCode = String(qrRaw || '').trim();

    const checkSingle = (value, label, key) => {
      if (!value) return;
      if (/\s/.test(value)) {
        errors[key] = `${label} cannot contain spaces.`;
        return;
      }
      if (value.length < 3) {
        errors[key] = `${label} must be at least 3 characters.`;
        return;
      }
      if (value.length > 64) {
        errors[key] = `${label} must be 64 characters or less.`;
        return;
      }
      if (!IDENTIFIER_CODE_RE.test(value)) {
        errors[key] = `${label}: use letters, numbers, hyphens, and underscores only (e.g. UBH-ABC123XY).`;
      }
    };

    checkSingle(barcode, 'Barcode', 'barcode');
    checkSingle(qrCode, 'QR code', 'qr_code');

    if (!errors.barcode && !errors.qr_code && (barcode || qrCode)) {
      if (barcode && !qrCode) {
        errors.qr_code = 'QR code is required and must match the barcode.';
      } else if (qrCode && !barcode) {
        errors.barcode = 'Barcode is required and must match the QR code.';
      } else if (barcode !== qrCode) {
        errors.barcode = 'Barcode and QR code must be the same value.';
        errors.qr_code = 'Barcode and QR code must be the same value.';
      }
    }

    return errors;
  };

  const applyIdentifierValidation = () => {
    const idErrors = validateBarcodeQrFields(formData.barcode, formData.qr_code);
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.barcode;
      delete next.qr_code;
      return { ...next, ...idErrors };
    });
  };

  const verifyIdentifierNotInUse = async (code, resourceId) => {
    const trimmed = String(code || '').trim();
    if (!trimmed) return null;
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const res = await axios.get(
        `http://localhost:5000/resources/scan/${encodeURIComponent(trimmed)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const existing = res.data?.data;
      if (existing && (!resourceId || String(existing._id) !== String(resourceId))) {
        const label = existing.name ? `"${existing.name}"` : 'another resource';
        return `This code is already used by ${label}. Use Generate or enter a different code.`;
      }
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw err;
    }
    return null;
  };

  const validateResourceForm = () => {
    const errors = {};
    const name = String(formData.name || '').trim();
    if (!name) errors.name = 'Resource name is required.';
    else if (name.length < 2) errors.name = 'Name must be at least 2 characters.';
    else if (name.length > 200) errors.name = 'Name must be 200 characters or less.';

    const category = String(formData.category || '').trim();
    if (!category) errors.category = 'Category is required.';
    else if (category.length > 100) errors.category = 'Category is too long (max 100 characters).';

    if (!formData.college || !VALID_COLLEGES.includes(formData.college)) {
      errors.college = 'Please select a college.';
    }

    if (!VALID_STATUSES.includes(formData.status)) {
      errors.status = 'Please select a valid status.';
    }

    if (formData.condition && !VALID_CONDITIONS.includes(formData.condition)) {
      errors.condition = 'Please select a valid condition.';
    }

    const description = String(formData.description || '');
    if (description.length > 2000) {
      errors.description = 'Description is too long (max 2000 characters).';
    }

    const totalQty = Number(formData.total_quantity);
    if (!Number.isFinite(totalQty) || !Number.isInteger(totalQty) || totalQty < 1) {
      errors.total_quantity = 'Total quantity must be a whole number of at least 1.';
    }

    const availQty = Number(formData.available_quantity);
    if (!Number.isFinite(availQty) || !Number.isInteger(availQty) || availQty < 0) {
      errors.available_quantity = 'Available quantity must be a whole number of 0 or more.';
    } else if (
      Number.isFinite(totalQty) &&
      Number.isInteger(totalQty) &&
      totalQty >= 1 &&
      availQty > totalQty
    ) {
      errors.available_quantity = 'Available quantity cannot be greater than total quantity.';
    }

    const maxDays = Number(formData.max_borrow_days);
    if (!Number.isFinite(maxDays) || !Number.isInteger(maxDays) || maxDays < 1) {
      errors.max_borrow_days = 'Max borrow days must be at least 1.';
    } else if (maxDays > 365) {
      errors.max_borrow_days = 'Max borrow days cannot exceed 365.';
    }

    if (formData.requires_payment) {
      const amt = Number(formData.payment_amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        errors.payment_amount = 'Enter a security deposit greater than 0 OMR.';
      } else if (amt > 10) {
        errors.payment_amount = 'Security deposit cannot exceed 10 OMR.';
      }
    }

    const location = String(formData.location || '').trim();
    if (location.length > 200) {
      errors.location = 'Location is too long (max 200 characters).';
    }

    const image = String(formData.image || '').trim();
    if (image) {
      try {
        const parsed = new URL(image);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errors.image = 'Image URL must use http:// or https://';
        }
      } catch {
        errors.image = 'Enter a valid URL (e.g. https://example.com/image.jpg).';
      }
    }

    Object.assign(errors, validateBarcodeQrFields(formData.barcode, formData.qr_code));

    return errors;
  };

  const closeResourceModal = () => {
    setModalOpen(false);
    setFormErrors({});
  };
  
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
    image: '',
    requires_payment: false,
    payment_amount: 0
  });

  useEffect(() => {
    fetchResources();
    fetchCollegeStats();
    fetchAvailableCategories();
  }, [currentPage, searchTerm, selectedCategory, selectedCollege, selectedStatus]);

  // Open Add New Resource when scan finds no device
  useEffect(() => {
    const scannedBarcode =
      location.state?.openAddWithBarcode != null && location.state?.openAddWithBarcode !== ''
        ? String(location.state.openAddWithBarcode).trim()
        : location.state?.openAddFromScan != null && location.state?.openAddFromScan !== ''
          ? String(location.state.openAddFromScan).trim()
          : '';
    if (!scannedBarcode) return;
    navigate(location.pathname, { replace: true, state: {} });
    setSelectedResource(null);
    setIdentifiersLocked(false);
    setFormData({
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
      barcode: scannedBarcode,
      qr_code: '',
      image: '',
      requires_payment: false,
      payment_amount: 0
    });
    setModalOpen(true);
    toast.info(`Barcode "${scannedBarcode}" filled from scan. Enter QR code separately if needed.`);
  }, [location.state, location.pathname, navigate]);

  // Open Add New Resource when QR code scan finds no device — fill only qr_code field
  useEffect(() => {
    const scannedQR =
      location.state?.openAddWithQRCode != null && location.state?.openAddWithQRCode !== ''
        ? String(location.state.openAddWithQRCode).trim()
        : '';
    if (!scannedQR) return;
    navigate(location.pathname, { replace: true, state: {} });
    setSelectedResource(null);
    setIdentifiersLocked(false);
    setFormData({
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
      qr_code: scannedQR,
      image: '',
      requires_payment: false,
      payment_amount: 0
    });
    setModalOpen(true);
    toast.info(`QR code "${scannedQR}" filled from scan. Enter barcode separately if needed.`);
  }, [location.state, location.pathname, navigate]);

  // Open edit modal when arriving from scan (View Details / Edit Resource)
  useEffect(() => {
    const resourceFromScan = location.state?.openEditResource;
    const resourceId = location.state?.openEditResourceId;
    if (!resourceFromScan && !resourceId) return;

    navigate(location.pathname, { replace: true, state: {} });

    const openEditFromScan = async () => {
      if (resourceFromScan?._id) {
        await handleEdit(resourceFromScan);
        return;
      }
      const token = localStorage.getItem('token');
      if (!token || !resourceId) return;
      try {
        const res = await axios.get(
          `http://localhost:5000/resources/scan/${encodeURIComponent(String(resourceId))}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data?.success && res.data?.data) {
          await handleEdit(res.data.data);
        } else {
          toast.error('Resource not found');
        }
      } catch {
        toast.error('Could not open resource for editing');
      }
    };

    openEditFromScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.openEditResource, location.state?.openEditResourceId]);

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
    setIdentifiersLocked(false);
    setFormErrors({});
    setFormData({
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
      image: '',
      requires_payment: false,
      payment_amount: 0
    });
    setModalOpen(true);
  };

  const handleEdit = async (resource) => {
    let locked = ['Borrowed', 'Reserved'].includes(resource.status);
    const token = localStorage.getItem('token');
    const lookup = resource.qr_code || resource.barcode || resource._id;
    if (token && lookup && !locked) {
      try {
        const res = await axios.get(
          `http://localhost:5000/resources/scan/${encodeURIComponent(String(lookup))}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data?.activeBorrow) locked = true;
      } catch {
        /* ignore scan errors; fields stay editable */
      }
    }
    setIdentifiersLocked(locked);
    setFormErrors({});
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
      image: resource.image || '',
      requires_payment: !!resource.requires_payment,
      payment_amount: typeof resource.payment_amount === 'number'
        ? Math.min(Math.max(resource.payment_amount, 0), 10)
        : 0
    });
    setModalOpen(true);
  };

  const handleView = (resource) => {
    setSelectedResource(resource);
    setViewModalOpen(true);
  };

  const handleGenerateUniqueCodes = async () => {
    if (generatingCodes) return;
    if (identifiersLocked && selectedResource) {
      toast.warning('Barcode and QR cannot be changed while this resource is borrowed or has a pending borrow.');
      return;
    }
    if (selectedResource && (formData.barcode || formData.qr_code)) {
      if (!window.confirm('Replace existing barcode and QR code with new unique values?')) return;
    }
    try {
      setGeneratingCodes(true);
      const token = localStorage.getItem('token');
      const body = {};
      if (selectedResource?._id) {
        body.resource_id = selectedResource._id;
        body.replace = !!(formData.barcode || formData.qr_code);
      }
      const res = await axios.post('http://localhost:5000/admin/resources/generate-codes', body, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const c = res.data?.codes;
      if (c?.barcode) {
        setFormData((fd) => ({ ...fd, barcode: c.barcode, qr_code: c.qr_code }));
        if (res.data?.data && selectedResource?._id) {
          setSelectedResource(res.data.data);
        }
        toast.success(
          selectedResource?._id
            ? 'Unique barcode and QR value saved on this resource.'
            : 'Codes generated. Click Create to save the new resource with these codes.'
        );
        if (selectedResource?._id) {
          fetchResources();
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate codes');
    } finally {
      setGeneratingCodes(false);
    }
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
    const errors = validateResourceForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please fix the highlighted fields before saving.');
      return;
    }
    setFormErrors({});

    const payload = {
      ...formData,
      name: String(formData.name || '').trim(),
      category: String(formData.category || '').trim(),
      description: String(formData.description || '').trim(),
      location: String(formData.location || '').trim(),
      image: String(formData.image || '').trim(),
      barcode: String(formData.barcode || '').trim(),
      qr_code: String(formData.qr_code || '').trim(),
      department: formData.department || '',
      total_quantity: Number(formData.total_quantity),
      available_quantity: Number(formData.available_quantity),
      max_borrow_days: Number(formData.max_borrow_days),
      payment_amount: formData.requires_payment ? Number(formData.payment_amount) : 0
    };

    if (payload.barcode) {
      setValidatingCodes(true);
      try {
        const duplicateMsg = await verifyIdentifierNotInUse(payload.barcode, selectedResource?._id);
        if (duplicateMsg) {
          setFormErrors({ barcode: duplicateMsg, qr_code: duplicateMsg });
          toast.error(duplicateMsg);
          return;
        }
      } catch (checkErr) {
        console.error('Code uniqueness check failed:', checkErr);
        toast.error('Could not verify barcode/QR uniqueness. Try again.');
        return;
      } finally {
        setValidatingCodes(false);
      }
    }

    try {
      const token = localStorage.getItem('token');
      
      // Add new category to available categories if it doesn't exist
      if (payload.category && !availableCategories.includes(payload.category)) {
        setAvailableCategories([...availableCategories, payload.category].sort());
      }
      
      if (selectedResource) {
        // Update
        await axios.put(`http://localhost:5000/resources/${selectedResource._id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        toast.success('Resource updated successfully');
      } else {
        // Create
        await axios.post('http://localhost:5000/resources', payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        toast.success('Resource created successfully');
      }
      
      closeResourceModal();
      setSelectedResource(null);
      fetchResources();
      fetchCollegeStats();
      fetchAvailableCategories(); // Refresh categories after adding/updating resource
    } catch (error) {
      console.error('Submit error:', error);
      const msg = error.response?.data?.message || 'Failed to save resource';
      if (/barcode|qr\s*code|qr_code/i.test(msg)) {
        setFormErrors((prev) => ({ ...prev, barcode: msg, qr_code: msg }));
      }
      toast.error(msg);
    }
  };

  const handleStatusToggle = async (resource) => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = resource.status === 'Available' ? 'Maintenance' : 'Available';
      
      await axios.put(`http://localhost:5000/resources/${resource._id}`, { status: newStatus }, {
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
      'Available': { color: '#2e7d32' },
      'Borrowed': { color: '#c77700' },
      'Reserved': { color: '#1565c0' },
      'Maintenance': { color: '#c62828' },
      'Lost': { color: '#ad1457' }
    };
    const style = colors[status] || { color: '#4b5563' };
    
    return (
      <span style={{
        color: style.color,
        fontSize: '0.85rem',
        fontWeight: '600'
      }}>
        {status}
      </span>
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
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'var(--bg-secondary)', padding: '2rem', transition: 'all 0.3s ease' }}>
      <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Resources Management
              </h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
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
          <h5 style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '1rem' }}>
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
                  background: isSelected ? colors.bg : 'var(--card-bg)',
                  border: isSelected ? 'none' : '1px solid var(--border-color)',
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
                    color: isSelected ? '#fff' : 'var(--text-primary)',
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
                    color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)',
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
              color: 'var(--text-secondary)',
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
                  color: 'var(--text-secondary)',
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
            background: 'var(--card-bg)', 
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <strong style={{ color: '#1976d2' }}>{total}</strong> Total
          </div>
        </Col>
      </Row>

      {/* Resources Table */}
      <Card className="border-0 shadow-sm" style={{ backgroundColor: 'var(--card-bg)' }}>
        <CardBody className="p-0" style={{ backgroundColor: 'var(--card-bg)' }}>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : resources.length === 0 ? (
            <div className="text-center py-5">
              <FaBox style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No resources found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ margin: 0 }}>
                <thead style={{ background: 'var(--bg-tertiary)' }}>
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
                          <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{resource.name}</strong>
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {resource.barcode || resource.qr_code || 'N/A'}
                        </span>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        <span style={{
                          color: '#355c7d',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          {resource.category}
                        </span>
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                        {getStatusBadge(resource.status)}
                      </td>
                      <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <Button
                            size="sm"
                            onClick={() => handleView(resource)}
                            style={{
                              background: '#0288d1',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.8rem'
                            }}
                            title="View details (read only)"
                          >
                            <FaEye style={{ fontSize: '0.85rem' }} />
                          </Button>
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
              <span style={{ padding: '0.5rem 1rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
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
      <Modal isOpen={modalOpen} toggle={closeResourceModal} size="lg">
        <ModalHeader toggle={closeResourceModal}>
          {selectedResource ? 'Edit Resource' : 'Add New Resource'}
        </ModalHeader>
        <Form onSubmit={handleSubmit}>
          <ModalBody>
            {Object.keys(formErrors).length > 0 && (
              <Alert color="danger" className="py-2 small">
                Please correct the highlighted fields below before {selectedResource ? 'updating' : 'creating'} the resource.
              </Alert>
            )}
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Resource Name *</Label>
                  <Input
                    type="text"
                    value={formData.name}
                    invalid={!!formErrors.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      clearFieldError('name');
                    }}
                  />
                  {formErrors.name && <FormFeedback>{formErrors.name}</FormFeedback>}
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
                      invalid={!!formErrors.category}
                      onChange={(e) => {
                        setFormData({ ...formData, category: e.target.value });
                        clearFieldError('category');
                      }}
                      placeholder="Type or select a category..."
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
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem'
                    }}>
                      <FaBox />
                    </div>
                  </div>
                  {formErrors.category && <FormFeedback className="d-block">{formErrors.category}</FormFeedback>}
                  {formData.category && !availableCategories.includes(formData.category) && !formErrors.category && (
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
                    invalid={!!formErrors.college}
                    onChange={(e) => {
                      setFormData({ ...formData, college: e.target.value });
                      clearFieldError('college');
                    }}
                  >
                    <option value="General">General</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Science">Science</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Business Studies">Business Studies</option>
                    <option value="Creative Industries">Creative Industries</option>
                  </Input>
                  {formErrors.college && <FormFeedback>{formErrors.college}</FormFeedback>}
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
                invalid={!!formErrors.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  clearFieldError('description');
                }}
              />
              {formErrors.description && <FormFeedback>{formErrors.description}</FormFeedback>}
            </FormGroup>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Status *</Label>
                  <Input
                    type="select"
                    value={formData.status}
                    invalid={!!formErrors.status}
                    onChange={(e) => {
                      setFormData({ ...formData, status: e.target.value });
                      clearFieldError('status');
                    }}
                  >
                    <option value="Available">Available</option>
                    <option value="Borrowed">Borrowed</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Lost">Lost</option>
                  </Input>
                  {formErrors.status && <FormFeedback>{formErrors.status}</FormFeedback>}
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Condition</Label>
                  <Input
                    type="select"
                    value={formData.condition}
                    invalid={!!formErrors.condition}
                    onChange={(e) => {
                      setFormData({ ...formData, condition: e.target.value });
                      clearFieldError('condition');
                    }}
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </Input>
                  {formErrors.condition && <FormFeedback>{formErrors.condition}</FormFeedback>}
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
                    step="1"
                    value={formData.total_quantity}
                    invalid={!!formErrors.total_quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const total = Number.isFinite(val) && val >= 1 ? val : 1;
                      setFormData({
                        ...formData,
                        total_quantity: total,
                        available_quantity: Math.min(formData.available_quantity, total)
                      });
                      clearFieldError('total_quantity');
                      clearFieldError('available_quantity');
                    }}
                  />
                  {formErrors.total_quantity && <FormFeedback>{formErrors.total_quantity}</FormFeedback>}
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label>Available Quantity *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    max={formData.total_quantity}
                    value={formData.available_quantity}
                    invalid={!!formErrors.available_quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setFormData({
                        ...formData,
                        available_quantity: Number.isFinite(val) && val >= 0 ? val : 0
                      });
                      clearFieldError('available_quantity');
                    }}
                  />
                  {formErrors.available_quantity && <FormFeedback>{formErrors.available_quantity}</FormFeedback>}
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label>Max Borrow Days</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={formData.max_borrow_days}
                    invalid={!!formErrors.max_borrow_days}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setFormData({
                        ...formData,
                        max_borrow_days: Number.isFinite(val) && val >= 1 ? val : 1
                      });
                      clearFieldError('max_borrow_days');
                    }}
                  />
                  {formErrors.max_borrow_days && <FormFeedback>{formErrors.max_borrow_days}</FormFeedback>}
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <FormGroup check>
                  <Label check>
                    <Input
                      type="checkbox"
                      checked={formData.requires_payment}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requires_payment: e.target.checked,
                          payment_amount: e.target.checked ? (formData.payment_amount || 1) : 0
                        })
                      }
                    />{' '}
                    Require security deposit (refundable)
                  </Label>
                  <small className="text-muted d-block mt-1">
                    If enabled, students must pay a security deposit before their borrow request is accepted.
                  </small>
                </FormGroup>
              </Col>
            </Row>
            {formData.requires_payment && (
              <Row className="mt-3">
                <Col md={6}>
                  <FormGroup>
                    <Label>Security Deposit (OMR, max 10)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={formData.payment_amount}
                      invalid={!!formErrors.payment_amount}
                      onChange={(e) => {
                        let val = parseFloat(e.target.value);
                        if (Number.isNaN(val)) val = 0;
                        if (val < 0) val = 0;
                        if (val > 10) val = 10;
                        setFormData({ ...formData, payment_amount: val });
                        clearFieldError('payment_amount');
                      }}
                    />
                    {formErrors.payment_amount && <FormFeedback>{formErrors.payment_amount}</FormFeedback>}
                    <small className="text-muted">
                      This amount (up to 10 OMR) will be held as a security deposit and can be used to cover penalties.
                    </small>
                  </FormGroup>
                </Col>
              </Row>
            )}
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Location</Label>
                  <Input
                    type="text"
                    value={formData.location}
                    invalid={!!formErrors.location}
                    onChange={(e) => {
                      setFormData({ ...formData, location: e.target.value });
                      clearFieldError('location');
                    }}
                  />
                  {formErrors.location && <FormFeedback>{formErrors.location}</FormFeedback>}
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Image URL</Label>
                  <Input
                    type="url"
                    value={formData.image}
                    invalid={!!formErrors.image}
                    onChange={(e) => {
                      setFormData({ ...formData, image: e.target.value });
                      clearFieldError('image');
                    }}
                    placeholder="https://example.com/image.jpg"
                  />
                  {formErrors.image && <FormFeedback>{formErrors.image}</FormFeedback>}
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                {identifiersLocked && selectedResource && (
                  <Alert color="secondary" className="py-2 small mb-2">
                    Barcode and QR are locked: this resource is <strong>borrowed / reserved</strong> or has an{' '}
                    <strong>active borrow</strong>. They unlock after the item is returned and borrows are cleared.
                  </Alert>
                )}
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>
                    Barcode
                    {!selectedResource && formData.barcode && (
                      <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#1565c0', fontWeight: 600 }}>
                        ✓ Scanned
                      </span>
                    )}
                  </Label>
                  <Input
                    type="text"
                    value={formData.barcode}
                    invalid={!!formErrors.barcode}
                    maxLength={64}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\s/g, '');
                      const syncIdentifiers = !(identifiersLocked && selectedResource);
                      setFormData({
                        ...formData,
                        barcode: v,
                        ...(syncIdentifiers ? { qr_code: v } : {})
                      });
                      clearFieldError('barcode');
                      clearFieldError('qr_code');
                    }}
                    onBlur={applyIdentifierValidation}
                    disabled={identifiersLocked && !!selectedResource}
                    style={!selectedResource && formData.barcode ? { borderColor: '#1565c0', background: '#e8f0fe' } : {}}
                    placeholder="e.g. UBH-ABC123XY (3–64 chars)"
                  />
                  {formErrors.barcode && <FormFeedback>{formErrors.barcode}</FormFeedback>}
                  {!formErrors.barcode && (
                    <small className="text-muted d-block">Letters, numbers, hyphen, underscore. Must match QR code.</small>
                  )}
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>QR Code</Label>
                  <Input
                    type="text"
                    value={formData.qr_code}
                    invalid={!!formErrors.qr_code}
                    maxLength={64}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\s/g, '');
                      const syncIdentifiers = !(identifiersLocked && selectedResource);
                      setFormData({
                        ...formData,
                        qr_code: v,
                        ...(syncIdentifiers ? { barcode: v } : {})
                      });
                      clearFieldError('barcode');
                      clearFieldError('qr_code');
                    }}
                    onBlur={applyIdentifierValidation}
                    disabled={identifiersLocked && !!selectedResource}
                    placeholder="Same value as barcode"
                  />
                  {formErrors.qr_code && <FormFeedback>{formErrors.qr_code}</FormFeedback>}
                  {!formErrors.qr_code && (
                    <small className="text-muted d-block">Must be identical to barcode for scanning.</small>
                  )}
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <Button
                  type="button"
                  color="info"
                  outline
                  className="d-flex align-items-center gap-2"
                  onClick={handleGenerateUniqueCodes}
                  disabled={generatingCodes || (identifiersLocked && !!selectedResource)}
                  title="Assigns the same unique value to Barcode and QR for scanning and labels"
                >
                  {generatingCodes ? <Spinner size="sm" /> : <FaQrcode />}
                  Generate unique codes (barcode + QR)
                </Button>
                <small className="text-muted d-block mt-1">
                  Barcode and QR must always be the same value. This button creates one code (e.g. UBH-…) and saves it to both fields. For existing resources with codes, you will be asked to confirm replace.
                </small>
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button type="button" color="secondary" onClick={closeResourceModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={validatingCodes}
              style={{ background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)', border: 'none' }}
            >
              {validatingCodes ? (
                <>
                  <Spinner size="sm" className="me-1" /> Checking code…
                </>
              ) : selectedResource ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewModalOpen} toggle={() => setViewModalOpen(false)} size="lg">
        <ModalHeader toggle={() => setViewModalOpen(false)}>
          <span className="d-flex align-items-center gap-2">
            <FaEye /> Resource Details
          </span>
        </ModalHeader>
        <ModalBody style={{ background: 'var(--card-bg)' }}>
          {selectedResource && (
            <Row>
              <Col md={12} className="mb-2">
                <Alert color="light" className="mb-0 py-2 small" style={{ border: '1px solid var(--border-color)' }}>
                  View only — use <strong>Edit</strong> from the list to change this resource.
                </Alert>
              </Col>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>General</h6>
                <p><strong>Name:</strong> {selectedResource.name}</p>
                <p><strong>Category:</strong> {selectedResource.category}</p>
                <p><strong>College:</strong> {selectedResource.college || 'N/A'}</p>
                <p><strong>Department:</strong> {selectedResource.department || 'N/A'}</p>
                <p><strong>Status:</strong> {getStatusBadge(selectedResource.status)}</p>
                <p><strong>Condition:</strong> {selectedResource.condition || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>Inventory &amp; borrowing</h6>
                <p><strong>Location:</strong> {selectedResource.location || 'N/A'}</p>
                <p><strong>Total quantity:</strong> {selectedResource.total_quantity ?? 'N/A'}</p>
                <p><strong>Available quantity:</strong> {selectedResource.available_quantity ?? 'N/A'}</p>
                <p><strong>Max borrow days:</strong> {selectedResource.max_borrow_days ?? 'N/A'}</p>
                <p>
                  <strong>Security deposit:</strong>{' '}
                  {selectedResource.requires_payment && selectedResource.payment_amount > 0
                    ? `${Math.min(selectedResource.payment_amount, 10).toFixed(2)} OMR`
                    : 'Not required'}
                </p>
                <p>
                  <strong>Replacement cost (loss):</strong>{' '}
                  {selectedResource.replacement_cost != null
                    ? `${Number(selectedResource.replacement_cost).toFixed(2)} OMR`
                    : 'N/A'}
                </p>
              </Col>
              <Col md={12} className="mt-3">
                <h6 style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#1976d2' }}>Identifiers</h6>
                <Row>
                  <Col md={6}>
                    <p><strong>Barcode:</strong>{' '}
                      <code style={{ fontSize: '0.9rem' }}>{selectedResource.barcode || 'N/A'}</code>
                    </p>
                    <p><strong>QR code:</strong>{' '}
                      <code style={{ fontSize: '0.9rem' }}>{selectedResource.qr_code || 'N/A'}</code>
                    </p>
                  </Col>
                  <Col md={6}>
                    {(selectedResource.qr_code || selectedResource.barcode || selectedResource._id) && (
                      <div
                        className="p-3 rounded d-inline-block"
                        style={{ background: 'var(--bg-tertiary)' }}
                      >
                        <p className="small text-muted mb-2"><strong>Label preview</strong></p>
                        <QRCodeSVG
                          value={String(selectedResource.qr_code || selectedResource.barcode || selectedResource._id)}
                          size={140}
                          level="M"
                          includeMargin
                        />
                      </div>
                    )}
                  </Col>
                </Row>
              </Col>
              {selectedResource.description && (
                <Col md={12} className="mt-3">
                  <h6 style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#1976d2' }}>Description</h6>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{selectedResource.description}</p>
                </Col>
              )}
              {selectedResource.image && (
                <Col md={12} className="mt-3">
                  <h6 style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#1976d2' }}>Image</h6>
                  <img
                    src={selectedResource.image}
                    alt={selectedResource.name}
                    style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', objectFit: 'contain' }}
                  />
                </Col>
              )}
              {(selectedResource.created_at || selectedResource.updated_at) && (
                <Col md={12} className="mt-3">
                  <p className="small text-muted mb-0">
                    {selectedResource.created_at && (
                      <>Created: {new Date(selectedResource.created_at).toLocaleString()}</>
                    )}
                    {selectedResource.updated_at && (
                      <>
                        {selectedResource.created_at ? ' · ' : ''}
                        Updated: {new Date(selectedResource.updated_at).toLocaleString()}
                      </>
                    )}
                  </p>
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
