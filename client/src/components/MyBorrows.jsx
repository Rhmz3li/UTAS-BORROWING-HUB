import React, { useEffect } from "react";
import { Container, Row, Col, Card, CardBody, CardTitle, Table, Badge, Button, Spinner, Alert } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchBorrowings, updateBorrowing } from "../redux/reducers/borrowingReducer";
import { FaBook, FaClock, FaCheckCircle, FaExclamationTriangle, FaArrowLeft, FaHourglassHalf, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';

const MyBorrows = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const { borrowings, isLoading, isError } = useSelector((state) => state.borrowing);
    const borrows = Array.isArray(borrowings) ? borrowings : [];

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        dispatch(fetchBorrowings());
    }, [dispatch, user, navigate]);

    useEffect(() => {
        if (isError) {
            toast.error('Failed to load borrows. Please try again.');
        }
    }, [isError]);

    const handleReturn = async (borrowId) => {
        try {
            await dispatch(updateBorrowing({
                id: borrowId,
                borrowingData: { condition_on_return: 'Good' }
            })).unwrap();
            toast.success('Resource returned successfully!');
            dispatch(fetchBorrowings());
        } catch (error) {
            toast.error(error || 'Failed to return resource');
        }
    };

    return (
        <div style={{ marginLeft: '280px', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', transition: 'all 0.3s ease' }}>
            <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Button
                                onClick={() => navigate('/home')}
                                style={{
                                    background: '#fff',
                                    color: '#667eea',
                                    border: '2px solid #667eea',
                                    borderRadius: '10px',
                                    padding: '0.5rem 1.5rem',
                                    fontWeight: '600',
                                    marginBottom: '1rem'
                                }}
                            >
                                <FaArrowLeft className="me-2" />Back
                            </Button>
                            <h2 style={{ color: '#2c3e50', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                My Borrows
                            </h2>
                            <p style={{ color: '#666', margin: 0 }}>
                                View and manage your borrowed resources
                            </p>
                        </div>
                    </div>
                </Col>
            </Row>

            {isLoading ? (
                <div className="text-center py-5">
                    <Spinner color="primary" />
                    <p className="mt-3">Loading borrows...</p>
                </div>
            ) : isError ? (
                <Alert color="danger">
                    <h5>Error Loading Borrows</h5>
                    <p>Failed to load your borrows. Please try refreshing the page.</p>
                    <Button color="primary" onClick={() => dispatch(fetchBorrowings())}>
                        Retry
                    </Button>
                </Alert>
            ) : (
                <Card className="border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                    <CardBody style={{ padding: '1.5rem' }}>
                        <CardTitle tag="h5" style={{ fontWeight: 'bold', marginBottom: '1.5rem', color: '#2c3e50' }}>
                            Borrowed Resources
                        </CardTitle>
                        {Array.isArray(borrows) && borrows.length > 0 ? (
                            <div className="table-responsive">
                                <Table hover style={{ margin: 0 }}>
                                    <thead style={{ background: '#f8f9fa' }}>
                                        <tr>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Resource</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Borrow Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Due Date</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Approval Status</th>
                                            <th style={{ border: 'none', padding: '1rem', fontWeight: '600' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {borrows.map((borrow) => {
                                            const isOverdue = borrow.status === 'Active' && borrow.due_date && new Date(borrow.due_date) < new Date();
                                            const daysUntilDue = borrow.due_date ? Math.ceil((new Date(borrow.due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                                            
                                            return (
                                                <tr 
                                                    key={borrow._id}
                                                    style={isOverdue ? { background: '#fff3e0' } : {}}
                                                >
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <div>
                                                            <FaBook className="me-2" style={{ color: '#667eea' }} />
                                                            <strong style={{ color: '#333' }}>
                                                                {borrow.resource_id?.name || 'Unknown'}
                                                            </strong>
                                                            {borrow.resource_id?.category && (
                                                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                                                    {borrow.resource_id.category}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <span style={{ color: '#666' }}>
                                                            {borrow.borrow_date ? new Date(borrow.borrow_date).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            }) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <FaClock style={{ color: isOverdue ? '#f44336' : '#666' }} />
                                                            <span style={{ color: isOverdue ? '#f44336' : '#666', fontWeight: isOverdue ? '600' : 'normal' }}>
                                                                {borrow.due_date ? new Date(borrow.due_date).toLocaleDateString('en-US', {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                }) : 'N/A'}
                                                            </span>
                                                        </div>
                                                        {daysUntilDue !== null && borrow.status === 'Active' && (
                                                            <div style={{ fontSize: '0.75rem', color: isOverdue ? '#f44336' : daysUntilDue <= 3 ? '#ff9800' : '#666', marginTop: '0.25rem' }}>
                                                                {isOverdue 
                                                                    ? `${Math.abs(daysUntilDue)} day(s) overdue`
                                                                    : daysUntilDue <= 3 
                                                                    ? `${daysUntilDue} day(s) remaining`
                                                                    : ''}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        {borrow.status === 'PendingApproval' ? (
                                                            <Badge style={{
                                                                background: '#fff3e0',
                                                                color: '#ff9800',
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '20px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                width: 'fit-content'
                                                            }}>
                                                                <FaHourglassHalf />Pending Approval
                                                            </Badge>
                                                        ) : isOverdue ? (
                                                            <Badge style={{
                                                                background: '#ffebee',
                                                                color: '#f44336',
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '20px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                width: 'fit-content'
                                                            }}>
                                                                <FaExclamationTriangle />Overdue
                                                            </Badge>
                                                        ) : borrow.status === 'Active' ? (
                                                            <Badge style={{
                                                                background: '#e8f5e9',
                                                                color: '#4caf50',
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '20px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                width: 'fit-content'
                                                            }}>
                                                                <FaCheckCircle />Approved (Active)
                                                            </Badge>
                                                        ) : borrow.status === 'Returned' ? (
                                                            <Badge style={{
                                                                background: '#e3f2fd',
                                                                color: '#2196f3',
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '20px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                width: 'fit-content'
                                                            }}>
                                                                <FaCheckCircle />Returned
                                                            </Badge>
                                                        ) : borrow.status === 'Lost' ? (
                                                            <Badge style={{
                                                                background: '#fce4ec',
                                                                color: '#e91e63',
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '20px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                width: 'fit-content'
                                                            }}>
                                                                <FaTimesCircle />Lost
                                                            </Badge>
                                                        ) : (
                                                            <Badge style={{
                                                                background: '#f5f5f5',
                                                                color: '#666',
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '20px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                width: 'fit-content'
                                                            }}>
                                                                {borrow.status}
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td style={{ border: 'none', padding: '1rem', verticalAlign: 'middle' }}>
                                                        {borrow.status === 'PendingApproval' && (
                                                            <span style={{ fontSize: '0.85rem', color: '#ff9800', fontStyle: 'italic' }}>
                                                                Waiting for admin approval
                                                            </span>
                                                        )}
                                                        {borrow.status === 'Active' && (
                                                            <Button 
                                                                color="primary" 
                                                                size="sm" 
                                                                onClick={() => handleReturn(borrow._id)}
                                                                style={{
                                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    fontWeight: '600'
                                                                }}
                                                            >
                                                                Return
                                                            </Button>
                                                        )}
                                                        {borrow.status === 'Returned' && borrow.return_date && (
                                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>
                                                                Returned: {new Date(borrow.return_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {borrow.status === 'Lost' && (
                                                            <span style={{ fontSize: '0.85rem', color: '#e91e63', fontStyle: 'italic' }}>
                                                                Marked as Lost
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-5">
                                <FaBook size={64} style={{ color: '#ccc', marginBottom: '1rem' }} />
                                <h5 style={{ color: '#666', marginBottom: '0.5rem' }}>No Borrows Found</h5>
                                <p style={{ color: '#999' }}>
                                    You don't have any borrowed resources yet.
                                </p>
                                <Button 
                                    color="primary" 
                                    onClick={() => navigate('/resources')}
                                    style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.75rem 1.5rem',
                                        marginTop: '1rem',
                                        fontWeight: '600'
                                    }}
                                >
                                    <FaBook className="me-2" />Browse Resources
                                </Button>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}
            </Container>
        </div>
    );
};

export default MyBorrows;

