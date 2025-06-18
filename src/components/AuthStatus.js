import { makeAuthenticatedRequest } from '../utils/api.js';

export class AuthStatus {
  constructor() {
    this.element = document.createElement('div');
    this.element.style.position = 'fixed';
    this.element.style.top = '20px';
    this.element.style.right = '20px';
    this.element.style.zIndex = '1000';
    this.element.style.cursor = 'pointer';
    this.element.style.width = '40px';
    this.element.style.height = '40px';
    this.element.style.borderRadius = '50%';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';
    this.element.style.fontSize = '24px';
    this.element.style.transition = 'all 0.3s ease';
    
    this.isLoggedIn = false;
    this.updateStatus();
    this.setupEventListeners();
    
    document.body.appendChild(this.element);
  }

  async updateStatus() {
    try {
      const token = localStorage.getItem('token');
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      if (!token || !currentUser || !currentUser._id) {
        this.setLoggedOut();
        return;
      }
      
      const response = await makeAuthenticatedRequest(`${import.meta.env.VITE_API_URL}/users/verify`);
      if (response.ok) {
        this.setLoggedIn();
      } else {
        this.setLoggedOut();
      }
    } catch (error) {
      console.error('Auth verification failed:', error);
      this.setLoggedOut();
    }
  }

  setLoggedIn() {
    this.element.style.backgroundColor = '#4CAF50';
    this.element.textContent = '✓';
    this.element.title = 'Click to logout';
    this.isLoggedIn = true;
  }

  setLoggedOut() {
    this.element.style.backgroundColor = '#f44336';
    this.element.textContent = '!';
    this.element.title = 'Click to login';
    this.isLoggedIn = false;
    
    // Clear auth data
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
  }

  setupEventListeners() {
    this.element.addEventListener('click', async () => {
      if (this.isLoggedIn) {
        // Logout locally since server endpoint is not available
        this.setLoggedOut();
        window.location.reload();
      } else {
        // Show login modal
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
          authModal.style.display = 'flex';
        }
      }
    });
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 