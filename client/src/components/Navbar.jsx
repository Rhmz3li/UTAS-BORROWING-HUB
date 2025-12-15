import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Navbar, NavbarBrand, Nav, NavItem, NavLink, Badge, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { logout } from '../redux/reducers/authReducer'
import { FaBell, FaUser } from 'react-icons/fa'
import { fetchNotifications } from '../redux/reducers/notificationReducer'
import { useEffect, useState } from 'react'

const AppNavbar = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const { unreadCount } = useSelector((state) => state.notifications)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    if (user) {
      dispatch(fetchNotifications());
      // Auto-refresh notifications every 30 seconds
      const interval = setInterval(() => {
        dispatch(fetchNotifications());
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [dispatch, user])

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <Navbar color="light" light expand="md" className="shadow-sm">
      <NavbarBrand href="/dashboard" className="fw-bold text-primary">
        UTAS Borrowing Hub
      </NavbarBrand>
      <Nav className="ms-auto" navbar>
        <NavItem>
          <NavLink 
            href="/notifications" 
            className="position-relative"
            style={{ 
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <FaBell 
              size={20}
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
        <Dropdown isOpen={dropdownOpen} toggle={() => setDropdownOpen(!dropdownOpen)}>
          <DropdownToggle nav caret>
            <FaUser className="me-2" />
            {user?.full_name || 'User'}
          </DropdownToggle>
          <DropdownMenu end>
            <DropdownItem header>{user?.email}</DropdownItem>
            <DropdownItem divider />
            <DropdownItem onClick={() => navigate('/profile')}>Profile</DropdownItem>
            {['Admin', 'Assistant'].includes(user?.role) && (
              <DropdownItem onClick={() => navigate('/admin/dashboard')}>Admin Panel</DropdownItem>
            )}
            <DropdownItem divider />
            <DropdownItem onClick={handleLogout}>Logout</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </Nav>
    </Navbar>
  )
}

export default AppNavbar

