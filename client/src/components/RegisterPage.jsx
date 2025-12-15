import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, CardBody, Form, FormGroup, Label, Input, Button } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { register } from "../redux/reducers/authReducer.js";
import { useFormik } from "formik";
import { registerSchema } from "../validation/UserSchemaValidation.js";
import { toast } from 'react-toastify';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaIdCard, FaPhone, FaBuilding, FaUsers, FaBox, FaChartLine, FaGraduationCap, FaCog, FaUserTie } from 'react-icons/fa';
import logoImg from '../img/img1.png';
import TermsAndPrivacyModal from './TermsAndPrivacyModal.jsx';

const Register = () => {
    let [showPassword, setShowPassword] = useState(false);
    const [termsModalOpen, setTermsModalOpen] = useState(false);
    const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isLoading, user } = useSelector((state) => state.auth);

    // Calculate password strength
    const calculatePasswordStrength = (password) => {
        if (!password) return { level: 0, text: '', color: '', percentage: 0 };
        
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        
        if (strength <= 2) return { level: 1, text: 'Weak', color: '#dc3545', percentage: 33 };
        if (strength <= 4) return { level: 2, text: 'Medium', color: '#ffc107', percentage: 66 };
        return { level: 3, text: 'Strong', color: '#28a745', percentage: 100 };
    };

    // Password requirements checklist
    const getPasswordRequirements = (password) => [
        { 
            text: 'At least 8 characters long', 
            met: password?.length >= 8,
            icon: password?.length >= 8 ? '✓' : '○'
        },
        { 
            text: 'Contains uppercase letter', 
            met: /[A-Z]/.test(password || ''),
            icon: /[A-Z]/.test(password || '') ? '✓' : '○'
        },
        { 
            text: 'Contains lowercase letter', 
            met: /[a-z]/.test(password || ''),
            icon: /[a-z]/.test(password || '') ? '✓' : '○'
        },
        { 
            text: 'Contains number', 
            met: /[0-9]/.test(password || ''),
            icon: /[0-9]/.test(password || '') ? '✓' : '○'
        },
        { 
            text: 'Contains special character', 
            met: /[^a-zA-Z0-9]/.test(password || ''),
            icon: /[^a-zA-Z0-9]/.test(password || '') ? '✓' : '○'
        }
    ];

    // Only redirect if user is already logged in (from previous session)
    // Don't redirect after registration - let them go to login page
    useEffect(() => {
        // Only auto-redirect if user exists from previous session, not from fresh registration
        if (user && localStorage.getItem('token')) {
            navigate('/home');
        }
    }, [user, navigate]);

    const formik = useFormik({
        initialValues: {
            full_name: '',
            email: '',
            password: '',
            confirmPassword: '',
            role: 'Student',
            student_id: '',
            employee_id: '',
            identification_id: '',
            phone: '',
            department: '',
            agreeToTerms: false,
            subscribeNewsletter: false
        },
        validationSchema: registerSchema,
        onSubmit: async (values) => {
            if (!values.agreeToTerms) {
                toast.error('Please agree to the Terms of Service and Privacy Policy');
                return;
            }

            try {
                const { confirmPassword, agreeToTerms, subscribeNewsletter, ...userData } = values;
                
                // Set identification_id and appropriate ID field based on role
                if (userData.role === 'Student' && userData.student_id) {
                    userData.identification_id = userData.student_id;
                } else if (userData.role === 'Staff' && (userData.employee_id || userData.student_id)) {
                    // Support both employee_id and student_id for Staff (backward compatibility)
                    const staffId = userData.employee_id || userData.student_id;
                    userData.employee_id = staffId;
                    userData.identification_id = staffId;
                    delete userData.student_id; // Remove student_id for Staff
                }
                
                // Clean up: remove student_id if not Student
                if (userData.role !== 'Student') {
                    delete userData.student_id;
                }
                
                // Clean up fields
                if (!userData.phone) delete userData.phone;
                if (!userData.department) delete userData.department;
                
                const result = await dispatch(register(userData)).unwrap();
                if (result && result.user) {
                    toast.success('Registration successful! Please login to continue.');
                    if (subscribeNewsletter) {
                        toast.info('You have been subscribed to our newsletter');
                    }
                    // Clear form and navigate to login page after successful registration
                    formik.resetForm();
                    setTimeout(() => {
                        navigate('/login');
                    }, 1000);
                }
            } catch (error) {
                const errorMessage = typeof error === 'string' ? error : error?.message || 'Registration failed. Please try again.';
                toast.error(errorMessage);
            }
        }
    });

    return (
        <div style={{ 
            minHeight: '100vh', 
            display: 'flex',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* Left Section - Branding */}
            <div style={{
                flex: '1',
                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem',
                color: '#ffffff',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Top Buttons */}
                <div style={{
                    position: 'absolute',
                    top: '2rem',
                    left: '2rem',
                    right: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    zIndex: 3
                }}>
                    {/* Student Button - Top Left */}
                    <button
                        onClick={() => formik.setFieldValue('role', 'Student')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '16px',
                            padding: '1rem 1.5rem',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.3s ease',
                            animation: 'float 3s ease-in-out infinite'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <FaGraduationCap style={{ fontSize: '1.8rem' }} />
                        <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Student</span>
                    </button>

                    {/* Assistant Button - Top Right */}
                    <button
                        onClick={() => formik.setFieldValue('role', 'Assistant')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '16px',
                            padding: '1rem 1.5rem',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.3s ease',
                            animation: 'float 3s ease-in-out infinite 0.5s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <FaCog style={{ fontSize: '1.8rem', animation: 'rotate 4s linear infinite' }} />
                        <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Assistant</span>
                    </button>
                </div>

                {/* Logo and Title */}
                <div style={{ 
                    marginBottom: '2rem',
                    textAlign: 'center',
                    zIndex: 2
                }}>
                    <img 
                        src={logoImg} 
                        alt="UTAS Borrowing Hub" 
                        style={{ 
                            width: '100px', 
                            height: '100px', 
                            marginBottom: '1.5rem',
                            filter: 'brightness(0) invert(1)'
                        }} 
                    />
                    <h1 style={{ 
                        fontSize: '2.8rem', 
                        fontWeight: 'bold', 
                        marginBottom: '0.5rem',
                        color: '#ffffff'
                    }}>
                        UTAS Borrowing Hub
                    </h1>
                </div>

                {/* Welcome Message */}
                <div style={{ 
                    marginBottom: '2rem',
                    textAlign: 'center',
                    zIndex: 2
                }}>
                    <h2 style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: 'bold', 
                        marginBottom: '1rem',
                        color: '#ffffff'
                    }}>
                        Join Our Community!
                    </h2>
                    <p style={{ 
                        fontSize: '1.1rem', 
                        lineHeight: '1.6',
                        color: 'rgba(255, 255, 255, 0.95)',
                        maxWidth: '500px',
                        margin: '0 auto'
                    }}>
                        Create your account and start borrowing resources from our comprehensive digital platform designed for students and staff.
                    </p>
                </div>

                {/* Statistics Cards */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    width: '100%',
                    maxWidth: '400px',
                    zIndex: 2,
                    marginBottom: '2rem'
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        animation: 'float 3s ease-in-out infinite 0.2s'
                    }}>
                        <FaUsers style={{ fontSize: '2rem' }} />
                        <div>
                            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>2,500+ Active Users</div>
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        animation: 'float 3s ease-in-out infinite 0.4s'
                    }}>
                        <FaBox style={{ fontSize: '2rem' }} />
                        <div>
                            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>500+ Resources</div>
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        animation: 'float 3s ease-in-out infinite 0.6s'
                    }}>
                        <FaChartLine style={{ fontSize: '2rem' }} />
                        <div>
                            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>10,000+ Transactions</div>
                        </div>
                    </div>
                </div>

                {/* Staff Button - Right Side */}
                <button
                    onClick={() => formik.setFieldValue('role', 'Staff')}
                    style={{
                        position: 'absolute',
                        right: '2rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '16px',
                        padding: '1rem 1.5rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.3s ease',
                        zIndex: 2,
                        animation: 'float 3s ease-in-out infinite 1s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                    }}
                >
                    <FaUserTie style={{ fontSize: '1.8rem' }} />
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Staff</span>
                </button>

                {/* CSS Animations */}
                <style>{`
                    @keyframes float {
                        0%, 100% {
                            transform: translateY(0px);
                        }
                        50% {
                            transform: translateY(-10px);
                        }
                    }
                    @keyframes rotate {
                        from {
                            transform: rotate(0deg);
                        }
                        to {
                            transform: rotate(360deg);
                        }
                    }
                `}</style>
            </div>

            {/* Right Section - Sign Up Form */}
            <div style={{
                flex: '1',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem',
                overflowY: 'auto'
            }}>
                <div style={{ width: '100%', maxWidth: '550px' }}>
                    <h2 style={{
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        color: '#333333',
                        marginBottom: '0.5rem'
                    }}>
                        Create Account
                    </h2>
                    <p style={{
                        fontSize: '1rem',
                        color: '#666666',
                        marginBottom: '2.5rem'
                    }}>
                        Sign up to start using UTAS Borrowing Hub
                    </p>

                    <Form onSubmit={formik.handleSubmit}>
                        <Row>
                            <Col md={6}>
                                <FormGroup style={{ marginBottom: '1.5rem' }}>
                                    <Label for="full_name" style={{ 
                                        fontWeight: '600', 
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Full Name *
                                    </Label>
                                    <div className="position-relative">
                                        <FaUser className="position-absolute" style={{ 
                                            left: '15px', 
                                            top: '50%', 
                                            transform: 'translateY(-50%)',
                                            color: '#999999',
                                            zIndex: 10
                                        }} />
                                        <Input
                                            type="text"
                                            id="full_name"
                                            name="full_name"
                                            className="ps-5"
                                            placeholder="Enter your full name"
                                            value={formik.values.full_name}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            invalid={formik.touched.full_name && !!formik.errors.full_name}
                                            style={{
                                                height: '50px',
                                                borderRadius: '8px',
                                                border: formik.touched.full_name && formik.errors.full_name 
                                                    ? '2px solid #dc3545' 
                                                    : '1px solid #e0e0e0',
                                                fontSize: '1rem',
                                                paddingLeft: '45px'
                                            }}
                                        />
                                    </div>
                                    {formik.touched.full_name && formik.errors.full_name && (
                                        <div className="text-danger small mt-1">{formik.errors.full_name}</div>
                                    )}
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup style={{ marginBottom: '1.5rem' }}>
                                    <Label for="email" style={{ 
                                        fontWeight: '600', 
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Email Address *
                                    </Label>
                                    <div className="position-relative">
                                        <FaEnvelope className="position-absolute" style={{ 
                                            left: '15px', 
                                            top: '50%', 
                                            transform: 'translateY(-50%)',
                                            color: '#999999',
                                            zIndex: 10
                                        }} />
                                        <Input
                                            type="email"
                                            id="email"
                                            name="email"
                                            className="ps-5"
                                            placeholder="Enter your email"
                                            value={formik.values.email}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            invalid={formik.touched.email && !!formik.errors.email}
                                            style={{
                                                height: '50px',
                                                borderRadius: '8px',
                                                border: formik.touched.email && formik.errors.email 
                                                    ? '2px solid #dc3545' 
                                                    : '1px solid #e0e0e0',
                                                fontSize: '1rem',
                                                paddingLeft: '45px'
                                            }}
                                        />
                                    </div>
                                    {formik.touched.email && formik.errors.email && (
                                        <div className="text-danger small mt-1">{formik.errors.email}</div>
                                    )}
                                </FormGroup>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <FormGroup style={{ marginBottom: '1.5rem' }}>
                                    <Label for="password" style={{ 
                                        fontWeight: '600', 
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Password *
                                    </Label>
                                    <div className="position-relative">
                                        <FaLock className="position-absolute" style={{ 
                                            left: '15px', 
                                            top: '50%', 
                                            transform: 'translateY(-50%)',
                                            color: '#999999',
                                            zIndex: 10
                                        }} />
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            id="password"
                                            name="password"
                                            className="ps-5 pe-5"
                                            placeholder="Enter your password"
                                            value={formik.values.password}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            invalid={formik.touched.password && !!formik.errors.password}
                                            style={{
                                                height: '50px',
                                                borderRadius: '8px',
                                                border: formik.touched.password && formik.errors.password 
                                                    ? '2px solid #dc3545' 
                                                    : '1px solid #e0e0e0',
                                                fontSize: '1rem',
                                                paddingLeft: '45px',
                                                paddingRight: '45px'
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="position-absolute border-0 bg-transparent"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ 
                                                right: '15px', 
                                                top: '50%', 
                                                transform: 'translateY(-50%)',
                                                zIndex: 10, 
                                                cursor: 'pointer',
                                                color: '#999999'
                                            }}
                                        >
                                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                    {formik.touched.password && formik.errors.password && (
                                        <div className="text-danger small mt-1">{formik.errors.password}</div>
                                    )}

                                    {/* Password Strength Indicator */}
                                    {formik.values.password && (
                                        <div className="mt-2">
                                            <div className="d-flex justify-content-between mb-1">
                                                <small className="text-muted">Password Strength:</small>
                                                <small style={{
                                                    color: calculatePasswordStrength(formik.values.password).color,
                                                    fontWeight: 'bold'
                                                }}>
                                                    {calculatePasswordStrength(formik.values.password).text}
                                                </small>
                                            </div>
                                            <div className="progress" style={{ height: '6px', borderRadius: '3px' }}>
                                                <div
                                                    className="progress-bar"
                                                    role="progressbar"
                                                    style={{
                                                        width: `${calculatePasswordStrength(formik.values.password).percentage}%`,
                                                        backgroundColor: calculatePasswordStrength(formik.values.password).color,
                                                        transition: 'width 0.3s ease'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Password Requirements */}
                                    {formik.values.password && (
                                        <div className="mt-3">
                                            <small className="text-muted d-block mb-2">Password Requirements:</small>
                                            <div style={{ fontSize: '0.85rem' }}>
                                                {getPasswordRequirements(formik.values.password).map((req, idx) => (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            color: req.met ? '#28a745' : '#6c757d',
                                                            marginBottom: '0.25rem'
                                                        }}
                                                    >
                                                        <span style={{ marginRight: '0.5rem' }}>
                                                            {req.icon}
                                                        </span>
                                                        {req.text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup style={{ marginBottom: '1.5rem' }}>
                                    <Label for="confirmPassword" style={{ 
                                        fontWeight: '600', 
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Confirm Password *
                                    </Label>
                                    <div className="position-relative">
                                        <FaLock className="position-absolute" style={{ 
                                            left: '15px', 
                                            top: '50%', 
                                            transform: 'translateY(-50%)',
                                            color: '#999999',
                                            zIndex: 10
                                        }} />
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            className="ps-5 pe-5"
                                            placeholder="Confirm your password"
                                            value={formik.values.confirmPassword}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            invalid={formik.touched.confirmPassword && !!formik.errors.confirmPassword}
                                            style={{
                                                height: '50px',
                                                borderRadius: '8px',
                                                border: formik.touched.confirmPassword && formik.errors.confirmPassword 
                                                    ? '2px solid #dc3545' 
                                                    : '1px solid #e0e0e0',
                                                fontSize: '1rem',
                                                paddingLeft: '45px',
                                                paddingRight: '45px'
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="position-absolute border-0 bg-transparent"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ 
                                                right: '15px', 
                                                top: '50%', 
                                                transform: 'translateY(-50%)',
                                                zIndex: 10, 
                                                cursor: 'pointer',
                                                color: '#999999'
                                            }}
                                        >
                                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                    {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                                        <div className="text-danger small mt-1">{formik.errors.confirmPassword}</div>
                                    )}
                                </FormGroup>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <FormGroup style={{ marginBottom: '1.5rem' }}>
                                    <Label for="role" style={{ 
                                        fontWeight: '600', 
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Role *
                                    </Label>
                                    <Input
                                        type="select"
                                        id="role"
                                        name="role"
                                        value={formik.values.role}
                                        onChange={formik.handleChange}
                                        style={{
                                            height: '50px',
                                            borderRadius: '8px',
                                            border: '1px solid #e0e0e0',
                                            fontSize: '1rem'
                                        }}
                                    >
                                        <option value="Student">Student</option>
                                        <option value="Staff">Staff</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup style={{ marginBottom: '1.5rem' }}>
                                    <Label for={formik.values.role === 'Student' ? 'student_id' : 'employee_id'} style={{ 
                                        fontWeight: '600', 
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        {formik.values.role === 'Student' ? 'Student ID' : 'Employee ID'} *
                                    </Label>
                                    <div className="position-relative">
                                        <FaIdCard className="position-absolute" style={{ 
                                            left: '15px', 
                                            top: '50%', 
                                            transform: 'translateY(-50%)',
                                            color: '#999999',
                                            zIndex: 10
                                        }} />
                                        <Input
                                            type="text"
                                            id={formik.values.role === 'Student' ? 'student_id' : 'employee_id'}
                                            name={formik.values.role === 'Student' ? 'student_id' : 'employee_id'}
                                            className="ps-5"
                                            placeholder={formik.values.role === 'Student' ? 'Enter your student ID' : 'Enter your employee ID'}
                                            value={formik.values.role === 'Student' ? formik.values.student_id : formik.values.employee_id}
                                            onChange={(e) => {
                                                if (formik.values.role === 'Student') {
                                                    formik.setFieldValue('student_id', e.target.value);
                                                    formik.setFieldValue('identification_id', e.target.value);
                                                } else {
                                                    formik.setFieldValue('employee_id', e.target.value);
                                                    formik.setFieldValue('identification_id', e.target.value);
                                                }
                                            }}
                                            onBlur={formik.handleBlur}
                                            invalid={formik.values.role === 'Student' 
                                                ? (formik.touched.student_id && !!formik.errors.student_id)
                                                : (formik.touched.employee_id && !!formik.errors.employee_id)}
                                            style={{
                                                height: '50px',
                                                borderRadius: '8px',
                                                border: formik.touched.student_id && formik.errors.student_id 
                                                    ? '2px solid #dc3545' 
                                                    : '1px solid #e0e0e0',
                                                fontSize: '1rem',
                                                paddingLeft: '45px'
                                            }}
                                        />
                                    </div>
                                    {(formik.values.role === 'Student' 
                                        ? (formik.touched.student_id && formik.errors.student_id)
                                        : (formik.touched.employee_id && formik.errors.employee_id)) && (
                                        <div className="text-danger small mt-1">
                                            {formik.values.role === 'Student' 
                                                ? formik.errors.student_id 
                                                : formik.errors.employee_id}
                                        </div>
                                    )}
                                </FormGroup>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <FormGroup style={{ marginBottom: '1.5rem' }}>
                                    <Label for="phone" style={{ 
                                        fontWeight: '600', 
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Phone
                                    </Label>
                                    <div className="position-relative">
                                        <FaPhone className="position-absolute" style={{ 
                                            left: '15px', 
                                            top: '50%', 
                                            transform: 'translateY(-50%)',
                                            color: '#999999',
                                            zIndex: 10
                                        }} />
                                        <Input
                                            type="text"
                                            id="phone"
                                            name="phone"
                                            className="ps-5"
                                            placeholder="Enter your phone number"
                                            value={formik.values.phone}
                                            onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        invalid={formik.touched.phone && !!formik.errors.phone}
                                            style={{
                                                height: '50px',
                                                borderRadius: '8px',
                                            border: formik.touched.phone && formik.errors.phone
                                                ? '2px solid #dc3545'
                                                : '1px solid #e0e0e0',
                                                fontSize: '1rem',
                                                paddingLeft: '45px'
                                            }}
                                        />
                                    </div>
                                {formik.touched.phone && formik.errors.phone && (
                                    <div className="text-danger small mt-1">{formik.errors.phone}</div>
                                )}
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup style={{ marginBottom: '1.5rem' }}>
                                    <Label for="department" style={{ 
                                        fontWeight: '600', 
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Department
                                    </Label>
                                    <div className="position-relative">
                                        <FaBuilding className="position-absolute" style={{ 
                                            left: '15px', 
                                            top: '50%', 
                                            transform: 'translateY(-50%)',
                                            color: '#999999',
                                            zIndex: 10
                                        }} />
                                        <Input
                                            type="select"
                                            id="department"
                                            name="department"
                                            className="ps-5"
                                            value={formik.values.department}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            invalid={formik.touched.department && !!formik.errors.department}
                                            style={{
                                                height: '50px',
                                                borderRadius: '8px',
                                                border: formik.touched.department && formik.errors.department 
                                                    ? '2px solid #dc3545' 
                                                    : '1px solid #e0e0e0',
                                                fontSize: '1rem',
                                                paddingLeft: '45px'
                                            }}
                                        >
                                            <option value="">Select Department</option>
                                            <option value="College of Information Technology">College of Information Technology</option>
                                            <option value="College of Science">College of Science</option>
                                            <option value="College of Engineering">College of Engineering</option>
                                            <option value="College of Business Studies">College of Business Studies</option>
                                            <option value="College of Creative Industries">College of Creative Industries</option>
                                        </Input>
                                    </div>
                                    {formik.touched.department && formik.errors.department && (
                                        <div className="text-danger small mt-1">{formik.errors.department}</div>
                                    )}
                                </FormGroup>
                            </Col>
                        </Row>

                        {/* Terms and Newsletter Checkboxes */}
                        <FormGroup style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                <Input
                                    type="checkbox"
                                    id="agreeToTerms"
                                    name="agreeToTerms"
                                    checked={formik.values.agreeToTerms}
                                    onChange={formik.handleChange}
                                    style={{
                                        marginTop: '0.25rem',
                                        cursor: 'pointer',
                                        width: '18px',
                                        height: '18px'
                                    }}
                                />
                                <Label
                                    for="agreeToTerms"
                                    style={{
                                        color: '#666666',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        marginBottom: 0,
                                        lineHeight: '1.5'
                                    }}
                                >
                                    I agree to the{' '}
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setTermsModalOpen(true);
                                        }}
                                        style={{
                                            color: '#1976d2',
                                            textDecoration: 'none',
                                            fontWeight: '500'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                        Terms of Service
                                    </a>
                                    {' '}and{' '}
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setPrivacyModalOpen(true);
                                        }}
                                        style={{
                                            color: '#1976d2',
                                            textDecoration: 'none',
                                            fontWeight: '500'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                        Privacy Policy
                                    </a>
                                </Label>
                            </div>
                            {formik.touched.agreeToTerms && !formik.values.agreeToTerms && (
                                <div className="text-danger small mt-1">You must agree to the Terms of Service and Privacy Policy</div>
                            )}
                        </FormGroup>

                        <FormGroup style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                <Input
                                    type="checkbox"
                                    id="subscribeNewsletter"
                                    name="subscribeNewsletter"
                                    checked={formik.values.subscribeNewsletter}
                                    onChange={formik.handleChange}
                                    style={{
                                        marginTop: '0.25rem',
                                        cursor: 'pointer',
                                        width: '18px',
                                        height: '18px'
                                    }}
                                />
                                <Label
                                    for="subscribeNewsletter"
                                    style={{
                                        color: '#666666',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        marginBottom: 0,
                                        lineHeight: '1.5'
                                    }}
                                >
                                    Subscribe to our newsletter for updates and announcements
                                </Label>
                            </div>
                        </FormGroup>

                        <Button
                            type="submit"
                            disabled={isLoading || !formik.values.agreeToTerms}
                            style={{
                                width: '100%',
                                height: '50px',
                                background: isLoading || !formik.values.agreeToTerms
                                    ? '#94c5f4' 
                                    : 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#ffffff',
                                fontWeight: '600',
                                fontSize: '1rem',
                                marginBottom: '2rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                cursor: isLoading || !formik.values.agreeToTerms ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isLoading && (
                                <div className="spinner-border spinner-border-sm" role="status" style={{ width: '1rem', height: '1rem' }}>
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            )}
                            {isLoading ? 'Creating Account...' : 'Sign Up'}
                        </Button>
                    </Form>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ 
                            color: '#666666',
                            marginBottom: 0
                        }}>
                            Already have an account?{' '}
                            <a 
                                href="/login" 
                                className="text-decoration-none fw-bold" 
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    navigate('/login'); 
                                }}
                                style={{ 
                                    color: '#1976d2',
                                    fontWeight: '600'
                                }}
                            >
                                Sign in here
                            </a>
                        </p>
                    </div>
                </div>
            </div>

            {/* Terms and Privacy Modals */}
            <TermsAndPrivacyModal 
                isOpen={termsModalOpen} 
                toggle={() => setTermsModalOpen(!termsModalOpen)} 
                type="terms" 
            />
            <TermsAndPrivacyModal 
                isOpen={privacyModalOpen} 
                toggle={() => setPrivacyModalOpen(!privacyModalOpen)} 
                type="privacy" 
            />
        </div>
    );
};

export default Register;

