import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import axios from 'axios';

export const fetchPosts = createAsyncThunk("post/fetchPosts", async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:5000/posts", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const fetchPost = createAsyncThunk("post/fetchPost", async (id) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/posts/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const addPost = createAsyncThunk("post/addPost", async (postData) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.post("http://localhost:5000/posts", postData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const updatePost = createAsyncThunk("post/updatePost", async ({id, postData}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/posts/${id}`, postData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

export const deletePost = createAsyncThunk("post/deletePost", async (id, {rejectWithValue}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`http://localhost:5000/posts/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return {id, message: response.data.message};
    } catch (error) {
        return rejectWithValue(error.response?.data || {message: error.message || "An error occurred"});
    }
});

export const addComment = createAsyncThunk("post/addComment", async ({postId, comment}) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.post(`http://localhost:5000/posts/${postId}/comments`, {comment}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
});

const initVal = {
    posts: [],
    currentPost: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false
}

export const PostSlice = createSlice({
    name: "post",
    initialState: initVal,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchPosts.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchPosts.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.posts = action.payload?.data || action.payload || [];
        })
        .addCase(fetchPosts.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(fetchPost.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(fetchPost.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.currentPost = action.payload?.data || action.payload;
        })
        .addCase(fetchPost.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(addPost.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(addPost.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            state.posts = [...state.posts, action.payload.data || action.payload.post || action.payload];
        })
        .addCase(addPost.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(updatePost.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(updatePost.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const updatedPost = action.payload.data || action.payload.post || action.payload;
            state.posts = state.posts.map((p) =>
                p._id === updatedPost._id ? updatedPost : p
            );
        })
        .addCase(updatePost.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(deletePost.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(deletePost.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message;
            state.posts = state.posts.filter((p) => p._id !== action.payload.id);
        })
        .addCase(deletePost.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
        .addCase(addComment.pending, (state, action) => {
            state.isLoading = true
        })
        .addCase(addComment.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.message = action.payload.message || "";
            const comment = action.payload.data || action.payload.comment || action.payload;
            const postId = action.meta.arg.postId;
            const postIndex = state.posts.findIndex(p => p._id === comment.post_id || p._id === postId);
            if (postIndex !== -1) {
                if (!state.posts[postIndex].comments) {
                    state.posts[postIndex].comments = [];
                }
                state.posts[postIndex].comments.push(comment);
            }
        })
        .addCase(addComment.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
        })
    }
});

export default PostSlice.reducer;
