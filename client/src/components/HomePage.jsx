import React, { useEffect, useState, useCallback } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, Button, Badge, Input, InputGroup, InputGroupText, Alert, Nav, NavItem, NavLink, TabContent, TabPane, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchBorrowings } from "../redux/reducers/borrowingReducer";
import { fetchReservations } from "../redux/reducers/reservationReducer";
import { fetchNotifications } from "../redux/reducers/notificationReducer";
import { fetchDevices } from "../redux/reducers/deviceReducer";
import { FaBook, FaCalendarCheck, FaBell, FaBox, FaSearch, FaClock, FaCheckCircle, FaExclamationTriangle, FaArrowRight, FaQrcode, FaLaptop, FaMicroscope, FaTools, FaChartLine, FaPalette, FaRobot, FaTimes, FaArrowUp, FaLightbulb, FaUniversity, FaGraduationCap, FaBolt, FaStar, FaComments, FaPlus, FaBullhorn } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTheme } from '../contexts/ThemeContext.jsx';

const Home = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const { borrowings: borrows, isLoading: borrowsLoading } = useSelector((state) => state.borrowing);
    const { reservations, isLoading: reservationsLoading } = useSelector((state) => state.reservations);
    const { notifications, isLoading: notificationsLoading } = useSelector((state) => state.notifications);
    const { devices: resources, isLoading: resourcesLoading } = useSelector((state) => state.devices);
    const { theme, isDark } = useTheme();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [chatbotOpen, setChatbotOpen] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [feedbackModal, setFeedbackModal] = useState(false);
    const [feedbackData, setFeedbackData] = useState({
        rating: 5,
        comment: '',
        category: 'Other'
    });
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [announcements, setAnnouncements] = useState([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

    const fetchAnnouncements = useCallback(async () => {
        try {
            setLoadingAnnouncements(true);
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await axios.get('http://localhost:5000/announcements', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setAnnouncements(response.data.data || []);
            }
        } catch (error) {
            console.error('Fetch announcements error:', error);
            // Don't show error to user, just log it
        } finally {
            setLoadingAnnouncements(false);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        // Redirect Admin/Assistant to admin dashboard
        if (user.role === 'Admin' || user.role === 'Assistant') {
            navigate('/admin/dashboard');
            return;
        }
        dispatch(fetchBorrowings());
        dispatch(fetchReservations());
        dispatch(fetchNotifications());
        dispatch(fetchDevices());
        fetchAnnouncements();
        
        // Show welcome modal for first-time users
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        if (!hasSeenWelcome) {
            setShowWelcome(true);
        }
        }, [dispatch, user, navigate, fetchAnnouncements]);

    const activeBorrows = Array.isArray(borrows) ? borrows.filter(b => b.status === 'Active').length : 0;
    const activeReservations = Array.isArray(reservations) ? reservations.filter(r => ['Pending', 'Confirmed'].includes(r.status)).length : 0;
    const unreadNotifications = notifications?.unreadCount || 0;
    const availableResources = Array.isArray(resources) ? resources.filter(r => r.status === 'Available') : [];
    const resourcesCount = availableResources.length;
    
    const recentBorrows = Array.isArray(borrows) ? borrows.slice(0, 5) : [];
    const recentReservations = Array.isArray(reservations) ? reservations.slice(0, 5) : [];
    const overdueBorrows = Array.isArray(borrows) ? borrows.filter(b => {
        if (b.status === 'Active' && b.due_date) {
            try {
                return new Date(b.due_date) < new Date();
            } catch {
                return false;
            }
        }
        return false;
    }) : [];

    const upcomingReturns = Array.isArray(borrows) ? borrows
        .filter(b => b.status === 'Active' && b.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 1) : [];

    const totalPenalties = 0; // TODO: Calculate from penalties
    const monthlyDigitalTransactions = 1247; // Example stat

    const getDepartmentIcon = (dept) => {
        if (!dept) return FaBox;
        if (dept.includes('Information Technology')) return FaLaptop;
        if (dept.includes('Science')) return FaMicroscope;
        if (dept.includes('Engineering')) return FaTools;
        if (dept.includes('Business')) return FaChartLine;
        if (dept.includes('Creative')) return FaPalette;
        return FaBox;
    };

    const DepartmentIcon = getDepartmentIcon(user?.department);

    const handleSearch = () => {
        if (searchTerm.trim()) {
            navigate(`/resources?search=${encodeURIComponent(searchTerm)}`);
        } else {
            navigate('/resources');
        }
    };

    const handleWelcomeClose = () => {
        setShowWelcome(false);
        localStorage.setItem('hasSeenWelcome', 'true');
    };

    const handleSubmitFeedback = async () => {
        if (!feedbackData.comment.trim()) {
            toast.error('Please enter your review');
            return;
        }

        try {
            setSubmittingFeedback(true);
            const token = localStorage.getItem('token');
            const response = await axios.post('http://localhost:5000/feedback', {
                rating: feedbackData.rating,
                comment: feedbackData.comment,
                category: feedbackData.category
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                toast.success('Thank you for your feedback!');
                setFeedbackModal(false);
                setFeedbackData({ rating: 5, comment: '', category: 'Other' });
            }
        } catch (error) {
            console.error('Submit feedback error:', error);
            toast.error(error.response?.data?.message || 'Failed to submit feedback');
        } finally {
            setSubmittingFeedback(false);
        }
    };

    const colleges = [
        { id: 'all', name: 'All Colleges', icon: FaUniversity },
        { id: 'it', name: 'Information Technology', icon: FaLaptop },
        { id: 'science', name: 'Science', icon: FaMicroscope },
        { id: 'engineering', name: 'Engineering', icon: FaTools },
        { id: 'business', name: 'Business Studies', icon: FaChartLine },
        { id: 'creative', name: 'Creative Industries', icon: FaPalette }
    ];

    const filteredResourcesByCollege = activeTab === 'all' 
        ? availableResources 
        : availableResources.filter(r => {
            const collegeMap = {
                'it': 'IT',
                'science': 'Lab Equipment',
                'engineering': 'Electronics',
                'business': 'Books',
                'creative': 'Media'
            };
            return r.category === collegeMap[activeTab];
        });

    return (
        <div style={{ 
            marginLeft: '280px', 
            minHeight: '100vh', 
            background: isDark 
                ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            padding: '2rem',
            transition: 'all 0.3s ease',
            color: 'var(--text-primary)'
        }}>
            <Container fluid>
            {/* Welcome Modal */}
            <Modal isOpen={showWelcome} toggle={handleWelcomeClose} size="lg" centered>
                <ModalHeader toggle={handleWelcomeClose} className="bg-primary text-white">
                    <FaUniversity className="me-2" />Welcome to UTAS Borrowing Hub! 🎓
                </ModalHeader>
                <ModalBody>
                    <div className="text-center mb-4">
                        <div className="mb-3" style={{ fontSize: '4rem' }}>📚</div>
                        <h4 className="mb-3">Your One-Stop Resource Management System</h4>
                        <p className="text-muted">UTAS Borrowing Hub connects you with thousands of resources across all colleges</p>
                    </div>
                    <Row>
                        <Col md={4} className="text-center mb-3">
                            <div className="p-3 bg-primary bg-opacity-10 rounded">
                                <FaBox size={30} className="text-primary mb-2" />
                                <h6>Browse Resources</h6>
                                <p className="small text-muted">Access IT equipment, lab tools, books, and more</p>
                            </div>
                        </Col>
                        <Col md={4} className="text-center mb-3">
                            <div className="p-3 bg-success bg-opacity-10 rounded">
                                <FaQrcode size={30} className="text-success mb-2" />
                                <h6>Quick Scan</h6>
                                <p className="small text-muted">Use QR/Barcode scanning for instant checkout</p>
                            </div>
                        </Col>
                        <Col md={4} className="text-center mb-3">
                            <div className="p-3 bg-info bg-opacity-10 rounded">
                                <FaRobot size={30} className="text-info mb-2" />
                                <h6>AI Assistant</h6>
                                <p className="small text-muted">Get instant help with our smart chatbot</p>
                            </div>
                        </Col>
                    </Row>
                </ModalBody>
                <ModalFooter>
                    <Button color="primary" onClick={handleWelcomeClose}>Get Started!</Button>
                </ModalFooter>
            </Modal>

            {/* Welcome Header */}
            <Row className="mb-4">
                <Col>
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '20px',
                        padding: '2rem',
                        color: '#fff',
                        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
                    }}>
                        <h2 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            Welcome back, {user?.full_name || 'User'}! 👋
                        </h2>
                        <p style={{ margin: 0, opacity: 0.9, fontSize: '1.1rem' }}>
                            Manage your resources and stay organized
                        </p>
                    </div>
                </Col>
            </Row>

            {/* Announcements Section */}
            {announcements.length > 0 && (
                <Row className="mb-4">
                    <Col>
                        <Card className="border-0 shadow-sm" style={{ backgroundColor: 'var(--card-bg)' }}>
                            <CardBody style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                                    <FaBullhorn style={{ fontSize: '1.5rem', color: '#667eea', marginRight: '0.75rem' }} />
                                    <h4 style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-primary)' }}>Announcements</h4>
                                </div>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {announcements.map((announcement) => (
                                        <Alert 
                                            key={announcement._id || announcement.id || Math.random()}
                                            color={
                                                announcement.priority === 'High' ? 'danger' :
                                                announcement.priority === 'Medium' ? 'warning' : 'info'
                                            }
                                            style={{ 
                                                marginBottom: '1rem',
                                                borderRadius: '10px',
                                                borderLeft: `4px solid ${
                                                    announcement.priority === 'High' ? '#dc3545' :
                                                    announcement.priority === 'Medium' ? '#ffc107' : '#17a2b8'
                                                }`
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ flex: 1 }}>
                                                    <h5 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                                        {announcement.title}
                                                    </h5>
                                                    <p style={{ marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                                                        {announcement.message}
                                                    </p>
                                                    <small style={{ color: 'var(--text-secondary)' }}>
                                                        {announcement.created_by?.full_name && `By ${announcement.created_by.full_name} • `}
                                                        {announcement.created_at && new Date(announcement.created_at).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </small>
                                                </div>
                                                {announcement.priority === 'High' && (
                                                    <FaExclamationTriangle 
                                                        style={{ 
                                                            fontSize: '1.25rem', 
                                                            color: '#dc3545',
                                                            marginLeft: '1rem',
                                                            flexShrink: 0
                                                        }} 
                                                    />
                                                )}
                                            </div>
                                        </Alert>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Smart Search Bar */}
            <Row className="mb-4">
                <Col>
                    <Card className="border-0 shadow-lg" style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        border: 'none'
                    }}>
                        <CardBody className="p-4">
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <h3 className="text-white mb-3" style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                                        <FaSearch className="me-2" />What are you looking for?
                                    </h3>
                                    <InputGroup size="lg" style={{ borderRadius: '15px', overflow: 'hidden' }}>
                                        <InputGroupText style={{ 
                                            background: 'var(--input-bg)',
                                            border: 'none',
                                            padding: '0.75rem 1rem',
                                            color: 'var(--text-primary)'
                                        }}>
                                            <FaSearch style={{ color: '#667eea', fontSize: '1.2rem' }} />
                                        </InputGroupText>
                                        <Input
                                            type="text"
                                            placeholder="Search for laptops, microscopes, tools, books..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                            style={{ 
                                                border: 'none',
                                                padding: '0.75rem',
                                                fontSize: '1rem',
                                                backgroundColor: 'var(--input-bg)',
                                                color: 'var(--text-primary)'
                                            }}
                                        />
                                        <Button 
                                            onClick={handleSearch}
                                            style={{
                                                background: 'var(--input-bg)',
                                                color: '#667eea',
                                                border: 'none',
                                                fontWeight: '600',
                                                padding: '0.75rem 2rem'
                                            }}
                                        >
                                            Search
                                        </Button>
                                    </InputGroup>
                                </Col>
                                <Col md={4} className="text-center">
                                    <div 
                                        className="p-4 rounded"
                                        style={{
                                            background: isDark ? 'rgba(45, 45, 45, 0.95)' : 'var(--card-bg)',
                                            backdropFilter: 'blur(10px)',
                                            boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.5)' : '0 4px 15px rgba(0,0,0,0.1)',
                                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.3)',
                                            borderRadius: '20px',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        <h2 
                                            className="mb-2 fw-bold"
                                            style={{
                                                color: '#1976d2',
                                                fontSize: '3rem',
                                                textShadow: 'none'
                                            }}
                                        >
                                            {resourcesCount}
                                        </h2>
                                        <p 
                                            className="mb-3"
                                            style={{
                                                color: 'var(--text-primary)',
                                                fontSize: '1rem',
                                                fontWeight: '600',
                                                margin: 0
                                            }}
                                        >
                                            Devices Available Now
                                        </p>
                                        <Badge 
                                            style={{ 
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                border: 'none',
                                                padding: '0.6rem 1.2rem',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                color: '#fff',
                                                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                                                borderRadius: '20px'
                                            }} 
                                        >
                                            Live Status
                                        </Badge>
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Personalized Alerts */}
            <Row className="mb-4">
                {overdueBorrows.length > 0 && (
                    <Col md={overdueBorrows.length > 0 && totalPenalties > 0 ? 6 : 12} className="mb-3">
                        <Alert color="danger" className="d-flex align-items-center" style={{ 
                            borderRadius: '15px', 
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(244, 67, 54, 0.2)'
                        }}>
                            <FaExclamationTriangle className="me-2" size={24} />
                            <div className="flex-grow-1">
                                <strong>Overdue Items!</strong>
                                <p className="mb-0 small">You have {overdueBorrows.length} item(s) overdue. Please return them immediately.</p>
                            </div>
                            <Button 
                                color="danger" 
                                size="sm" 
                                onClick={() => navigate('/my-borrows')}
                                style={{ borderRadius: '10px', fontWeight: '600' }}
                            >
                                View
                            </Button>
                        </Alert>
                    </Col>
                )}
                {totalPenalties > 0 && (
                    <Col md={overdueBorrows.length > 0 ? 6 : 12} className="mb-3">
                        <Alert color="warning" className="d-flex align-items-center" style={{ 
                            borderRadius: '15px', 
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(255, 152, 0, 0.2)'
                        }}>
                            <FaExclamationTriangle className="me-2" size={24} />
                            <div className="flex-grow-1">
                                <strong>Pending Penalties</strong>
                                <p className="mb-0 small">Total: {totalPenalties.toFixed(2)} OMR</p>
                            </div>
                            <Button 
                                color="warning" 
                                size="sm" 
                                onClick={() => navigate('/penalties')}
                                style={{ borderRadius: '10px', fontWeight: '600' }}
                            >
                                View Penalties
                            </Button>
                        </Alert>
                    </Col>
                )}
                {overdueBorrows.length === 0 && totalPenalties === 0 && (
                    <Col md={12} className="mb-3">
                        <Alert color="info" className="d-flex align-items-center" style={{ 
                            borderRadius: '15px', 
                            border: 'none',
                            boxShadow: isDark ? '0 4px 12px rgba(33, 150, 243, 0.3)' : '0 4px 12px rgba(33, 150, 243, 0.2)',
                            background: isDark 
                                ? 'linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%)'
                                : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                            color: isDark ? '#fff' : 'inherit'
                        }}>
                            <FaLightbulb className="me-2" size={24} style={{ color: isDark ? '#64b5f6' : '#1976d2' }} />
                            <div className="flex-grow-1">
                                <strong style={{ color: isDark ? '#90caf9' : '#1976d2' }}>💡 Tip of the Week</strong>
                                <p className="mb-0 small" style={{ color: isDark ? '#b3e5fc' : '#1565c0' }}>
                                    Return items on time to maintain your borrowing privileges and avoid penalties!
                                </p>
                            </div>
                        </Alert>
                    </Col>
                )}
            </Row>

            {/* Quick Actions Cards */}
            <Row className="mb-4">
                <Col>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '1.5rem'
                    }}>
                        <h4 className="mb-0" style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.5rem' }}>
                            <FaBolt className="me-2" style={{ color: '#ff9800' }} />Quick Actions
                        </h4>
                    </div>
                </Col>
            </Row>
            <Row className="mb-4">
                <Col md={4} className="mb-3">
                    <Card 
                        className="h-100 border-0 shadow-lg" 
                        style={{ 
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: '#fff',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 12px 30px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                        }}
                        onClick={() => navigate('/resources')}
                    >
                        <CardBody className="p-4">
                            <div className="d-flex align-items-center mb-3">
                                <div style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '1rem',
                                    borderRadius: '15px',
                                    marginRight: '1rem'
                                }}>
                                    <FaBolt size={30} style={{ color: '#fff' }} />
                                </div>
                                <div>
                                    <CardTitle tag="h5" className="mb-0" style={{ color: '#fff', fontWeight: 'bold' }}>
                                        Quick Borrow
                                    </CardTitle>
                                    <small style={{ color: 'rgba(255,255,255,0.9)' }}>Browse available devices</small>
                                </div>
                            </div>
                            <Button 
                                block 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/resources');
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.95)',
                                    color: '#667eea',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    padding: '0.75rem'
                                }}
                            >
                                <FaBox className="me-2" />Browse Resources
                            </Button>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card 
                        className="h-100 border-0 shadow-lg" 
                        style={{ 
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            color: '#fff',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 12px 30px rgba(79, 172, 254, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                        }}
                        onClick={() => navigate('/my-borrows')}
                    >
                        <CardBody className="p-4">
                            <div className="d-flex align-items-center mb-3">
                                <div style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '1rem',
                                    borderRadius: '15px',
                                    marginRight: '1rem'
                                }}>
                                    <FaClock size={30} style={{ color: '#fff' }} />
                                </div>
                                <div>
                                    <CardTitle tag="h5" className="mb-0" style={{ color: '#fff', fontWeight: 'bold' }}>
                                        My Borrows
                                    </CardTitle>
                                    <small style={{ color: 'rgba(255,255,255,0.9)' }}>
                                        {activeBorrows} Active {activeBorrows === 1 ? 'Borrow' : 'Borrows'}
                                    </small>
                                </div>
                            </div>
                            {upcomingReturns.length > 0 ? (
                                <div className="mb-3" style={{ background: 'rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '10px' }}>
                                    <strong style={{ fontSize: '0.9rem' }}>{upcomingReturns[0].resource_id?.name || 'Item'}</strong>
                                    <br />
                                    <small style={{ color: 'rgba(255,255,255,0.9)' }}>
                                        Due: {new Date(upcomingReturns[0].due_date).toLocaleDateString()}
                                    </small>
                                </div>
                            ) : null}
                            <Button 
                                block 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/my-borrows');
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.95)',
                                    color: '#4facfe',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    padding: '0.75rem'
                                }}
                            >
                                <FaBook className="me-2" />View All
                            </Button>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card 
                        className="h-100 border-0 shadow-lg" 
                        style={{ 
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                            color: '#fff',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 12px 30px rgba(67, 233, 123, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                        }}
                        onClick={() => navigate('/resources')}
                    >
                        <CardBody className="p-4">
                            <div className="d-flex align-items-center mb-3">
                                <div style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '1rem',
                                    borderRadius: '15px',
                                    marginRight: '1rem'
                                }}>
                                    <FaStar size={30} style={{ color: '#fff' }} />
                                </div>
                                <div>
                                    <CardTitle tag="h5" className="mb-0" style={{ color: '#fff', fontWeight: 'bold' }}>
                                        Recommendations
                                    </CardTitle>
                                    <small style={{ color: 'rgba(255,255,255,0.9)' }}>Based on your history</small>
                                </div>
                            </div>
                            <Button 
                                block 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/resources');
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.95)',
                                    color: '#43e97b',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    padding: '0.75rem'
                                }}
                            >
                                <FaStar className="me-2" />View Suggestions
                            </Button>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* UTAS Academic Section */}
            <Row className="mb-4">
                <Col>
                    <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
                        <CardBody className="p-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h4 className="mb-1" style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                        <FaUniversity className="me-2" style={{ color: '#1976d2' }} />
                                        UTAS Colleges
                                    </h4>
                                    <p className="mb-0" style={{ color: 'var(--text-secondary)' }}>Browse resources by college</p>
                                </div>
                                <Badge 
                                    style={{ 
                                        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '15px',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        border: 'none'
                                    }}
                                >
                                    <FaGraduationCap className="me-1" />
                                    {monthlyDigitalTransactions.toLocaleString()} Transactions
                                </Badge>
                            </div>
                            <Nav pills className="mb-3">
                                {colleges.map(college => {
                                    const Icon = college.icon;
                                    return (
                                        <NavItem key={college.id}>
                                            <NavLink
                                                className={activeTab === college.id ? 'active' : ''}
                                                onClick={() => setActiveTab(college.id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <Icon className="me-1" />
                                                {college.name}
                                            </NavLink>
                                        </NavItem>
                                    );
                                })}
                            </Nav>
                            <TabContent activeTab={activeTab}>
                                <TabPane tabId={activeTab}>
                                    <Row>
                                        {filteredResourcesByCollege.slice(0, 6).map((resource) => {
                                            const CollegeIcon = colleges.find(c => {
                                                const map = { 'IT': 'it', 'Lab Equipment': 'science', 'Electronics': 'engineering', 'Books': 'business', 'Media': 'creative' };
                                                return c.id === map[resource.category];
                                            })?.icon || FaBox;
                                            return (
                                                <Col md={4} key={resource._id} className="mb-3">
                                                    <Card className="card-hover border-0 shadow-sm" style={{ backgroundColor: 'var(--card-bg)' }}>
                                                        <CardBody style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}>
                                                            <CollegeIcon className="text-primary mb-2" size={24} />
                                                            <CardTitle tag="h6" className="mb-1" style={{ color: 'var(--text-primary)' }}>{resource.name}</CardTitle>
                                                            <small style={{ color: 'var(--text-secondary)' }}>{resource.category}</small>
                                                            <Badge color="success" className="ms-2">Available</Badge>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                            );
                                        })}
                                    </Row>
                                    {filteredResourcesByCollege.length === 0 && (
                                        <div className="text-center py-4">
                                            <FaBox size={48} className="text-muted mb-3 opacity-25" />
                                            <p className="text-muted">No resources available for this college</p>
                                        </div>
                                    )}
                                </TabPane>
                            </TabContent>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Stats Dashboard */}
            <Row className="mb-3">
                <Col>
                    <h4 className="mb-0" style={{ color: '#2c3e50', fontWeight: 'bold', fontSize: '1.5rem' }}>
                        <FaChartLine className="me-2" style={{ color: '#1976d2' }} />Your Statistics
                    </h4>
                </Col>
            </Row>
            <Row className="mb-4">
                <Col md={3} className="mb-3">
                    <Card 
                        className="h-100 border-0 shadow-lg" 
                        style={{ 
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: '#fff',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 10px 25px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                        }}
                        onClick={() => navigate('/my-borrows')}
                    >
                        <CardBody className="p-4">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="mb-1 small" style={{ color: 'rgba(255,255,255,0.9)' }}>Active Borrows</p>
                                    <h2 className="mb-0 fw-bold" style={{ fontSize: '2.5rem' }}>{activeBorrows}</h2>
                                </div>
                                <div style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '1rem',
                                    borderRadius: '15px'
                                }}>
                                    <FaBook style={{ color: '#fff', fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={3} className="mb-3">
                    <Card 
                        className="h-100 border-0 shadow-lg" 
                        style={{ 
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            color: '#fff',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 10px 25px rgba(79, 172, 254, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                        }}
                        onClick={() => navigate('/reservations')}
                    >
                        <CardBody className="p-4">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="mb-1 small" style={{ color: 'rgba(255,255,255,0.9)' }}>Reservations</p>
                                    <h2 className="mb-0 fw-bold" style={{ fontSize: '2.5rem' }}>{activeReservations}</h2>
                                </div>
                                <div style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '1rem',
                                    borderRadius: '15px'
                                }}>
                                    <FaCalendarCheck style={{ color: '#fff', fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={3} className="mb-3">
                    <Card 
                        className="h-100 border-0 shadow-lg" 
                        style={{ 
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                            color: '#fff',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 10px 25px rgba(250, 112, 154, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                        }}
                        onClick={() => navigate('/notifications')}
                    >
                        <CardBody className="p-4">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="mb-1 small" style={{ color: 'rgba(255,255,255,0.9)' }}>Notifications</p>
                                    <h2 className="mb-0 fw-bold" style={{ fontSize: '2.5rem' }}>{unreadNotifications}</h2>
                                    {unreadNotifications > 0 && (
                                        <Badge style={{
                                            background: 'rgba(255,255,255,0.3)',
                                            color: '#fff',
                                            marginTop: '0.5rem',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '15px'
                                        }}>
                                            New
                                        </Badge>
                                    )}
                                </div>
                                <div style={{
                                    background: unreadNotifications > 0 ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '1rem',
                                    borderRadius: '15px',
                                    animation: unreadNotifications > 0 ? 'pulse 2s infinite' : 'none',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <FaBell style={{ 
                                        color: '#fff', 
                                        fontSize: '1.8rem',
                                        animation: unreadNotifications > 0 ? 'bell-shake 0.5s ease-in-out infinite' : 'none'
                                    }} />
                                    <style>{`
                                        @keyframes pulse {
                                            0%, 100% {
                                                transform: scale(1);
                                                box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7);
                                            }
                                            50% {
                                                transform: scale(1.05);
                                                box-shadow: 0 0 0 10px rgba(255, 152, 0, 0);
                                            }
                                        }
                                        @keyframes bell-shake {
                                            0%, 100% { transform: rotate(0deg); }
                                            10%, 30%, 50%, 70%, 90% { transform: rotate(-5deg); }
                                            20%, 40%, 60%, 80% { transform: rotate(5deg); }
                                        }
                                    `}</style>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={3} className="mb-3">
                    <Card 
                        className="h-100 border-0 shadow-lg" 
                        style={{ 
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                            color: '#fff',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 10px 25px rgba(67, 233, 123, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                        }}
                        onClick={() => navigate('/resources')}
                    >
                        <CardBody className="p-4">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="mb-1 small" style={{ color: 'rgba(255,255,255,0.9)' }}>Available Resources</p>
                                    <h2 className="mb-0 fw-bold" style={{ fontSize: '2.5rem' }}>{resourcesCount}</h2>
                                </div>
                                <div style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '1rem',
                                    borderRadius: '15px'
                                }}>
                                    <FaBox style={{ color: '#fff', fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Recent Activity */}
            <Row>
                <Col md={6} className="mb-4">
                    <Card className="border-0 shadow-sm h-100" style={{ backgroundColor: 'var(--card-bg)' }}>
                        <CardBody style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <CardTitle tag="h5" className="mb-0" style={{ color: 'var(--text-primary)' }}>
                                    <FaBook className="me-2 text-primary" />Recent Borrows
                                </CardTitle>
                                <Button color="link" size="sm" onClick={() => navigate('/my-borrows')}>
                                    View All <FaArrowRight className="ms-1" />
                                </Button>
                            </div>
                            {borrowsLoading ? (
                                <div className="text-center py-4">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : recentBorrows.length > 0 ? (
                                <div>
                                    {recentBorrows.map((borrow) => {
                                        const isOverdue = borrow.status === 'Active' && borrow.due_date && new Date(borrow.due_date) < new Date();
                                        return (
                                            <div key={borrow._id} className="border-bottom py-3 d-flex align-items-center justify-content-between">
                                                <div className="flex-grow-1">
                                                    <div className="d-flex align-items-center mb-1">
                                                        <strong className="me-2">{borrow.resource_id?.name || 'Unknown Resource'}</strong>
                                                        {isOverdue ? (
                                                            <Badge color="danger">
                                                                <FaExclamationTriangle className="me-1" />Overdue
                                                            </Badge>
                                                        ) : borrow.status === 'Active' ? (
                                                            <Badge color="success">
                                                                <FaCheckCircle className="me-1" />Active
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <small className="d-flex align-items-center" style={{ color: 'var(--text-secondary)' }}>
                                                        <FaClock className="me-1" />
                                                        Due: {borrow.due_date ? new Date(borrow.due_date).toLocaleDateString() : 'N/A'}
                                                    </small>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                                    <FaBook size={48} className="mb-3 opacity-25" />
                                    <p>No borrows yet</p>
                                    <Button color="primary" size="sm" onClick={() => navigate('/resources')}>
                                        Browse Resources
                                    </Button>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </Col>
                <Col md={6} className="mb-4">
                    <Card className="border-0 shadow-sm h-100" style={{ backgroundColor: 'var(--card-bg)' }}>
                        <CardBody>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <CardTitle tag="h5" className="mb-0">
                                    <FaCalendarCheck className="me-2 text-info" />Recent Reservations
                                </CardTitle>
                                <Button color="link" size="sm" onClick={() => navigate('/reservations')}>
                                    View All <FaArrowRight className="ms-1" />
                                </Button>
                            </div>
                            {reservationsLoading ? (
                                <div className="text-center py-4">
                                    <div className="spinner-border text-info" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : recentReservations.length > 0 ? (
                                <div>
                                    {recentReservations.map((reservation) => (
                                        <div key={reservation._id} className="border-bottom py-3 d-flex align-items-center justify-content-between" style={{ borderColor: 'var(--border-color)' }}>
                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center mb-1">
                                                    <strong className="me-2" style={{ color: 'var(--text-primary)' }}>{reservation.resource_id?.name || 'Unknown Resource'}</strong>
                                                    <Badge color={reservation.status === 'Confirmed' ? 'success' : 'warning'}>
                                                        {reservation.status}
                                                    </Badge>
                                                </div>
                                                <small className="text-muted d-flex align-items-center">
                                                    <FaClock className="me-1" />
                                                    Pickup: {reservation.pickup_date ? new Date(reservation.pickup_date).toLocaleDateString() : 'N/A'}
                                                </small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <FaCalendarCheck size={48} className="mb-3 opacity-25" />
                                    <p>No reservations yet</p>
                                    <Button color="info" size="sm" onClick={() => navigate('/resources')}>
                                        Make Reservation
                                    </Button>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Feedback Button */}
            <Button
                style={{
                    position: 'fixed',
                    bottom: '100px',
                    right: '30px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '50px',
                    padding: '0.75rem 1.5rem',
                    color: '#ffffff',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
                onClick={() => setFeedbackModal(true)}
            >
                <FaPlus /> Add Your Review
            </Button>

            {/* AI Chatbot Floating Button */}
            <Button
                color="primary"
                className="rounded-circle"
                style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    width: '60px',
                    height: '60px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
                onClick={() => setChatbotOpen(true)}
            >
                <FaRobot size={24} />
            </Button>

            {/* Feedback Modal */}
            <Modal isOpen={feedbackModal} toggle={() => setFeedbackModal(false)} size="lg">
                <ModalHeader toggle={() => setFeedbackModal(false)}>
                    <FaStar className="me-2" />Add Your Review
                </ModalHeader>
                <ModalBody>
                    <Form>
                        <FormGroup>
                            <Label>Rating *</Label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                {[1, 2, 3, 4, 5].map((rating) => (
                                    <FaStar
                                        key={rating}
                                        style={{
                                            color: rating <= feedbackData.rating ? '#ffc107' : '#ddd',
                                            fontSize: '1.5rem',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setFeedbackData({ ...feedbackData, rating })}
                                    />
                                ))}
                            </div>
                        </FormGroup>
                        <FormGroup>
                            <Label for="feedbackCategory">Category</Label>
                            <Input
                                type="select"
                                id="feedbackCategory"
                                value={feedbackData.category}
                                onChange={(e) => setFeedbackData({ ...feedbackData, category: e.target.value })}
                            >
                                <option value="Service">Service</option>
                                <option value="Resource">Resource</option>
                                <option value="System">System</option>
                                <option value="Other">Other</option>
                            </Input>
                        </FormGroup>
                        <FormGroup>
                            <Label for="feedbackComment">Your Review *</Label>
                            <Input
                                type="textarea"
                                id="feedbackComment"
                                rows="4"
                                value={feedbackData.comment}
                                onChange={(e) => setFeedbackData({ ...feedbackData, comment: e.target.value })}
                                placeholder="Share your experience with UTAS Borrowing Hub..."
                            />
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={() => {
                        setFeedbackModal(false);
                        setFeedbackData({ rating: 5, comment: '', category: 'Other' });
                    }}>
                        Cancel
                    </Button>
                    <Button 
                        color="primary" 
                        onClick={handleSubmitFeedback}
                        disabled={submittingFeedback || !feedbackData.comment.trim()}
                        style={{
                            background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                            border: 'none'
                        }}
                    >
                        {submittingFeedback ? 'Submitting...' : 'Submit Review'}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Chatbot Modal */}
            <Modal isOpen={chatbotOpen} toggle={() => setChatbotOpen(false)} size="md">
                <ModalHeader toggle={() => setChatbotOpen(false)}>
                    <FaRobot className="me-2" />AI Assistant
                </ModalHeader>
                <ModalBody>
                    <div className="text-center mb-4">
                        <FaRobot size={48} className="text-primary mb-3" />
                        <h5>Hello! 👋</h5>
                        <p className="text-muted">
                            I'm your smart assistant at UTAS Borrow Hub. How can I help you with borrowing your devices today?
                        </p>
                    </div>
                    <div className="border rounded p-3 mb-3" style={{ minHeight: '200px', background: '#f8f9fa' }}>
                        <p className="text-muted text-center mb-0">Chat interface will be implemented here</p>
                    </div>
                    <InputGroup>
                        <Input placeholder="Type your question..." />
                        <Button color="primary">
                            <FaComments />
                        </Button>
                    </InputGroup>
                </ModalBody>
            </Modal>
            </Container>
        </div>
    );
};

export default Home;
