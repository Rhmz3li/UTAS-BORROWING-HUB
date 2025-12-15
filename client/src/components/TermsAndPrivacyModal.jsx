import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';
import { FaLock, FaShieldAlt } from 'react-icons/fa';

const TermsAndPrivacyModal = ({ isOpen, toggle, type }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg" centered>
            <ModalHeader toggle={toggle} style={{
                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                color: '#ffffff',
                borderBottom: 'none',
                padding: '1.5rem'
            }}>
                {type === 'terms' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FaShieldAlt />
                        <span>Terms of Service</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FaLock />
                        <span>Privacy Policy</span>
                    </div>
                )}
            </ModalHeader>
            <ModalBody style={{ padding: '2rem', maxHeight: '70vh', overflowY: 'auto' }}>
                {type === 'terms' ? (
                    <div>
                        <h4 style={{ color: '#333333', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                            Terms of Service (Short Version)
                        </h4>
                        <p style={{ color: '#666666', marginBottom: '1.5rem', lineHeight: '1.8' }}>
                            By using UTAS Borrowing Hub, you agree to the following:
                        </p>
                        
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                1. Eligibility
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                Only UTAS students and staff may borrow resources such as laptops, cameras, and telescopes.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                2. Return Policy
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                You must return all items on time and in good condition.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                3. Responsibility
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                You are responsible for any loss, damage, or late return penalties.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                4. Usage Restrictions
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                Borrowed items must be used for academic or approved purposes only.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                5. Account Suspension
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                Your account may be suspended if you violate the rules.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                6. Data Disclaimer
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                The Hub is not responsible for personal data stored on borrowed devices.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                7. Terms Updates
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                We may update these terms at any time.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div>
                        <h4 style={{ color: '#333333', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                            Privacy Policy (Short Version)
                        </h4>
                        
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                Information We Collect
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                UTAS Borrowing Hub collects only the information needed to manage borrowing services, such as your name, university ID, email, and borrowing records.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                How We Use Your Data
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                We use this data to:
                            </p>
                            <ul style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '2rem' }}>
                                <li>Verify your eligibility</li>
                                <li>Manage reservations and returns</li>
                                <li>Contact you about due dates or issues</li>
                            </ul>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                Data Protection
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                Your data is protected, not sold, and shared only with authorized UTAS departments when necessary.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: '#1976d2', marginBottom: '0.75rem', fontWeight: '600' }}>
                                Policy Updates
                            </h5>
                            <p style={{ color: '#666666', marginBottom: '1rem', lineHeight: '1.8', paddingLeft: '1rem' }}>
                                By using the website, you agree to our data practices and any future updates to this policy.
                            </p>
                        </div>
                    </div>
                )}
            </ModalBody>
            <ModalFooter style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem' }}>
                <Button
                    onClick={toggle}
                    style={{
                        background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.5rem 2rem',
                        fontWeight: '600'
                    }}
                >
                    I Understand
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default TermsAndPrivacyModal;
