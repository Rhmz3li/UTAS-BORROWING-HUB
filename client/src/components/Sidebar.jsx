import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchNotifications } from '../redux/reducers/notificationReducer.js';
import {
  FaHome,
  FaBox,
  FaBook,
  FaCalendarCheck,
  FaBell,
  FaExclamationTriangle,
  FaCreditCard,
  FaUsers,
  FaChartLine,
  FaCog,
  FaTachometerAlt,
  FaUserShield,
  FaUserTie,
  FaUserGraduate,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaQrcode
} from 'react-icons/fa';
import { logout } from '../redux/reducers/authReducer.js';
import { useTheme } from '../contexts/ThemeContext.jsx';
import ResourceScanner from './ResourceScanner.jsx';
import ScanAndUpdateStatus from './ScanAndUpdateStatus.jsx';
import ScanResourceManagement from './ScanResourceManagement.jsx';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { unreadCount } = useSelector((state) => state.notifications || {});
  const { theme, toggleTheme, isDark } = useTheme();
  const [scanMgmtModalOpen, setScanMgmtModalOpen] = React.useState(false);
  const [scanModalOpen, setScanModalOpen] = React.useState(false);
  const [scanUpdateModalOpen, setScanUpdateModalOpen] = React.useState(false);
  const isAdmin = ['Admin', 'Assistant'].includes(user?.role);

  // Auto-refresh notifications when component mounts
  React.useEffect(() => {
    if (user) {
      dispatch(fetchNotifications());
      const interval = setInterval(() => {
        dispatch(fetchNotifications());
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [dispatch, user]);

  const isActive = (path) => {
    if (path === '/admin/dashboard' || path === '/admin') {
      return location.pathname === '/admin/dashboard' || location.pathname === '/admin';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      'Admin': 'System Administrator',
      'Assistant': 'System Assistant',
      'Staff': 'Staff Member',
      'Student': 'Student'
    };
    return roleNames[role] || role;
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'Admin': return FaUserShield;
      case 'Assistant': return FaUserTie;
      case 'Staff': return FaUserTie;
      case 'Student': return FaUserGraduate;
      default: return FaUserShield;
    }
  };

  const studentStaffMenu = [
    { path: '/home', label: 'Dashboard', icon: FaHome, section: 'main' },
    { path: '/resources', label: 'Browse Resources', icon: FaBox, section: 'main' },
    { path: '/my-borrows', label: 'My Borrows', icon: FaBook, section: 'borrowing' },
    { path: '/reservations', label: 'My Reservations', icon: FaCalendarCheck, section: 'borrowing' },
    { path: '/notifications', label: 'Notifications', icon: FaBell, section: 'account' },
    { path: '/notification-settings', label: 'Notification Settings', icon: FaCog, section: 'account' },
    { path: '/penalties', label: 'My Penalties', icon: FaExclamationTriangle, section: 'account' },
    { path: '/payments', label: 'My Payments', icon: FaCreditCard, section: 'account' }
  ];

  const adminMenu = [
    { path: '/admin/dashboard', label: 'Control Panel', icon: FaTachometerAlt, section: 'main' },
    { path: '/admin/resources', label: 'Resource Management', icon: FaBox, section: 'management' },
    { path: '/admin/scan-mgmt', label: 'Scan Resource Management', icon: FaQrcode, section: 'management', action: 'scanMgmt' },
    { path: '/admin/users', label: 'User Management', icon: FaUsers, section: 'management', adminOnly: true },
    { path: '/admin/borrows', label: 'Borrow Management', icon: FaBook, section: 'management' },
    { path: '/admin/reservations', label: 'Reservation Management', icon: FaCalendarCheck, section: 'management' },
    { path: '/admin/penalties', label: 'Penalty Management', icon: FaExclamationTriangle, section: 'management' },
    { path: '/admin/payments', label: 'Payment Management', icon: FaCreditCard, section: 'management' },
    { path: '/admin/reports', label: 'Reports & Analytics', icon: FaChartLine, section: 'reports', adminOnly: true }
  ];

  // Filter menu items based on role
  let menuItems = ['Admin', 'Assistant'].includes(user?.role) ? adminMenu : studentStaffMenu;
  
  // Filter out admin-only items for Assistant
  if (user?.role === 'Assistant') {
    menuItems = menuItems.filter(item => !item.adminOnly);
  }
  
  const RoleIcon = user?.role ? getRoleIcon(user.role) : FaUserShield;
  
  // Group menu items by section
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(item);
    return acc;
  }, {});
  
  const sectionLabels = {
    main: 'Main',
    borrowing: 'Borrowing',
    account: 'Account',
    management: 'Management',
    reports: 'Reports'
  };

  const sidebarPalette = isDark
    ? {
        background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
        text: '#f9fafb',
        mutedText: 'rgba(249,250,251,0.72)',
        subtleText: 'rgba(249,250,251,0.55)',
        border: '1px solid rgba(148,163,184,0.2)',
        userCardBg: 'rgba(15,23,42,0.65)',
        hoverBg: 'rgba(148,163,184,0.15)',
        activeBg: 'rgba(96,165,250,0.2)',
        icon: 'rgba(249,250,251,0.9)',
        danger: '#f87171',
        dangerHover: 'rgba(248,113,113,0.16)'
      }
    : {
        background: 'linear-gradient(180deg, #1565c0 0%, #0d47a1 100%)',
        text: '#ffffff',
        mutedText: 'rgba(255,255,255,0.8)',
        subtleText: 'rgba(255,255,255,0.6)',
        border: '1px solid rgba(255,255,255,0.1)',
        userCardBg: 'rgba(0,0,0,0.2)',
        hoverBg: 'rgba(255,255,255,0.08)',
        activeBg: 'rgba(255,255,255,0.15)',
        icon: 'rgba(255,255,255,0.9)',
        danger: '#ff6b6b',
        dangerHover: 'rgba(255,107,107,0.15)'
      };

  return (
    <>
    <div style={{
      width: '280px',
      minHeight: '100vh',
      background: sidebarPalette.background,
      color: sidebarPalette.text,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 1000
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 1rem',
        borderBottom: sidebarPalette.border
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem'
        }}>
          <div style={{ flex: 1 }}>
            <h4 style={{
              margin: 0,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              lineHeight: '1.3',
              color: sidebarPalette.text
            }}>
              UTAS Borrowing Hub
            </h4>
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '0.75rem',
              color: sidebarPalette.mutedText
            }}>
              Management System
            </p>
          </div>
        </div>
      </div>

      {/* User Info Card */}
      <div style={{
        margin: '1rem',
        padding: '1rem',
        background: sidebarPalette.userCardBg,
        borderRadius: '10px',
        border: sidebarPalette.border
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#ff9800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0
          }}>
            <RoleIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 'bold',
              fontSize: '0.9rem',
              marginBottom: '0.25rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {getRoleDisplayName(user?.role || 'User')}
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: sidebarPalette.mutedText,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user?.full_name || 'User Name'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem 0'
      }}>
        {Object.keys(groupedMenuItems).map((sectionKey) => {
          const sectionItems = groupedMenuItems[sectionKey];
          const sectionLabel = sectionLabels[sectionKey];
          
          return (
            <div key={sectionKey}>
              {/* Section Label */}
              {sectionLabel && (
                <div style={{
                  padding: '0.5rem 1rem 0.25rem 1rem',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  color: sidebarPalette.subtleText,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginTop: sectionKey !== 'main' ? '1rem' : '0'
                }}>
                  {sectionLabel}
                </div>
              )}
              
              {/* Section Items */}
              {sectionItems.map((item) => {
                const Icon = item.icon;
                const active = (item.action === 'scanMgmt') ? false : isActive(item.path);
                const isNotificationItem = item.path === '/notifications';
                const hasUnread = isNotificationItem && unreadCount > 0;
                
                return (
                  <div
                    key={item.path}
                    onClick={() => {
                      if (item.action === 'scanMgmt') {
                        setScanMgmtModalOpen(true);
                      } else {
                        navigate(item.path);
                      }
                    }}
                    style={{
                      margin: '0.25rem 1rem',
                      padding: '0.875rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: active 
                        ? sidebarPalette.activeBg 
                        : hasUnread
                        ? 'rgba(255, 152, 0, 0.15)'
                        : 'transparent',
                      borderLeft: active 
                        ? '4px solid #ffc107' 
                        : hasUnread
                        ? '4px solid #ff9800'
                        : '4px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.2s ease',
                      color: sidebarPalette.text,
                      fontWeight: active ? '600' : '400',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = hasUnread 
                          ? 'rgba(255, 152, 0, 0.2)' 
                          : sidebarPalette.hoverBg;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = hasUnread 
                          ? 'rgba(255, 152, 0, 0.15)' 
                          : 'transparent';
                      }
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Icon style={{
                        fontSize: '1.1rem',
                        color: active 
                          ? '#ffc107' 
                          : hasUnread
                          ? '#ff9800'
                          : sidebarPalette.icon,
                        animation: hasUnread ? 'pulse 2s infinite' : 'none',
                        transition: 'color 0.3s ease'
                      }} />
                      {hasUnread && (
                        <span style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-8px',
                          background: '#f44336',
                          color: 'white',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          animation: 'pulse-badge 1.5s infinite',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.9rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1
                    }}>
                      {item.label}
                    </span>
                    {hasUnread && (
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
                            transform: scale(1);
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 0 0 0 rgba(244, 67, 54, 0.7);
                          }
                          50% {
                            transform: scale(1.1);
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 0 0 6px rgba(244, 67, 54, 0);
                          }
                        }
                      `}</style>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Settings at bottom */}
      <div style={{
        padding: '1rem',
        borderTop: sidebarPalette.border
      }}>
        {/* Theme Toggle */}
        <div
          onClick={toggleTheme}
          style={{
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s ease',
            color: sidebarPalette.text,
            background: 'transparent',
            marginBottom: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = sidebarPalette.hoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {isDark ? (
            <FaSun style={{
              fontSize: '1.1rem',
              flexShrink: 0,
              color: '#ffc107'
            }} />
          ) : (
            <FaMoon style={{
              fontSize: '1.1rem',
              flexShrink: 0,
              color: sidebarPalette.icon
            }} />
          )}
          <span style={{ fontSize: '0.9rem' }}>
            Dark Mode and Light Mode
          </span>
        </div>
        
        <div
          onClick={() => navigate('/profile')}
          style={{
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s ease',
            color: sidebarPalette.text,
            background: location.pathname === '/profile' 
              ? sidebarPalette.activeBg 
              : 'transparent',
            borderLeft: location.pathname === '/profile' ? '4px solid #ffc107' : '4px solid transparent'
          }}
          onMouseEnter={(e) => {
            if (location.pathname !== '/profile') {
              e.currentTarget.style.background = sidebarPalette.hoverBg;
            }
          }}
          onMouseLeave={(e) => {
            if (location.pathname !== '/profile') {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <FaCog style={{
            fontSize: '1.1rem',
            flexShrink: 0,
            color: location.pathname === '/profile' 
              ? '#ffc107' 
              : sidebarPalette.icon
          }} />
          <span style={{ fontSize: '0.9rem', fontWeight: location.pathname === '/profile' ? '600' : '400' }}>Profile Settings</span>
        </div>
        
        <div
          onClick={() => {
            dispatch(logout());
            // Navigate to login page after logout
            setTimeout(() => {
              navigate('/login');
            }, 100);
          }}
          style={{
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s ease',
            color: sidebarPalette.danger,
            background: 'transparent',
            marginTop: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = sidebarPalette.dangerHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <FaSignOutAlt style={{
            fontSize: '1.1rem',
            flexShrink: 0,
            color: sidebarPalette.danger
          }} />
          <span style={{ fontSize: '0.9rem' }}>Logout</span>
        </div>
      </div>
    </div>
    <ScanResourceManagement
      isOpen={scanMgmtModalOpen}
      toggle={() => setScanMgmtModalOpen(false)}
      onScanResource={() => setScanModalOpen(true)}
      onScanUpdateStatus={() => setScanUpdateModalOpen(true)}
      isAdmin={isAdmin}
    />
    <ResourceScanner isOpen={scanModalOpen} toggle={() => setScanModalOpen(false)} />
    <ScanAndUpdateStatus isOpen={scanUpdateModalOpen} toggle={() => setScanUpdateModalOpen(false)} />
    </>
  );
};

export default Sidebar;
