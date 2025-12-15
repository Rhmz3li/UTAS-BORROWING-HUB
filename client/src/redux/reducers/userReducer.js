import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchProfile = createAsyncThunk("user/fetchProfile", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/profile", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const updateProfile = createAsyncThunk("user/updateProfile", async (userData) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put("http://localhost:5000/profile", userData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const updatePassword = createAsyncThunk("user/updatePassword", async (passwordData) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put("http://localhost:5000/auth/change-password", passwordData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

const initVal = {
    profile: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const UserSlice = createSlice({
    name: "user",
    initialState: initVal,
    reducers: {
        clearUserState: (state) => {
            state.profile = null;
            state.isError = false;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(fetchProfile.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchProfile.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.profile = action.payload?.user || action.payload;
        })
        .addCase(fetchProfile.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updateProfile.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updateProfile.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            state.profile = action.payload.user || action.payload;
        })
        .addCase(updateProfile.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updatePassword.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updatePassword.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
        })
        .addCase(updatePassword.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export const { clearUserState } = UserSlice.actions;

export default UserSlice.reducer;
