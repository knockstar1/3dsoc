import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

class PostService {
  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      withCredentials: true
    });
  }

  // Add auth token to requests
  setAuthToken(token) {
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Get all posts with pagination
  async getPosts(page = 1, limit = 10) {
    try {
      const response = await this.api.get(`/posts?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get single post
  async getPost(id) {
    try {
      const response = await this.api.get(`/posts/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Create new post
  async createPost(postData) {
    try {
      const response = await this.api.post('/posts', postData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update post
  async updatePost(id, postData) {
    try {
      const response = await this.api.put(`/posts/${id}`, postData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Delete post
  async deletePost(id) {
    try {
      const response = await this.api.delete(`/posts/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Toggle like on post
  async toggleLike(id) {
    try {
      const response = await this.api.post(`/posts/${id}/like`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Add comment to post
  async addComment(id, content) {
    try {
      const response = await this.api.post(`/posts/${id}/comment`, { content });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Error handler
  handleError(error) {
    if (error.response) {
      // Server responded with error
      return {
        message: error.response.data.message || 'Server error occurred',
        status: error.response.status
      };
    } else if (error.request) {
      // Request made but no response
      return {
        message: 'No response from server',
        status: 503
      };
    } else {
      // Request setup error
      return {
        message: error.message,
        status: 500
      };
    }
  }
}

export default new PostService(); 