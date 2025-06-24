/**
 * Makes an authenticated request to the API
 * @param {string} url - The URL to make the request to
 * @param {string} method - The HTTP method to use (default: 'GET')
 * @param {object} data - The data to send in the request body (for non-GET requests)
 * @returns {Promise<Response>} - The response from the API
 */
export async function makeAuthenticatedRequest(url, method = 'GET', data = null) {
    const token = localStorage.getItem('token');
    
    // Dynamically determine the base API URL
    const BASE_API_URL = import.meta.env.VITE_APP_API_BASE_URL || 'http://localhost:5000';
    const fullUrl = `${BASE_API_URL}${url}`;

    // Enhanced logging of API requests
    console.log(`Making ${method} request to ${fullUrl}` + (data ? ' with data' : ' without data'));
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
        if (url.includes('/character') && method === 'PUT' || 
            url.includes('/posts') || 
            url.includes('/messages') ||
            url.includes('/reaction')) {
            options.body = JSON.stringify(data);
        } else {
            options.body = JSON.stringify({ character: data });
        }
    }
    
    try {
        const response = await fetch(fullUrl, options);
        
        console.log(`API request to ${fullUrl} ${response.ok ? 'successful' : 'failed'} with status ${response.status}`);
        
        return response;
    } catch (error) {
        console.error(`API request to ${fullUrl} failed with error:`, error);
        throw error;
    }
} 