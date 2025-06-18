/**
 * Makes an authenticated request to the API
 * @param {string} url - The URL to make the request to
 * @param {string} method - The HTTP method to use (default: 'GET')
 * @param {object} data - The data to send in the request body (for non-GET requests)
 * @returns {Promise<Response>} - The response from the API
 */
export async function makeAuthenticatedRequest(url, method = 'GET', data = null) {
    const BASE_API_URL = 'https://threedsocbackend.onrender.com/api';
    const fullUrl = `${BASE_API_URL}${url.startsWith('/') ? url : '/' + url}`;
    const token = localStorage.getItem('token');
    
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
        if (fullUrl.includes('/character') && method === 'PUT' || 
            fullUrl.includes('/posts') || 
            fullUrl.includes('/messages') ||
            fullUrl.includes('/reaction')) {
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