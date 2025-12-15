import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchPenalties = createAsyncThunk("penalties/fetchPenalties", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/penalties/my-penalties", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchPenalty = createAsyncThunk("penalties/fetchPenalty", async (id) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/penalties/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const addPenalty = createAsyncThunk("penalties/addPenalty", async (penaltyData) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.post("http://localhost:5000/penalties", penaltyData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const updatePenalty = createAsyncThunk("penalties/updatePenalty", async ({id, penaltyData}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/penalties/${id}`, penaltyData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const deletePenalty = createAsyncThunk("penalties/deletePenalty", async (id, {rejectWithValue}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`http://localhost:5000/penalties/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return {id, message: response.data.message};
    } catch (error) {
        return rejectWithValue(error.response?.data || {message: error.message || "An error occurred"});
    }
});

const initVal = {
    penalties: [],
    currentPenalty: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const PenaltySlice = createSlice({
    name: "penalties",
    initialState: initVal,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchPenalties.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchPenalties.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.penalties = action.payload?.data || action.payload || [];
        })
        .addCase(fetchPenalties.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchPenalty.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchPenalty.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.currentPenalty = action.payload?.data || action.payload;
        })
        .addCase(fetchPenalty.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(addPenalty.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(addPenalty.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            state.penalties = [...state.penalties, action.payload.data || action.payload.penalty || action.payload];
        })
        .addCase(addPenalty.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updatePenalty.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updatePenalty.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const updatedPenalty = action.payload.data || action.payload.penalty || action.payload;
            state.penalties = state.penalties.map((p) =>
                p._id === updatedPenalty._id ? updatedPenalty : p
            );
        })
        .addCase(updatePenalty.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(deletePenalty.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(deletePenalty.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message;
            state.penalties = state.penalties.filter((p) => p._id !== action.payload.id);
        })
        .addCase(deletePenalty.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export default PenaltySlice.reducer;
