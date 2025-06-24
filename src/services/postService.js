import { makeAuthenticatedRequest } from '../utils/api.js';

class PostService {
  constructor() {
    // No longer need axios instance as makeAuthenticatedRequest handles it
  }

  // Remove setAuthToken as makeAuthenticatedRequest handles auth

  // Get all posts with pagination
  async getPosts(page = 1, limit = 10) {
    try {
      const response = await makeAuthenticatedRequest(`/posts?page=${page}&limit=${limit}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    } catch (error) {
      throw error; // Let makeAuthenticatedRequest handle logging
    }
  }

  // Get single post
  async getPost(id) {
    try {
      const response = await makeAuthenticatedRequest(`/posts/${id}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    } catch (error) {
      throw error;
    }
  }

  // Create new post
  async createPost(postData) {
    try {
      const response = await makeAuthenticatedRequest('/posts', 'POST', postData);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    } catch (error) {
      throw error;
    }
  }

  // Update post
  async updatePost(id, postData) {
    try {
      const response = await makeAuthenticatedRequest(`/posts/${id}`, 'PUT', postData);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    } catch (error) {
      throw error;
    }
  }

  // Delete post
  async deletePost(id) {
    try {
      const response = await makeAuthenticatedRequest(`/posts/${id}`, 'DELETE');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    } catch (error) {
      throw error;
    }
  }

  // Toggle like on post
  async toggleLike(id) {
    try {
      const response = await makeAuthenticatedRequest(`/posts/${id}/like`, 'POST');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    } catch (error) {
      throw error;
    }
  }

  // Add comment to post
  async addComment(id, content) {
    try {
      const response = await makeAuthenticatedRequest(`/posts/${id}/comment`, 'POST', { content });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    } catch (error) {
      throw error;
    }
  }

  // Remove handleError as makeAuthenticatedRequest handles logging
}

export default new PostService();
export default new PostService(); 