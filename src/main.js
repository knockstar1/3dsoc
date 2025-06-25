import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { Auth } from './pages/auth';
import { Home } from './pages/Home';

class App {
  constructor() {
    console.log('Initializing App');
    console.log('VITE_APP_API_BASE_URL:', import.meta.env.VITE_APP_API_BASE_URL);
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 1, 1000);
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    });
    
    this.init();
  }

  init() {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(ambientLight, directionalLight);

    // Initialize auth first
    this.auth = new Auth();
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const currentUser = localStorage.getItem('currentUser');
    
    // Setup logout button handler
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        // Clear authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        
        // Redirect to home page and force reload
        window.location.href = 'index.html';
      });
    }
    
    // Only handle index.html - other pages handle themselves
    const currentPath = window.location.pathname;
    if (currentPath.includes('notifications.html') || 
        currentPath.includes('character.html') || 
        currentPath.includes('messages.html')) {
      // These pages handle themselves with their own scripts
      // Don't initialize main app for these pages
      return;
    } else if (token && currentUser) {
      console.log('User found, initializing home page');
      this.home = new Home(this.scene, this.camera, this.renderer);
      this.currentPage = 'home';
      this.home.show();
    } else {
      console.log('No user found, showing auth page');
      this.currentPage = 'auth';
      this.auth.show();
    }

    // Setup event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Handle navigation events (only for index.html page switching)
    window.addEventListener('navigate', (event) => {
      const newPage = event.detail.page;
      console.log('Navigating to:', newPage);
      
      // Hide current page
      if (this.currentPage === 'home') {
        this.home?.hide();
      } else if (this.currentPage === 'auth') {
        this.auth?.hide();
      }
      
      // Show new page (only handle home and auth on index.html)
      if (newPage === 'home') {
        if (!this.home) {
          console.log('Creating new home page instance');
          this.home = new Home(this.scene, this.camera, this.renderer);
        }
        this.home.show();
      } else if (newPage === 'auth') {
        this.auth.show();
      }
      
      this.currentPage = newPage;
    });

    // Handle menu clicks
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Skip for logout button (handled separately)
        if (e.target.id === 'logout-button') return;
        
        e.preventDefault();
        
        // Remove active class from all items
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        // Add active class to clicked item
        e.target.classList.add('active');
        
        const page = e.target.dataset.page;
        if (page === 'messages') {
          // Check if user is logged in
          const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
          if (!currentUser || !currentUser._id) {
            this.auth.show();
            return;
          }
          
          // Navigate to messages page
          window.location.href = 'messages.html';
        } else if (page === 'character') {
          // Check if user is logged in before navigating to character page
          const token = localStorage.getItem('token');
          const currentUser = localStorage.getItem('currentUser');
          if (token && currentUser) {
            window.location.href = 'character.html';
          } else {
            this.auth.show();
          }
        } else if (page === 'notifications') {
          // Check if user is logged in before navigating to notifications page
          const token = localStorage.getItem('token');
          const currentUser = localStorage.getItem('currentUser');
          if (token && currentUser) {
            window.location.href = 'notifications.html';
          } else {
            this.auth.show();
          }
        } else if (page === 'home') {
          // Check if we're already on the home page
          if (window.location.pathname.includes('character.html') || 
              window.location.pathname.includes('notifications.html') ||
              window.location.pathname.includes('messages.html')) {
            window.location.href = 'index.html';
          } else {
            window.dispatchEvent(new CustomEvent('navigate', { 
              detail: { page } 
            }));
          }
        }
      });
    });

    // Start animation loop
    this.animate();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    TWEEN.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize the app
new App();
