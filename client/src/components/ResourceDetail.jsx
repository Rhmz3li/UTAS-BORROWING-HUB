import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, CardBody, CardTitle, Button, Badge, Spinner, Alert, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input } from 'reactstrap';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { addBorrowing } from '../redux/reducers/borrowingReducer';
import { fetchDevices } from '../redux/reducers/deviceReducer';
import { addReservation } from '../redux/reducers/reservationReducer';
import { BorrowingSchemaValidation } from '../validation';
import BorrowingForm from './BorrowingForm';
import { FaArrowLeft, FaBox, FaCalendarCheck, FaMapMarkerAlt, FaTag, FaInfoCircle, FaCheckCircle, FaCalendarAlt, FaBell, FaExclamationTriangle, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import TermsAndPrivacyModal from './TermsAndPrivacyModal';

const ResourceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [borrowModal, setBorrowModal] = useState(false);
  const [reserveModal, setReserveModal] = useState(false);
  const [selectedBorrowDate, setSelectedBorrowDate] = useState('');
  const [selectedReserveDate, setSelectedReserveDate] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [suggestedDates, setSuggestedDates] = useState([]);
  const [borrowedDates, setBorrowedDates] = useState([]);
  const [reserveCalendarMonth, setReserveCalendarMonth] = useState(new Date());
  const [borrowCalendarMonth, setBorrowCalendarMonth] = useState(new Date());
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showPenaltyInfo, setShowPenaltyInfo] = useState(false);

  useEffect(() => {
    fetchResource();
    if (id) {
      fetchAvailability();
    }
  }, [id]);

  const fetchAvailability = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/resources/${id}/availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setBorrowedDates(response.data.data.borrowedDates || []);
        setSuggestedDates(response.data.data.suggestedDates || []);
      }
    } catch (error) {
      console.error('Availability error:', error);
    }
  };

  const fetchResource = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/resources/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setResource(response.data.data);
      }
    } catch (error) {
      console.error('Fetch resource error:', error);
      toast.error('Failed to load resource details');
    } finally {
      setLoading(false);
    }
  };

  const checkDateAvailability = async (date) => {
    if (!date) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`http://localhost:5000/resources/${id}/check-availability`, {
        borrow_date: date
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setAvailabilityStatus({
          available: response.data.data.available,
          message: response.data.data.message,
          returnDate: response.data.data.returnDate
        });
      }
    } catch (error) {
      setAvailabilityStatus({
        available: false,
        message: error.response?.data?.message || 'Failed to check availability'
      });
    }
  };

  const handleBorrow = async () => {
    if (!selectedBorrowDate) {
      toast.error('Please select a borrow date');
      return;
    }

    if (!termsAccepted) {
      toast.error('You must accept the terms and conditions to borrow resources');
      return;
    }

    // Check if payment is required
    if (resource.requires_payment && resource.payment_amount > 0) {
      if (!paymentMethod) {
        toast.error('Please select a payment method');
        return;
      }
    }

    // Check availability first
    await checkDateAvailability(selectedBorrowDate);
    
    if (availabilityStatus && !availabilityStatus.available) {
      toast.error(availabilityStatus.message);
      return;
    }

    try {
      const borrowDate = new Date(selectedBorrowDate);
      const dueDate = new Date(borrowDate);
      dueDate.setDate(dueDate.getDate() + (resource.max_borrow_days || 7));
      
      const result = await dispatch(addBorrowing({
        deviceId: resource._id,
        returnDate: dueDate.toISOString(),
        conditionBefore: resource.condition || 'Good'
      })).unwrap();
      
      const location = resource.location || 'IT Borrowing Hub - Lab 2';
      toast.success(
        `Borrow request submitted successfully! Pending admin approval. You will be notified when approved. Pickup location: ${location}`,
        { autoClose: 6000 }
      );
      setBorrowModal(false);
      setSelectedBorrowDate('');
      setTermsAccepted(false);
      setPaymentMethod('');
      fetchResource();
      fetchAvailability();
      // Don't navigate - the borrow is already added to Redux store and will appear in My Borrows page
    } catch (error) {
      // Handle error from rejectWithValue (payload) or regular error (message)
      const errorMessage = error?.payload || error?.message || typeof error === 'string' ? error : 'Failed to borrow resource';
      toast.error(errorMessage);
    }
  };

  const handleReserve = async () => {
    if (!selectedReserveDate) {
      toast.error('Please select a pickup date');
      return;
    }

    if (!termsAccepted) {
      toast.error('You must accept the terms and conditions to make reservations');
      return;
    }

    // Check if payment is required
    if (resource.requires_payment && resource.payment_amount > 0) {
      if (!paymentMethod) {
        toast.error('Please select a payment method');
        return;
      }
    }

    try {
      const pickupDate = new Date(selectedReserveDate);
      const expiryDate = new Date(pickupDate);
      expiryDate.setDate(expiryDate.getDate() + 7); // Default 7 days expiry

      await dispatch(addReservation({
        resource_id: resource._id,
        pickup_date: pickupDate.toISOString(),
        expiry_date: expiryDate.toISOString()
      })).unwrap();
      
      toast.success('Reservation created successfully! You will be notified when the resource is available.' + (resource.requires_payment ? ' Payment will be processed by admin.' : ''));
      setReserveModal(false);
      setSelectedReserveDate('');
      setTermsAccepted(false);
      setPaymentMethod('');
      fetchResource();
      fetchAvailability();
      navigate('/reservations');
    } catch (error) {
      // Handle error from rejectWithValue (payload) or regular error (message)
      let errorMessage = 'Failed to create reservation';
      if (error?.payload) {
        errorMessage = error.payload;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      console.error('Reservation error:', error); // Debug log
      toast.error(errorMessage);
    }
  };

  const isDateDisabled = (date) => {
    const dateStr = new Date(date).toISOString().split('T')[0];
    return borrowedDates.some(bd => {
      const start = new Date(bd.start).toISOString().split('T')[0];
      const end = new Date(bd.end).toISOString().split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const renderBorrowCalendar = () => {
    const year = borrowCalendarMonth.getFullYear();
    const month = borrowCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    const handleDateClick = (day) => {
      if (day) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(date);
        selectedDateObj.setHours(0, 0, 0, 0);
        
        if (selectedDateObj > today) {
          setSelectedBorrowDate(dateStr);
          checkDateAvailability(dateStr);
        }
      }
    };

    const isSelectedDate = (day) => {
      if (!day) return false;
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      return dateStr === selectedBorrowDate;
    };

    const isDateDisabled = (day) => {
      if (!day) return true;
      const date = new Date(year, month, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      
      if (date <= today) return true;
      
      const dateStr = date.toISOString().split('T')[0];
      return borrowedDates.some(bd => {
        const start = new Date(bd.start).toISOString().split('T')[0];
        const end = new Date(bd.end).toISOString().split('T')[0];
        return dateStr >= start && dateStr <= end;
      });
    };

    const isDateSuggested = (day) => {
      if (!day) return false;
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      return suggestedDates.includes(dateStr);
    };

    const getDateStatus = (day) => {
      if (!day) return null;
      if (isDateDisabled(day)) return 'disabled';
      if (isDateSuggested(day)) return 'suggested';
      if (isSelectedDate(day)) return 'selected';
      return 'available';
    };

    return (
      <div style={{ width: '100%' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <Button
            onClick={() => {
              const newDate = new Date(borrowCalendarMonth);
              newDate.setMonth(newDate.getMonth() - 1);
              setBorrowCalendarMonth(newDate);
            }}
            style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '0.5rem 1rem',
              color: '#fff',
              fontWeight: '600'
            }}
          >
            ← Prev
          </Button>
          <h5 style={{ margin: 0, fontWeight: 'bold', color: '#2c3e50', fontSize: '1.2rem' }}>
            {borrowCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h5>
          <Button
            onClick={() => {
              const newDate = new Date(borrowCalendarMonth);
              newDate.setMonth(newDate.getMonth() + 1);
              setBorrowCalendarMonth(newDate);
            }}
            style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '0.5rem 1rem',
              color: '#fff',
              fontWeight: '600'
            }}
          >
            Next →
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {weekDays.map(day => (
            <div key={day} style={{ 
              textAlign: 'center', 
              fontWeight: 'bold', 
              padding: '0.75rem',
              color: '#667eea',
              fontSize: '0.9rem'
            }}>
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const status = getDateStatus(day);
            const isDisabled = status === 'disabled';
            const isSuggested = status === 'suggested';
            const isSelected = status === 'selected';
            
            return (
              <div
                key={idx}
                onClick={() => !isDisabled && handleDateClick(day)}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  background: isSelected 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : isSuggested
                    ? '#e3f2fd'
                    : isDisabled
                    ? '#f5f5f5'
                    : '#fff',
                  color: isSelected 
                    ? '#fff'
                    : isDisabled
                    ? '#ccc'
                    : '#333',
                  borderRadius: '12px',
                  border: isSelected 
                    ? '3px solid #667eea'
                    : isSuggested
                    ? '2px solid #90caf9'
                    : isDisabled
                    ? '1px solid #e0e0e0'
                    : '2px solid #e0e0e0',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  opacity: isDisabled ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled && !isSelected) {
                    e.currentTarget.style.background = isSuggested ? '#bbdefb' : '#f0f0f0';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled && !isSelected) {
                    e.currentTarget.style.background = isSuggested ? '#e3f2fd' : '#fff';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                {day && (
                  <>
                    <span style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{day}</span>
                    {isSuggested && !isSelected && (
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#667eea',
                        marginTop: '0.25rem'
                      }} />
                    )}
                    {isDisabled && day && (
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#f44336'
                      }} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          display: 'flex',
          gap: '1.5rem',
          justifyContent: 'center',
          paddingTop: '1rem',
          borderTop: '1px solid #e0e0e0',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: '2px solid #667eea'
            }} />
            <small style={{ color: '#666' }}>Selected</small>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '8px',
              background: '#e3f2fd',
              border: '2px solid #90caf9'
            }} />
            <small style={{ color: '#666' }}>Suggested</small>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '8px',
              background: '#f5f5f5',
              border: '1px solid #e0e0e0',
              opacity: 0.5
            }} />
            <small style={{ color: '#666' }}>Unavailable</small>
          </div>
        </div>
      </div>
    );
  };

  const renderReservationCalendar = () => {
    const year = reserveCalendarMonth.getFullYear();
    const month = reserveCalendarMonth.getMonth();
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
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(date);
        selectedDateObj.setHours(0, 0, 0, 0);
        
        // Only allow future dates
        if (selectedDateObj > today) {
          setSelectedReserveDate(dateStr);
        }
      }
    };

    const isSelectedDate = (day) => {
      if (!day) return false;
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      return dateStr === selectedReserveDate;
    };

    const isDateDisabled = (day) => {
      if (!day) return true;
      const date = new Date(year, month, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      
      // Disable past dates
      if (date <= today) return true;
      
      // Disable dates that are borrowed
      const dateStr = date.toISOString().split('T')[0];
      return borrowedDates.some(bd => {
        const start = new Date(bd.start).toISOString().split('T')[0];
        const end = new Date(bd.end).toISOString().split('T')[0];
        return dateStr >= start && dateStr <= end;
      });
    };

    const isDateSuggested = (day) => {
      if (!day) return false;
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      return suggestedDates.includes(dateStr);
    };

    const getDateStatus = (day) => {
      if (!day) return null;
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      
      if (isDateDisabled(day)) return 'disabled';
      if (isDateSuggested(day)) return 'suggested';
      if (isSelectedDate(day)) return 'selected';
      return 'available';
    };

    return (
      <div style={{ width: '100%' }}>
        {/* Calendar Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <Button
            onClick={() => {
              const newDate = new Date(reserveCalendarMonth);
              newDate.setMonth(newDate.getMonth() - 1);
              setReserveCalendarMonth(newDate);
            }}
            style={{ 
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '0.5rem 1rem',
              color: '#fff',
              fontWeight: '600'
            }}
          >
            ← Prev
          </Button>
          <h5 style={{ margin: 0, fontWeight: 'bold', color: '#2c3e50', fontSize: '1.2rem' }}>
            {reserveCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h5>
          <Button
            onClick={() => {
              const newDate = new Date(reserveCalendarMonth);
              newDate.setMonth(newDate.getMonth() + 1);
              setReserveCalendarMonth(newDate);
            }}
            style={{ 
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '0.5rem 1rem',
              color: '#fff',
              fontWeight: '600'
            }}
          >
            Next →
          </Button>
        </div>

        {/* Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {weekDays.map(day => (
            <div key={day} style={{ 
              textAlign: 'center', 
              fontWeight: 'bold', 
              padding: '0.75rem',
              color: '#667eea',
              fontSize: '0.9rem'
            }}>
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const status = getDateStatus(day);
            const isDisabled = status === 'disabled';
            const isSuggested = status === 'suggested';
            const isSelected = status === 'selected';
            
            return (
              <div
                key={idx}
                onClick={() => !isDisabled && handleDateClick(day)}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  background: isSelected 
                    ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                    : isSuggested
                    ? '#e3f2fd'
                    : isDisabled
                    ? '#f5f5f5'
                    : '#fff',
                  color: isSelected 
                    ? '#fff'
                    : isDisabled
                    ? '#ccc'
                    : '#333',
                  borderRadius: '12px',
                  border: isSelected 
                    ? '3px solid #4facfe'
                    : isSuggested
                    ? '2px solid #90caf9'
                    : isDisabled
                    ? '1px solid #e0e0e0'
                    : '2px solid #e0e0e0',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  opacity: isDisabled ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled && !isSelected) {
                    e.currentTarget.style.background = isSuggested ? '#bbdefb' : '#f0f0f0';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled && !isSelected) {
                    e.currentTarget.style.background = isSuggested ? '#e3f2fd' : '#fff';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                {day && (
                  <>
                    <span style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{day}</span>
                    {isSuggested && !isSelected && (
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#4facfe',
                        marginTop: '0.25rem'
                      }} />
                    )}
                    {isDisabled && day && (
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#f44336'
                      }} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          justifyContent: 'center',
          paddingTop: '1rem',
          borderTop: '1px solid #e0e0e0',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: '2px solid #4facfe'
            }} />
            <small style={{ color: '#666' }}>Selected</small>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '8px',
              background: '#e3f2fd',
              border: '2px solid #90caf9'
            }} />
            <small style={{ color: '#666' }}>Suggested</small>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '8px',
              background: '#f5f5f5',
              border: '1px solid #e0e0e0',
              opacity: 0.5
            }} />
            <small style={{ color: '#666' }}>Unavailable</small>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', transition: 'all 0.3s ease' }}>
        <Container fluid className="py-5">
          <div className="text-center">
            <Spinner color="primary" />
            <p className="mt-3">Loading resource details...</p>
          </div>
        </Container>
      </div>
    );
  }

  if (!resource) {
    return (
      <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', transition: 'all 0.3s ease' }}>
        <Container fluid className="py-5">
        <Alert color="danger">
          <h4>Resource not found</h4>
          <p>The resource you're looking for doesn't exist or has been removed.</p>
          <Button color="primary" onClick={() => navigate('/resources')}>
            <FaArrowLeft className="me-2" />Back to Resources
          </Button>
        </Alert>
        </Container>
      </div>
    );
  }

  const images = resource.image 
    ? [resource.image, ...(resource.images || [])]
    : (resource.images && resource.images.length > 0 ? resource.images : []);

  const mainImage = images.length > 0 ? images[selectedImageIndex] : null;

    return (
    <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', transition: 'all 0.3s ease' }}>
      <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <Button
            onClick={() => navigate('/resources')}
            style={{ 
              marginBottom: '1rem',
              background: '#fff',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '10px',
              padding: '0.5rem 1.5rem',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
            }}
          >
            <FaArrowLeft className="me-2" />Back to Resources
          </Button>
        </Col>
      </Row>

      <Row>
        {/* Image Section */}
        <Col md={6} className="mb-4">
          <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', overflow: 'hidden' }}>
            <CardBody style={{ padding: 0 }}>
              {mainImage ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={mainImage}
                    alt={resource.name}
                    style={{
                      width: '100%',
                      height: '500px',
                      objectFit: 'cover',
                      borderRadius: '8px 8px 0 0'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div
                    style={{
                      display: 'none',
                      width: '100%',
                      height: '500px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '3rem'
                    }}
                  >
                    <FaBox />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '500px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '3rem',
                    borderRadius: '8px 8px 0 0'
                  }}
                >
                  <FaBox />
                </div>
              )}

              {/* Thumbnail Gallery */}
              {images.length > 1 && (
                <div style={{
                  padding: '1rem',
                  display: 'flex',
                  gap: '0.5rem',
                  overflowX: 'auto'
                }}>
                  {images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${resource.name} ${idx + 1}`}
                      onClick={() => setSelectedImageIndex(idx)}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: selectedImageIndex === idx ? '3px solid #1976d2' : '2px solid #e0e0e0',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </Col>

        {/* Details Section */}
        <Col md={6}>
          <Card className="border-0 shadow-lg h-100" style={{ borderRadius: '20px' }}>
            <CardBody style={{ padding: '2rem' }}>
              <div className="mb-4">
                <h2 style={{ 
                  color: '#2c3e50', 
                  fontWeight: 'bold', 
                  marginBottom: '1rem',
                  fontSize: '2rem',
                  lineHeight: '1.2'
                }}>
                  {resource.name}
                </h2>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <Badge style={{ 
                    fontSize: '0.9rem', 
                    padding: '0.6rem 1.2rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '25px',
                    fontWeight: '600'
                  }}>
                    <FaTag className="me-2" />{resource.category}
                  </Badge>
                  <Badge 
                    style={{ 
                      fontSize: '0.9rem', 
                      padding: '0.6rem 1.2rem',
                      background: resource.status === 'Available' 
                        ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)'
                        : 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                      border: 'none',
                      borderRadius: '25px',
                      fontWeight: '600'
                    }}
                  >
                    <FaCheckCircle className="me-2" />
                    {resource.status}
                  </Badge>
                  {resource.location && (
                    <Badge style={{ 
                      fontSize: '0.9rem', 
                      padding: '0.6rem 1.2rem',
                      background: '#e3f2fd',
                      color: '#1976d2',
                      border: 'none',
                      borderRadius: '25px',
                      fontWeight: '500'
                    }}>
                      <FaMapMarkerAlt className="me-2" />{resource.location}
                    </Badge>
                  )}
                </div>
              </div>

              {resource.description && (
                <div className="mb-4" style={{
                  background: '#f8f9fa',
                  padding: '1.5rem',
                  borderRadius: '15px',
                  border: '1px solid #e9ecef'
                }}>
                  <h5 style={{ 
                    color: '#2c3e50', 
                    marginBottom: '1rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <FaInfoCircle className="me-2" style={{ color: '#667eea' }} />Description
                  </h5>
                  <p style={{ 
                    color: '#495057', 
                    lineHeight: '1.8', 
                    fontSize: '1rem',
                    margin: 0
                  }}>
                    {resource.description}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <Row className="g-3">
                  <Col md={6}>
                    <div style={{
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                      borderRadius: '15px',
                      border: '2px solid #90caf9',
                      textAlign: 'center',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-5px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(33, 150, 243, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    >
                      <p style={{ margin: 0, color: '#1976d2', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Available Quantity
                      </p>
                      <h3 style={{ margin: 0, color: '#0d47a1', fontWeight: 'bold', fontSize: '2rem' }}>
                        {resource.available_quantity} / {resource.total_quantity}
                      </h3>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div style={{
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                      borderRadius: '15px',
                      border: '2px solid #ce93d8',
                      textAlign: 'center',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-5px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(156, 39, 176, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    >
                      <p style={{ margin: 0, color: '#7b1fa2', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Max Borrow Days
                      </p>
                      <h3 style={{ margin: 0, color: '#4a148c', fontWeight: 'bold', fontSize: '2rem' }}>
                        {resource.max_borrow_days || 7} days
                      </h3>
                    </div>
                  </Col>
                  {resource.condition && (
                    <Col md={6}>
                      <div style={{
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                        borderRadius: '15px',
                        border: '2px solid #a5d6a7',
                        textAlign: 'center'
                      }}>
                        <p style={{ margin: 0, color: '#2e7d32', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                          Condition
                        </p>
                        <h4 style={{ margin: 0, color: '#1b5e20', fontWeight: 'bold' }}>
                          {resource.condition}
                        </h4>
                      </div>
                    </Col>
                  )}
                  {resource.college && (
                    <Col md={6}>
                      <div style={{
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                        borderRadius: '15px',
                        border: '2px solid #ffcc80',
                        textAlign: 'center'
                      }}>
                        <p style={{ margin: 0, color: '#e65100', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                          College
                        </p>
                        <h4 style={{ margin: 0, color: '#bf360c', fontWeight: 'bold' }}>
                          {resource.college}
                        </h4>
                      </div>
                    </Col>
                  )}
                </Row>
              </div>

              {((resource.status === 'Available' || resource.status === 'Reserved') && resource.available_quantity > 0) && (
                <div className="d-flex gap-3" style={{ marginTop: '1.5rem' }}>
                  <Button
                    type="button"
                    size="lg"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Borrow button clicked');
                      const minDate = getMinDate();
                      console.log('Min date:', minDate);
                      setBorrowModal(true);
                      setSelectedBorrowDate(minDate);
                      setBorrowCalendarMonth(new Date());
                      setTermsAccepted(false);
                      if (minDate) {
                        checkDateAvailability(minDate);
                      }
                      fetchAvailability();
                    }}
                    style={{ 
                      flex: 1, 
                      fontWeight: '600',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: '15px',
                      padding: '1rem',
                      fontSize: '1.1rem',
                      boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                    }}
                  >
                    <FaBox className="me-2" />Borrow
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Reserve button clicked');
                      const minDate = getMinDate();
                      console.log('Min date:', minDate);
                      setReserveModal(true);
                      setSelectedReserveDate(minDate);
                      setReserveCalendarMonth(new Date());
                      setTermsAccepted(false);
                      fetchAvailability();
                    }}
                    style={{ 
                      flex: 1, 
                      fontWeight: '600',
                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      border: 'none',
                      borderRadius: '15px',
                      padding: '1rem',
                      fontSize: '1.1rem',
                      boxShadow: '0 6px 20px rgba(79, 172, 254, 0.4)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(79, 172, 254, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 172, 254, 0.4)';
                    }}
                  >
                    <FaCalendarCheck className="me-2" />Reserve
                  </Button>
                </div>
              )}

              {resource.status !== 'Available' && resource.status !== 'Reserved' && resource.available_quantity === 0 && (
                <Alert color="warning" style={{ marginTop: '1rem', borderRadius: '10px' }}>
                  This resource is currently {resource.status.toLowerCase()}. Please check back later.
                </Alert>
              )}

              {resource.available_quantity === 0 && (resource.status === 'Available' || resource.status === 'Reserved') && (
                <Alert color="info" style={{ marginTop: '1rem', borderRadius: '10px' }}>
                  This resource is currently out of stock. You can still reserve it for later.
                </Alert>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Borrow Modal */}
      <Modal 
        isOpen={borrowModal} 
        toggle={() => {
          setBorrowModal(false);
          setAvailabilityStatus(null);
        }} 
        size="lg"
        style={{ borderRadius: '20px' }}
      >
        <ModalHeader 
          toggle={() => {
            setBorrowModal(false);
            setAvailabilityStatus(null);
          }}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '20px 20px 0 0'
          }}
        >
          <FaBox className="me-2" />Borrow Resource
        </ModalHeader>
        <ModalBody style={{ padding: '2rem' }}>
          <Form>
            <FormGroup>
              <Label>
                <FaCalendarAlt className="me-2" />Select Borrow Date *
              </Label>
              <Input
                type="date"
                value={selectedBorrowDate}
                min={getMinDate()}
                onChange={(e) => {
                  setSelectedBorrowDate(e.target.value);
                  checkDateAvailability(e.target.value);
                }}
                required
              />
              {selectedBorrowDate && (
                <div style={{ marginTop: '1rem' }}>
                  {availabilityStatus?.available ? (
                    <Alert color="success" style={{ borderRadius: '10px', border: 'none' }}>
                      <FaCheckCircle className="me-2" />
                      <strong>Resource is available on this date!</strong>
                      {availabilityStatus.returnDate && (
                        <div className="mt-2" style={{ fontSize: '0.9rem' }}>
                          Due date: <strong>{new Date(availabilityStatus.returnDate).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</strong>
                        </div>
                      )}
                    </Alert>
                  ) : availabilityStatus && !availabilityStatus.available ? (
                    <Alert color="warning" style={{ borderRadius: '10px', border: 'none' }}>
                      <FaExclamationTriangle className="me-2" />
                      <strong>{availabilityStatus.message}</strong>
                      {availabilityStatus.returnDate && (
                        <div className="mt-2" style={{ fontSize: '0.9rem' }}>
                          <strong>Expected return date:</strong> {new Date(availabilityStatus.returnDate).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                      )}
                    </Alert>
                  ) : null}
                </div>
              )}
            </FormGroup>

            {suggestedDates.length > 0 && (
              <div className="mt-3">
                <Label>
                  <FaBell className="me-2" />Suggested Available Dates:
                </Label>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {suggestedDates.map((date, idx) => (
                    <Badge
                      key={idx}
                      color="info"
                      style={{ cursor: 'pointer', padding: '0.5rem 1rem' }}
                      onClick={() => {
                        setSelectedBorrowDate(date);
                        checkDateAvailability(date);
                      }}
                    >
                      {new Date(date).toLocaleDateString()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {borrowedDates.length > 0 && (
              <div className="mt-3">
                <Label className="text-muted small">
                  <FaExclamationTriangle className="me-2" />Currently Borrowed Periods:
                </Label>
                <div className="mt-2">
                  {borrowedDates.map((period, idx) => (
                    <div key={idx} className="small text-muted mb-1">
                      {new Date(period.start).toLocaleDateString()} - {new Date(period.end).toLocaleDateString()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Borrow Policy & Penalties */}
            <div className="mt-4" style={{ 
              padding: '1rem', 
              background: '#fff3cd', 
              borderRadius: '10px',
              border: '2px solid #ffc107'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>🔔</span>
                <strong style={{ color: '#856404' }}>Borrow Policy & Penalties</strong>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#856404', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                Late return, damage, or loss of the resource may result in penalties and temporary borrowing restrictions.
              </p>
              <div style={{ fontSize: '0.85rem', color: '#856404', lineHeight: '1.6', paddingLeft: '1rem', borderLeft: '3px solid #ffc107' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  • <strong>Late Return:</strong> 0.5 OMR per day after due date
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  • <strong>Damage:</strong> 25-50 OMR depending on severity
                </div>
                <div>
                  • <strong>Loss:</strong> Full replacement cost (default: 100 OMR)
                </div>
              </div>
            </div>

            {/* Payment Section */}
            {resource.requires_payment && resource.payment_amount > 0 && (
              <div className="mt-4" style={{ 
                padding: '1.5rem', 
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', 
                borderRadius: '10px',
                border: '2px solid #2196f3'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                  <FaShieldAlt style={{ color: '#1976d2', fontSize: '1.3rem', marginRight: '0.5rem' }} />
                  <strong style={{ color: '#1976d2', fontSize: '1.1rem' }}>Payment Required</strong>
                </div>
                <div style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#1565c0' }}>
                  <strong>Amount: {resource.payment_amount} OMR</strong>
                </div>
                <FormGroup>
                  <Label style={{ fontWeight: '600', color: '#1976d2', marginBottom: '0.75rem' }}>
                    Select Payment Method *
                  </Label>
                  <Input
                    type="select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ borderRadius: '10px', border: '2px solid #2196f3' }}
                  >
                    <option value="">Choose payment method...</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Online">Online</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </Input>
                </FormGroup>
                <div style={{ fontSize: '0.85rem', color: '#1565c0', marginTop: '0.75rem', fontStyle: 'italic' }}>
                  Payment will be processed by admin. You will receive a notification once payment is confirmed.
                </div>
              </div>
            )}

            {/* Terms and Conditions */}
            <div className="mt-4" style={{ 
              padding: '1rem', 
              background: '#f8f9fa', 
              borderRadius: '10px',
              border: '1px solid #e0e0e0'
            }}>
              <FormGroup check>
                <Label check style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{ marginRight: '0.75rem', cursor: 'pointer' }}
                  />
                  <div>
                    <span style={{ fontWeight: '600', color: '#333' }}>
                      I accept the <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#667eea',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: '600'
                        }}
                      >
                        Terms and Conditions
                      </button>
                    </span>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                      By checking this box, you agree to be responsible for any loss, damage, or late return penalties.
                    </div>
                  </div>
                </Label>
              </FormGroup>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter style={{ border: 'none', padding: '1.5rem 2rem' }}>
          <Button 
            onClick={() => {
              setBorrowModal(false);
              setAvailabilityStatus(null);
              setTermsAccepted(false);
              setPaymentMethod('');
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
            onClick={handleBorrow}
            disabled={
              !selectedBorrowDate || 
              !termsAccepted || 
              (availabilityStatus && !availabilityStatus.available) ||
              (resource.requires_payment && resource.payment_amount > 0 && !paymentMethod)
            }
            style={{
              background: !selectedBorrowDate || !termsAccepted || (availabilityStatus && !availabilityStatus.available) || (resource.requires_payment && resource.payment_amount > 0 && !paymentMethod)
                ? '#ccc'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '0.75rem 2rem',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
          >
            <FaBox className="me-2" />Confirm Borrow
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reserve Modal */}
      <Modal 
        isOpen={reserveModal} 
        toggle={() => setReserveModal(false)}
        size="lg"
        style={{ borderRadius: '20px' }}
      >
        <ModalHeader 
          toggle={() => setReserveModal(false)}
          style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '20px 20px 0 0'
          }}
        >
          <FaCalendarCheck className="me-2" />Reserve Resource
        </ModalHeader>
        <ModalBody style={{ padding: '2rem' }}>
          <Form>
            <FormGroup>
              <Label style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '1rem', fontSize: '1.1rem' }}>
                <FaCalendarAlt className="me-2" style={{ color: '#4facfe' }} />Select Pickup Date *
              </Label>
              
              {/* Custom Calendar */}
              <div style={{
                border: '2px solid #e0e0e0',
                borderRadius: '15px',
                padding: '1.5rem',
                background: '#fff',
                marginBottom: '1rem'
              }}>
                {renderReservationCalendar()}
              </div>

              {selectedReserveDate && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: '#e3f2fd',
                  borderRadius: '10px',
                  border: '1px solid #90caf9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <FaCalendarCheck className="me-2" style={{ color: '#1976d2' }} />
                    <strong style={{ color: '#1976d2' }}>Selected Date:</strong>
                    <span style={{ color: '#1976d2', marginLeft: '0.5rem', fontWeight: '600' }}>
                      {new Date(selectedReserveDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #90caf9' }}>
                    <FaBell className="me-2" style={{ color: '#1976d2', fontSize: '0.9rem' }} />
                    <span style={{ color: '#1976d2', fontSize: '0.9rem' }}>
                      You will be notified when the resource is available for pickup on this date.
                    </span>
                  </div>
                </div>
              )}

              {suggestedDates.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <Label style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                    <FaBell className="me-2" style={{ color: '#4facfe' }} />Suggested Available Dates:
                  </Label>
                  <div className="d-flex flex-wrap gap-2">
                    {suggestedDates.map((date, idx) => (
                      <Badge
                        key={idx}
                        style={{
                          cursor: 'pointer',
                          padding: '0.6rem 1.2rem',
                          background: selectedReserveDate === date
                            ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                            : '#e3f2fd',
                          color: selectedReserveDate === date ? '#fff' : '#1976d2',
                          border: 'none',
                          borderRadius: '20px',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          transition: 'all 0.3s ease'
                        }}
                        onClick={() => setSelectedReserveDate(date)}
                        onMouseEnter={(e) => {
                          if (selectedReserveDate !== date) {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.background = '#bbdefb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedReserveDate !== date) {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.background = '#e3f2fd';
                          }
                        }}
                      >
                        {new Date(date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </FormGroup>

            {/* Borrow Policy & Penalties */}
            <div className="mt-4" style={{ 
              padding: '1rem', 
              background: '#fff3cd', 
              borderRadius: '10px',
              border: '2px solid #ffc107'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>🔔</span>
                <strong style={{ color: '#856404' }}>Borrow Policy & Penalties</strong>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#856404', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                Late return, damage, or loss of the resource may result in penalties and temporary borrowing restrictions.
              </p>
              <div style={{ fontSize: '0.85rem', color: '#856404', lineHeight: '1.6', paddingLeft: '1rem', borderLeft: '3px solid #ffc107' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  • <strong>Late Return:</strong> 0.5 OMR per day after due date
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  • <strong>Damage:</strong> 25-50 OMR depending on severity
                </div>
                <div>
                  • <strong>Loss:</strong> Full replacement cost (default: 100 OMR)
                </div>
              </div>
            </div>

            {/* Payment Section */}
            {resource.requires_payment && resource.payment_amount > 0 && (
              <div className="mt-4" style={{ 
                padding: '1.5rem', 
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', 
                borderRadius: '10px',
                border: '2px solid #2196f3'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                  <FaShieldAlt style={{ color: '#1976d2', fontSize: '1.3rem', marginRight: '0.5rem' }} />
                  <strong style={{ color: '#1976d2', fontSize: '1.1rem' }}>Payment Required</strong>
                </div>
                <div style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#1565c0' }}>
                  <strong>Amount: {resource.payment_amount} OMR</strong>
                </div>
                <FormGroup>
                  <Label style={{ fontWeight: '600', color: '#1976d2', marginBottom: '0.75rem' }}>
                    Select Payment Method *
                  </Label>
                  <Input
                    type="select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ borderRadius: '10px', border: '2px solid #2196f3' }}
                  >
                    <option value="">Choose payment method...</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Online">Online</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </Input>
                </FormGroup>
                <div style={{ fontSize: '0.85rem', color: '#1565c0', marginTop: '0.75rem', fontStyle: 'italic' }}>
                  Payment will be processed by admin. You will receive a notification once payment is confirmed.
                </div>
              </div>
            )}

            {/* Terms and Conditions */}
            <div className="mt-4" style={{ 
              padding: '1rem', 
              background: '#f8f9fa', 
              borderRadius: '10px',
              border: '1px solid #e0e0e0'
            }}>
              <FormGroup check>
                <Label check style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{ marginRight: '0.75rem', cursor: 'pointer' }}
                  />
                  <div>
                    <span style={{ fontWeight: '600', color: '#333' }}>
                      I accept the <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4facfe',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: '600'
                        }}
                      >
                        Terms and Conditions
                      </button>
                    </span>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                      By checking this box, you agree to be responsible for any loss, damage, or late return penalties.
                    </div>
                  </div>
                </Label>
              </FormGroup>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter style={{ border: 'none', padding: '1.5rem 2rem' }}>
          <Button 
            onClick={() => {
              setReserveModal(false);
              setTermsAccepted(false);
              setPaymentMethod('');
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
            onClick={handleReserve} 
            disabled={
              !selectedReserveDate || 
              !termsAccepted ||
              (resource.requires_payment && resource.payment_amount > 0 && !paymentMethod)
            }
            style={{
              background: !selectedReserveDate || !termsAccepted || (resource.requires_payment && resource.payment_amount > 0 && !paymentMethod)
                ? '#ccc'
                : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '0.75rem 2rem',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)'
            }}
          >
            <FaCalendarCheck className="me-2" />Confirm Reservation
          </Button>
        </ModalFooter>
      </Modal>

      {/* Terms and Conditions Modal */}
      <TermsAndPrivacyModal 
        isOpen={termsModalOpen} 
        toggle={() => setTermsModalOpen(false)} 
        type="terms" 
      />

      {/* Terms and Conditions Modal */}
      <TermsAndPrivacyModal 
        isOpen={termsModalOpen} 
        toggle={() => setTermsModalOpen(false)} 
        type="terms" 
      />
      </Container>
    </div>
  );
};

export default ResourceDetail;

