import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const login = createAsyncThunk("auth/login", async (credentials, { rejectWithValue }) => {
    try {
        const response = await axios.post("http://localhost:5000/login", credentials);
        const token = response.data.token;
        const user = response.data.user || response.data;
        
        if (token && user) {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            return { token, user };
        }
        return rejectWithValue('Invalid response from server');
    } catch (error) {
        // Handle different error types
        if (error.response) {
            // Server responded with error status
            const status = error.response.status;
            const message = error.response.data?.message || error.response.data?.error || 'Login failed';
            
            if (status === 401) {
                return rejectWithValue('Invalid email or password. Please try again.');
            } else if (status === 403) {
                return rejectWithValue(message || 'Account is not active. Please contact support.');
            } else if (status === 400) {
                return rejectWithValue(message || 'Invalid data. Please check your email and password.');
            } else {
                return rejectWithValue(message || 'Login failed. Please try again.');
            }
        } else if (error.request) {
            // Request was made but no response received
            return rejectWithValue('Cannot connect to server. Please check your internet connection.');
        } else {
            // Error setting up the request
            return rejectWithValue('An error occurred. Please try again.');
        }
    }
});

export const register = createAsyncThunk("auth/register", async (userData) => {
    try {
        const response = await axios.post("http://localhost:5000/register", userData);
        const token = response.data.token;
        const user = response.data.user || response.data;
        
        if (token && user) {
            // Don't save to localStorage on registration - user needs to login explicitly
            // localStorage.setItem('token', token);
            // localStorage.setItem('user', JSON.stringify(user));
            return { token, user, registered: true };
        }
        throw new Error('Invalid response from server');
    } catch (error) {
        throw error;
    }
});

export const fetchProfile = createAsyncThunk("auth/fetchProfile", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/profile", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.user;
    } catch (error) {
        throw error;
    }
});

const getUserFromStorage = () => {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch {
        return null;
    }
};

const initVal = {
    user: getUserFromStorage(),
    token: localStorage.getItem('token') || null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false,
    errorMessage: null
}

export const AuthSlice = createSlice({
    name: "auth",
    initialState: initVal,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isError = false;
            state.errorMessage = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        },
        clearError: (state) => {
            state.isError = false;
            state.errorMessage = null;
        }
    },
    extraReducers: (builder) => {
        builder        .addCase(login.pending, (state, action) => {
            state.isLoading = true;
            state.isError = false;
            state.errorMessage = null;
        })
        .addCase(login.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.isError = false;
            state.errorMessage = null;
            state.user = action.payload.user;
            state.token = action.payload.token;
        })
        .addCase(login.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
            state.errorMessage = action.payload || 'Login failed. Please try again.';
        })
        .addCase(register.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(register.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            // Don't save user to state on registration - user needs to login explicitly
            // state.user = action.payload.user;
            // state.token = action.payload.token;
        })
        .addCase(register.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchProfile.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchProfile.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.user = action.payload;
        })
        .addCase(fetchProfile.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export const { logout, clearError } = AuthSlice.actions;

export default AuthSlice.reducer;
