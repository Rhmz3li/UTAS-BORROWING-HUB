import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, CardBody, Form, FormGroup, Label, Input, Button } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { login, clearError } from "../redux/reducers/authReducer.js";
import { useFormik } from "formik";
import { loginSchema } from "../validation/UserSchemaValidation.js";
import { toast } from 'react-toastify';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaLaptop, FaCamera, FaMicroscope, FaShieldAlt, FaMobileAlt, FaClock, FaArrowLeft, FaHome } from 'react-icons/fa';
import logoImg from '../img/img1.png';

const Login = () => {
    let [showPassword, setShowPassword] = useState(false);
    const [localErrorMessage, setLocalErrorMessage] = useState(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isLoading, user, isError, errorMessage } = useSelector((state) => state.auth);

    useEffect(() => {
        if (user) {
            navigate('/home');
        }
    }, [user, navigate]);

    // Update local error message when Redux error changes
    useEffect(() => {
        if (isError && errorMessage) {
            setLocalErrorMessage(errorMessage);
        }
    }, [isError, errorMessage]);


    const formik = useFormik({
        initialValues: {
            email: '',
            password: ''
        },
        validationSchema: loginSchema,
        onSubmit: async (values) => {
            try {
                // Clear local error before attempting login
                setLocalErrorMessage(null);
                const result = await dispatch(login(values)).unwrap();
                if (result && result.user) {
                    toast.success('Login successful!');
                    // Redirect based on user role
                    if (result.user.role === 'Admin' || result.user.role === 'Assistant') {
                        navigate('/admin/dashboard');
                    } else {
                        navigate('/home');
                    }
                } else {
                    toast.error('Login failed. Please try again.');
                }
            } catch (error) {
                // Handle different error formats - use the error message from AuthSlice
                let errorMsg = 'Login failed. Please try again.';
                
                // The error from unwrap() should contain the error message from AuthSlice
                if (typeof error === 'string') {
                    errorMsg = error;
                } else if (error?.message) {
                    errorMsg = error.message;
                } else if (error?.payload) {
                    errorMsg = error.payload;
                }
                
                // Set local error message (this will persist even if Redux state changes)
                // The useEffect will also update it when Redux state changes
                setLocalErrorMessage(errorMsg);
                
                toast.error(errorMsg, {
                    autoClose: 5000,
                    position: 'top-center'
                });
            }
        }
    });

    return (
        <div style={{ 
            minHeight: '100vh', 
            display: 'flex',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            position: 'relative'
        }}>
            {/* Home Button - Arrow */}
            <Button
                onClick={() => navigate('/')}
                style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    zIndex: 1000,
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '50%',
                    width: '45px',
                    height: '45px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                }}
                title="Go to Home Page"
            >
                <FaArrowLeft style={{ color: '#1976d2', fontSize: '1.2rem' }} />
            </Button>

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
                {/* Logo and Title */}
                <div style={{ 
                    marginBottom: '3rem',
                    textAlign: 'center',
                    zIndex: 2
                }}>
                    <img 
                        src={logoImg} 
                        alt="UTAS Borrowing Hub" 
                        style={{ 
                            width: '80px', 
                            height: '80px', 
                            marginBottom: '1.5rem',
                            filter: 'brightness(0) invert(1)'
                        }} 
                    />
                    <h1 style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: 'bold', 
                        marginBottom: '1rem',
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
                        fontSize: '3rem', 
                        fontWeight: 'bold', 
                        marginBottom: '1rem',
                        color: '#ffffff'
                    }}>
                        Welcome Back!
                    </h2>
                    <p style={{ 
                        fontSize: '1.1rem', 
                        lineHeight: '1.6',
                        color: 'rgba(255, 255, 255, 0.95)',
                        maxWidth: '500px'
                    }}>
                        Access your digital resource management platform and continue your borrowing journey with ease.
                    </p>
                </div>

                {/* Resource Icons */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '2rem',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    zIndex: 2
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        <FaLaptop style={{ fontSize: '1.5rem' }} />
                        <span style={{ fontWeight: '500' }}>Laptop</span>
                    </div>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        <FaCamera style={{ fontSize: '1.5rem' }} />
                        <span style={{ fontWeight: '500' }}>Camera</span>
                    </div>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        <FaMicroscope style={{ fontSize: '1.5rem' }} />
                        <span style={{ fontWeight: '500' }}>Microscope</span>
                    </div>
                </div>

                {/* Feature Buttons */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    width: '100%',
                    maxWidth: '400px',
                    zIndex: 2
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        <FaShieldAlt style={{ fontSize: '1.5rem' }} />
                        <span style={{ fontWeight: '500' }}>Secure & Protected</span>
                    </div>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        <FaMobileAlt style={{ fontSize: '1.5rem' }} />
                        <span style={{ fontWeight: '500' }}>Mobile Friendly</span>
                    </div>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        <FaClock style={{ fontSize: '1.5rem' }} />
                        <span style={{ fontWeight: '500' }}>24/7 Access</span>
                    </div>
                </div>
            </div>

            {/* Right Section - Sign In Form */}
            <div style={{
                flex: '1',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem'
            }}>
                <div style={{ width: '100%', maxWidth: '450px' }}>
                    <h2 style={{
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        color: '#333333',
                        marginBottom: '0.5rem'
                    }}>
                        Sign In
                    </h2>
                    <p style={{
                        fontSize: '1rem',
                        color: '#666666',
                        marginBottom: '2.5rem'
                    }}>
                        Enter your credentials to access your account
                    </p>

                    <Form onSubmit={formik.handleSubmit}>
                        <FormGroup style={{ marginBottom: '1.5rem' }}>
                            <Label for="email" style={{ 
                                fontWeight: '600', 
                                color: '#333333',
                                marginBottom: '0.5rem'
                            }}>
                                Email Address
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
                                    invalid={(formik.touched.email && !!formik.errors.email) || (isError && errorMessage?.toLowerCase().includes('email'))}
                                    style={{
                                        height: '50px',
                                        borderRadius: '8px',
                                        border: (formik.touched.email && formik.errors.email) || (isError && errorMessage?.toLowerCase().includes('email'))
                                            ? '2px solid #dc3545' 
                                            : '1px solid #e0e0e0',
                                        fontSize: '1rem',
                                        paddingLeft: '45px',
                                        backgroundColor: (isError && errorMessage?.toLowerCase().includes('email')) ? '#fff5f5' : '#ffffff'
                                    }}
                                />
                            </div>
                            {formik.touched.email && formik.errors.email && (
                                <div className="text-danger small mt-1">{formik.errors.email}</div>
                            )}
                        </FormGroup>

                        <FormGroup style={{ marginBottom: '1.5rem' }}>
                            <Label for="password" style={{ 
                                fontWeight: '600', 
                                color: '#333333',
                                marginBottom: '0.5rem'
                            }}>
                                Password
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
                                    invalid={(formik.touched.password && !!formik.errors.password) || (isError && errorMessage?.toLowerCase().includes('password'))}
                                    style={{
                                        height: '50px',
                                        borderRadius: '8px',
                                        border: (formik.touched.password && formik.errors.password) || (isError && errorMessage?.toLowerCase().includes('password'))
                                            ? '2px solid #dc3545' 
                                            : '1px solid #e0e0e0',
                                        fontSize: '1rem',
                                        paddingLeft: '45px',
                                        paddingRight: '45px',
                                        backgroundColor: (isError && errorMessage?.toLowerCase().includes('password')) ? '#fff5f5' : '#ffffff'
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
                        </FormGroup>

                        {/* Display login error message prominently */}
                        {localErrorMessage && (
                            <div className="alert alert-danger d-flex align-items-start position-relative" role="alert" style={{
                                borderRadius: '8px',
                                marginBottom: '1.5rem',
                                padding: '1rem',
                                fontSize: '0.95rem',
                                border: '2px solid #dc3545',
                                backgroundColor: '#f8d7da',
                                color: '#721c24'
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" className="bi bi-exclamation-triangle-fill me-2" viewBox="0 0 16 16" style={{ color: '#dc3545', marginTop: '2px', flexShrink: 0 }}>
                                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                                </svg>
                                <div style={{ flex: 1 }}>
                                    <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '1rem' }}>Login Error</strong>
                                    <span>{localErrorMessage}</span>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => {
                                        setLocalErrorMessage(null);
                                        dispatch(clearError());
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        opacity: 0.7,
                                        cursor: 'pointer'
                                    }}
                                    aria-label="Close"
                                ></button>
                            </div>
                        )}

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '2rem'
                        }}>
                            <FormGroup check style={{ marginBottom: 0 }}>
                                <Input 
                                    type="checkbox" 
                                    id="remember" 
                                    style={{ cursor: 'pointer' }}
                                />
                                <Label 
                                    check 
                                    for="remember" 
                                    style={{ 
                                        color: '#666666',
                                        cursor: 'pointer',
                                        marginLeft: '0.5rem'
                                    }}
                                >
                                    Remember me
                                </Label>
                            </FormGroup>
                            <a 
                                href="/forgot-password" 
                                className="text-decoration-none"
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    navigate('/forgot-password'); 
                                }}
                                style={{ 
                                    color: '#1976d2',
                                    fontSize: '0.9rem',
                                    fontWeight: '500'
                                }}
                            >
                                Forgot Password?
                            </a>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                height: '50px',
                                background: isLoading 
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
                                gap: '0.5rem'
                            }}
                        >
                            {isLoading && (
                                <div className="spinner-border spinner-border-sm" role="status" style={{ width: '1rem', height: '1rem' }}>
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            )}
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </Form>

                    {/* Sign Up Link */}
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ 
                            color: '#666666',
                            marginBottom: 0
                        }}>
                            Don't have an account?{' '}
                            <a 
                                href="/register" 
                                className="text-decoration-none fw-bold" 
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    navigate('/register'); 
                                }}
                                style={{ 
                                    color: '#1976d2',
                                    fontWeight: '600'
                                }}
                            >
                                Sign up here
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
