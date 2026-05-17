import { Container, Row, Col, Card, CardBody, CardTitle } from 'reactstrap';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { 
  FaUsers, FaBox, FaBookOpen, FaCalendarCheck, FaExclamationTriangle, 
  FaChartBar, FaMoneyBillWave, FaCreditCard, FaWrench, FaCheckCircle,
  FaLaptop, FaArrowRight
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useTheme } from '../contexts/ThemeContext.jsx';


const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { isDark } = useTheme();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const dashboardPalette = isDark
    ? {
        pageBg: 'var(--bg-secondary)',
        cardBg: 'var(--card-bg)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        cardShadow: '0 4px 14px rgba(0,0,0,0.35)',
        hoverShadow: '0 10px 22px rgba(0,0,0,0.45)'
      }
    : {
        pageBg: 'var(--bg-secondary)',
        cardBg: 'var(--card-bg)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        cardShadow: '0 2px 6px rgba(0,0,0,0.1)',
        hoverShadow: '0 8px 16px rgba(0,0,0,0.15)'
      };

  useEffect(() => {
    // Check if user is Admin or Assistant
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'Admin' && user.role !== 'Assistant') {
      toast.error('Access denied. Admin access required.');
      navigate('/home');
      return;
    }
    fetchDashboardData();

    const interval = setInterval(fetchDashboardData, 10000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, navigate]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      toast.error(error.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container fluid className="py-5" style={{ background: dashboardPalette.pageBg, minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  const { overview } = dashboardData || {};

  // Main Statistics Cards (4 cards like in the image)
  const mainStatCards = [
    {
      title: 'Under Maintenance',
      value: overview?.maintenanceResources || 0,
      icon: FaWrench,
      color: '#f44336',
      bgColor: '#ffebee',
      path: '/admin/resources?status=Maintenance'
    },
    {
      title: 'Borrowed Resources',
      value: overview?.activeBorrows || 0,
      icon: FaArrowRight,
      color: '#ff9800',
      bgColor: '#fff3e0',
      path: '/admin/borrows'
    },
    {
      title: 'Available Resources',
      value: overview?.availableResources || 0,
      icon: FaCheckCircle,
      color: '#4caf50',
      bgColor: '#e8f5e9',
      path: '/admin/resources?status=Available'
    },
    {
      title: 'Total Resources',
      value: overview?.totalResources || 0,
      icon: FaLaptop,
      color: '#1976d2',
      bgColor: '#e3f2fd',
      path: '/admin/resources'
    }
  ];

  // Borrow Status Chart Data
  const borrowStatusData = [
    { name: 'Active', value: overview?.activeBorrows || 0, color: '#4caf50' },
    { name: 'Overdue', value: overview?.overdueBorrows || 0, color: '#f44336' },
    { name: 'Returned', value: overview?.returnedBorrows || 0, color: '#2196f3' }
  ];

  // Resource Status Chart Data (Pie/Donut Chart) — unit counts, not resource-type rows
  const resourceStatusData = [
    { name: 'Available', value: overview?.availableResources || 0, color: '#4caf50' },
    { name: 'Borrowed', value: (overview?.unitsOnLoan ?? overview?.activeBorrows) || 0, color: '#ff9800' },
    { name: 'Maintenance', value: overview?.maintenanceResources || 0, color: '#f44336' },
    { name: 'Reserved', value: overview?.reservedResources || 0, color: '#9c27b0' },
    { name: 'Lost', value: overview?.lostResources || 0, color: '#795548' }
  ];

  // Additional Statistics
  const additionalStats = [
    {
      title: 'Total Users',
      value: overview?.totalUsers || 0,
      icon: FaUsers,
      color: '#1976d2',
      path: '/admin/users'
    },
    {
      title: 'Pending Reservations',
      value: overview?.pendingReservations || 0,
      icon: FaCalendarCheck,
      color: '#9c27b0',
      path: '/admin/reservations'
    },
    {
      title: 'Pending Penalties',
      value: overview?.pendingPenalties || 0,
      icon: FaMoneyBillWave,
      color: '#ff5722',
      path: '/admin/penalties'
    },
    {
      title: 'Total Revenue',
      value: `${(overview?.totalRevenue || 0).toFixed(2)} OMR`,
      icon: FaChartBar,
      color: '#00bcd4',
      path: '/admin/payments'
    }
  ];

  return (
    <div style={{ 
      marginLeft: '280px',
      padding: '2rem', 
      minHeight: '100vh', 
      background: dashboardPalette.pageBg
    }}>
      <Container fluid>
        {/* Header */}
        <Row className="mb-4">
        <Col>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: dashboardPalette.cardBg,
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: dashboardPalette.cardShadow
          }}>
            <div>
              <h2 style={{ color: dashboardPalette.textPrimary, fontWeight: 'bold', marginBottom: '0.25rem' }}>
                Control Panel
              </h2>
              <p style={{ color: dashboardPalette.textSecondary, margin: 0, fontSize: '0.95rem' }}>
                Welcome to the UTAS Borrowing Hub Management System
              </p>
              <p style={{ color: dashboardPalette.textSecondary, margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                University of Technology and Applied Sciences
              </p>
            </div>
          </div>
        </Col>
      </Row>

      {/* Main Statistics Cards (4 cards) */}
      <Row className="g-3 mb-4">
        {mainStatCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Col key={index} md={6} lg={3}>
              <Card 
                className="border-0 shadow-sm h-100" 
                style={{ 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  transition: 'all 0.3s ease',
                  borderLeft: `4px solid ${stat.color}`,
                  backgroundColor: dashboardPalette.cardBg,
                  boxShadow: dashboardPalette.cardShadow
                }}
                onClick={() => navigate(stat.path)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = dashboardPalette.hoverShadow;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = dashboardPalette.cardShadow;
                }}
              >
                <CardBody className="p-4">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ 
                        color: isDark ? dashboardPalette.textSecondary : '#333333', 
                        fontSize: '0.875rem', 
                        margin: 0, 
                        marginBottom: '0.5rem',
                        fontWeight: '500'
                      }}>
                        {stat.title}
                      </p>
                      <h2 style={{ 
                        color: stat.color, 
                        fontSize: '2.5rem', 
                        fontWeight: 'bold', 
                        margin: 0 
                      }}>
                        {stat.value}
                      </h2>
                    </div>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '12px',
                      background: stat.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon style={{ color: stat.color, fontSize: '2rem' }} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Charts Section */}
      <Row className="g-3 mb-4">
        {/* Bar Chart - Borrow Status */}
        <Col md={6}>
          <Card className="border-0 shadow-sm" style={{ borderRadius: '12px', height: '100%', backgroundColor: dashboardPalette.cardBg }}>
            <CardBody className="p-4">
              <CardTitle tag="h5" style={{ marginBottom: '1.5rem', fontWeight: 'bold', color: dashboardPalette.textPrimary }}>
                Borrow Status Overview
              </CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={borrowStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#3b3b3b' : '#e5e7eb'} />
                  <XAxis dataKey="name" tick={{ fill: dashboardPalette.textSecondary }} />
                  <YAxis tick={{ fill: dashboardPalette.textSecondary }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#1976d2" radius={[8, 8, 0, 0]}>
                    {borrowStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </Col>

        {/* Pie/Donut Chart - Resource Status */}
        <Col md={6}>
          <Card className="border-0 shadow-sm" style={{ borderRadius: '12px', height: '100%', backgroundColor: dashboardPalette.cardBg }}>
            <CardBody className="p-4">
              <CardTitle tag="h5" style={{ marginBottom: '1.5rem', fontWeight: 'bold', color: dashboardPalette.textPrimary }}>
                Resource Status Distribution
              </CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={resourceStatusData}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={false}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {resourceStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => {
                      const total = resourceStatusData.reduce((sum, d) => sum + d.value, 0);
                      const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                      return [`${value} (${percent}%)`, name];
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      padding: '10px'
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={80}
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: '20px',
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)'
                    }}
                    formatter={(value) => {
                      const data = resourceStatusData.find(d => d.name === value);
                      const total = resourceStatusData.reduce((sum, d) => sum + d.value, 0);
                      const percent = data && total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';
                      return `${value}: ${percent}%`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Additional Statistics */}
      <Row className="g-3">
        {additionalStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Col key={index} md={6} lg={3}>
              <Card 
                className="border-0 shadow-sm h-100" 
                style={{ 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  transition: 'all 0.3s ease',
                  borderTop: `4px solid ${stat.color}`,
                  backgroundColor: dashboardPalette.cardBg,
                  boxShadow: dashboardPalette.cardShadow
                }}
                onClick={() => navigate(stat.path)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = dashboardPalette.hoverShadow;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = dashboardPalette.cardShadow;
                }}
              >
                <CardBody className="p-3">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ 
                        color: dashboardPalette.textSecondary, 
                        fontSize: '0.8rem', 
                        margin: 0, 
                        marginBottom: '0.25rem',
                        fontWeight: '500'
                      }}>
                        {stat.title}
                      </p>
                      <h4 style={{ 
                        color: dashboardPalette.textPrimary, 
                        fontSize: '1.5rem', 
                        fontWeight: 'bold', 
                        margin: 0 
                      }}>
                        {stat.value}
                      </h4>
                    </div>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '10px',
                      background: `${stat.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon style={{ color: stat.color, fontSize: '1.5rem' }} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>
      </Container>
    </div>
  );
};

export default AdminDashboard;
