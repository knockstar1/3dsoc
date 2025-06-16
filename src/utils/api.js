// src/utils/api.js

// Determine API base URL based on environment
// TEMPORARY: Hardcoding Render URL to debug VITE_API_BASE_URL issue
export const API_BASE_URL = 'https://iw-9wja.onrender.com';

/**
 * Makes an authenticated request to the API
 * @param {string} endpoint - The API endpoint (e.g., '/api/users/login')
 * @param {string} method - The HTTP method to use (default: 'GET')
 * @param {object} data - The data to send in the request body (for non-GET requests)
 * @returns {Promise<Response>} - The response from the API
 */
export async function makeAuthenticatedRequest(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('token');
    
    const url = `${API_BASE_URL}${endpoint}`;

    // Enhanced logging of API requests
    console.log(`Making ${method} request to ${url}` + (data ? ' with data' : ' without data'));
    if (data) {
        console.log('Request data preview:', JSON.stringify(data).substring(0, 100) + (JSON.stringify(data).length > 100 ? '...' : ''));
    }
    
    const options = {
        method: method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    // Add body for non-GET requests
    if (method !== 'GET' && data) {
        // Special handling for endpoints that need direct data
        if (endpoint.includes('/character') && method === 'PUT' || 
            endpoint.includes('/posts') || 
            endpoint.includes('/messages') ||
            endpoint.includes('/reaction')) {
            options.body = JSON.stringify(data);
        } else {
            options.body = JSON.stringify({ character: data });
        }
    }
    
    try {
        const response = await fetch(url, options);
        
        console.log(`API request to ${url} ${response.ok ? 'successful' : 'failed'} with status ${response.status}`);
        
        return response;
    } catch (error) {
        console.error(`API request to ${url} failed with error:`, error);
        throw error;
    }
} 