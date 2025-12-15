import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchReservations = createAsyncThunk("reservations/fetchReservations", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/reservations/my-reservations", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchReservation = createAsyncThunk("reservations/fetchReservation", async (id) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/reservations/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const addReservation = createAsyncThunk("reservations/addReservation", async (reservationData, { rejectWithValue }) => {
    try {
        const token = localStorage.getItem('token');
        const apiData = {
            ...reservationData,
            terms_accepted: true
        };
        const response = await axios.post("http://localhost:5000/reservations", apiData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        // Extract error message from response
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to create reservation';
        return rejectWithValue(errorMessage);
    }
});

export const updateReservation = createAsyncThunk("reservations/updateReservation", async ({id, reservationData}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/reservations/${id}`, reservationData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const deleteReservation = createAsyncThunk("reservations/deleteReservation", async (id, {rejectWithValue}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/reservations/${id}/cancel`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return {id, message: response.data.message};
    } catch (error) {
        return rejectWithValue(error.response?.data || {message: error.message || "An error occurred"});
    }
});

const initVal = {
    reservations: [],
    currentReservation: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const ReservationSlice = createSlice({
    name: "reservations",
    initialState: initVal,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchReservations.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchReservations.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.reservations = action.payload?.data || action.payload || [];
        })
        .addCase(fetchReservations.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchReservation.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchReservation.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.currentReservation = action.payload?.data || action.payload;
        })
        .addCase(fetchReservation.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(addReservation.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(addReservation.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            state.reservations = [...state.reservations, action.payload.data || action.payload.reservation || action.payload];
        })
        .addCase(addReservation.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updateReservation.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updateReservation.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const updatedReservation = action.payload.data || action.payload.reservation || action.payload;
            state.reservations = state.reservations.map((r) =>
                r._id === updatedReservation._id ? updatedReservation : r
            );
        })
        .addCase(updateReservation.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(deleteReservation.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(deleteReservation.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message;
            state.reservations = state.reservations.filter((r) => r._id !== action.payload.id);
        })
        .addCase(deleteReservation.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export default ReservationSlice.reducer;
