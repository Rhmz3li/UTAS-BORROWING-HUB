import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchBorrowings = createAsyncThunk("borrowing/fetchBorrowings", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/borrow/my-borrows", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchBorrowing = createAsyncThunk("borrowing/fetchBorrowing", async (id) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/borrow/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const addBorrowing = createAsyncThunk("borrowing/addBorrowing", async (borrowingData, { rejectWithValue }) => {
    try {
        const token = localStorage.getItem('token');
        const apiData = {
            resource_id: borrowingData.deviceId,
            due_date: borrowingData.returnDate,
            condition_on_borrow: borrowingData.conditionBefore,
            terms_accepted: true
        };
        const response = await axios.post("http://localhost:5000/borrow/checkout", apiData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        // Extract error message from response
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to borrow resource';
        return rejectWithValue(errorMessage);
    }
});

export const updateBorrowing = createAsyncThunk("borrowing/updateBorrowing", async ({id, borrowingData}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/borrow/${id}/return`, borrowingData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const deleteBorrowing = createAsyncThunk("borrowing/deleteBorrowing", async (id, {rejectWithValue}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`http://localhost:5000/borrow/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return {id, message: response.data.message};
    } catch (error) {
        return rejectWithValue(error.response?.data || {message: error.message || "An error occurred"});
    }
});

const initVal = {
    borrowings: [],
    currentBorrowing: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const BorrowingSlice = createSlice({
    name: "borrowing",
    initialState: initVal,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchBorrowings.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchBorrowings.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.isError = false;
            // Handle both response formats: {success: true, data: [...]} or just [...]
            state.borrowings = Array.isArray(action.payload?.data) 
                ? action.payload.data 
                : Array.isArray(action.payload) 
                ? action.payload 
                : [];
        })
        .addCase(fetchBorrowings.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchBorrowing.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchBorrowing.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.currentBorrowing = action.payload?.data || action.payload;
        })
        .addCase(fetchBorrowing.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(addBorrowing.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(addBorrowing.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload?.message || action.payload?.success ? "Success" : "";
            // Add the new borrow to the list - handle different response formats
            const newBorrow = action.payload?.data || action.payload?.borrowing || action.payload;
            if (newBorrow && !state.borrowings.find(b => b._id === newBorrow._id)) {
                state.borrowings = [newBorrow, ...state.borrowings]; // Add to beginning of array
            }
        })
        .addCase(addBorrowing.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updateBorrowing.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updateBorrowing.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const updatedBorrowing = action.payload.data || action.payload.borrowing || action.payload;
            state.borrowings = state.borrowings.map((b) =>
                b._id === updatedBorrowing._id ? updatedBorrowing : b
            );
        })
        .addCase(updateBorrowing.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(deleteBorrowing.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(deleteBorrowing.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message;
            state.borrowings = state.borrowings.filter((b) => b._id !== action.payload.id);
        })
        .addCase(deleteBorrowing.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export default BorrowingSlice.reducer;
