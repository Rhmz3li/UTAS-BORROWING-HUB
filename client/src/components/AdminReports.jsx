import { Container, Row, Col, Card, CardBody, CardTitle, Button, Input, InputGroup, InputGroupText, Table, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Alert, Spinner } from 'reactstrap';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config';
import { 
  FaChartBar, FaDownload, FaFilePdf, FaFileExcel, FaFileCsv, FaCalendarAlt, 
  FaComments, FaBullhorn, FaArrowUp, FaArrowDown, FaUsers, FaBox, FaBookOpen,
  FaExclamationTriangle, FaDollarSign, FaFilter, FaSearch, FaStar, FaReply, FaCheckCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';


const AdminReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    resourceStatus: '',
    department: '',
    userRole: '',
    borrowStatus: '',
    paymentStatus: ''
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);
  
  // Analytics Data
  const [analyticsData, setAnalyticsData] = useState(null);
  const [borrowDetails, setBorrowDetails] = useState([]);
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
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchCalendarEvents();
    fetchFeedbacks();
    fetchAnnouncements();
  }, [dateRange]);


  const buildAnalyticsParams = (overrides = null) => {
    if (overrides) return overrides;
    return {
      ...(dateRange.start && { startDate: dateRange.start }),
      ...(dateRange.end && { endDate: dateRange.end }),
      ...(filters.search && { search: filters.search.trim() }),
      ...(filters.category && { category: filters.category }),
      ...(filters.resourceStatus && { resourceStatus: filters.resourceStatus }),
      ...(filters.department && { department: filters.department }),
      ...(filters.userRole && { userRole: filters.userRole }),
      ...(filters.borrowStatus && { borrowStatus: filters.borrowStatus }),
      ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus })
    };
  };

  const fetchAnalytics = async (overrideParams = null) => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const params = buildAnalyticsParams(overrideParams);

      const response = await axios.get(`${API_BASE}/admin/reports/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        const d = response.data.data;
        setAnalyticsData(d);
        setMostBorrowed(d.mostBorrowed || []);
        setDepartmentStats(d.departmentStats || []);
        setUserTrends(d.userTrends || []);
        setBorrowDetails(d.borrowDetails || []);
      }
    } catch (error) {
      console.error('Analytics error:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    setFilterPanelOpen(false);
    fetchAnalytics();
  };

  const resetFilter = () => {
    setDateRange({ start: '', end: '' });
    setFilters({
      search: '',
      category: '',
      resourceStatus: '',
      department: '',
      userRole: '',
      borrowStatus: '',
      paymentStatus: ''
    });
    setFilterPanelOpen(false);
    fetchAnalytics({}); // refetch with empty params immediately
  };

  const fetchCalendarEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin/calendar`, {
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
      const response = await axios.get(`${API_BASE}/admin/feedback`, {
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
      const response = await axios.get(`${API_BASE}/admin/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setAnnouncements(response.data.data || []);
      }
    } catch (error) {
      console.error('Announcements error:', error);
      toast.error(error.response?.data?.message || 'Failed to load announcements');
    }
  };

  /** Export uses the same in-memory data as the Analytics tab (after Apply Filter). */
  const escapeHtml = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtTableDate = (d) => {
    if (!d) return 'N/A';
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? 'N/A' : new Date(d).toLocaleDateString();
  };

  const paymentLabel = (b) => b.payment_status || 'Not Required';

  const describeFiltersSummary = () => {
    const parts = [];
    if (dateRange.start || dateRange.end) {
      parts.push(`Dates: ${dateRange.start || '…'} → ${dateRange.end || '…'}`);
    }
    if (filters.search?.trim()) parts.push(`Search: ${filters.search.trim()}`);
    if (filters.category) parts.push(`Category: ${filters.category}`);
    if (filters.resourceStatus) parts.push(`Resource status: ${filters.resourceStatus}`);
    if (filters.department) parts.push(`Department: ${filters.department}`);
    if (filters.userRole) parts.push(`User role: ${filters.userRole}`);
    if (filters.borrowStatus) parts.push(`Borrow status: ${filters.borrowStatus}`);
    if (filters.paymentStatus) parts.push(`Payment: ${filters.paymentStatus}`);
    return parts.length ? parts.join(' | ') : 'No extra filters (all borrows in scope)';
  };

  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const buildReportCsvFromState = () => {
    const a = analyticsData || {};
    const rev = typeof a.totalRevenue === 'number' ? a.totalRevenue.toFixed(2) : String(a.totalRevenue ?? '0');

    let csv = '\uFEFF';
    csv += 'UTAS Borrowing Hub — Reports & Analytics\n';
    csv += `Active filters,${csvEscape(describeFiltersSummary())}\n`;
    csv += `Generated,${csvEscape(new Date().toLocaleString())}\n\n`;

    csv += 'SUMMARY (same as dashboard cards)\n';
    csv += 'Metric,Value\n';
    csv += `Total Borrows,${a.totalBorrows ?? 0}\n`;
    csv += `Total Returns,${a.totalReturns ?? 0}\n`;
    csv += `Overdue Items,${a.overdueItems ?? 0}\n`;
    csv += `Total Revenue (OMR),${rev}\n\n`;

    csv += 'MOST BORROWED RESOURCES (current table)\n';
    csv += 'Resource,Category,Borrows\n';
    (mostBorrowed || []).forEach((item) => {
      csv += [csvEscape(item.name || 'N/A'), csvEscape(item.category || 'N/A'), item.count ?? 0].join(',');
      csv += '\n';
    });
    csv += '\n';

    csv += 'ACTIVE DEPARTMENTS (current table)\n';
    csv += 'Department,Users,Borrows\n';
    (departmentStats || []).forEach((dept) => {
      csv += [csvEscape(dept.department || 'N/A'), dept.users ?? 0, dept.borrows ?? 0].join(',');
      csv += '\n';
    });
    csv += '\n';

    csv += 'BORROW DETAILS FILTERED (same rows as on screen, up to 200)\n';
    csv += '#,User,Role,Department,Resource,Category,Borrow Status,Payment Status,Borrow Date,Due Date,Return Date\n';
    (borrowDetails || []).forEach((b, idx) => {
      const ret = b.return_date ? fmtTableDate(b.return_date) : '-';
      csv += [
        String(idx + 1),
        csvEscape(b.user_id?.full_name || 'N/A'),
        csvEscape(b.user_id?.role || 'N/A'),
        csvEscape(b.user_id?.department || 'N/A'),
        csvEscape(b.resource_id?.name || 'N/A'),
        csvEscape(b.resource_id?.category || 'N/A'),
        csvEscape(b.status || 'N/A'),
        csvEscape(paymentLabel(b)),
        csvEscape(fmtTableDate(b.borrow_date)),
        csvEscape(fmtTableDate(b.due_date)),
        csvEscape(ret)
      ].join(',');
      csv += '\n';
    });

    return csv;
  };

  const buildReportWorkbookFromState = () => {
    const a = analyticsData || {};
    const summaryRows = [
      { Metric: 'Report', Value: 'UTAS Borrowing Hub — Analytics (current filters)' },
      { Metric: 'Filters', Value: describeFiltersSummary() },
      { Metric: 'Generated', Value: new Date().toLocaleString() },
      { Metric: 'Total Borrows', Value: a.totalBorrows ?? 0 },
      { Metric: 'Total Returns', Value: a.totalReturns ?? 0 },
      { Metric: 'Overdue Items', Value: a.overdueItems ?? 0 },
      { Metric: 'Total Revenue (OMR)', Value: Number(a.totalRevenue ?? 0).toFixed(2) }
    ];

    const mostRows = (mostBorrowed || []).map((item) => ({
      Resource: item.name || 'N/A',
      Category: item.category || 'N/A',
      Borrows: item.count ?? 0
    }));

    const deptRows = (departmentStats || []).map((d) => ({
      Department: d.department || 'N/A',
      Users: d.users ?? 0,
      Borrows: d.borrows ?? 0
    }));

    const borrowRows = (borrowDetails || []).map((b, idx) => ({
      '#': idx + 1,
      User: b.user_id?.full_name || 'N/A',
      Role: b.user_id?.role || 'N/A',
      Department: b.user_id?.department || 'N/A',
      Resource: b.resource_id?.name || 'N/A',
      Category: b.resource_id?.category || 'N/A',
      BorrowStatus: b.status || 'N/A',
      PaymentStatus: paymentLabel(b),
      BorrowDate: fmtTableDate(b.borrow_date),
      DueDate: fmtTableDate(b.due_date),
      ReturnDate: b.return_date ? fmtTableDate(b.return_date) : '-'
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        mostRows.length ? mostRows : [{ Resource: 'No data', Category: '', Borrows: 0 }]
      ),
      'MostBorrowed'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        deptRows.length ? deptRows : [{ Department: 'No data', Users: 0, Borrows: 0 }]
      ),
      'Departments'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        borrowRows.length
          ? borrowRows
          : [{ '#': '', User: '', Resource: '', Category: 'No rows for current filters' }]
      ),
      'BorrowDetails'
    );
    return wb;
  };

  const openReportPdfFromState = () => {
    const a = analyticsData || {};
    const rev = Number(a.totalRevenue ?? 0).toFixed(2);

    const borrowRowsHtml = (borrowDetails || [])
      .map(
        (b, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(b.user_id?.full_name || 'N/A')}</td>
            <td>${escapeHtml(b.user_id?.role || 'N/A')}</td>
            <td>${escapeHtml(b.user_id?.department || 'N/A')}</td>
            <td>${escapeHtml(b.resource_id?.name || 'N/A')}</td>
            <td>${escapeHtml(b.resource_id?.category || 'N/A')}</td>
            <td>${escapeHtml(b.status || 'N/A')}</td>
            <td>${escapeHtml(paymentLabel(b))}</td>
            <td>${escapeHtml(fmtTableDate(b.borrow_date))}</td>
            <td>${escapeHtml(fmtTableDate(b.due_date))}</td>
            <td>${escapeHtml(b.return_date ? fmtTableDate(b.return_date) : '-')}</td>
          </tr>`
      )
      .join('');

    const mostHtml = (mostBorrowed || [])
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.name || 'N/A')}</td><td>${escapeHtml(item.category || 'N/A')}</td><td>${item.count ?? 0}</td></tr>`
      )
      .join('');

    const deptHtml = (departmentStats || [])
      .map(
        (dept) =>
          `<tr><td>${escapeHtml(dept.department || 'N/A')}</td><td>${dept.users ?? 0}</td><td>${dept.borrows ?? 0}</td></tr>`
      )
      .join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Allow pop-ups for this site to print or save as PDF.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>UTAS Borrowing Hub — Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            h1 { color: #1976d2; font-size: 20px; }
            h2 { color: #333; font-size: 15px; margin-top: 22px; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background: #1976d2; color: #fff; }
            .meta { color: #555; margin: 8px 0 16px; }
            .summary { background: #f5f5f5; padding: 12px 16px; margin: 12px 0; border-radius: 6px; }
          </style>
        </head>
        <body>
          <h1>UTAS Borrowing Hub — Reports & Analytics</h1>
          <p class="meta">Generated: ${escapeHtml(new Date().toLocaleString())}</p>
          <p class="meta"><strong>Active filters:</strong> ${escapeHtml(describeFiltersSummary())}</p>

          <div class="summary">
            <h2 style="margin-top:0">Summary</h2>
            <p><strong>Total Borrows:</strong> ${a.totalBorrows ?? 0}</p>
            <p><strong>Total Returns:</strong> ${a.totalReturns ?? 0}</p>
            <p><strong>Overdue Items:</strong> ${a.overdueItems ?? 0}</p>
            <p><strong>Total Revenue:</strong> ${rev} OMR</p>
          </div>

          <h2>Most Borrowed Resources</h2>
          <table>
            <thead><tr><th>Resource</th><th>Category</th><th>Borrows</th></tr></thead>
            <tbody>${mostHtml || '<tr><td colspan="3">No data</td></tr>'}</tbody>
          </table>

          <h2>Active Departments</h2>
          <table>
            <thead><tr><th>Department</th><th>Users</th><th>Borrows</th></tr></thead>
            <tbody>${deptHtml || '<tr><td colspan="3">No data</td></tr>'}</tbody>
          </table>

          <h2>Borrow Details (Filtered)</h2>
          <p class="meta">Same rows as the dashboard table (up to 200).</p>
          <table>
            <thead>
              <tr>
                <th>#</th><th>User</th><th>Role</th><th>Department</th><th>Resource</th><th>Category</th>
                <th>Borrow Status</th><th>Payment Status</th><th>Borrow Date</th><th>Due Date</th><th>Return Date</th>
              </tr>
            </thead>
            <tbody>${borrowRowsHtml || '<tr><td colspan="11">No records for the selected filters.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (format) => {
    if (loading) {
      toast.warning('Wait until the report has finished loading.');
      return;
    }
    if (!analyticsData) {
      toast.error('No report data yet. Open the Analytics tab and apply filters, then try again.');
      return;
    }

    try {
      const stamp = new Date().toISOString().split('T')[0];

      if (format === 'csv') {
        triggerDownload(new Blob([buildReportCsvFromState()], { type: 'text/csv;charset=utf-8;' }), `report_${stamp}.csv`);
        toast.success('CSV downloaded (matches current tables and filters)');
        return;
      }

      if (format === 'xlsx') {
        const wb = buildReportWorkbookFromState();
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        triggerDownload(
          new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          `report_${stamp}.xlsx`
        );
        toast.success('Excel downloaded (matches current tables and filters)');
        return;
      }

      if (format === 'pdf') {
        openReportPdfFromState();
        toast.success('Print dialog opened — choose Save as PDF if you prefer a file');
        return;
      }

      toast.error('Unknown export format');
    } catch (err) {
      console.error('Export error:', err);
      toast.error(err?.message || 'Export failed');
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
      await axios.put(`${API_BASE}/admin/feedback/${selectedFeedback._id}/respond`, {
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
      if (!token) {
        toast.error('You must be logged in');
        navigate('/login');
        return;
      }

      setAnnouncementSubmitting(true);
      await axios.post(`${API_BASE}/admin/announcements`, announcementForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFeedbackMessage({ type: 'success', text: 'Announcement created successfully!' });
      toast.success('Announcement created successfully');
      setAnnouncementModal(false);
      setAnnouncementForm({ title: '', message: '', priority: 'Normal', target_audience: 'All' });
      await fetchAnnouncements();
      setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Announcement error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to create announcement. Please try again.';
      setFeedbackMessage({ type: 'danger', text: errorMsg });
      toast.error(errorMsg);
      setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
    } finally {
      setAnnouncementSubmitting(false);
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
              color: 'var(--text-secondary)'
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
                background: isSelectedDate(day) ? '#1976d2' : day ? 'var(--bg-tertiary)' : 'transparent',
                color: isSelectedDate(day) ? '#fff' : 'var(--text-primary)',
                borderRadius: '8px',
                border: isSelectedDate(day) ? '2px solid #1976d2' : '1px solid var(--border-color)',
                fontWeight: isSelectedDate(day) ? 'bold' : 'normal',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (day) {
                  e.currentTarget.style.background = isSelectedDate(day) ? '#1976d2' : 'rgba(25, 118, 210, 0.22)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (day) {
                  e.currentTarget.style.background = isSelectedDate(day) ? '#1976d2' : 'var(--bg-tertiary)';
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
      <Container fluid className="py-5" style={{ marginLeft: '280px', background: 'var(--bg-secondary)', minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'var(--bg-secondary)', padding: '2rem', transition: 'all 0.3s ease' }}>
      <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                Reports & Analytics
              </h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
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
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border-color)' }}>
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
                    color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
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

      {/* Advanced Filter - Analytics tab */}
      {activeTab === 'analytics' && (
        <div className="mb-4">
          <Button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            style={{ background: '#1976d2', border: 'none' }}
          >
            <FaFilter className="me-2" />
            {filterPanelOpen ? 'Hide Filter' : 'Filter'}
          </Button>

          {filterPanelOpen && (
            <Card className="mt-3 border shadow-sm">
              <CardBody>
                <CardTitle tag="h6" className="mb-3 d-flex align-items-center">
                  <FaSearch className="me-2" /> Advanced Filter
                </CardTitle>

                {/* Search by resource / user */}
                <Row className="mb-3">
                  <Col md={12}>
                    <InputGroup>
                      <InputGroupText><FaSearch /> Search</InputGroupText>
                      <Input
                        type="text"
                        placeholder="Resource name, user name, resource number, Barcode / QR"
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      />
                    </InputGroup>
                    <small className="text-muted">Search by: resource name, user name, resource number, Barcode/QR</small>
                  </Col>
                </Row>

                {/* Dropdowns row 1: Category, Resource Status, Department */}
                <Row className="mb-3">
                  <Col md={4}>
                    <InputGroup>
                      <InputGroupText>Category</InputGroupText>
                      <select
                        className="form-select"
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                      >
                        <option value="">All</option>
                        <option value="Laptop">Laptop</option>
                        <option value="Book">Book</option>
                        <option value="Lab Equipment">Lab Equipment</option>
                        <option value="Tablet">Tablet</option>
                        <option value="Other">Other</option>
                      </select>
                    </InputGroup>
                  </Col>
                  <Col md={4}>
                    <InputGroup>
                      <InputGroupText>Resource Status</InputGroupText>
                      <select
                        className="form-select"
                        value={filters.resourceStatus}
                        onChange={(e) => setFilters({ ...filters, resourceStatus: e.target.value })}
                      >
                        <option value="">All</option>
                        <option value="Available">Available</option>
                        <option value="Borrowed">Borrowed</option>
                        <option value="Returned">Returned</option>
                        <option value="Overdue">Overdue</option>
                        <option value="Reserved">Reserved</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                    </InputGroup>
                  </Col>
                  <Col md={4}>
                    <InputGroup>
                      <InputGroupText>Department</InputGroupText>
                      <select
                        className="form-select"
                        value={filters.department}
                        onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                      >
                        <option value="">All</option>
                        <option value="IT">IT</option>
                        <option value="Business">Business</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Other">Other</option>
                      </select>
                    </InputGroup>
                  </Col>
                </Row>

                {/* Dropdowns row 2: User Role, Borrow Status, Payment Status */}
                <Row className="mb-3">
                  <Col md={4}>
                    <InputGroup>
                      <InputGroupText>User Role</InputGroupText>
                      <select
                        className="form-select"
                        value={filters.userRole}
                        onChange={(e) => setFilters({ ...filters, userRole: e.target.value })}
                      >
                        <option value="">All</option>
                        <option value="Student">Student</option>
                        <option value="Staff">Staff</option>
                        <option value="Assistant">Assistant</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </InputGroup>
                  </Col>
                  <Col md={4}>
                    <InputGroup>
                      <InputGroupText>Borrow Status</InputGroupText>
                      <select
                        className="form-select"
                        value={filters.borrowStatus}
                        onChange={(e) => setFilters({ ...filters, borrowStatus: e.target.value })}
                      >
                        <option value="">All</option>
                        <option value="Active">Active</option>
                        <option value="Returned">Returned</option>
                        <option value="Overdue">Overdue</option>
                        <option value="Reserved">Reserved</option>
                      </select>
                    </InputGroup>
                  </Col>
                  <Col md={4}>
                    <InputGroup>
                      <InputGroupText>Payment Status</InputGroupText>
                      <select
                        className="form-select"
                        value={filters.paymentStatus}
                        onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
                      >
                        <option value="">All</option>
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Refunded">Refunded</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </InputGroup>
                  </Col>
                </Row>

                {/* Date range */}
                <Row className="mb-3">
                  <Col md={6}>
                    <InputGroup>
                      <InputGroupText>Start Date</InputGroupText>
                      <Input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      />
                    </InputGroup>
                  </Col>
                  <Col md={6}>
                    <InputGroup>
                      <InputGroupText>End Date</InputGroupText>
                      <Input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      />
                    </InputGroup>
                  </Col>
                </Row>

                {/* Actions */}
                <Row>
                  <Col className="d-flex gap-2">
                    <Button onClick={applyFilter} style={{ background: '#1976d2', border: 'none' }}>
                      <FaFilter className="me-2" /> Apply Filter
                    </Button>
                    <Button onClick={resetFilter} color="secondary" outline>
                      Reset
                    </Button>
                  </Col>
                </Row>
              </CardBody>
            </Card>
          )}
        </div>
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
                          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>{metric.label}</p>
                          <h3 style={{ color: 'var(--text-primary)', margin: '0.5rem 0 0 0', fontWeight: 'bold' }}>{metric.value}</h3>
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

          {/* Detailed Borrow List (respects all filters) */}
          <Row className="mb-4">
            <Col>
              <Card className="border-0 shadow-sm">
                <CardBody>
                  <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Borrow Details (Filtered)
                  </CardTitle>
                  <p style={{ fontSize: '0.85rem', color: '#777' }}>
                    This table shows all borrow transactions that match the selected filters (e.g. User Role, Department, Category, Borrow Status, Date Range). Up to the latest 200 records are displayed.
                  </p>
                  <Table hover responsive size="sm">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>User</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>Resource</th>
                        <th>Category</th>
                        <th>Borrow Status</th>
                        <th>Payment Status</th>
                        <th>Borrow Date</th>
                        <th>Due Date</th>
                        <th>Return Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borrowDetails && borrowDetails.length > 0 ? (
                        borrowDetails.map((b, idx) => (
                          <tr key={b._id || idx}>
                            <td>{idx + 1}</td>
                            <td>{b.user_id?.full_name || 'N/A'}</td>
                            <td>{b.user_id?.role || 'N/A'}</td>
                            <td>{b.user_id?.department || 'N/A'}</td>
                            <td>{b.resource_id?.name || 'N/A'}</td>
                            <td>{b.resource_id?.category || 'N/A'}</td>
                            <td>{b.status || 'N/A'}</td>
                            <td>{b.payment_status || 'Not Required'}</td>
                            <td>{b.borrow_date ? new Date(b.borrow_date).toLocaleDateString() : 'N/A'}</td>
                            <td>{b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A'}</td>
                            <td>{b.return_date ? new Date(b.return_date).toLocaleDateString() : '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="11" className="text-center">No records found for the selected filters.</td>
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
                        background: 'var(--bg-tertiary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{event.title}</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {event.description}
                        </p>
                        <small style={{ color: 'var(--text-tertiary)' }}>{event.time}</small>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No events for this date</p>
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
                          <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                            Target: {announcement.target_audience} | 
                            Created: {new Date(announcement.created_at).toLocaleDateString()}
                          </small>
                        </div>
                        <Badge color="secondary">{announcement.priority}</Badge>
                      </div>
                    </Alert>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No announcements yet</p>
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
                    <option value="Student">Students</option>
                    <option value="Staff">Staff</option>
                    <option value="Assistant">Assistants</option>
                    <option value="Admin">Admins</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={() => setAnnouncementModal(false)} disabled={announcementSubmitting}>
              Cancel
            </Button>
            <Button type="submit" style={{ background: '#4caf50', border: 'none' }} disabled={announcementSubmitting}>
              {announcementSubmitting ? <Spinner size="sm" /> : 'Create Announcement'}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
      </Container>
    </div>
  );
};

export default AdminReports;
