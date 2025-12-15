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
  FaSun
} from 'react-icons/fa';
import { logout } from '../redux/reducers/authReducer.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { unreadCount } = useSelector((state) => state.notifications || {});
  const { theme, toggleTheme, isDark } = useTheme();

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
    { path: '/penalties', label: 'My Penalties', icon: FaExclamationTriangle, section: 'account' },
    { path: '/payments', label: 'My Payments', icon: FaCreditCard, section: 'account' }
  ];

  const adminMenu = [
    { path: '/admin/dashboard', label: 'Control Panel', icon: FaTachometerAlt, section: 'main' },
    { path: '/admin/resources', label: 'Resource Management', icon: FaBox, section: 'management' },
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

  return (
    <div style={{
      width: '280px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1565c0 0%, #0d47a1 100%)',
      color: 'white',
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
        borderBottom: '1px solid rgba(255,255,255,0.1)'
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
              color: 'white'
            }}>
              UTAS Borrowing Hub
            </h4>
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.8)'
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
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.1)'
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
              color: 'rgba(255,255,255,0.7)',
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
                  color: 'rgba(255,255,255,0.6)',
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
                const active = isActive(item.path);
                const isNotificationItem = item.path === '/notifications';
                const hasUnread = isNotificationItem && unreadCount > 0;
                
                return (
                  <div
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      margin: '0.25rem 1rem',
                      padding: '0.875rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: active 
                        ? 'rgba(255,255,255,0.15)' 
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
                      color: 'white',
                      fontWeight: active ? '600' : '400',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = hasUnread 
                          ? 'rgba(255, 152, 0, 0.2)' 
                          : 'rgba(255,255,255,0.08)';
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
                          : 'rgba(255,255,255,0.9)',
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
        borderTop: '1px solid rgba(255,255,255,0.1)'
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
            color: 'white',
            background: 'transparent',
            marginBottom: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
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
              color: 'rgba(255,255,255,0.9)'
            }} />
          )}
          <span style={{ fontSize: '0.9rem' }}>
            {isDark ? 'Light Mode' : 'Dark Mode'}
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
            color: 'white',
            background: location.pathname === '/profile' 
              ? 'rgba(255,255,255,0.15)' 
              : 'transparent',
            borderLeft: location.pathname === '/profile' ? '4px solid #ffc107' : '4px solid transparent'
          }}
          onMouseEnter={(e) => {
            if (location.pathname !== '/profile') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
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
              : 'rgba(255,255,255,0.9)'
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
            color: '#ff6b6b',
            background: 'transparent',
            marginTop: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,107,107,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <FaSignOutAlt style={{
            fontSize: '1.1rem',
            flexShrink: 0,
            color: '#ff6b6b'
          }} />
          <span style={{ fontSize: '0.9rem' }}>Logout</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
