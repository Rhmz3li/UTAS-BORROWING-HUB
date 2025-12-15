import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchPayments = createAsyncThunk("payments/fetchPayments", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/payments/my-payments", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchPayment = createAsyncThunk("payments/fetchPayment", async (id) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/payments/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const addPayment = createAsyncThunk("payments/addPayment", async (paymentData) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.post("http://localhost:5000/payments", paymentData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const updatePayment = createAsyncThunk("payments/updatePayment", async ({id, paymentData}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/payments/${id}/status`, paymentData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const deletePayment = createAsyncThunk("payments/deletePayment", async (id, {rejectWithValue}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`http://localhost:5000/payments/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return {id, message: response.data.message};
    } catch (error) {
        return rejectWithValue(error.response?.data || {message: error.message || "An error occurred"});
    }
});

const initVal = {
    payments: [],
    currentPayment: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const PaymentSlice = createSlice({
    name: "payments",
    initialState: initVal,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchPayments.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchPayments.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.payments = action.payload?.data || action.payload || [];
        })
        .addCase(fetchPayments.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchPayment.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchPayment.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.currentPayment = action.payload?.data || action.payload;
        })
        .addCase(fetchPayment.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(addPayment.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(addPayment.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            state.payments = [...state.payments, action.payload.data || action.payload.payment || action.payload];
        })
        .addCase(addPayment.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updatePayment.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updatePayment.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const updatedPayment = action.payload.data || action.payload.payment || action.payload;
            state.payments = state.payments.map((p) =>
                p._id === updatedPayment._id ? updatedPayment : p
            );
        })
        .addCase(updatePayment.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(deletePayment.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(deletePayment.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message;
            state.payments = state.payments.filter((p) => p._id !== action.payload.id);
        })
        .addCase(deletePayment.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export default PaymentSlice.reducer;
