import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchDashboardStats = createAsyncThunk("admin/fetchDashboardStats", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/admin/dashboard", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchUsers = createAsyncThunk("admin/fetchUsers", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/admin/users", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchUser = createAsyncThunk("admin/fetchUser", async (id) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/admin/users/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const updateUser = createAsyncThunk("admin/updateUser", async ({id, userData}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/admin/users/${id}/status`, userData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const deleteUser = createAsyncThunk("admin/deleteUser", async (id, {rejectWithValue}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`http://localhost:5000/admin/users/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return {id, message: response.data.message};
    } catch (error) {
        return rejectWithValue(error.response?.data || {message: error.message || "An error occurred"});
    }
});

const initVal = {
    dashboardStats: null,
    users: [],
    currentUser: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const AdminSlice = createSlice({
    name: "admin",
    initialState: initVal,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchDashboardStats.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchDashboardStats.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.dashboardStats = action.payload?.data || action.payload;
        })
        .addCase(fetchDashboardStats.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchUsers.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchUsers.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.users = action.payload?.data || action.payload || [];
        })
        .addCase(fetchUsers.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchUser.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.currentUser = action.payload?.data || action.payload;
        })
        .addCase(fetchUser.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updateUser.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updateUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const updatedUser = action.payload.data || action.payload.user || action.payload;
            state.users = state.users.map((u) =>
                u._id === updatedUser._id ? updatedUser : u
            );
        })
        .addCase(updateUser.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(deleteUser.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(deleteUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message;
            state.users = state.users.filter((u) => u._id !== action.payload.id);
        })
        .addCase(deleteUser.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export default AdminSlice.reducer;
