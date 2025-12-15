import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchDevices = createAsyncThunk("devices/fetchDevices", async () => {
    try {
        const response = await axios.get("http://localhost:5000/showDevices");
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchDevice = createAsyncThunk("devices/fetchDevice", async (id) => {
    try {
        const response = await axios.get(`http://localhost:5000/showDevice/${id}`);
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const addDevice = createAsyncThunk("devices/addDevice", async (deviceData) => {
    try {
        const response = await axios.post("http://localhost:5000/saveDevice", deviceData);
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const updateDevice = createAsyncThunk("devices/updateDevice", async ({id, deviceData}) => {
    try {
        const response = await axios.put("http://localhost:5000/updateDevice", {...deviceData, _id: id});
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const deleteDevice = createAsyncThunk("devices/deleteDevice", async (id, {rejectWithValue}) => {
    try {
        const response = await axios.delete(`http://localhost:5000/deleteDevice/${id}`);
        return {id, message: response.data.message};
    } catch (error) {
        return rejectWithValue(error.response?.data || {message: error.message || "An error occurred"});
    }
});

const initVal = {
    devices: [],
    currentDevice: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const DeviceSlice = createSlice({
    name: "devices",
    initialState: initVal,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchDevices.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchDevices.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.devices = action.payload?.data || action.payload || [];
        })
        .addCase(fetchDevices.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchDevice.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchDevice.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.currentDevice = action.payload?.data || action.payload;
        })
        .addCase(fetchDevice.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(addDevice.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(addDevice.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            state.devices = [...state.devices, action.payload.data || action.payload.device || action.payload];
        })
        .addCase(addDevice.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updateDevice.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updateDevice.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const updatedDevice = action.payload.data || action.payload.device || action.payload;
            state.devices = state.devices.map((d) =>
                d._id === updatedDevice._id ? updatedDevice : d
            );
        })
        .addCase(updateDevice.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(deleteDevice.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(deleteDevice.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message;
            state.devices = state.devices.filter((d) => d._id !== action.payload.id);
        })
        .addCase(deleteDevice.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export default DeviceSlice.reducer;
