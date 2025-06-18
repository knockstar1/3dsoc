import * as THREE from 'three';
import { CharacterCreator } from './CharacterCreator.js';

export class CharacterPage {
  constructor(scene, camera, renderer) {
    // Use provided scene, camera, renderer if available
    this.scene = scene || new THREE.Scene();
    this.camera = camera || new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = renderer || new THREE.WebGLRenderer({ antialias: true });

    // Setup camera if we created it
    if (!camera) {
      this.camera.position.set(0, 0, 5);
      this.camera.lookAt(0, 0, 0);
    }

    // Setup renderer if we created it
    if (!renderer) {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor(0x1a1a1a);

      // Safely append renderer to either #character-container or <body>
      const container = document.getElementById('character-container') || document.body;
      container.appendChild(this.renderer.domElement);
    }

    // Add lights if we created the scene
    if (!scene) {
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      this.scene.add(ambientLight, directionalLight);
    }

    // Character setup
    this.characterCreator = new CharacterCreator(this.scene, this.camera);
    this.isActive = false;

    // Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());

    // Setup logout functionality
    this.setupLogoutButton();

    // Start loop if we created the renderer
    if (!renderer) {
      this.animate();
    }
  }

  setupLogoutButton() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        // Clear authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        
        // Redirect to home page
        window.location.href = 'index.html';
      });
    }
  }

  async show() {
    console.log('Showing character page');
    this.isActive = true;
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found, redirecting to home page');
      window.location.href = 'index.html';
      return;
    }
    
    if (!this.characterCreator) {
      this.characterCreator = new CharacterCreator(this.scene, this.camera);
    }
    
    // Load character data
    try {
      await this.characterCreator.loadCharacter();
      this.characterCreator.show();
    } catch (error) {
      console.error('Error loading character:', error);
    }
  }

  hide() {
    this.isActive = false;
    if (this.characterCreator) {
      this.characterCreator.hide();
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    if (!this.isActive) return;
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
}
