import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchNotifications = createAsyncThunk("notifications/fetchNotifications", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/notifications", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchNotification = createAsyncThunk("notifications/fetchNotification", async (id) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/notifications/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const addNotification = createAsyncThunk("notifications/addNotification", async (notificationData) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.post("http://localhost:5000/notifications", notificationData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const updateNotification = createAsyncThunk("notifications/updateNotification", async ({id, notificationData}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/notifications/${id}/read`, notificationData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const deleteNotification = createAsyncThunk("notifications/deleteNotification", async (id, {rejectWithValue}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`http://localhost:5000/notifications/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return {id, message: response.data.message};
    } catch (error) {
        return rejectWithValue(error.response?.data || {message: error.message || "An error occurred"});
    }
});

const initVal = {
    notifications: [],
    currentNotification: null,
    unreadCount: 0,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const NotificationSlice = createSlice({
    name: "notifications",
    initialState: initVal,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchNotifications.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchNotifications.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.notifications = action.payload?.data || action.payload?.notifications || [];
            state.unreadCount = action.payload?.unreadCount || 0;
        })
        .addCase(fetchNotifications.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchNotification.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchNotification.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.currentNotification = action.payload?.data || action.payload;
        })
        .addCase(fetchNotification.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(addNotification.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(addNotification.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const newNotification = action.payload.data || action.payload.notification || action.payload;
            state.notifications = [...state.notifications, newNotification];
            // Update unreadCount when new notification is added and not read
            if (newNotification && !newNotification.is_read) {
                state.unreadCount = (state.unreadCount || 0) + 1;
            }
        })
        .addCase(addNotification.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updateNotification.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updateNotification.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const updatedNotification = action.payload.data || action.payload.notification || action.payload;
            const oldNotification = state.notifications.find(n => n._id === updatedNotification._id);
            state.notifications = state.notifications.map((n) =>
                n._id === updatedNotification._id ? updatedNotification : n
            );
            // Update unreadCount when notification status changes
            if (oldNotification && updatedNotification.is_read !== oldNotification.is_read) {
                if (updatedNotification.is_read) {
                    // Notification was marked as read
                    state.unreadCount = Math.max(0, (state.unreadCount || 0) - 1);
                } else {
                    // Notification was marked as unread
                    state.unreadCount = (state.unreadCount || 0) + 1;
                }
            }
        })
        .addCase(updateNotification.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(deleteNotification.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(deleteNotification.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message;
            const deletedNotification = state.notifications.find((n) => n._id === action.payload.id);
            state.notifications = state.notifications.filter((n) => n._id !== action.payload.id);
            // Update unreadCount when unread notification is deleted
            if (deletedNotification && !deletedNotification.is_read) {
                state.unreadCount = Math.max(0, (state.unreadCount || 0) - 1);
            }
        })
        .addCase(deleteNotification.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export default NotificationSlice.reducer;
