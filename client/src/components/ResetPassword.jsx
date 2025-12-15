import { Container, Row, Col, Card, CardBody, Form, FormGroup, Label, Input, Button } from "reactstrap";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaLock, FaEye, FaEyeSlash, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import axios from 'axios';
import { resetPasswordSchema } from '../validation/UserSchemaValidation.js';

const ResetPassword = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isValidatingToken, setIsValidatingToken] = useState(true);
    const [isValidToken, setIsValidToken] = useState(false);
    const [passwordReset, setPasswordReset] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    // Verify token validity on component mount
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                toast.error('Invalid or missing reset token');
                setTimeout(() => navigate('/forgot-password'), 2000);
                return;
            }

            try {
                const response = await axios.get(`http://localhost:5000/verify-reset-token?token=${token}`);
                if (response.data.success) {
                    setIsValidToken(true);
                } else {
                    toast.error('Invalid or expired reset token');
                    setTimeout(() => navigate('/forgot-password'), 2000);
                }
            } catch (error) {
                let errorMessage = 'Invalid or expired reset token';
                
                if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                }
                
                toast.error(errorMessage);
                setTimeout(() => navigate('/forgot-password'), 2000);
            } finally {
                setIsValidatingToken(false);
            }
        };

        verifyToken();
    }, [token, navigate]);

    const formik = useFormik({
        initialValues: {
            password: '',
            confirmPassword: ''
        },
        validationSchema: resetPasswordSchema,
        onSubmit: async (values, { setSubmitting }) => {
            try {
                const response = await axios.post('http://localhost:5000/reset-password', {
                    token,
                    password: values.password,
                    confirmPassword: values.confirmPassword
                });
                
                if (response.data.success) {
                    setPasswordReset(true);
                    toast.success('Password has been reset successfully!');
                    setTimeout(() => {
                        navigate('/login');
                    }, 3000);
                }
            } catch (error) {
                let errorMessage = 'Failed to reset password. Please try again.';
                
                if (error.response?.data?.message) {
                    const serverMessage = error.response.data.message;
                    
                    if (serverMessage.includes('expired')) {
                        errorMessage = 'This reset link has expired. Please request a new password reset link.';
                    } else if (serverMessage.includes('Invalid') || serverMessage.includes('invalid')) {
                        errorMessage = 'This reset link is invalid or has already been used. Please request a new password reset link.';
                    } else if (serverMessage.includes('different from your current password')) {
                        errorMessage = 'New password must be different from your current password. Please choose a different password.';
                    } else if (serverMessage.includes('used before')) {
                        errorMessage = 'You cannot use a password that you have used before. Please choose a new password.';
                    } else if (serverMessage.includes('Password must')) {
                        errorMessage = serverMessage;
                    } else {
                        errorMessage = serverMessage;
                    }
                }
                
                toast.error(errorMessage, {
                    autoClose: 6000,
                    position: 'top-center'
                });
            } finally {
                setSubmitting(false);
            }
        }
    });

    // Calculate password strength
    const calculatePasswordStrength = (password) => {
        if (!password) return { level: 0, text: '', color: '' };
        
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

    const passwordStrength = calculatePasswordStrength(formik.values.password);

    // Password requirements checklist
    const passwordRequirements = [
        { 
            text: 'At least 8 characters long', 
            met: formik.values.password?.length >= 8,
            icon: formik.values.password?.length >= 8 ? '✓' : '○'
        },
        { 
            text: 'Contains uppercase letter', 
            met: /[A-Z]/.test(formik.values.password || ''),
            icon: /[A-Z]/.test(formik.values.password || '') ? '✓' : '○'
        },
        { 
            text: 'Contains lowercase letter', 
            met: /[a-z]/.test(formik.values.password || ''),
            icon: /[a-z]/.test(formik.values.password || '') ? '✓' : '○'
        },
        { 
            text: 'Contains number', 
            met: /[0-9]/.test(formik.values.password || ''),
            icon: /[0-9]/.test(formik.values.password || '') ? '✓' : '○'
        },
        { 
            text: 'Contains special character', 
            met: /[^a-zA-Z0-9]/.test(formik.values.password || ''),
            icon: /[^a-zA-Z0-9]/.test(formik.values.password || '') ? '✓' : '○'
        }
    ];

    // Show loading state while validating token
    if (isValidatingToken) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
                <Card className="shadow-lg border-0" style={{ borderRadius: '16px' }}>
                    <CardBody className="p-5 text-center">
                        <FaSpinner className="fa-spin" style={{ fontSize: '2rem', color: '#1976d2', marginBottom: '1rem' }} />
                        <p style={{ color: '#666666', margin: 0 }}>Verifying reset link...</p>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // Show error state if token is invalid
    if (!isValidToken) {
        return null; // Will redirect to forgot-password
    }

    // Show success state after password reset
    if (passwordReset) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                padding: '2rem',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
                <Container>
                    <Row className="justify-content-center">
                        <Col md={6} lg={5}>
                            <Card className="shadow-lg border-0" style={{ borderRadius: '16px' }}>
                                <CardBody className="p-5 text-center">
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1.5rem'
                                    }}>
                                        <FaCheckCircle style={{ fontSize: '2rem', color: '#ffffff' }} />
                                    </div>
                                    <h2 style={{
                                        fontSize: '2rem',
                                        fontWeight: 'bold',
                                        color: '#333333',
                                        marginBottom: '1rem'
                                    }}>
                                        Password Reset Successful!
                                    </h2>
                                    <p style={{
                                        fontSize: '1rem',
                                        color: '#666666',
                                        marginBottom: '2rem'
                                    }}>
                                        Your password has been reset successfully. Redirecting to login...
                                    </p>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </div>
        );
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
            padding: '2rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <Container>
                <Row className="justify-content-center">
                    <Col md={8} lg={7}>
                        <Card className="shadow-lg border-0" style={{ borderRadius: '16px' }}>
                            <CardBody className="p-5">
                                <div className="text-center mb-4">
                                    <h2 style={{
                                        fontSize: '2rem',
                                        fontWeight: 'bold',
                                        color: '#333333',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Reset Password
                                    </h2>
                                    <p style={{
                                        fontSize: '1rem',
                                        color: '#666666'
                                    }}>
                                        Enter your new password below. Make sure it meets all requirements.
                                    </p>
                                </div>

                                <Form onSubmit={formik.handleSubmit}>
                                    <FormGroup style={{ marginBottom: '1.5rem' }}>
                                        <Label for="password" style={{ 
                                            fontWeight: '600', 
                                            color: '#333333',
                                            marginBottom: '0.5rem'
                                        }}>
                                            New Password
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
                                                placeholder="Enter new password"
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
                                                        color: passwordStrength.color, 
                                                        fontWeight: 'bold' 
                                                    }}>
                                                        {passwordStrength.text}
                                                    </small>
                                                </div>
                                                <div className="progress" style={{ height: '6px', borderRadius: '3px' }}>
                                                    <div 
                                                        className="progress-bar" 
                                                        role="progressbar"
                                                        style={{ 
                                                            width: `${passwordStrength.percentage}%`,
                                                            backgroundColor: passwordStrength.color,
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
                                                    {passwordRequirements.map((req, idx) => (
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

                                    <FormGroup style={{ marginBottom: '2rem' }}>
                                        <Label for="confirmPassword" style={{ 
                                            fontWeight: '600', 
                                            color: '#333333',
                                            marginBottom: '0.5rem'
                                        }}>
                                            Confirm Password
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
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                id="confirmPassword"
                                                name="confirmPassword"
                                                className="ps-5 pe-5"
                                                placeholder="Confirm new password"
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
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                style={{ 
                                                    right: '15px', 
                                                    top: '50%', 
                                                    transform: 'translateY(-50%)',
                                                    zIndex: 10, 
                                                    cursor: 'pointer',
                                                    color: '#999999'
                                                }}
                                            >
                                                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                            </button>
                                        </div>
                                        {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                                            <div className="text-danger small mt-1">{formik.errors.confirmPassword}</div>
                                        )}
                                    </FormGroup>

                                    <Button
                                        type="submit"
                                        disabled={formik.isSubmitting}
                                        style={{
                                            width: '100%',
                                            height: '50px',
                                            background: formik.isSubmitting 
                                                ? '#94c5f4' 
                                                : 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#ffffff',
                                            fontWeight: '600',
                                            fontSize: '1rem'
                                        }}
                                    >
                                        {formik.isSubmitting ? (
                                            <>
                                                <FaSpinner className="fa-spin me-2" />
                                                Resetting...
                                            </>
                                        ) : (
                                            'Reset Password'
                                        )}
                                    </Button>
                                </Form>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default ResetPassword;
