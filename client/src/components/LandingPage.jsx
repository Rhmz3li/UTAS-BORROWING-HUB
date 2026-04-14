import { Container, Row, Col, Button, Navbar, NavbarBrand, Nav, NavItem, NavLink, Card, CardBody, Modal, ModalHeader, ModalBody, Input, Form, FormGroup, Label } from "reactstrap";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { FaCheckCircle, FaStar, FaArrowRight, FaSearch, FaCalendarCheck, FaBell, FaQrcode, FaRobot, FaChartBar, FaComments, FaTimes, FaFacebook, FaTwitter, FaLinkedin, FaInstagram, FaRocket, FaPlay, FaLaptop, FaCamera, FaMicroscope, FaGraduationCap, FaUser, FaPlus, FaCode, FaFlask, FaCogs, FaBriefcase, FaPalette } from 'react-icons/fa';
import logoImg from '../img/img1.png';
import footerLogoImg from '../img/img1.png';
import heroImg from '../img/img1.png';

const LandingPage = () => {
    const navigate = useNavigate();
    const [chatbotOpen, setChatbotOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const [chatMessages, setChatMessages] = useState([
        {
            type: 'bot',
            text: 'Hello! I\'m your AI assistant. How can I help you today?'
        }
    ]);
    const [comments, setComments] = useState([
        {
            id: 1,
            name: 'Ahmed Salim',
            role: 'Computer Science Student',
            initials: 'AS',
            rating: 5,
            text: "This platform has made borrowing resources so much easier. The QR code scanning feature is incredibly convenient!"
        },
        {
            id: 2,
            name: 'Mariam Al-Kindi',
            role: 'Engineering Student',
            initials: 'MK',
            rating: 5,
            text: "The reservation system is fantastic! I can book equipment in advance and never miss out on what I need."
        },
        {
            id: 3,
            name: 'Hassan Obaid',
            role: 'IT Department Staff',
            initials: 'HO',
            rating: 5,
            text: "As a staff member, the admin dashboard helps me manage resources efficiently. Highly recommended!"
        },
        {
            id: 4,
            name: 'Salim Al-Abrawi',
            role: 'Business Staff',
            initials: 'SA',
            rating: 5,
            text: "Excellent service! The platform is user-friendly and the support team is always helpful. Great experience overall!"
        },
        {
            id: 5,
            name: 'Fatima Al-Mazroui',
            role: 'Science Student',
            initials: 'FM',
            rating: 5,
            text: "The borrowing system is seamless and efficient. I love how easy it is to track my borrowed items and manage reservations!"
        }
    ]);
    const [newComment, setNewComment] = useState({ name: '', role: '', text: '', rating: 5 });
    const [showCommentForm, setShowCommentForm] = useState(false);
    const featuresRef = useRef(null);
    const commentsRef = useRef(null);
    const supportRef = useRef(null);

    const scrollToSection = (ref) => {
        ref.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleAddComment = () => {
        if (newComment.name && newComment.text) {
            const initials = newComment.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const comment = {
                id: comments.length + 1,
                name: newComment.name,
                role: newComment.role || 'User',
                initials: initials,
                rating: newComment.rating,
                text: newComment.text
            };
            setComments([...comments, comment]);
            setNewComment({ name: '', role: '', text: '', rating: 5 });
            setShowCommentForm(false);
        }
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: '#ffffff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* Header Navigation */}
            <Navbar 
                expand="md" 
                style={{ 
                    background: '#ffffff',
                    borderBottom: '1px solid #e0e0e0',
                    padding: '1rem 0',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1000,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
            >
                <Container>
                    <NavbarBrand 
                        href="/" 
                        className="d-flex align-items-center"
                        style={{ 
                            fontWeight: 'bold',
                            fontSize: '1.5rem',
                            color: '#333333',
                            textDecoration: 'none'
                        }}
                    >
                        <div style={{
                            position: 'relative',
                            marginRight: '15px',
                            animation: 'gentleShake 3s ease-in-out infinite'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                border: '3px double #1976d2',
                                padding: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, rgba(227, 242, 253, 0.5) 0%, rgba(255, 243, 224, 0.5) 100%)'
                            }}>
                                <img 
                                    src={logoImg} 
                                    alt="UTAS Logo" 
                                    style={{ 
                                        height: '65px', 
                                        width: 'auto',
                                        borderRadius: '50%'
                                    }}
                                />
                            </div>
                        </div>
                        <span style={{ color: '#333333' }}>UTAS</span>
                        <span style={{ 
                            color: '#ff9800',
                            fontWeight: 'bold',
                            marginLeft: '4px'
                        }}>Borrowing Hub</span>
                    </NavbarBrand>
                    
                    <Nav className="ms-auto d-flex align-items-center" navbar style={{ gap: '1.5rem' }}>
                        <NavItem>
                            <NavLink 
                                href="#" 
                                onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                style={{ 
                                    color: '#333333',
                                    fontWeight: '500',
                                    textDecoration: 'none',
                                    fontSize: '0.95rem',
                                    padding: '0.5rem 0',
                                    cursor: 'pointer'
                                }}
                            >
                                HOME
                            </NavLink>
                        </NavItem>
                        <NavItem>
                            <NavLink 
                                href="#features" 
                                onClick={(e) => { e.preventDefault(); scrollToSection(featuresRef); }}
                                style={{ 
                                    color: '#333333',
                                    fontWeight: '500',
                                    textDecoration: 'none',
                                    fontSize: '0.95rem',
                                    padding: '0.5rem 0',
                                    cursor: 'pointer'
                                }}
                            >
                                FEATURES
                            </NavLink>
                        </NavItem>
                        <NavItem>
                            <NavLink 
                                href="#support" 
                                onClick={(e) => { e.preventDefault(); scrollToSection(supportRef); }}
                                style={{ 
                                    color: '#333333',
                                    fontWeight: '500',
                                    textDecoration: 'none',
                                    fontSize: '0.95rem',
                                    padding: '0.5rem 0',
                                    cursor: 'pointer'
                                }}
                            >
                                SUPPORT
                            </NavLink>
                        </NavItem>
                        <NavItem>
                            <NavLink 
                                href="#comments" 
                                onClick={(e) => { e.preventDefault(); scrollToSection(commentsRef); }}
                                style={{ 
                                    color: '#333333',
                                    fontWeight: '500',
                                    textDecoration: 'none',
                                    fontSize: '0.95rem',
                                    padding: '0.5rem 0',
                                    cursor: 'pointer'
                                }}
                            >
                                REVIEWS
                            </NavLink>
                        </NavItem>
                        <NavItem>
                            <Button 
                                onClick={() => navigate('/register')}
                                style={{
                                    background: '#fff3cd',
                                    color: '#333333',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.5rem 1.5rem',
                                    fontWeight: '600',
                                    fontSize: '0.9rem',
                                    marginRight: '0.5rem'
                                }}
                            >
                                CREATE ACCOUNT
                            </Button>
                        </NavItem>
                        <NavItem>
                            <Button 
                                onClick={() => navigate('/login')}
                                style={{
                                    background: '#ff9800',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.5rem 1.5rem',
                                    fontWeight: '600',
                                    fontSize: '0.9rem'
                                }}
                            >
                                SIGN IN
                            </Button>
                        </NavItem>
                    </Nav>
                </Container>
            </Navbar>

            {/* Hero Section with Stats */}
            <Container style={{ paddingTop: '4rem', paddingBottom: '2rem', position: 'relative' }}>
                {/* Background Gradient Circles */}
                <div style={{
                    position: 'absolute',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(227, 242, 253, 0.3) 0%, rgba(255,255,255,0) 70%)',
                    top: '-100px',
                    left: '-100px',
                    zIndex: 0
                }}></div>
                <div style={{
                    position: 'absolute',
                    width: '350px',
                    height: '350px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 243, 224, 0.3) 0%, rgba(255,255,255,0) 70%)',
                    bottom: '-50px',
                    right: '-50px',
                    zIndex: 0
                }}></div>

                <Row className="align-items-center" style={{ position: 'relative', zIndex: 1 }}>
                    {/* Left Side - Content */}
                    <Col md={7} className="mb-5 mb-md-0">
                        {/* Badge */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            marginBottom: '1.5rem',
                            border: '1px solid #1976d2'
                        }}>
                            <FaGraduationCap style={{ color: '#1976d2', fontSize: '1rem' }} />
                            <span style={{ color: '#1976d2', fontSize: '0.9rem', fontWeight: '600' }}>
                                University of Technology and Applied Sciences
                            </span>
                        </div>

                        {/* Main Headline */}
                        <h1 style={{
                            fontSize: '3rem',
                            fontWeight: 'bold',
                            color: '#333333',
                            marginBottom: '1.5rem',
                            lineHeight: '1.2'
                        }}>
                            Digital Resource Management{' '}
                            <span style={{ color: '#666666' }}>Made</span>{' '}
                            <span style={{ color: '#ff9800' }}>Simple</span>
                        </h1>

                        {/* Description */}
                        <p style={{
                            fontSize: '1.15rem',
                            color: '#666666',
                            lineHeight: '1.8',
                            marginBottom: '2rem',
                            maxWidth: '600px'
                        }}>
                            Streamline borrowing operations, track resources effectively, and enhance collaboration with our centralized digital platform for students and staff.
                        </p>

                        {/* CTA Buttons */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
                            <Button
                                onClick={() => navigate('/register')}
                                style={{
                                    background: '#1976d2',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.875rem 2rem',
                                    fontWeight: '600',
                                    fontSize: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
                                }}
                            >
                                <FaRocket /> Start Borrowing
                            </Button>
                            <Button
                                onClick={() => scrollToSection(featuresRef)}
                                style={{
                                    background: '#ffffff',
                                    color: '#1976d2',
                                    border: '2px solid #1976d2',
                                    borderRadius: '8px',
                                    padding: '0.875rem 2rem',
                                    fontWeight: '600',
                                    fontSize: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <FaPlay /> Watch Demo
                            </Button>
                        </div>

                        {/* Statistics */}
                        <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1976d2', marginBottom: '0.25rem' }}>
                                    500+
                                </div>
                                <div style={{ fontSize: '0.95rem', color: '#666666', fontWeight: '500' }}>
                                    Resources
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1976d2', marginBottom: '0.25rem' }}>
                                    2,500+
                                </div>
                                <div style={{ fontSize: '0.95rem', color: '#666666', fontWeight: '500' }}>
                                    Users
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1976d2', marginBottom: '0.25rem' }}>
                                    10,000+
                                </div>
                                <div style={{ fontSize: '0.95rem', color: '#666666', fontWeight: '500' }}>
                                    Transactions
                                </div>
                            </div>
                        </div>
                    </Col>

                    {/* Right Side - Active Resources Card */}
                    <Col md={5} className="mb-5 mb-md-0">
                        <Card className="shadow-lg border-0" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                            <CardBody style={{ padding: '1.5rem' }}>
                                {/* Card Header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', gap: '-8px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: '#ff9800',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ffffff',
                                            border: '3px solid #ffffff',
                                            marginLeft: '-8px',
                                            zIndex: 3
                                        }}>
                                            <FaUser style={{ fontSize: '1rem' }} />
                                        </div>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: '#ff6b35',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ffffff',
                                            border: '3px solid #ffffff',
                                            marginLeft: '-8px',
                                            zIndex: 2
                                        }}>
                                            <FaUser style={{ fontSize: '1rem' }} />
                                        </div>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: '#d84315',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ffffff',
                                            border: '3px solid #ffffff',
                                            marginLeft: '-8px',
                                            zIndex: 1
                                        }}>
                                            <FaUser style={{ fontSize: '1rem' }} />
                                        </div>
                                    </div>
                                    <h5 style={{ margin: 0, color: '#333333', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                        Active Borrowers
                                    </h5>
                                </div>

                                {/* Resource List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.75rem', borderRadius: '8px', background: '#f8f9fa' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                                            <FaLaptop style={{ fontSize: '1.2rem' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', color: '#333333', marginBottom: '0.25rem' }}>MacBook Pro</div>
                                        </div>
                                        <span style={{
                                            background: '#28a745',
                                            color: '#ffffff',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '12px',
                                            fontSize: '0.85rem',
                                            fontWeight: '600'
                                        }}>Available</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.75rem', borderRadius: '8px', background: '#f8f9fa' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                                            <FaMicroscope style={{ fontSize: '1.2rem' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', color: '#333333', marginBottom: '0.25rem' }}>Digital Microscope</div>
                                        </div>
                                        <span style={{
                                            background: '#fff3e0',
                                            color: '#e65100',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '12px',
                                            fontSize: '0.85rem',
                                            fontWeight: '600'
                                        }}>Borrowed</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.75rem', borderRadius: '8px', background: '#f8f9fa' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                                            <FaCamera style={{ fontSize: '1.2rem' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', color: '#333333', marginBottom: '0.25rem' }}>DSLR Camera</div>
                                        </div>
                                        <span style={{
                                            background: '#e3f2fd',
                                            color: '#1976d2',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '12px',
                                            fontSize: '0.85rem',
                                            fontWeight: '600'
                                        }}>Reserved</span>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            </Container>

            {/* Features Section */}
            <div ref={featuresRef} style={{ scrollMarginTop: '80px' }}>
                <Container style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
                    <Row>
                        <Col className="text-center mb-5">
                            <h2 style={{
                                fontSize: '2.5rem',
                                fontWeight: 'bold',
                                color: '#333333',
                                marginBottom: '1rem'
                            }}>
                                Powerful Features
                            </h2>
                            <p style={{
                                fontSize: '1.1rem',
                                color: '#666666',
                                maxWidth: '600px',
                                margin: '0 auto'
                            }}>
                                Everything you need to manage resources efficiently
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {/* Feature Card 1: Smart Search */}
                        <Col md={4} className="mb-4">
                            <Card className="border-0 shadow-sm h-100" style={{
                                borderRadius: '12px',
                                transition: 'all 0.3s ease',
                                borderTop: '4px solid transparent',
                                borderImage: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%) 1'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                            }}
                            >
                                <CardBody className="p-4">
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <FaSearch style={{ color: '#ffffff', fontSize: '1.5rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#333333',
                                        marginBottom: '1rem',
                                        fontSize: '1.25rem'
                                    }}>
                                        Smart Search
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.6',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Find resources quickly with our intelligent search system that filters by category, department, and availability.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* Feature Card 2: Reservation System */}
                        <Col md={4} className="mb-4">
                            <Card className="border-0 shadow-sm h-100" style={{
                                borderRadius: '12px',
                                transition: 'all 0.3s ease',
                                borderTop: '4px solid transparent',
                                borderImage: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%) 1'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                            }}
                            >
                                <CardBody className="p-4">
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <FaCalendarCheck style={{ color: '#ffffff', fontSize: '1.5rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#333333',
                                        marginBottom: '1rem',
                                        fontSize: '1.25rem'
                                    }}>
                                        Reservation System
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.6',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Book resources in advance with our calendar-based reservation system that prevents conflicts.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* Feature Card 3: Smart Notifications */}
                        <Col md={4} className="mb-4">
                            <Card className="border-0 shadow-sm h-100" style={{
                                borderRadius: '12px',
                                transition: 'all 0.3s ease',
                                borderTop: '4px solid transparent',
                                borderImage: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%) 1'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                            }}
                            >
                                <CardBody className="p-4">
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <FaBell style={{ color: '#ffffff', fontSize: '1.5rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#333333',
                                        marginBottom: '1rem',
                                        fontSize: '1.25rem'
                                    }}>
                                        Smart Notifications
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.6',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Receive automated reminders via email, SMS, and push notifications for due dates and availability.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* Feature Card 4: QR Code Scanning */}
                        <Col md={4} className="mb-4">
                            <Card className="border-0 shadow-sm h-100" style={{
                                borderRadius: '12px',
                                transition: 'all 0.3s ease',
                                borderTop: '4px solid transparent',
                                borderImage: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%) 1'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                            }}
                            >
                                <CardBody className="p-4">
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <FaQrcode style={{ color: '#ffffff', fontSize: '1.5rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#333333',
                                        marginBottom: '1rem',
                                        fontSize: '1.25rem'
                                    }}>
                                        QR Code Scanning
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.6',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Quick check-in/check-out with QR code scanning for instant status updates and inventory management.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* Feature Card 5: AI Chatbot */}
                        <Col md={4} className="mb-4">
                            <Card className="border-0 shadow-sm h-100" style={{
                                borderRadius: '12px',
                                transition: 'all 0.3s ease',
                                borderTop: '4px solid transparent',
                                borderImage: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%) 1'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                            }}
                            >
                                <CardBody className="p-4">
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <FaRobot style={{ color: '#ffffff', fontSize: '1.5rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#333333',
                                        marginBottom: '1rem',
                                        fontSize: '1.25rem'
                                    }}>
                                        AI Chatbot
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.6',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Get instant assistance with our AI-powered chatbot for FAQs, borrowing advice, and deadline reminders.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* Feature Card 6: Analytics Dashboard */}
                        <Col md={4} className="mb-4">
                            <Card className="border-0 shadow-sm h-100" style={{
                                borderRadius: '12px',
                                transition: 'all 0.3s ease',
                                borderTop: '4px solid transparent',
                                borderImage: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%) 1'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                            }}
                            >
                                <CardBody className="p-4">
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <FaChartBar style={{ color: '#ffffff', fontSize: '1.5rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#333333',
                                        marginBottom: '1rem',
                                        fontSize: '1.25rem'
                                    }}>
                                        Analytics Dashboard
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.6',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Track usage patterns, popular resources, and generate comprehensive reports for better decision making.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </div>

            {/* Multi-College Support Section */}
            <div ref={supportRef} style={{ 
                scrollMarginTop: '80px',
                paddingTop: '5rem', 
                paddingBottom: '5rem', 
                background: 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)',
                position: 'relative'
            }}>
                <Container>
                    <Row>
                        <Col className="text-center mb-5">
                            <h2 style={{
                                fontSize: '2.75rem',
                                fontWeight: 'bold',
                                color: '#333333',
                                marginBottom: '1rem'
                            }}>
                                Multi-College Support
                            </h2>
                            <div style={{
                                width: '80px',
                                height: '4px',
                                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                margin: '0 auto 1.5rem',
                                borderRadius: '2px'
                            }}></div>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {/* College of Information Technology */}
                        <Col md={6} lg={4} className="mb-4">
                            <Card className="border-0 shadow-lg h-100" style={{
                                borderRadius: '16px',
                                transition: 'all 0.3s ease',
                                background: 'linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%)',
                                border: '2px solid #1976d2'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(25, 118, 210, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            >
                                <CardBody className="p-4 text-center">
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1.5rem',
                                        boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
                                    }}>
                                        <FaCode style={{ color: '#ffffff', fontSize: '2rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#1976d2',
                                        marginBottom: '1rem',
                                        fontSize: '1.3rem'
                                    }}>
                                        College of Information Technology
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.7',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Networking devices, laptops, servers, development kits, and IT equipment for students and faculty.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* College of Science */}
                        <Col md={6} lg={4} className="mb-4">
                            <Card className="border-0 shadow-lg h-100" style={{
                                borderRadius: '16px',
                                transition: 'all 0.3s ease',
                                background: 'linear-gradient(135deg, #ffffff 0%, #e8f5e9 100%)',
                                border: '2px solid #4caf50'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(76, 175, 80, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            >
                                <CardBody className="p-4 text-center">
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1.5rem',
                                        boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                                    }}>
                                        <FaFlask style={{ color: '#ffffff', fontSize: '2rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#4caf50',
                                        marginBottom: '1rem',
                                        fontSize: '1.3rem'
                                    }}>
                                        College of Science
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.7',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Microscopes, laboratory sets, scientific instruments, measurement tools, and research equipment.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* College of Engineering */}
                        <Col md={6} lg={4} className="mb-4">
                            <Card className="border-0 shadow-lg h-100" style={{
                                borderRadius: '16px',
                                transition: 'all 0.3s ease',
                                background: 'linear-gradient(135deg, #ffffff 0%, #fff3e0 100%)',
                                border: '2px solid #ff9800'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(255, 152, 0, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            >
                                <CardBody className="p-4 text-center">
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1.5rem',
                                        boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                                    }}>
                                        <FaCogs style={{ color: '#ffffff', fontSize: '2rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#ff9800',
                                        marginBottom: '1rem',
                                        fontSize: '1.3rem'
                                    }}>
                                        College of Engineering
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.7',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Circuit boards, 3D printing tools, mechanical equipment, sensors, and engineering prototyping devices.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* College of Business Studies */}
                        <Col md={6} lg={4} className="mb-4">
                            <Card className="border-0 shadow-lg h-100" style={{
                                borderRadius: '16px',
                                transition: 'all 0.3s ease',
                                background: 'linear-gradient(135deg, #ffffff 0%, #f3e5f5 100%)',
                                border: '2px solid #9c27b0'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(156, 39, 176, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            >
                                <CardBody className="p-4 text-center">
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1.5rem',
                                        boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
                                    }}>
                                        <FaBriefcase style={{ color: '#ffffff', fontSize: '2rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#9c27b0',
                                        marginBottom: '1rem',
                                        fontSize: '1.3rem'
                                    }}>
                                        College of Business Studies
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.7',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Projectors, simulation software, presentation equipment, business analysis tools, and conference resources.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>

                        {/* College of Creative Industries */}
                        <Col md={6} lg={4} className="mb-4">
                            <Card className="border-0 shadow-lg h-100" style={{
                                borderRadius: '16px',
                                transition: 'all 0.3s ease',
                                background: 'linear-gradient(135deg, #ffffff 0%, #fce4ec 100%)',
                                border: '2px solid #e91e63'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(233, 30, 99, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            >
                                <CardBody className="p-4 text-center">
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        background: 'linear-gradient(135deg, #e91e63 0%, #f48fb1 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1.5rem',
                                        boxShadow: '0 4px 12px rgba(233, 30, 99, 0.3)'
                                    }}>
                                        <FaPalette style={{ color: '#ffffff', fontSize: '2rem' }} />
                                    </div>
                                    <h4 style={{
                                        fontWeight: 'bold',
                                        color: '#e91e63',
                                        marginBottom: '1rem',
                                        fontSize: '1.3rem'
                                    }}>
                                        College of Creative Industries
                                    </h4>
                                    <p style={{
                                        color: '#666666',
                                        lineHeight: '1.7',
                                        margin: 0,
                                        fontSize: '0.95rem'
                                    }}>
                                        Digital cameras, graphic tablets, audio equipment, video production tools, and creative design resources.
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </div>

            {/* User Comments/Testimonials Section */}
            <div ref={commentsRef} style={{ scrollMarginTop: '80px' }}>
                <div style={{ paddingTop: '4rem', paddingBottom: '4rem', background: '#f8f9fa' }}>
                    <Container>
                        <Row>
                            <Col className="text-center mb-5">
                                <h2 style={{
                                    fontSize: '2.5rem',
                                    fontWeight: 'bold',
                                    color: '#333333',
                                    marginBottom: '1rem'
                                }}>
                                    What Our Users Say
                                </h2>
                                <p style={{
                                    fontSize: '1.1rem',
                                    color: '#666666',
                                    maxWidth: '600px',
                                    margin: '0 auto'
                                }}>
                                    Hear from students and staff who are using UTAS Borrowing Hub
                                </p>
                            </Col>
                        </Row>
                    </Container>

                    <div style={{
                        display: 'flex',
                        gap: '1.5rem',
                        overflowX: 'auto',
                        padding: '0 2rem 1rem 2rem',
                        marginBottom: '2rem',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#ff9800 #f0f0f0'
                    }}
                    className="comments-carousel"
                    >
                        {comments.map((comment, index) => (
                            <Card 
                                key={comment.id} 
                                className="border-0 shadow-sm" 
                                style={{ 
                                    borderRadius: '16px',
                                    minWidth: '350px',
                                    maxWidth: '350px',
                                    flexShrink: 0,
                                    transition: 'all 0.3s ease',
                                    animation: `slideIn 0.5s ease-out ${index * 0.1}s both`
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-8px)';
                                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                                }}
                            >
                                <CardBody style={{ padding: '2rem' }}>
                                    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
                                        {[...Array(comment.rating)].map((_, i) => (
                                            <FaStar key={i} style={{ color: '#ff9800', fontSize: '1.2rem' }} />
                                        ))}
                                    </div>
                                    <p style={{ color: '#666666', lineHeight: '1.8', marginBottom: '1.5rem', fontSize: '1rem' }}>
                                        "{comment.text}"
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '50px',
                                            height: '50px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ffffff',
                                            fontWeight: 'bold',
                                            boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                        }}>
                                            {comment.initials}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#333333' }}>{comment.name}</div>
                                            <div style={{ fontSize: '0.9rem', color: '#666666' }}>{comment.role}</div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                    <style>{`
                        @keyframes slideIn {
                            from {
                                opacity: 0;
                                transform: translateX(-30px);
                            }
                            to {
                                opacity: 1;
                                transform: translateX(0);
                            }
                        }
                        .comments-carousel::-webkit-scrollbar {
                            height: 8px;
                        }
                        .comments-carousel::-webkit-scrollbar-track {
                            background: #f0f0f0;
                            border-radius: 4px;
                        }
                        .comments-carousel::-webkit-scrollbar-thumb {
                            background: linear-gradient(135deg, #1976d2 0%, #ff9800 100%);
                            border-radius: 4px;
                        }
                        .comments-carousel::-webkit-scrollbar-thumb:hover {
                            background: linear-gradient(135deg, #1565c0 0%, #f57c00 100%);
                        }
                    `}</style>
                </div>
            </div>

            {/* Comment Form Modal - moved outside testimonials section */}
            {showCommentForm && (
                <Container>
                    <Row className="mt-4">
                                <Col md={8} className="mx-auto">
                                <Card className="border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                                    <CardBody style={{ padding: '2rem' }}>
                                        <h4 style={{ marginBottom: '1.5rem', color: '#333333' }}>Share Your Experience</h4>
                                        <Form>
                                            <Row>
                                                <Col md={6}>
                                                    <FormGroup>
                                                        <Label for="commentName">Your Name *</Label>
                                                        <Input
                                                            type="text"
                                                            id="commentName"
                                                            value={newComment.name}
                                                            onChange={(e) => setNewComment({ ...newComment, name: e.target.value })}
                                                            placeholder="Enter your name"
                                                        />
                                                    </FormGroup>
                                                </Col>
                                                <Col md={6}>
                                                    <FormGroup>
                                                        <Label for="commentRole">Your Role</Label>
                                                        <Input
                                                            type="text"
                                                            id="commentRole"
                                                            value={newComment.role}
                                                            onChange={(e) => setNewComment({ ...newComment, role: e.target.value })}
                                                            placeholder="e.g., Student, Staff"
                                                        />
                                                    </FormGroup>
                                                </Col>
                                            </Row>
                                            <FormGroup>
                                                <Label for="commentRating">Rating *</Label>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                                    {[1, 2, 3, 4, 5].map((rating) => (
                                                        <FaStar
                                                            key={rating}
                                                            style={{
                                                                color: rating <= newComment.rating ? '#ff9800' : '#ddd',
                                                                fontSize: '1.5rem',
                                                                cursor: 'pointer'
                                                            }}
                                                            onClick={() => setNewComment({ ...newComment, rating })}
                                                        />
                                                    ))}
                                                </div>
                                            </FormGroup>
                                            <FormGroup>
                                                <Label for="commentText">Your Review *</Label>
                                                <Input
                                                    type="textarea"
                                                    id="commentText"
                                                    rows="4"
                                                    value={newComment.text}
                                                    onChange={(e) => setNewComment({ ...newComment, text: e.target.value })}
                                                    placeholder="Share your experience with UTAS Borrowing Hub..."
                                                />
                                            </FormGroup>
                                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                                <Button
                                                    onClick={() => {
                                                        setShowCommentForm(false);
                                                        setNewComment({ name: '', role: '', text: '', rating: 5 });
                                                    }}
                                                    style={{
                                                        background: '#f5f5f5',
                                                        color: '#333333',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        padding: '0.75rem 1.5rem'
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={handleAddComment}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        padding: '0.75rem 1.5rem'
                                                    }}
                                                >
                                                    Submit Review
                                                </Button>
                                            </div>
                                        </Form>
                                    </CardBody>
                                </Card>
                        </Col>
                    </Row>
                </Container>
            )}

            {/* Chatbot Button - Floating */}
            <div
                onClick={() => setChatbotOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                }}
            >
                <FaComments style={{ color: '#ffffff', fontSize: '1.5rem' }} />
            </div>

            {/* Chatbot Modal */}
            <Modal isOpen={chatbotOpen} toggle={() => setChatbotOpen(false)} style={{ maxWidth: '400px' }}>
                <ModalHeader toggle={() => setChatbotOpen(false)} style={{
                    background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                    color: '#ffffff',
                    borderBottom: 'none'
                }}>
                    <FaRobot className="me-2" /> AI Assistant
                </ModalHeader>
                <ModalBody style={{ padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        {chatMessages.map((msg, index) => (
                            <div
                                key={index}
                                style={{
                                    marginBottom: '1rem',
                                    textAlign: msg.type === 'bot' ? 'left' : 'right'
                                }}
                            >
                                <div style={{
                                    display: 'inline-block',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '12px',
                                    background: msg.type === 'bot' ? '#f0f0f0' : 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                    color: msg.type === 'bot' ? '#333333' : '#ffffff',
                                    maxWidth: '80%',
                                    fontSize: '0.9rem'
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Input
                            type="text"
                            placeholder="Type your message..."
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && chatMessage.trim()) {
                                    const userMsg = { type: 'user', text: chatMessage };
                                    setChatMessages([...chatMessages, userMsg]);
                                    setChatMessage('');
                                    
                                    setTimeout(() => {
                                        const botResponses = [
                                            "I'm here to help! You can ask me about borrowing resources, checking availability, or managing your account.",
                                            "Great question! You can search for resources using the search bar, or browse by category.",
                                            "To borrow a resource, simply click on it and select 'Borrow'. Make sure to check the due date!",
                                            "If you need help with reservations, I can guide you through the process. Would you like to know more?",
                                            "You can track all your borrows in the 'My Borrows' section. Don't forget to return items on time!"
                                        ];
                                        const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];
                                        setChatMessages(prev => [...prev, { type: 'bot', text: randomResponse }]);
                                    }, 1000);
                                }
                            }}
                            style={{ flex: 1 }}
                        />
                        <Button
                            onClick={() => {
                                if (chatMessage.trim()) {
                                    const userMsg = { type: 'user', text: chatMessage };
                                    setChatMessages([...chatMessages, userMsg]);
                                    setChatMessage('');
                                    
                                    setTimeout(() => {
                                        const botResponses = [
                                            "I'm here to help! You can ask me about borrowing resources, checking availability, or managing your account.",
                                            "Great question! You can search for resources using the search bar, or browse by category.",
                                            "To borrow a resource, simply click on it and select 'Borrow'. Make sure to check the due date!",
                                            "If you need help with reservations, I can guide you through the process. Would you like to know more?",
                                            "You can track all your borrows in the 'My Borrows' section. Don't forget to return items on time!"
                                        ];
                                        const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];
                                        setChatMessages(prev => [...prev, { type: 'bot', text: randomResponse }]);
                                    }, 1000);
                                }
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                border: 'none'
                            }}
                        >
                            <FaArrowRight />
                        </Button>
                    </div>
                </ModalBody>
            </Modal>

            {/* Footer */}
            <footer style={{
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e3f2fd 50%, #fff3e0 100%)',
                padding: '4rem 0 2rem',
                marginTop: '4rem',
                borderTop: '1px solid #e0e0e0'
            }}>
                <Container>
                    <Row className="mb-4">
                        {/* Mission Section */}
                        <Col md={3} className="mb-4 mb-md-0">
                            <h5 style={{ 
                                color: '#1976d2',
                                fontWeight: 'bold',
                                marginBottom: '1.5rem',
                                fontSize: '1.4rem',
                                letterSpacing: '0.5px'
                            }}>
                                UTAS Borrowing Hub
                            </h5>
                            <p style={{ 
                                color: '#333333',
                                fontSize: '1.05rem',
                                lineHeight: '1.8',
                                margin: 0,
                                fontWeight: '500'
                            }}>
                                Empowering education through digital innovation and resource sharing.
                            </p>
                        </Col>

                        {/* Platform Links */}
                        <Col md={3} className="mb-4 mb-md-0">
                            <h6 style={{ 
                                color: '#1976d2',
                                fontWeight: 'bold',
                                marginBottom: '1.5rem',
                                fontSize: '1.15rem',
                                letterSpacing: '0.5px'
                            }}>
                                Platform
                            </h6>
                            <ul style={{ 
                                listStyle: 'none',
                                padding: 0,
                                margin: 0
                            }}>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="#features" 
                                        onClick={(e) => { e.preventDefault(); scrollToSection(featuresRef); }}
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        Features
                                    </a>
                                </li>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="#" 
                                        onClick={(e) => { e.preventDefault(); }}
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        Pricing
                                    </a>
                                </li>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="#" 
                                        onClick={(e) => { e.preventDefault(); }}
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        Security
                                    </a>
                                </li>
                            </ul>
                        </Col>

                        {/* Support Links */}
                        <Col md={3} className="mb-4 mb-md-0">
                            <h6 style={{ 
                                color: '#1976d2',
                                fontWeight: 'bold',
                                marginBottom: '1.5rem',
                                fontSize: '1.15rem',
                                letterSpacing: '0.5px'
                            }}>
                                Support
                            </h6>
                            <ul style={{ 
                                listStyle: 'none',
                                padding: 0,
                                margin: 0
                            }}>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="#" 
                                        onClick={(e) => { e.preventDefault(); setChatbotOpen(true); }}
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        Help Center
                                    </a>
                                </li>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="mailto:info@utas.edu.om" 
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        Contact Us
                                    </a>
                                </li>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="#" 
                                        onClick={(e) => { e.preventDefault(); }}
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        Status
                                    </a>
                                </li>
                            </ul>
                        </Col>

                        {/* University Links */}
                        <Col md={3} className="mb-4 mb-md-0">
                            <h6 style={{ 
                                color: '#1976d2',
                                fontWeight: 'bold',
                                marginBottom: '1.5rem',
                                fontSize: '1.15rem',
                                letterSpacing: '0.5px'
                            }}>
                                University
                            </h6>
                            <ul style={{ 
                                listStyle: 'none',
                                padding: 0,
                                margin: 0
                            }}>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="https://www.utas.edu.om" 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        UTAS Website
                                    </a>
                                </li>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="#" 
                                        onClick={(e) => { e.preventDefault(); }}
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        About
                                    </a>
                                </li>
                                <li style={{ marginBottom: '1rem' }}>
                                    <a 
                                        href="#" 
                                        onClick={(e) => { e.preventDefault(); }}
                                        style={{ 
                                            color: '#555555',
                                            textDecoration: 'none',
                                            fontSize: '1rem',
                                            fontWeight: '500',
                                            transition: 'color 0.3s ease',
                                            display: 'block'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#ff9800'}
                                        onMouseLeave={(e) => e.target.style.color = '#555555'}
                                    >
                                        Careers
                                    </a>
                                </li>
                            </ul>
                        </Col>
                    </Row>

                    {/* Separator Line */}
                    <hr style={{ 
                        borderColor: '#e0e0e0',
                        margin: '2rem 0',
                        opacity: 0.5
                    }} />

                    {/* Bottom Section */}
                    <Row className="align-items-center">
                        <Col md={6}>
                            <p style={{ 
                                color: '#333333',
                                margin: 0,
                                fontSize: '1rem',
                                fontWeight: '500'
                            }}>
                                &copy; {new Date().getFullYear()} University of Technology and Applied Sciences. All rights reserved.
                            </p>
                        </Col>
                        <Col md={6} className="text-end">
                            <div style={{ 
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '1rem'
                            }}>
                                <a 
                                    href="https://facebook.com" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)',
                                        border: '2px solid #ff9800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#1976d2',
                                        textDecoration: 'none',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#ff9800';
                                        e.currentTarget.style.color = '#ffffff';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)';
                                        e.currentTarget.style.color = '#1976d2';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    <FaFacebook />
                                </a>
                                <a 
                                    href="https://twitter.com" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)',
                                        border: '2px solid #ff9800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#1976d2',
                                        textDecoration: 'none',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#ff9800';
                                        e.currentTarget.style.color = '#ffffff';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)';
                                        e.currentTarget.style.color = '#1976d2';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    <FaTwitter />
                                </a>
                                <a 
                                    href="https://linkedin.com" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)',
                                        border: '2px solid #ff9800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#1976d2',
                                        textDecoration: 'none',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#ff9800';
                                        e.currentTarget.style.color = '#ffffff';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)';
                                        e.currentTarget.style.color = '#1976d2';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    <FaLinkedin />
                                </a>
                                <a 
                                    href="https://instagram.com" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)',
                                        border: '2px solid #ff9800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#1976d2',
                                        textDecoration: 'none',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#ff9800';
                                        e.currentTarget.style.color = '#ffffff';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)';
                                        e.currentTarget.style.color = '#1976d2';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    <FaInstagram />
                                </a>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </footer>

            {/* CSS Animations */}
            <style>{`
                @keyframes gentleShake {
                    0%, 100% { 
                        transform: translateX(0px) translateY(0px) rotate(0deg); 
                    }
                    25% { 
                        transform: translateX(-2px) translateY(-1px) rotate(-1deg); 
                    }
                    50% { 
                        transform: translateX(2px) translateY(1px) rotate(1deg); 
                    }
                    75% { 
                        transform: translateX(-1px) translateY(1px) rotate(-0.5deg); 
                    }
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
