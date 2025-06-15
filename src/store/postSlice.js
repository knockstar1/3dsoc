import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import postService from '../services/postService';

// Async thunks
export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async ({ page, limit } = { page: 1, limit: 10 }) => {
    const response = await postService.getPosts(page, limit);
    return response.data;
  }
);

export const createPost = createAsyncThunk(
  'posts/createPost',
  async (postData) => {
    const response = await postService.createPost(postData);
    return response.data;
  }
);

export const updatePost = createAsyncThunk(
  'posts/updatePost',
  async ({ id, postData }) => {
    const response = await postService.updatePost(id, postData);
    return response.data;
  }
);

export const deletePost = createAsyncThunk(
  'posts/deletePost',
  async (id) => {
    await postService.deletePost(id);
    return id;
  }
);

export const toggleLike = createAsyncThunk(
  'posts/toggleLike',
  async (id) => {
    const response = await postService.toggleLike(id);
    return response.data;
  }
);

export const addComment = createAsyncThunk(
  'posts/addComment',
  async ({ id, content }) => {
    const response = await postService.addComment(id, content);
    return response.data;
  }
);

const postSlice = createSlice({
  name: 'posts',
  initialState: {
    items: [],
    currentPost: null,
    pagination: {
      current: 1,
      total: 0,
      pages: 0
    },
    status: 'idle',
    error: null
  },
  reducers: {
    setCurrentPost: (state, action) => {
      state.currentPost = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch posts
      .addCase(fetchPosts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      
      // Create post
      .addCase(createPost.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      
      // Update post
      .addCase(updatePost.fulfilled, (state, action) => {
        const index = state.items.findIndex(post => post._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentPost?._id === action.payload._id) {
          state.currentPost = action.payload;
        }
      })
      
      // Delete post
      .addCase(deletePost.fulfilled, (state, action) => {
        state.items = state.items.filter(post => post._id !== action.payload);
        if (state.currentPost?._id === action.payload) {
          state.currentPost = null;
        }
      })
      
      // Toggle like
      .addCase(toggleLike.fulfilled, (state, action) => {
        const index = state.items.findIndex(post => post._id === action.payload._id);
        if (index !== -1) {
          state.items[index].likes = action.payload.likes;
        }
        if (state.currentPost?._id === action.payload._id) {
          state.currentPost.likes = action.payload.likes;
        }
      })
      
      // Add comment
      .addCase(addComment.fulfilled, (state, action) => {
        const index = state.items.findIndex(post => post._id === action.payload._id);
        if (index !== -1) {
          state.items[index].comments = action.payload.comments;
        }
        if (state.currentPost?._id === action.payload._id) {
          state.currentPost.comments = action.payload.comments;
        }
      });
  }
});

export const { setCurrentPost, clearError } = postSlice.actions;
export default postSlice.reducer; 