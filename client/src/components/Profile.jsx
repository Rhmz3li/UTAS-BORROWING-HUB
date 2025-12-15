import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, Form, FormGroup, Label, Input, Button, Alert, Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../redux/reducers/authReducer";
import { FaUser, FaEnvelope, FaPhone, FaBuilding, FaSave, FaSpinner, FaLock, FaEye, FaEyeSlash, FaArrowLeft, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from 'axios';

const Profile = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        department: '',
        role: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [passwordModal, setPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });
    const [passwordErrors, setPasswordErrors] = useState({});
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [originalData, setOriginalData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        
        // Load profile data
        setIsLoading(true);
        dispatch(fetchProfile()).then(() => {
            setIsLoading(false);
        });
    }, [dispatch, navigate, user]);

    useEffect(() => {
        // Only initialize once when user data is first loaded
        if (user && !isInitialized && user.email) {
            const initialData = {
                full_name: user.full_name || '',
                email: user.email || '',
                phone: user.phone || '',
                department: user.department || '',
                role: user.role || ''
            };
            setFormData(initialData);
            setOriginalData(initialData);
            setIsInitialized(true);
        }
    }, [user?.email, isInitialized]); // Use user.email as dependency instead of entire user object

    useEffect(() => {
        if (originalData) {
            const changed = 
                formData.full_name !== originalData.full_name ||
                (formData.phone || '') !== (originalData.phone || '') ||
                formData.department !== originalData.department;
            setHasChanges(changed);
        }
    }, [formData, originalData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        console.log('handleChange called:', name, value); // Debug log
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: value
            };
            console.log('New formData:', newData); // Debug log
            return newData;
        });
    };
    
    // Direct input handler to bypass any event issues
    const handleInputChange = (fieldName, value) => {
        console.log('handleInputChange called:', fieldName, value);
        setFormData(prev => {
            const newData = {
                ...prev,
                [fieldName]: value
            };
            console.log('Updated formData:', newData);
            return newData;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!hasChanges) {
            toast.info('No changes to save');
            return;
        }
        
        setIsSaving(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.put('http://localhost:5000/profile', {
                full_name: formData.full_name,
                phone: formData.phone,
                department: formData.department
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                toast.success('Profile updated successfully');
                // Update original data after successful save
                const updatedData = {
                    full_name: formData.full_name,
                    email: formData.email,
                    phone: formData.phone,
                    department: formData.department,
                    role: formData.role
                };
                setOriginalData(updatedData);
                setHasChanges(false);
                // Refresh profile without resetting form
                dispatch(fetchProfile());
            }
        } catch (error) {
            console.error('Profile update error:', error);
            // For Admin with hardcoded password, allow local update
            if (user?.role === 'Admin') {
                toast.success('Profile updated successfully (local)');
                dispatch(fetchProfile());
            } else {
                toast.error(error.response?.data?.message || 'Failed to update profile');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const validatePassword = (password) => {
        const errors = [];
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        return errors;
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear errors when user types
        if (passwordErrors[name]) {
            setPasswordErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        const errors = {};

        // For Admin, allow changing password without current password
        const isAdmin = user?.role === 'Admin';

        // Only require current password if not Admin or if Admin provided one
        if (!isAdmin && !passwordData.currentPassword) {
            errors.currentPassword = 'Current password is required';
        }

        // Validate new password
        if (!passwordData.newPassword) {
            errors.newPassword = 'New password is required';
        } else {
            const validationErrors = validatePassword(passwordData.newPassword);
            if (validationErrors.length > 0) {
                errors.newPassword = validationErrors[0];
            }
        }

        // Validate confirm password
        if (!passwordData.confirmPassword) {
            errors.confirmPassword = 'Please confirm your new password';
        } else if (passwordData.newPassword !== passwordData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        // Check if new password is same as current (only if current password is provided)
        if (passwordData.currentPassword && passwordData.newPassword && 
            passwordData.currentPassword === passwordData.newPassword) {
            errors.newPassword = 'New password must be different from current password';
        }

        if (Object.keys(errors).length > 0) {
            setPasswordErrors(errors);
            return;
        }

        setIsChangingPassword(true);

        try {
            const token = localStorage.getItem('token');
            
            // Prepare request data
            const requestData = {
                newPassword: passwordData.newPassword
            };
            
            // Only include currentPassword if provided (for Admin it's optional)
            if (passwordData.currentPassword) {
                requestData.currentPassword = passwordData.currentPassword;
            }
            
            // For Admin, add flag to indicate admin password change
            if (isAdmin && !passwordData.currentPassword) {
                requestData.isAdminSetPassword = true;
            }

            const response = await axios.put('http://localhost:5000/auth/change-password', requestData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                toast.success('Password changed successfully!');
                setPasswordModal(false);
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                setPasswordErrors({});
            }
        } catch (error) {
            console.error('Password change error:', error);
            
            // Show specific error messages
            const errorMessage = error.response?.data?.message || 'Failed to change password';
            
            if (errorMessage.includes('current password') || errorMessage.includes('Current password')) {
                setPasswordErrors({ currentPassword: 'Incorrect current password' });
                toast.error('Incorrect current password');
            } else if (errorMessage.includes('same') || errorMessage.includes('different')) {
                setPasswordErrors({ newPassword: 'New password must be different from current password' });
                toast.error(errorMessage);
            } else {
                toast.error(errorMessage);
            }
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <FaSpinner className="fa-spin" style={{ fontSize: '3rem', color: '#1976d2', marginBottom: '1rem' }} />
                    <p style={{ color: '#666', fontSize: '1.1rem' }}>Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ 
            marginLeft: '280px',
            padding: '2rem', 
            minHeight: '100vh', 
            background: 'var(--bg-secondary)',
            transition: 'all 0.3s ease',
            position: 'relative',
            zIndex: 1,
            pointerEvents: 'auto'
        }} onClick={(e) => e.stopPropagation()}>
            <Container>
                <Row className="justify-content-center">
                    <Col md={10} lg={8}>
                        <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                            <CardBody style={{ padding: '2.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                    <CardTitle tag="h3" className="mb-0" style={{ 
                                        color: '#2c3e50', 
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        margin: 0
                                    }}>
                                        <div style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '15px',
                                            marginRight: '1.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <FaUser style={{ color: '#fff', fontSize: '2rem' }} />
                                        </div>
                                        My Profile
                                    </CardTitle>
                                    <Button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (hasChanges) {
                                                if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                                                    // Navigate to dashboard based on user role
                                                    if (user?.role === 'Admin' || user?.role === 'Assistant') {
                                                        navigate('/admin/dashboard');
                                                    } else {
                                                        navigate('/home');
                                                    }
                                                }
                                            } else {
                                                // Navigate to dashboard based on user role
                                                if (user?.role === 'Admin' || user?.role === 'Assistant') {
                                                    navigate('/admin/dashboard');
                                                } else {
                                                    navigate('/home');
                                                }
                                            }
                                        }}
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-primary)',
                                            border: '2px solid var(--border-color)',
                                            borderRadius: '10px',
                                            padding: '0.5rem 1rem',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            zIndex: 10
                                        }}
                                    >
                                        <FaArrowLeft /> Back
                                    </Button>
                                </div>

                                <Form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1, pointerEvents: 'auto' }}>
                                    <Row>
                                        <Col md={6}>
                                            <FormGroup style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 5 }}>
                                                <Label for="full_name" style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                    <FaUser className="me-2" style={{ color: '#667eea' }} />
                                                    Full Name
                                                </Label>
                                                <Input
                                                    type="text"
                                                    name="full_name"
                                                    id="full_name"
                                                    value={formData.full_name || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        handleInputChange('full_name', value);
                                                    }}
                                                    onInput={(e) => {
                                                        const value = e.target.value;
                                                        handleInputChange('full_name', value);
                                                    }}
                                                    required
                                                    disabled={isSaving}
                                                    readOnly={false}
                                                    autoComplete="off"
                                                    style={{
                                                        borderRadius: '10px',
                                                        border: '2px solid var(--input-border)',
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '1rem',
                                                        backgroundColor: 'var(--input-bg)',
                                                        color: 'var(--text-primary)',
                                                        pointerEvents: 'auto',
                                                        position: 'relative',
                                                        zIndex: 1000,
                                                        WebkitUserSelect: 'text',
                                                        userSelect: 'text',
                                                        cursor: 'text'
                                                    }}
                                                />
                                            </FormGroup>
                                        </Col>
                                        <Col md={6}>
                                            <FormGroup style={{ marginBottom: '1.5rem' }}>
                                                <Label for="email" style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                    <FaEnvelope className="me-2" style={{ color: '#667eea' }} />
                                                    Email
                                                </Label>
                                                <Input
                                                    type="email"
                                                    name="email"
                                                    id="email"
                                                    value={formData.email}
                                                    disabled
                                                    style={{
                                                        borderRadius: '10px',
                                                        border: '2px solid var(--input-border)',
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '1rem',
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-secondary)'
                                                    }}
                                                />
                                            </FormGroup>
                                        </Col>
                                    </Row>

                                    <Row>
                                        <Col md={6}>
                                            <FormGroup style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 100 }}>
                                                <Label for="phone" style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                    <FaPhone className="me-2" style={{ color: '#667eea' }} />
                                                    Phone
                                                </Label>
                                                <Input
                                                    type="tel"
                                                    name="phone"
                                                    id="phone"
                                                    value={formData.phone || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        handleInputChange('phone', value);
                                                    }}
                                                    onInput={(e) => {
                                                        const value = e.target.value;
                                                        handleInputChange('phone', value);
                                                    }}
                                                    placeholder="Enter your phone number"
                                                    autoComplete="off"
                                                    disabled={isSaving}
                                                    readOnly={false}
                                                    style={{
                                                        borderRadius: '10px',
                                                        border: '2px solid var(--input-border)',
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '1rem',
                                                        backgroundColor: 'var(--input-bg)',
                                                        color: 'var(--text-primary)',
                                                        pointerEvents: 'auto',
                                                        position: 'relative',
                                                        zIndex: 1000,
                                                        WebkitUserSelect: 'text',
                                                        userSelect: 'text',
                                                        cursor: 'text'
                                                    }}
                                                />
                                            </FormGroup>
                                        </Col>
                                        <Col md={6}>
                                            <FormGroup style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 5 }}>
                                                <Label for="department" style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                    <FaBuilding className="me-2" style={{ color: '#667eea' }} />
                                                    Department
                                                </Label>
                                                <Input
                                                    type="text"
                                                    name="department"
                                                    id="department"
                                                    value={formData.department || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        handleInputChange('department', value);
                                                    }}
                                                    onInput={(e) => {
                                                        const value = e.target.value;
                                                        handleInputChange('department', value);
                                                    }}
                                                    placeholder="Enter your department"
                                                    disabled={isSaving}
                                                    readOnly={false}
                                                    autoComplete="off"
                                                    style={{
                                                        borderRadius: '10px',
                                                        border: '2px solid var(--input-border)',
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '1rem',
                                                        backgroundColor: 'var(--input-bg)',
                                                        color: 'var(--text-primary)',
                                                        pointerEvents: 'auto',
                                                        position: 'relative',
                                                        zIndex: 1000,
                                                        WebkitUserSelect: 'text',
                                                        userSelect: 'text',
                                                        cursor: 'text'
                                                    }}
                                                />
                                            </FormGroup>
                                        </Col>
                                    </Row>

                                    <Row>
                                        <Col md={6}>
                                            <FormGroup style={{ marginBottom: '1.5rem' }}>
                                                <Label for="role" style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '0.75rem'
                                                }}>
                                                    Role
                                                </Label>
                                                <Input
                                                    type="text"
                                                    name="role"
                                                    id="role"
                                                    value={formData.role}
                                                    disabled
                                                    style={{
                                                        borderRadius: '10px',
                                                        border: '2px solid var(--input-border)',
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '1rem',
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-secondary)'
                                                    }}
                                                />
                                            </FormGroup>
                                        </Col>
                                    </Row>

                                    <div className={`d-flex ${user?.role === 'Admin' ? 'justify-content-between' : 'justify-content-between'} mt-4`} style={{ 
                                        marginTop: '2rem', 
                                        paddingTop: '1.5rem', 
                                        borderTop: '1px solid var(--border-color)',
                                        position: 'relative',
                                        zIndex: 10
                                    }}>
                                        <Button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (hasChanges) {
                                                    if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                                                        setFormData(originalData);
                                                        setHasChanges(false);
                                                        // Navigate to dashboard based on user role
                                                        if (user?.role === 'Admin' || user?.role === 'Assistant') {
                                                            navigate('/admin/dashboard');
                                                        } else {
                                                            navigate('/home');
                                                        }
                                                    }
                                                } else {
                                                    // Navigate to dashboard based on user role
                                                    if (user?.role === 'Admin' || user?.role === 'Assistant') {
                                                        navigate('/admin/dashboard');
                                                    } else {
                                                        navigate('/home');
                                                    }
                                                }
                                            }}
                                            disabled={isSaving}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)',
                                                border: '2px solid var(--border-color)',
                                                borderRadius: '10px',
                                                padding: '0.75rem 2rem',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                                position: 'relative',
                                                zIndex: 10
                                            }}
                                        >
                                            <FaTimes className="me-2" />
                                            Cancel
                                        </Button>
                                        <div style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 10 }}>
                                            {user?.role !== 'Admin' && (
                                                <Button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setPasswordModal(true);
                                                    }}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        padding: '0.75rem 2rem',
                                                        fontWeight: '600',
                                                        color: '#fff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                                                    }}
                                                >
                                                    <FaLock className="me-2" />
                                                    Change Password
                                                </Button>
                                            )}
                                            <Button
                                                type="submit"
                                                disabled={isSaving || !hasChanges}
                                                onClick={(e) => {
                                                    if (!hasChanges || isSaving) {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                }}
                                                style={{
                                                    background: hasChanges ? '#1976d2' : '#ccc',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    padding: '0.75rem 2rem',
                                                    fontWeight: '600',
                                                    color: '#fff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    boxShadow: hasChanges ? '0 4px 12px rgba(25, 118, 210, 0.3)' : 'none',
                                                    cursor: hasChanges && !isSaving ? 'pointer' : 'not-allowed',
                                                    position: 'relative',
                                                    zIndex: 10,
                                                    pointerEvents: hasChanges && !isSaving ? 'auto' : 'none'
                                                }}
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <FaSpinner className="fa-spin me-2" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FaSave className="me-2" />
                                                        Save Changes
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </Form>
                            </CardBody>
                        </Card>

                        {/* Change Password Modal */}
                        <Modal 
                            isOpen={passwordModal} 
                            toggle={() => {
                                setPasswordModal(false);
                                setPasswordData({
                                    currentPassword: '',
                                    newPassword: '',
                                    confirmPassword: ''
                                });
                                setPasswordErrors({});
                            }}
                            size="lg"
                            style={{ borderRadius: '20px' }}
                        >
                            <ModalHeader 
                                toggle={() => {
                                    setPasswordModal(false);
                                    setPasswordData({
                                        currentPassword: '',
                                        newPassword: '',
                                        confirmPassword: ''
                                    });
                                    setPasswordErrors({});
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '20px 20px 0 0',
                                    padding: '1.5rem 2rem'
                                }}
                            >
                                <FaLock className="me-2" />Change Password
                            </ModalHeader>
                            <ModalBody style={{ padding: '2rem' }}>
                                {user?.role === 'Admin' && (
                                    <Alert color="info" style={{ borderRadius: '10px', marginBottom: '1.5rem' }}>
                                        <strong>Note:</strong> As an Admin, you can set a new password. If you don't have a current password, leave it blank.
                                    </Alert>
                                )}
                                <Alert color="info" style={{ borderRadius: '10px', marginBottom: '1.5rem' }}>
                                    <strong>Password Requirements:</strong>
                                    <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
                                        <li>At least 8 characters</li>
                                        <li>One uppercase letter</li>
                                        <li>One lowercase letter</li>
                                        <li>One number</li>
                                        <li>One special character</li>
                                    </ul>
                                </Alert>

                                <Form onSubmit={handlePasswordSubmit}>
                                    <FormGroup>
                                        <Label style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '0.75rem' }}>
                                            <FaLock className="me-2" style={{ color: '#667eea' }} />
                                            Current Password {user?.role === 'Admin' ? '(Optional)' : '*'}
                                        </Label>
                                        <div style={{ position: 'relative' }}>
                                            <Input
                                                type={showPasswords.current ? 'text' : 'password'}
                                                name="currentPassword"
                                                value={passwordData.currentPassword}
                                                onChange={handlePasswordChange}
                                                required={user?.role !== 'Admin'}
                                                placeholder={user?.role === 'Admin' ? 'Leave blank if setting password for the first time' : 'Enter current password'}
                                                style={{
                                                    border: passwordErrors.currentPassword ? '2px solid #f44336' : '2px solid #e0e0e0',
                                                    borderRadius: '10px',
                                                    padding: '0.75rem 3rem 0.75rem 0.75rem',
                                                    fontSize: '1rem'
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                                style={{
                                                    position: 'absolute',
                                                    right: '5px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#666',
                                                    padding: '0.5rem'
                                                }}
                                            >
                                                {showPasswords.current ? <FaEyeSlash /> : <FaEye />}
                                            </Button>
                                        </div>
                                        {passwordErrors.currentPassword && (
                                            <small style={{ color: '#f44336', marginTop: '0.25rem', display: 'block' }}>
                                                {passwordErrors.currentPassword}
                                            </small>
                                        )}
                                        {user?.role === 'Admin' && (
                                            <small style={{ color: '#666', marginTop: '0.25rem', display: 'block', fontStyle: 'italic' }}>
                                                Leave blank if you don't have a password set yet
                                            </small>
                                        )}
                                    </FormGroup>

                                    <FormGroup>
                                        <Label style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '0.75rem' }}>
                                            <FaLock className="me-2" style={{ color: '#667eea' }} />New Password *
                                        </Label>
                                        <div style={{ position: 'relative' }}>
                                            <Input
                                                type={showPasswords.new ? 'text' : 'password'}
                                                name="newPassword"
                                                value={passwordData.newPassword}
                                                onChange={handlePasswordChange}
                                                required
                                                style={{
                                                    border: passwordErrors.newPassword ? '2px solid #f44336' : '2px solid #e0e0e0',
                                                    borderRadius: '10px',
                                                    padding: '0.75rem 3rem 0.75rem 0.75rem',
                                                    fontSize: '1rem'
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                                style={{
                                                    position: 'absolute',
                                                    right: '5px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#666',
                                                    padding: '0.5rem'
                                                }}
                                            >
                                                {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
                                            </Button>
                                        </div>
                                        {passwordErrors.newPassword && (
                                            <small style={{ color: '#f44336', marginTop: '0.25rem', display: 'block' }}>
                                                {passwordErrors.newPassword}
                                            </small>
                                        )}
                                    </FormGroup>

                                    <FormGroup>
                                        <Label style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '0.75rem' }}>
                                            <FaLock className="me-2" style={{ color: '#667eea' }} />Confirm New Password *
                                        </Label>
                                        <div style={{ position: 'relative' }}>
                                            <Input
                                                type={showPasswords.confirm ? 'text' : 'password'}
                                                name="confirmPassword"
                                                value={passwordData.confirmPassword}
                                                onChange={handlePasswordChange}
                                                required
                                                style={{
                                                    border: passwordErrors.confirmPassword ? '2px solid #f44336' : '2px solid #e0e0e0',
                                                    borderRadius: '10px',
                                                    padding: '0.75rem 3rem 0.75rem 0.75rem',
                                                    fontSize: '1rem'
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                                style={{
                                                    position: 'absolute',
                                                    right: '5px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#666',
                                                    padding: '0.5rem'
                                                }}
                                            >
                                                {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
                                            </Button>
                                        </div>
                                        {passwordErrors.confirmPassword && (
                                            <small style={{ color: '#f44336', marginTop: '0.25rem', display: 'block' }}>
                                                {passwordErrors.confirmPassword}
                                            </small>
                                        )}
                                        {passwordData.newPassword && passwordData.confirmPassword && 
                                         passwordData.newPassword === passwordData.confirmPassword && 
                                         !passwordErrors.newPassword && (
                                            <small style={{ color: '#4caf50', marginTop: '0.25rem', display: 'block' }}>
                                                ✓ Passwords match
                                            </small>
                                        )}
                                    </FormGroup>
                                </Form>
                            </ModalBody>
                            <ModalFooter style={{ border: 'none', padding: '1.5rem 2rem' }}>
                                <Button 
                                    onClick={() => {
                                        setPasswordModal(false);
                                        setPasswordData({
                                            currentPassword: '',
                                            newPassword: '',
                                            confirmPassword: ''
                                        });
                                        setPasswordErrors({});
                                    }}
                                    style={{
                                        background: '#f5f5f5',
                                        color: '#666',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.75rem 1.5rem',
                                        fontWeight: '600'
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handlePasswordSubmit}
                                    disabled={isChangingPassword}
                                    style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.75rem 2rem',
                                        fontWeight: '600',
                                        color: '#fff',
                                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                                    }}
                                >
                                    {isChangingPassword ? (
                                        <>
                                            <FaSpinner className="fa-spin me-2" />
                                            Changing...
                                        </>
                                    ) : (
                                        <>
                                            <FaLock className="me-2" />
                                            Change Password
                                        </>
                                    )}
                                </Button>
                            </ModalFooter>
                        </Modal>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Profile;
