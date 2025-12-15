import './App.css';
import LandingPage from './components/LandingPage.jsx';
import Login from './components/LoginPage.jsx';
import Register from './components/RegisterPage.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import ResetPassword from './components/ResetPassword.jsx';
import Home from './components/HomePage.jsx';
import Resources from './components/Resources.jsx';
import ResourceDetail from './components/ResourceDetail.jsx';
import MyBorrows from './components/MyBorrows.jsx';
import MyReservations from './components/MyReservations.jsx';
import Notifications from './components/Notifications.jsx';
import Profile from './components/Profile.jsx';
import Penalties from './components/Penalties.jsx';
import Payments from './components/PaymentPage.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import AdminResources from './components/AdminResources.jsx';
import AdminBorrows from './components/AdminBorrows.jsx';
import AdminReservations from './components/AdminReservations.jsx';
import AdminUsers from './components/AdminUsers.jsx';
import AdminPayments from './components/AdminPayments.jsx';
import AdminPenalties from './components/AdminPenalties.jsx';
import AdminReports from './components/AdminReports.jsx';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Container, Row, Col } from 'reactstrap';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Sidebar from './components/Sidebar.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { fetchProfile } from './redux/reducers/authReducer';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTheme } from './contexts/ThemeContext.jsx';

function App() {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const email = user?.email;
    const role = user?.role;
    const { theme } = useTheme();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            dispatch(fetchProfile());
        }
    }, [dispatch]);

    return (
        <>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={email ? <Navigate to="/home" /> : <Login />} />
                <Route path="/register" element={email ? <Navigate to="/home" /> : <Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Protected Routes */}
                <Route path="/home" element={
                    email ? (
                        <>
                            <Sidebar />
                            <Home />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/resources" element={
                    email ? (
                        <>
                            <Sidebar />
                            <Resources />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/resources/:id" element={
                    email ? (
                        <>
                            <Sidebar />
                            <ResourceDetail />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/my-borrows" element={
                    email ? (
                        <>
                            <Sidebar />
                            <MyBorrows />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/reservations" element={
                    email ? (
                        <>
                            <Sidebar />
                            <MyReservations />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/notifications" element={
                    email ? (
                        <>
                            <Sidebar />
                            <Notifications />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/profile" element={
                    email ? (
                        <>
                            <Sidebar />
                            <Profile />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/penalties" element={
                    email ? (
                        <>
                            <Sidebar />
                            <Penalties />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/payments" element={
                    email ? (
                        <>
                            <Sidebar />
                            <Payments />
                        </>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                {/* Admin Routes */}
                <Route path="/admin/dashboard" element={
                    email && ['Admin', 'Assistant'].includes(role) ? (
                        <>
                            <Sidebar />
                            <AdminDashboard />
                        </>
                    ) : email ? (
                        <Navigate to="/home" />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/admin/resources" element={
                    email && ['Admin', 'Assistant'].includes(role) ? (
                        <>
                            <Sidebar />
                            <AdminResources />
                        </>
                    ) : email ? (
                        <Navigate to="/home" />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/admin/borrows" element={
                    email && ['Admin', 'Assistant'].includes(role) ? (
                        <>
                            <Sidebar />
                            <AdminBorrows />
                        </>
                    ) : email ? (
                        <Navigate to="/home" />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/admin/reservations" element={
                    email && ['Admin', 'Assistant'].includes(role) ? (
                        <>
                            <Sidebar />
                            <AdminReservations />
                        </>
                    ) : email ? (
                        <Navigate to="/home" />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/admin/users" element={
                    email && role === 'Admin' ? (
                        <>
                            <Sidebar />
                            <AdminUsers />
                        </>
                    ) : email ? (
                        <Navigate to="/home" />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/admin/payments" element={
                    email && ['Admin', 'Assistant'].includes(role) ? (
                        <>
                            <Sidebar />
                            <AdminPayments />
                        </>
                    ) : email ? (
                        <Navigate to="/home" />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/admin/penalties" element={
                    email && ['Admin', 'Assistant'].includes(role) ? (
                        <>
                            <Sidebar />
                            <AdminPenalties />
                        </>
                    ) : email ? (
                        <Navigate to="/home" />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="/admin/reports" element={
                    email && role === 'Admin' ? (
                        <>
                            <Sidebar />
                            <AdminReports />
                        </>
                    ) : email ? (
                        <Navigate to="/home" />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
            </Routes>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme={theme}
            />
        </>
    );
}

export default App;
