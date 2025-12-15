import { Container, Row, Col, Card, CardBody, CardTitle, Button, Input, InputGroup, InputGroupText, Table, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Alert } from 'reactstrap';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FaChartBar, FaDownload, FaFilePdf, FaFileExcel, FaFileCsv, FaCalendarAlt, 
  FaComments, FaBullhorn, FaArrowUp, FaArrowDown, FaUsers, FaBox, FaBookOpen,
  FaExclamationTriangle, FaDollarSign, FaFilter, FaSearch, FaStar, FaReply, FaCheckCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';


const AdminReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);
  
  // Analytics Data
  const [analyticsData, setAnalyticsData] = useState(null);
  const [mostBorrowed, setMostBorrowed] = useState([]);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [userTrends, setUserTrends] = useState([]);
  
  // Feedback Data
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState({ type: '', text: '' });
  
  // Announcements
  const [announcements, setAnnouncements] = useState([]);
  const [announcementModal, setAnnouncementModal] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    priority: 'Normal',
    target_audience: 'All'
  });

  useEffect(() => {
    fetchAnalytics();
    fetchCalendarEvents();
    fetchFeedbacks();
    fetchAnnouncements();
  }, [dateRange]);


  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const params = {
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end })
      };

      const response = await axios.get('http://localhost:5000/admin/reports/analytics', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        setAnalyticsData(response.data.data);
        setMostBorrowed(response.data.data.mostBorrowed || []);
        setDepartmentStats(response.data.data.departmentStats || []);
        setUserTrends(response.data.data.userTrends || []);
      }
    } catch (error) {
      console.error('Analytics error:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/admin/calendar', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setCalendarEvents(response.data.data || []);
      }
    } catch (error) {
      console.error('Calendar error:', error);
    }
  };


  const fetchFeedbacks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/admin/feedback', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setFeedbacks(response.data.data || []);
      }
    } catch (error) {
      console.error('Feedback error:', error);
      toast.error('Failed to load feedbacks');
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/admin/announcements', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setAnnouncements(response.data.data || []);
      }
    } catch (error) {
      console.error('Announcements error:', error);
    }
  };

  // Generate report data for export (uses real data from state)
  const generateReportData = () => {
    return {
      summary: {
        totalUsers: analyticsData?.totalUsers || 0,
        totalResources: analyticsData?.totalResources || 0,
        activeBorrows: analyticsData?.totalBorrows || 0,
        totalReturns: analyticsData?.totalReturns || 0,
        overdueItems: analyticsData?.overdueItems || 0,
        totalRevenue: analyticsData?.totalRevenue || 0
      },
      mostBorrowed: mostBorrowed,
      departmentStats: departmentStats,
      userTrends: userTrends,
      feedbacks: feedbacks,
      generatedAt: new Date().toISOString()
    };
  };

  // Export to CSV
  const exportToCSV = () => {
    const data = generateReportData();
    let csv = 'Report Type,Value\n';
    csv += `Total Users,${data.summary.totalUsers}\n`;
    csv += `Total Resources,${data.summary.totalResources}\n`;
    csv += `Active Borrows,${data.summary.activeBorrows}\n`;
    csv += `Total Returns,${data.summary.totalReturns}\n`;
    csv += `Overdue Items,${data.summary.overdueItems}\n`;
    csv += `Total Revenue,${data.summary.totalRevenue} OMR\n\n`;
    
    csv += 'Most Borrowed Resources\n';
    csv += 'Resource Name,Category,Borrow Count\n';
    data.mostBorrowed.forEach(item => {
      csv += `${item.name || 'N/A'},${item.category || 'N/A'},${item.count || 0}\n`;
    });
    
    csv += '\nDepartment Statistics\n';
    csv += 'Department,Users,Borrows\n';
    data.departmentStats.forEach(dept => {
      csv += `${dept.department || 'N/A'},${dept.users || 0},${dept.borrows || 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported as CSV successfully');
  };

  // Export to Excel (using CSV format with .xlsx extension)
  const exportToExcel = () => {
    const data = generateReportData();
    // Create HTML table for Excel
    let html = '<table>';
    html += '<tr><th>Report Type</th><th>Value</th></tr>';
    html += `<tr><td>Total Users</td><td>${data.summary.totalUsers}</td></tr>`;
    html += `<tr><td>Total Resources</td><td>${data.summary.totalResources}</td></tr>`;
    html += `<tr><td>Active Borrows</td><td>${data.summary.activeBorrows}</td></tr>`;
    html += `<tr><td>Total Returns</td><td>${data.summary.totalReturns}</td></tr>`;
    html += `<tr><td>Overdue Items</td><td>${data.summary.overdueItems}</td></tr>`;
    html += `<tr><td>Total Revenue</td><td>${data.summary.totalRevenue} OMR</td></tr>`;
    html += '</table>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${new Date().toISOString().split('T')[0]}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported as Excel successfully');
  };

  // Export to PDF
  const exportToPDF = () => {
    const data = generateReportData();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>UTAS Borrowing Hub - Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1976d2; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #1976d2; color: white; }
            .summary { background-color: #f5f5f5; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>UTAS Borrowing Hub - System Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          
          <div class="summary">
            <h2>Summary</h2>
            <p>Total Users: ${data.summary.totalUsers}</p>
            <p>Total Resources: ${data.summary.totalResources}</p>
            <p>Active Borrows: ${data.summary.activeBorrows}</p>
            <p>Total Returns: ${data.summary.totalReturns}</p>
            <p>Overdue Items: ${data.summary.overdueItems}</p>
            <p>Total Revenue: ${data.summary.totalRevenue} OMR</p>
          </div>

          <h2>Most Borrowed Resources</h2>
          <table>
            <tr><th>Resource Name</th><th>Category</th><th>Borrow Count</th></tr>
            ${data.mostBorrowed.map(item => 
              `<tr><td>${item.name || 'N/A'}</td><td>${item.category || 'N/A'}</td><td>${item.count || 0}</td></tr>`
            ).join('')}
          </table>

          <h2>Department Statistics</h2>
          <table>
            <tr><th>Department</th><th>Users</th><th>Borrows</th></tr>
            ${data.departmentStats.map(dept => 
              `<tr><td>${dept.department || 'N/A'}</td><td>${dept.users || 0}</td><td>${dept.borrows || 0}</td></tr>`
            ).join('')}
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success('Report opened for PDF printing');
  };

  const handleExport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const params = {
        format,
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end })
      };

      const response = await axios.get('http://localhost:5000/admin/reports/export', {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: 'blob'
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Report exported as ${format.toUpperCase()} successfully`);
    } catch (error) {
      console.error('Export error:', error);
      // Fallback to client-side export
      if (format === 'csv') {
        exportToCSV();
      } else if (format === 'xlsx' || format === 'xls') {
        exportToExcel();
      } else if (format === 'pdf') {
        exportToPDF();
      }
    }
  };

  const handleFeedbackResponse = async () => {
    try {
      if (!responseText.trim()) {
        setFeedbackMessage({ type: 'danger', text: 'Please enter a response message.' });
        setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
        return;
      }

      // Validate ObjectId format (MongoDB ObjectId is 24 hexadecimal characters)
      const isValidObjectId = selectedFeedback._id && typeof selectedFeedback._id === 'string' && /^[0-9a-fA-F]{24}$/.test(selectedFeedback._id);
      
      if (!isValidObjectId) {
        setFeedbackMessage({ type: 'warning', text: 'Invalid feedback ID format.' });
        toast.warning('Invalid feedback ID');
        setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
        return;
      }

      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/admin/feedback/${selectedFeedback._id}/respond`, {
        response: responseText,
        status: 'Reviewed'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFeedbackMessage({ type: 'success', text: 'Response sent successfully!' });
      toast.success('Response sent successfully');
      setFeedbackModal(false);
      setResponseText('');
      fetchFeedbacks();
      setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Response error:', error);
      let errorMsg = 'Failed to send response. Please try again.';
      
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMsg = 'Invalid feedback ID. Please try selecting the feedback again.';
      } else if (error.response?.status === 404) {
        errorMsg = 'Feedback not found. It may have been deleted.';
      } else if (error.response?.status === 500) {
        errorMsg = 'Server error. Please try again later.';
      }
      
      setFeedbackMessage({ type: 'danger', text: errorMsg });
      toast.error(errorMsg);
      setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
        setFeedbackMessage({ type: 'danger', text: 'Please fill in all required fields.' });
        setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
        return;
      }

      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/admin/announcements', announcementForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFeedbackMessage({ type: 'success', text: 'Announcement created successfully!' });
      toast.success('Announcement created successfully');
      setAnnouncementModal(false);
      setAnnouncementForm({ title: '', message: '', priority: 'Normal', target_audience: 'All' });
      fetchAnnouncements();
      setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Announcement error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to create announcement. Please try again.';
      setFeedbackMessage({ type: 'danger', text: errorMsg });
      toast.error(errorMsg);
      setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
    }
  };

  const getEventsForDate = (date) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const renderCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    const handleDateClick = (day) => {
      if (day) {
        setSelectedDate(new Date(year, month, day));
      }
    };

    const isSelectedDate = (day) => {
      if (!day) return false;
      const date = new Date(year, month, day);
      return date.toDateString() === selectedDate.toDateString();
    };

    const getEventsCount = (day) => {
      if (!day) return 0;
      const date = new Date(year, month, day);
      return getEventsForDate(date).length;
    };

    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <Button
            onClick={() => setSelectedDate(new Date(year, month - 1, 1))}
            style={{ background: '#1976d2', border: 'none' }}
          >
            ← Prev
          </Button>
          <h5 style={{ margin: 0, fontWeight: 'bold' }}>
            {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h5>
          <Button
            onClick={() => setSelectedDate(new Date(year, month + 1, 1))}
            style={{ background: '#1976d2', border: 'none' }}
          >
            Next →
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
          {weekDays.map(day => (
            <div key={day} style={{ 
              textAlign: 'center', 
              fontWeight: 'bold', 
              padding: '0.5rem',
              color: '#666'
            }}>
              {day}
            </div>
          ))}
          {days.map((day, idx) => (
            <div
              key={idx}
              onClick={() => handleDateClick(day)}
              style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: day ? 'pointer' : 'default',
                background: isSelectedDate(day) ? '#1976d2' : day ? '#f5f5f5' : 'transparent',
                color: isSelectedDate(day) ? '#fff' : '#333',
                borderRadius: '8px',
                border: isSelectedDate(day) ? '2px solid #1976d2' : '1px solid #e0e0e0',
                fontWeight: isSelectedDate(day) ? 'bold' : 'normal',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (day) {
                  e.currentTarget.style.background = isSelectedDate(day) ? '#1976d2' : '#e3f2fd';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (day) {
                  e.currentTarget.style.background = isSelectedDate(day) ? '#1976d2' : '#f5f5f5';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {day && (
                <>
                  <span style={{ fontSize: '1rem' }}>{day}</span>
                  {getEventsCount(day) > 0 && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: isSelectedDate(day) ? '#fff' : '#1976d2',
                      marginTop: '0.25rem',
                      fontWeight: 'bold'
                    }}>
                      {getEventsCount(day)} {getEventsCount(day) === 1 ? 'event' : 'events'}
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Container fluid className="py-5" style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem' }}>
      <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: '#333', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                Reports & Analytics
              </h2>
              <p style={{ color: '#666', margin: 0, fontSize: '0.95rem' }}>
                Comprehensive insights and system management
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                onClick={() => handleExport('pdf')}
                style={{ background: '#f44336', border: 'none' }}
              >
                <FaFilePdf /> PDF
              </Button>
              <Button
                onClick={() => handleExport('xlsx')}
                style={{ background: '#4caf50', border: 'none' }}
              >
                <FaFileExcel /> Excel
              </Button>
              <Button
                onClick={() => handleExport('csv')}
                style={{ background: '#ff9800', border: 'none' }}
              >
                <FaFileCsv /> CSV
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Tabs */}
      <Row className="mb-4">
        <Col>
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e0e0e0' }}>
            {[
              { id: 'analytics', label: 'Analytics', icon: FaChartBar },
              { id: 'calendar', label: 'Calendar', icon: FaCalendarAlt },
              { id: 'feedback', label: 'Feedback', icon: FaComments },
              { id: 'announcements', label: 'Announcements', icon: FaBullhorn }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: activeTab === tab.id ? '#1976d2' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : '#666',
                    border: 'none',
                    borderRadius: '8px 8px 0 0',
                    padding: '0.75rem 1.5rem',
                    fontWeight: '600'
                  }}
                >
                  <Icon className="me-2" />
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </Col>
      </Row>

      {/* Date Range Filter */}
      {activeTab === 'analytics' && (
        <Row className="mb-4">
          <Col md={4}>
            <InputGroup>
              <InputGroupText>Start Date</InputGroupText>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </InputGroup>
          </Col>
          <Col md={4}>
            <InputGroup>
              <InputGroupText>End Date</InputGroupText>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </InputGroup>
          </Col>
          <Col md={4}>
            <Button
              onClick={fetchAnalytics}
              style={{ background: '#1976d2', border: 'none', width: '100%' }}
            >
              <FaFilter /> Apply Filter
            </Button>
          </Col>
        </Row>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <>
          {/* Key Metrics */}
          <Row className="mb-4">
            {[
              { label: 'Total Borrows', value: analyticsData?.totalBorrows || 0, icon: FaBookOpen, color: '#4caf50' },
              { label: 'Total Returns', value: analyticsData?.totalReturns || 0, icon: FaBookOpen, color: '#1976d2' },
              { label: 'Overdue Items', value: analyticsData?.overdueItems || 0, icon: FaExclamationTriangle, color: '#f44336' },
              { label: 'Total Revenue', value: `${(analyticsData?.totalRevenue || 0).toFixed(2)} OMR`, icon: FaDollarSign, color: '#ff9800' }
            ].map((metric, idx) => {
              const Icon = metric.icon;
              return (
                <Col md={3} key={idx} className="mb-3">
                  <Card className="border-0 shadow-sm h-100">
                    <CardBody>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ color: '#666', margin: 0, fontSize: '0.875rem' }}>{metric.label}</p>
                          <h3 style={{ color: '#333', margin: '0.5rem 0 0 0', fontWeight: 'bold' }}>{metric.value}</h3>
                        </div>
                        <Icon style={{ fontSize: '2rem', color: metric.color }} />
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              );
            })}
          </Row>

          {/* Most Borrowed Resources */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <CardBody>
                  <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                    Most Borrowed Resources
                  </CardTitle>
                  <Table hover>
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Category</th>
                        <th>Borrows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mostBorrowed.length > 0 ? (
                        mostBorrowed.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name}</td>
                            <td><Badge color="primary">{item.category}</Badge></td>
                            <td><strong>{item.count}</strong></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </CardBody>
              </Card>
            </Col>

            {/* Department Statistics */}
            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <CardBody>
                  <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                    Active Departments
                  </CardTitle>
                  <Table hover>
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Users</th>
                        <th>Borrows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentStats.length > 0 ? (
                        departmentStats.map((dept, idx) => (
                          <tr key={idx}>
                            <td>{dept.department || 'N/A'}</td>
                            <td><strong>{dept.users}</strong></td>
                            <td><strong>{dept.borrows}</strong></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* User Trends */}
          <Row>
            <Col>
              <Card className="border-0 shadow-sm">
                <CardBody>
                  <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                    User Trends
                  </CardTitle>
                  <Table hover>
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>New Users</th>
                        <th>Active Users</th>
                        <th>Borrows</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userTrends.length > 0 ? (
                        userTrends.map((trend, idx) => (
                          <tr key={idx}>
                            <td>{trend.period}</td>
                            <td><strong>{trend.newUsers}</strong></td>
                            <td><strong>{trend.activeUsers}</strong></td>
                            <td><strong>{trend.borrows}</strong></td>
                            <td>
                              {trend.trend > 0 ? (
                                <span style={{ color: '#4caf50' }}>
                                  <FaArrowUp /> +{trend.trend}%
                                </span>
                              ) : (
                                <span style={{ color: '#f44336' }}>
                                  <FaArrowDown /> {trend.trend}%
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <Row>
          <Col md={8}>
            <Card className="border-0 shadow-sm">
              <CardBody>
                <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                  Reservations Calendar
                </CardTitle>
                {renderCalendar()}
              </CardBody>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="border-0 shadow-sm">
              <CardBody>
                <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                  Events for {selectedDate.toLocaleDateString()}
                </CardTitle>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {getEventsForDate(selectedDate).length > 0 ? (
                    getEventsForDate(selectedDate).map((event, idx) => (
                      <div key={idx} style={{
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: '#f5f5f5',
                        borderRadius: '8px'
                      }}>
                        <strong>{event.title}</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
                          {event.description}
                        </p>
                        <small style={{ color: '#999' }}>{event.time}</small>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#666', textAlign: 'center' }}>No events for this date</p>
                  )}
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <Row>
          <Col>
            <Card className="border-0 shadow-sm">
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <CardTitle tag="h5" style={{ fontWeight: 'bold', margin: 0 }}>
                    User Feedback
                  </CardTitle>
                  <Badge color="warning">
                    {feedbacks.filter(f => f.status === 'Pending').length} Pending
                  </Badge>
                </div>
                
                {/* Feedback Messages */}
                {feedbackMessage.text && (
                  <Alert 
                    color={feedbackMessage.type === 'warning' ? 'warning' : feedbackMessage.type} 
                    style={{ 
                      marginBottom: '1.5rem',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                    toggle={() => setFeedbackMessage({ type: '', text: '' })}
                  >
                    {feedbackMessage.type === 'success' && <FaCheckCircle />}
                    {(feedbackMessage.type === 'danger' || feedbackMessage.type === 'warning') && <FaExclamationTriangle />}
                    <strong>{feedbackMessage.text}</strong>
                  </Alert>
                )}
                <Table hover>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Rating</th>
                      <th>Comment</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbacks.length > 0 ? (
                      feedbacks.map((feedback) => (
                        <tr key={feedback._id}>
                          <td>{feedback.user_id?.full_name || 'N/A'}</td>
                          <td>
                            {[...Array(5)].map((_, i) => (
                              <FaStar
                                key={i}
                                style={{
                                  color: i < feedback.rating ? '#ffc107' : '#ddd',
                                  fontSize: '0.875rem'
                                }}
                              />
                            ))}
                          </td>
                          <td>{feedback.comment || 'No comment'}</td>
                          <td><Badge>{feedback.category}</Badge></td>
                          <td>
                            <Badge color={
                              feedback.status === 'Pending' ? 'warning' :
                              feedback.status === 'Reviewed' ? 'info' :
                              feedback.status === 'Resolved' ? 'success' : 'secondary'
                            }>
                              {feedback.status}
                            </Badge>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedFeedback(feedback);
                                setFeedbackModal(true);
                              }}
                              style={{ background: '#1976d2', border: 'none' }}
                            >
                              <FaReply /> Respond
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center">No feedback available</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <Row>
          <Col>
            <Card className="border-0 shadow-sm">
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <CardTitle tag="h5" style={{ fontWeight: 'bold', margin: 0 }}>
                    System Announcements
                  </CardTitle>
                  <Button
                    onClick={() => setAnnouncementModal(true)}
                    style={{ background: '#4caf50', border: 'none' }}
                  >
                    <FaBullhorn /> New Announcement
                  </Button>
                </div>
                {announcements.length > 0 ? (
                  announcements.map((announcement) => (
                    <Alert
                      key={announcement._id}
                      color={
                        announcement.priority === 'High' ? 'danger' :
                        announcement.priority === 'Medium' ? 'warning' : 'info'
                      }
                      style={{ marginBottom: '1rem' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <h6 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            {announcement.title}
                          </h6>
                          <p style={{ margin: 0 }}>{announcement.message}</p>
                          <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                            Target: {announcement.target_audience} | 
                            Created: {new Date(announcement.created_at).toLocaleDateString()}
                          </small>
                        </div>
                        <Badge color="secondary">{announcement.priority}</Badge>
                      </div>
                    </Alert>
                  ))
                ) : (
                  <p style={{ color: '#666', textAlign: 'center' }}>No announcements yet</p>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}

      {/* Feedback Response Modal */}
      <Modal isOpen={feedbackModal} toggle={() => setFeedbackModal(false)}>
        <ModalHeader toggle={() => setFeedbackModal(false)}>
          Respond to Feedback
        </ModalHeader>
        <ModalBody>
          {selectedFeedback && (
            <>
              <p><strong>User:</strong> {selectedFeedback.user_id?.full_name}</p>
              <p><strong>Rating:</strong> {selectedFeedback.rating}/5</p>
              <p><strong>Comment:</strong> {selectedFeedback.comment}</p>
              <FormGroup>
                <Label>Your Response</Label>
                <Input
                  type="textarea"
                  rows="4"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Enter your response..."
                />
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setFeedbackModal(false)}>Cancel</Button>
          <Button
            style={{ background: '#1976d2', border: 'none' }}
            onClick={handleFeedbackResponse}
          >
            Send Response
          </Button>
        </ModalFooter>
      </Modal>

      {/* Announcement Modal */}
      <Modal isOpen={announcementModal} toggle={() => setAnnouncementModal(false)}>
        <ModalHeader toggle={() => setAnnouncementModal(false)}>
          Create Announcement
        </ModalHeader>
        <Form onSubmit={handleCreateAnnouncement}>
          <ModalBody>
            <FormGroup>
              <Label>Title *</Label>
              <Input
                type="text"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup>
              <Label>Message *</Label>
              <Input
                type="textarea"
                rows="4"
                value={announcementForm.message}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                required
              />
            </FormGroup>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Priority</Label>
                  <Input
                    type="select"
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Target Audience</Label>
                  <Input
                    type="select"
                    value={announcementForm.target_audience}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, target_audience: e.target.value })}
                  >
                    <option value="All">All Users</option>
                    <option value="Students">Students</option>
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={() => setAnnouncementModal(false)}>Cancel</Button>
            <Button type="submit" style={{ background: '#4caf50', border: 'none' }}>
              Create Announcement
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
      </Container>
    </div>
  );
};

export default AdminReports;
