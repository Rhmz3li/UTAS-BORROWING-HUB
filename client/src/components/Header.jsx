import { Navbar, NavbarBrand, Nav, NavItem, NavLink, NavbarToggler, Collapse, Badge, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from "reactstrap";
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../redux/reducers/authReducer.js";
import { fetchNotifications } from "../redux/reducers/notificationReducer.js";
import { FaHome, FaUserShield, FaSignOutAlt, FaBox, FaCalendarCheck, FaBell, FaUser, FaExclamationTriangle, FaCreditCard } from 'react-icons/fa';

const Header = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const notificationsState = useSelector((state) => state.notifications || {});
    const unreadCount = notificationsState?.unreadCount || 0;

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    // Auto-refresh notifications every 30 seconds
    useEffect(() => {
        if (user) {
            dispatch(fetchNotifications());
            const interval = setInterval(() => {
                dispatch(fetchNotifications());
            }, 30000); // Refresh every 30 seconds

            return () => clearInterval(interval);
        }
    }, [dispatch, user]);

    return (
        <Navbar color="light" light expand="md" className="shadow-sm">
            <NavbarBrand href="/home" onClick={(e) => { e.preventDefault(); navigate('/home'); }} className="fw-bold text-primary" style={{ cursor: 'pointer' }}>
                UTAS Borrowing Hub
            </NavbarBrand>
            <NavbarToggler onClick={() => setIsOpen(!isOpen)} />
            <Collapse isOpen={isOpen} navbar>
                <Nav className="me-auto" navbar>
                    {!['Admin', 'Assistant'].includes(user?.role) ? (
                        <>
                            <NavItem>
                                <NavLink href="/home" onClick={(e) => { e.preventDefault(); navigate('/home'); }} style={{ cursor: 'pointer' }}>
                                    <FaHome className="me-2" />Home
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href="/resources" onClick={(e) => { e.preventDefault(); navigate('/resources'); }} style={{ cursor: 'pointer' }}>
                                    <FaBox className="me-2" />Resources
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href="/my-borrows" onClick={(e) => { e.preventDefault(); navigate('/my-borrows'); }} style={{ cursor: 'pointer' }}>
                                    <FaBox className="me-2" />My Borrows
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href="/reservations" onClick={(e) => { e.preventDefault(); navigate('/reservations'); }} style={{ cursor: 'pointer' }}>
                                    <FaCalendarCheck className="me-2" />Reservations
                                </NavLink>
                            </NavItem>
                        </>
                    ) : (
                        <>
                            <NavItem>
                                <NavLink href="/admin/dashboard" onClick={(e) => { e.preventDefault(); navigate('/admin/dashboard'); }} style={{ cursor: 'pointer' }}>
                                    <FaUserShield className="me-2" />Admin Dashboard
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href="/admin/resources" onClick={(e) => { e.preventDefault(); navigate('/admin/resources'); }} style={{ cursor: 'pointer' }}>
                                    <FaBox className="me-2" />Resources
                                </NavLink>
                            </NavItem>
                        </>
                    )}
                </Nav>
                <Nav className="ms-auto" navbar>
                    <NavItem>
                        <NavLink 
                            href="/notifications" 
                            onClick={(e) => { e.preventDefault(); navigate('/notifications'); }} 
                            className="position-relative" 
                            style={{ 
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <FaBell 
                                className="me-2" 
                                style={{
                                    color: unreadCount > 0 ? '#ff9800' : '#6c757d',
                                    animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
                                    transition: 'color 0.3s ease'
                                }}
                            />
                            {unreadCount > 0 && (
                                <>
                                    <Badge 
                                        color="danger" 
                                        pill 
                                        className="position-absolute top-0 start-100 translate-middle"
                                        style={{
                                            animation: 'pulse-badge 1.5s infinite',
                                            fontSize: '0.7rem',
                                            padding: '0.25rem 0.5rem',
                                            minWidth: '1.25rem',
                                            height: '1.25rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Badge>
                                    <style>{`
                                        @keyframes pulse {
                                            0%, 100% {
                                                transform: scale(1);
                                                opacity: 1;
                                            }
                                            50% {
                                                transform: scale(1.1);
                                                opacity: 0.8;
                                            }
                                        }
                                        @keyframes pulse-badge {
                                            0%, 100% {
                                                transform: translate(-50%, -50%) scale(1);
                                                box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
                                            }
                                            50% {
                                                transform: translate(-50%, -50%) scale(1.05);
                                                box-shadow: 0 0 0 8px rgba(220, 53, 69, 0);
                                            }
                                        }
                                    `}</style>
                                </>
                            )}
                        </NavLink>
                    </NavItem>
                    {!['Admin', 'Assistant'].includes(user?.role) && (
                        <>
                            <NavItem>
                                <NavLink href="/penalties" onClick={(e) => { e.preventDefault(); navigate('/penalties'); }} style={{ cursor: 'pointer' }}>
                                    <FaExclamationTriangle className="me-2" />Penalties
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href="/payments" onClick={(e) => { e.preventDefault(); navigate('/payments'); }} style={{ cursor: 'pointer' }}>
                                    <FaCreditCard className="me-2" />Payments
                                </NavLink>
                            </NavItem>
                        </>
                    )}
                    <Dropdown isOpen={dropdownOpen} toggle={() => setDropdownOpen(!dropdownOpen)} nav inNavbar>
                        <DropdownToggle nav caret>
                            <FaUser className="me-2" />
                            {user?.full_name || user?.email || 'User'}
                        </DropdownToggle>
                        <DropdownMenu end>
                            <DropdownItem header>{user?.email}</DropdownItem>
                            <DropdownItem divider />
                            <DropdownItem onClick={() => navigate('/profile')}>
                                <FaUser className="me-2" />Profile
                            </DropdownItem>
                            <DropdownItem divider />
                            <DropdownItem onClick={handleLogout}>
                                <FaSignOutAlt className="me-2" />Logout
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </Nav>
            </Collapse>
        </Navbar>
    );
};

export default Header;

