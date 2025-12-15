import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, CardText, Button, Input, InputGroup, InputGroupText, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Label, FormGroup } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchDevices } from "../redux/reducers/deviceReducer";
import { addReservation } from "../redux/reducers/reservationReducer";
import { addBorrowing } from "../redux/reducers/borrowingReducer";
import { FaSearch, FaBox, FaCalendarCheck, FaLaptop, FaMicroscope, FaTools, FaChartLine, FaPalette, FaMapMarkerAlt, FaClock } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';

const Resources = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const { devices: resources, isLoading } = useSelector((state) => state.devices);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [availableCategories, setAvailableCategories] = useState(['IT', 'Electronics', 'Lab Equipment', 'Books', 'Media', 'Other']);
    const [borrowModal, setBorrowModal] = useState(false);
    const [reserveModal, setReserveModal] = useState(false);
    const [selectedResource, setSelectedResource] = useState(null);
    const [borrowData, setBorrowData] = useState({
        due_date: '',
        condition_on_borrow: 'Good',
        terms_accepted: false
    });
    const [reserveData, setReserveData] = useState({
        pickup_date: '',
        expiry_date: '',
        terms_accepted: false
    });
    const [isBorrowing, setIsBorrowing] = useState(false);
    const [isReserving, setIsReserving] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        dispatch(fetchDevices());
        fetchCategories();
    }, [dispatch, user, navigate]);

    const fetchCategories = async () => {
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

    const filteredResources = Array.isArray(resources) ? resources.filter(resource => {
        const matchesSearch = !searchTerm || 
            resource.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            resource.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !selectedCategory || resource.category === selectedCategory;
        return matchesSearch && matchesCategory && resource.status === 'Available';
    }) : [];

    const getCategoryIcon = (category) => {
        switch(category) {
            case 'IT': return FaLaptop;
            case 'Lab Equipment': return FaMicroscope;
            case 'Electronics': return FaTools;
            case 'Books': return FaChartLine;
            default: return FaBox;
        }
    };

    const handleBorrowClick = (resource) => {
        setSelectedResource(resource);
        // Set default due date (7 days from now or resource max_borrow_days)
        const defaultDays = resource.max_borrow_days || 7;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + defaultDays);
        setBorrowData({
            due_date: dueDate.toISOString().split('T')[0],
            condition_on_borrow: resource.condition || 'Good', // Use resource's current condition
            terms_accepted: false
        });
        setBorrowModal(true);
    };

    const handleReserveClick = (resource) => {
        setSelectedResource(resource);
        // Set default pickup date (tomorrow)
        const pickupDate = new Date();
        pickupDate.setDate(pickupDate.getDate() + 1);
        // Set default expiry date (pickup date + max_borrow_days or 7 days)
        const defaultDays = resource.max_borrow_days || 7;
        const expiryDate = new Date(pickupDate);
        expiryDate.setDate(expiryDate.getDate() + defaultDays);
        setReserveData({
            pickup_date: pickupDate.toISOString().split('T')[0],
            expiry_date: expiryDate.toISOString().split('T')[0],
            terms_accepted: false
        });
        setReserveModal(true);
    };

    const handleReserveSubmit = async () => {
        if (!reserveData.terms_accepted) {
            toast.error('Please accept the terms and conditions to proceed');
            return;
        }
        if (!reserveData.pickup_date) {
            toast.error('Please select a pickup date');
            return;
        }
        if (!reserveData.expiry_date) {
            toast.error('Please select an expiry date');
            return;
        }
        if (new Date(reserveData.expiry_date) <= new Date(reserveData.pickup_date)) {
            toast.error('Expiry date must be after pickup date');
            return;
        }

        try {
            setIsReserving(true);
            await dispatch(addReservation({
                resource_id: selectedResource._id,
                pickup_date: new Date(reserveData.pickup_date).toISOString(),
                expiry_date: new Date(reserveData.expiry_date).toISOString(),
                terms_accepted: true
            })).unwrap();
            
            toast.success(
                `Reservation request submitted successfully! ⏳ Pending admin approval. The resource will be reserved for future pickup.`,
                { autoClose: 6000 }
            );
            setReserveModal(false);
            setSelectedResource(null);
            setReserveData({
                pickup_date: '',
                expiry_date: '',
                terms_accepted: false
            });
            dispatch(fetchDevices()); // Refresh resources
        } catch (error) {
            // Handle error from rejectWithValue (payload) or regular error (message)
            let errorMessage = 'Failed to create reservation';
            if (error?.payload) {
                errorMessage = error.payload;
            } else if (error?.message) {
                errorMessage = error.message;
            } else if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            toast.error(errorMessage);
        } finally {
            setIsReserving(false);
        }
    };

    const handleBorrowSubmit = async () => {
        if (!borrowData.terms_accepted) {
            toast.error('Please accept the terms and conditions to proceed');
            return;
        }
        if (!borrowData.due_date) {
            toast.error('Please select a due date');
            return;
        }

        try {
            setIsBorrowing(true);
            // Use Redux action to add borrowing - this will update Redux store
            await dispatch(addBorrowing({
                deviceId: selectedResource._id,
                returnDate: borrowData.due_date,
                conditionBefore: borrowData.condition_on_borrow || 'Good'
            })).unwrap();

            const location = selectedResource.location || 'IT Borrowing Hub - Lab 2';
            toast.success(
                `Borrow request submitted successfully! Pending admin approval. You will be notified when approved. Pickup location: ${location}`,
                { autoClose: 6000 }
            );
            setBorrowModal(false);
            setSelectedResource(null);
            setBorrowData({
                due_date: '',
                condition_on_borrow: 'Good',
                terms_accepted: false
            });
            dispatch(fetchDevices()); // Refresh resources
            // Don't navigate - the borrow is already added to Redux store and will appear in My Borrows page
        } catch (error) {
            console.error('Borrow error:', error);
            // Handle error from rejectWithValue (payload) or regular error (message)
            let errorMessage = 'Failed to borrow resource';
            if (error?.payload) {
                errorMessage = error.payload;
            } else if (error?.message) {
                errorMessage = error.message;
            } else if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            toast.error(errorMessage);
        } finally {
            setIsBorrowing(false);
        }
    };

    return (
        <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', transition: 'all 0.3s ease' }}>
            <Container fluid className="py-4">
            {/* Header Section */}
            <Row className="mb-4">
                <Col>
                    <Card className="border-0 shadow-lg" style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '20px',
                        overflow: 'hidden'
                    }}>
                        <CardBody className="p-4 text-white">
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <h2 style={{ color: '#fff', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '2rem' }}>
                                        Browse Resources
                                    </h2>
                                    <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: '1.1rem' }}>
                                        Discover and borrow available resources easily
                                    </p>
                                </Col>
                                <Col md={4} className="text-end">
                                    <div style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '15px',
                                        padding: '1.5rem',
                                        display: 'inline-block'
                                    }}>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                            {filteredResources.length}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                            Available Now
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Search and Filter Section */}
            <Row className="mb-4">
                <Col md={8}>
                    <Card className="border-0 shadow-sm">
                        <CardBody className="p-3">
                            <InputGroup style={{ border: 'none' }}>
                                <InputGroupText style={{ 
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '10px 0 0 10px'
                                }}>
                                    <FaSearch />
                                </InputGroupText>
                                <Input
                                    type="text"
                                    placeholder="Search by name or description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        border: '2px solid #e0e0e0',
                                        borderRadius: '0 10px 10px 0',
                                        padding: '0.75rem',
                                        fontSize: '1rem'
                                    }}
                                />
                            </InputGroup>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-0 shadow-sm">
                        <CardBody className="p-3">
                            <Input
                                type="text"
                                list="resource-category-options"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                placeholder="Filter by category..."
                                style={{
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    fontSize: '1rem'
                                }}
                            />
                            <datalist id="resource-category-options">
                                <option value="">All Categories</option>
                                {availableCategories.map((category) => (
                                    <option key={category} value={category} />
                                ))}
                            </datalist>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {isLoading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : (
                <Row>
                    {filteredResources.length > 0 ? (
                        filteredResources.map((resource) => {
                            const CategoryIcon = getCategoryIcon(resource.category);
                            const imageUrl = resource.image || (resource.images && resource.images.length > 0 ? resource.images[0] : null);
                            
                            return (
                                <Col md={4} lg={3} key={resource._id} className="mb-4">
                                    <Card 
                                        className="h-100 border-0"
                                        style={{
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            overflow: 'hidden',
                                            borderRadius: '20px',
                                            background: '#fff',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                            border: '1px solid rgba(102, 126, 234, 0.1)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-10px)';
                                            e.currentTarget.style.boxShadow = '0 16px 40px rgba(102, 126, 234, 0.25)';
                                            e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                                            e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.1)';
                                        }}
                                    >
                                        {/* Image Section */}
                                        <div 
                                            style={{
                                                height: '220px',
                                                background: imageUrl 
                                                    ? `url(${imageUrl}) center/cover no-repeat`
                                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {!imageUrl && (
                                                <CategoryIcon 
                                                    size={70} 
                                                    style={{ 
                                                        color: '#fff',
                                                        opacity: 0.9,
                                                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                                                    }} 
                                                />
                                            )}
                                            {imageUrl && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '15px',
                                                    right: '15px',
                                                    background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                                                    borderRadius: '25px',
                                                    padding: '0.4rem 0.9rem',
                                                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)'
                                                }}>
                                                    <Badge style={{ 
                                                        fontSize: '0.8rem',
                                                        fontWeight: '600',
                                                        background: 'transparent',
                                                        color: '#fff',
                                                        padding: 0
                                                    }}>
                                                        {resource.available_quantity} Available
                                                    </Badge>
                                                </div>
                                            )}
                                            {/* Overlay gradient */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                height: '60px',
                                                background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)'
                                            }} />
                                        </div>
                                        
                                        <CardBody style={{ padding: '1rem' }}>
                                            <CardTitle 
                                                tag="h6" 
                                                className="mb-2"
                                                style={{
                                                    fontWeight: 'bold',
                                                    color: '#333',
                                                    fontSize: '1rem',
                                                    lineHeight: '1.4',
                                                    minHeight: '2.8rem',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {resource.name}
                                            </CardTitle>
                                            
                                            <CardText 
                                                className="text-muted small mb-2"
                                                style={{
                                                    fontSize: '0.85rem',
                                                    minHeight: '2.5rem',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {resource.description || 'No description available'}
                                            </CardText>
                                            
                                            <div className="mb-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <Badge 
                                                    color="primary" 
                                                    style={{ 
                                                        fontSize: '0.75rem',
                                                        padding: '0.35rem 0.65rem'
                                                    }}
                                                >
                                                    {resource.category}
                                                </Badge>
                                                {!imageUrl && (
                                                    <Badge 
                                                        color="success"
                                                        style={{ 
                                                            fontSize: '0.75rem',
                                                            padding: '0.35rem 0.65rem'
                                                        }}
                                                    >
                                                        Available: {resource.available_quantity}
                                                    </Badge>
                                                )}
                                                {resource.location && (
                                                    <Badge 
                                                        color="info"
                                                        style={{ 
                                                            fontSize: '0.75rem',
                                                            padding: '0.35rem 0.65rem'
                                                        }}
                                                    >
                                                        📍 {resource.location}
                                                    </Badge>
                                                )}
                                            </div>
                                            
                                            <div className="d-flex gap-2" style={{ marginTop: '0.5rem' }}>
                                                <Button 
                                                    color="primary" 
                                                    block 
                                                    size="sm" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleBorrowClick(resource);
                                                    }}
                                                    style={{
                                                        fontWeight: '600',
                                                        fontSize: '0.875rem',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        padding: '0.6rem',
                                                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                    title="Borrow this resource now"
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                                                    }}
                                                >
                                                    <FaBox className="me-1" />Borrow
                                                </Button>
                                                <Button 
                                                    color="info" 
                                                    block 
                                                    size="sm"
                                                    title="⏳ Reserve - Requires Admin Approval: Reserve for future pickup, borrow period starts when picked up" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleReserveClick(resource);
                                                    }}
                                                    style={{
                                                        fontWeight: '600',
                                                        fontSize: '0.875rem',
                                                        background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        padding: '0.6rem',
                                                        boxShadow: '0 4px 12px rgba(23, 162, 184, 0.3)',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(23, 162, 184, 0.4)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(23, 162, 184, 0.3)';
                                                    }}
                                                >
                                                    <FaCalendarCheck className="me-1" />Reserve
                                                </Button>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </Col>
                            );
                        })
                    ) : (
                        <Col>
                            <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                                <CardBody className="text-center py-5">
                                    <div style={{
                                        width: '120px',
                                        height: '120px',
                                        margin: '0 auto 1.5rem',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <FaBox size={50} style={{ color: '#fff' }} />
                                    </div>
                                    <h4 style={{ color: '#2c3e50', marginBottom: '0.5rem' }}>No Resources Found</h4>
                                    <p style={{ color: '#7f8c8d', margin: 0 }}>
                                        Try adjusting your search or filter criteria
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>
                    )}
                </Row>
            )}

            {/* Borrow Modal */}
            <Modal isOpen={borrowModal} toggle={() => setBorrowModal(false)} centered>
                <ModalHeader toggle={() => setBorrowModal(false)} style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    borderBottom: 'none'
                }}>
                    <FaBox className="me-2" />Borrow Resource
                </ModalHeader>
                <ModalBody>
                    {selectedResource && (
                        <>
                            <div className="mb-3">
                                <h5 style={{ fontWeight: 'bold', color: '#333' }}>{selectedResource.name}</h5>
                                <p className="text-muted small mb-2">{selectedResource.description}</p>
                                <div className="d-flex gap-2 mb-3">
                                    <Badge color="primary">{selectedResource.category}</Badge>
                                    <Badge color="success">
                                        {selectedResource.available_quantity} Available
                                    </Badge>
                                    {selectedResource.max_borrow_days && (
                                        <Badge color="info">
                                            <FaClock className="me-1" />
                                            Max {selectedResource.max_borrow_days} days
                                        </Badge>
                                    )}
                                </div>
                                {selectedResource.location && (
                                    <div className="mt-2 p-2" style={{
                                        background: '#e3f2fd',
                                        borderRadius: '8px',
                                        border: '1px solid #2196f3'
                                    }}>
                                        <strong style={{ color: '#1976d2' }}>
                                            <FaMapMarkerAlt className="me-1" />
                                            Pickup Location:
                                        </strong>
                                        <span className="ms-2" style={{ color: '#333' }}>
                                            {selectedResource.location}
                                        </span>
                                    </div>
                                )}
                                {/* Borrow Policy & Penalties */}
                                <div className="mt-3 p-3" style={{
                                    background: '#fff3cd',
                                    borderRadius: '8px',
                                    border: '2px solid #ffc107'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>🔔</span>
                                        <strong style={{ color: '#856404' }}>Borrow Policy & Penalties</strong>
                                    </div>
                                    <p className="small mb-0" style={{ color: '#856404', lineHeight: '1.6' }}>
                                        Late return, damage, or loss of the resource may result in penalties and temporary borrowing restrictions.
                                    </p>
                                </div>
                            </div>

                            <FormGroup>
                                <Label for="due_date" style={{ fontWeight: '600' }}>
                                    Due Date <span style={{ color: 'red' }}>*</span>
                                </Label>
                                <Input
                                    type="date"
                                    id="due_date"
                                    value={borrowData.due_date}
                                    onChange={(e) => setBorrowData({ ...borrowData, due_date: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                    max={
                                        selectedResource.max_borrow_days
                                            ? new Date(Date.now() + selectedResource.max_borrow_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                    }
                                    required
                                />
                            </FormGroup>

                            <FormGroup>
                                <Label for="condition" style={{ fontWeight: '600' }}>
                                    Condition on Borrow
                                </Label>
                                <Input
                                    type="text"
                                    id="condition"
                                    value={borrowData.condition_on_borrow || selectedResource.condition || 'Good'}
                                    readOnly
                                    disabled
                                    style={{
                                        backgroundColor: '#f8f9fa',
                                        cursor: 'not-allowed'
                                    }}
                                />
                                <small className="text-muted">This value is automatically set from the resource's current condition</small>
                            </FormGroup>

                            <FormGroup check className="mt-3">
                                <Label check>
                                    <Input
                                        type="checkbox"
                                        checked={borrowData.terms_accepted}
                                        onChange={(e) => setBorrowData({ ...borrowData, terms_accepted: e.target.checked })}
                                    />
                                    <span className="ms-2">
                                        I accept the terms and conditions for borrowing this resource
                                    </span>
                                </Label>
                            </FormGroup>
                        </>
                    )}
                </ModalBody>
                <ModalFooter style={{ borderTop: '1px solid #e0e0e0' }}>
                    <Button 
                        color="secondary" 
                        onClick={() => {
                            setBorrowModal(false);
                            setSelectedResource(null);
                        }}
                        disabled={isBorrowing}
                    >
                        Cancel
                    </Button>
                    <Button 
                        color="primary"
                        onClick={handleBorrowSubmit}
                        disabled={isBorrowing}
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none'
                        }}
                    >
                        {isBorrowing ? 'Processing...' : 'Confirm Borrow'}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Reserve Modal */}
            <Modal isOpen={reserveModal} toggle={() => setReserveModal(false)} centered>
                <ModalHeader toggle={() => setReserveModal(false)} style={{
                    background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                    color: '#fff',
                    borderBottom: 'none'
                }}>
                    <FaCalendarCheck className="me-2" />Reserve Resource
                </ModalHeader>
                <ModalBody>
                    {selectedResource && (
                        <>
                            <div className="mb-3">
                                <h5 style={{ fontWeight: 'bold', color: '#333' }}>{selectedResource.name}</h5>
                                <p className="text-muted small mb-2">{selectedResource.description}</p>
                                <div className="d-flex gap-2 mb-3">
                                    <Badge color="primary">{selectedResource.category}</Badge>
                                    <Badge color="success">
                                        {selectedResource.available_quantity} Available
                                    </Badge>
                                    {selectedResource.max_borrow_days && (
                                        <Badge color="info">
                                            <FaClock className="me-1" />
                                            Max {selectedResource.max_borrow_days} days
                                        </Badge>
                                    )}
                                </div>
                                {selectedResource.location && (
                                    <div className="mt-2 p-2" style={{
                                        background: '#e3f2fd',
                                        borderRadius: '8px',
                                        border: '1px solid #2196f3'
                                    }}>
                                        <strong style={{ color: '#1976d2' }}>
                                            <FaMapMarkerAlt className="me-1" />
                                            Pickup Location:
                                        </strong>
                                        <span className="ms-2" style={{ color: '#333' }}>
                                            {selectedResource.location}
                                        </span>
                                    </div>
                                )}
                                {/* Reserve Policy */}
                                <div className="mt-3 p-3" style={{
                                    background: '#d1ecf1',
                                    borderRadius: '8px',
                                    border: '2px solid #17a2b8'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>⏳</span>
                                        <strong style={{ color: '#0c5460' }}>Reservation Policy</strong>
                                    </div>
                                    <p className="small mb-0" style={{ color: '#0c5460', lineHeight: '1.6' }}>
                                        Reserve this resource for future pickup. The borrowing period starts when you pick up the resource. Late return, damage, or loss may result in penalties.
                                    </p>
                                </div>
                            </div>

                            <FormGroup>
                                <Label for="pickup_date" style={{ fontWeight: '600' }}>
                                    Pickup Date <span style={{ color: 'red' }}>*</span>
                                </Label>
                                <Input
                                    type="date"
                                    id="pickup_date"
                                    value={reserveData.pickup_date}
                                    onChange={(e) => {
                                        const newPickupDate = e.target.value;
                                        setReserveData({ ...reserveData, pickup_date: newPickupDate });
                                        // Auto-update expiry date if it's before the new pickup date
                                        if (reserveData.expiry_date && new Date(reserveData.expiry_date) <= new Date(newPickupDate)) {
                                            const defaultDays = selectedResource.max_borrow_days || 7;
                                            const newExpiryDate = new Date(newPickupDate);
                                            newExpiryDate.setDate(newExpiryDate.getDate() + defaultDays);
                                            setReserveData(prev => ({ ...prev, expiry_date: newExpiryDate.toISOString().split('T')[0] }));
                                        }
                                    }}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                />
                                <small className="text-muted">Select when you want to pick up this resource</small>
                            </FormGroup>

                            <FormGroup>
                                <Label for="expiry_date" style={{ fontWeight: '600' }}>
                                    Return Date <span style={{ color: 'red' }}>*</span>
                                </Label>
                                <Input
                                    type="date"
                                    id="expiry_date"
                                    value={reserveData.expiry_date}
                                    onChange={(e) => setReserveData({ ...reserveData, expiry_date: e.target.value })}
                                    min={reserveData.pickup_date || new Date().toISOString().split('T')[0]}
                                    max={
                                        reserveData.pickup_date && selectedResource.max_borrow_days
                                            ? new Date(new Date(reserveData.pickup_date).getTime() + selectedResource.max_borrow_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                            : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                    }
                                    required
                                />
                                <small className="text-muted">
                                    Select when you plan to return this resource (max {selectedResource.max_borrow_days || 7} days from pickup date)
                                </small>
                            </FormGroup>

                            <FormGroup check className="mt-3">
                                <Label check>
                                    <Input
                                        type="checkbox"
                                        checked={reserveData.terms_accepted}
                                        onChange={(e) => setReserveData({ ...reserveData, terms_accepted: e.target.checked })}
                                    />
                                    <span className="ms-2">
                                        I accept the terms and conditions for reserving this resource
                                    </span>
                                </Label>
                            </FormGroup>
                        </>
                    )}
                </ModalBody>
                <ModalFooter style={{ borderTop: '1px solid #e0e0e0' }}>
                    <Button 
                        color="secondary" 
                        onClick={() => {
                            setReserveModal(false);
                            setSelectedResource(null);
                        }}
                        disabled={isReserving}
                    >
                        Cancel
                    </Button>
                    <Button 
                        color="info"
                        onClick={handleReserveSubmit}
                        disabled={isReserving}
                        style={{
                            background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                            border: 'none'
                        }}
                    >
                        {isReserving ? 'Processing...' : 'Confirm Reserve'}
                    </Button>
                </ModalFooter>
            </Modal>
            </Container>
        </div>
    );
};

export default Resources;

