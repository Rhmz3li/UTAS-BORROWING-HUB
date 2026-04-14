import { Container, Row, Col, Card, CardBody, Form, FormGroup, Label, Input, Button } from "reactstrap";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEnvelope, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as yup from 'yup';
import axios from 'axios';

// Validation schema for forgot password
const forgotPasswordSchema = yup.object().shape({
    email: yup
        .string()
        .required('Email is required')
        .email('Please enter a valid email address')
        .matches(/^[^\s@]+@utas\.edu\.om$/, 'Email must be a valid UTAS email address (@utas.edu.om)')
});

const ForgotPassword = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const navigate = useNavigate();

    const formik = useFormik({
        initialValues: {
            email: ''
        },
        validationSchema: forgotPasswordSchema,
        onSubmit: async (values) => {
            setErrorMessage(null);
            setIsLoading(true);
            
            try {
                const response = await axios.post('http://localhost:5000/forgot-password', { email: values.email });
                if (response && response.data && response.data.success) {
                    setEmailSent(true);
                    toast.success('Password reset link has been sent to your email!');
                } else {
                    const errorMsg = response?.data?.message || 'Failed to send reset email. Please try again.';
                    setErrorMessage(errorMsg);
                    toast.error(errorMsg);
                }
            } catch (error) {
                console.error('Forgot password error:', error);
                let errorMsg = 'Failed to send reset email. Please try again.';
                
                if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
                    errorMsg = 'Cannot connect to server. Please make sure the server is running on http://localhost:5000';
                } else if (error.response) {
                    // Handle specific error messages from server
                    if (error.response.status === 404) {
                        errorMsg = 'Email address not found. Please check your email and try again.';
                    } else if (error.response.status === 400) {
                        errorMsg = error.response.data?.message || 'Please enter a valid email address.';
                    } else if (error.response.status === 429) {
                        errorMsg = error.response.data?.message || 'Too many requests. Please try again later.';
                    } else if (error.response.status === 500) {
                        errorMsg = error.response.data?.message || 'Email service error. Please contact administrator or try again later.';
                    } else {
                        errorMsg = error.response.data?.message || errorMsg;
                    }
                } else if (error.message) {
                    errorMsg = error.message;
                }
                
                setErrorMessage(errorMsg);
                toast.error(errorMsg);
            } finally {
                setIsLoading(false);
            }
        }
    });

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
                            <CardBody className="p-5">
                                <Button
                                    onClick={() => navigate('/login')}
                                    className="mb-4 border-0 bg-transparent p-0"
                                    style={{ color: '#1976d2', cursor: 'pointer' }}
                                >
                                    <FaArrowLeft style={{ marginRight: '0.5rem' }} />
                                    Back to Login
                                </Button>

                                {!emailSent ? (
                                    <>
                                        <div className="text-center mb-4">
                                            <div style={{
                                                width: '80px',
                                                height: '80px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 1.5rem'
                                            }}>
                                                <FaEnvelope style={{ fontSize: '2rem', color: '#ffffff' }} />
                                            </div>
                                            <h2 style={{
                                                fontSize: '2rem',
                                                fontWeight: 'bold',
                                                color: '#333333',
                                                marginBottom: '0.5rem'
                                            }}>
                                                Forgot Password?
                                            </h2>
                                            <p style={{
                                                fontSize: '1rem',
                                                color: '#666666'
                                            }}>
                                                Enter your email address and we'll send you a link to reset your password.
                                            </p>
                                        </div>

                                        <Form onSubmit={formik.handleSubmit}>
                                            {/* Display error message prominently */}
                                            {errorMessage && (
                                                <div className="alert alert-danger d-flex align-items-start" role="alert" style={{
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
                                                        <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '1rem' }}>Error</strong>
                                                        <span>{errorMessage}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <FormGroup style={{ marginBottom: '2rem' }}>
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
                                                        onChange={(e) => {
                                                            formik.handleChange(e);
                                                            // Clear error when user starts typing
                                                            if (errorMessage) {
                                                                setErrorMessage(null);
                                                            }
                                                        }}
                                                        onBlur={formik.handleBlur}
                                                        invalid={(formik.touched.email && !!formik.errors.email) || !!errorMessage}
                                                        style={{
                                                            height: '50px',
                                                            borderRadius: '8px',
                                                            border: (formik.touched.email && formik.errors.email) || errorMessage
                                                                ? '2px solid #dc3545' 
                                                                : '1px solid #e0e0e0',
                                                            fontSize: '1rem',
                                                            paddingLeft: '45px',
                                                            backgroundColor: errorMessage ? '#fff5f5' : '#ffffff'
                                                        }}
                                                    />
                                                </div>
                                                {formik.touched.email && formik.errors.email && (
                                                    <div className="text-danger small mt-1">{formik.errors.email}</div>
                                                )}
                                            </FormGroup>

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
                                                    marginBottom: '1.5rem'
                                                }}
                                            >
                                                {isLoading ? 'Sending...' : 'Send Reset Link'}
                                            </Button>
                                        </Form>
                                    </>
                                ) : (
                                    <div className="text-center">
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
                                            Check Your Email
                                        </h2>
                                        <p style={{
                                            fontSize: '1rem',
                                            color: '#666666',
                                            marginBottom: '2rem',
                                            lineHeight: '1.6'
                                        }}>
                                            We've sent a password reset link to <strong>{formik.values.email}</strong>. 
                                            Please check your email and click on the link to reset your password.
                                        </p>
                                        <Button
                                            onClick={() => navigate('/login')}
                                            style={{
                                                width: '100%',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontWeight: '600',
                                                fontSize: '1rem'
                                            }}
                                        >
                                            Back to Login
                                        </Button>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default ForgotPassword;

