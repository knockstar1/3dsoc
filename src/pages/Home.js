import * as THREE from 'three';
import { CharacterCreator } from './CharacterCreator';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { makeAuthenticatedRequest } from '../utils/api.js';
import { AuthStatus } from '../components/AuthStatus.js';

export class Home {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.dioramas = new THREE.Group();
    this.posts = new THREE.Group();
    this.scrollPosition = 0;
    this.dioramaHeight = 8;
    this.dioramaDepth = 5;
    this.dioramaGap = 14;
    this.visibleDioramas = [];
    this.isActive = false;
    this.userDioramaIndex = 0;
    this.bubbles = [];
    this.font = null;
    this.isLoading = true;
    this.userCharacter = null;
    this.characterCreator = new CharacterCreator(scene, camera);
    this.authStatus = new AuthStatus();
    
    // Connection cord properties
    this.cordSystem = {
      isActive: false,
      sourceDiorama: null,
      cord: null,
      dragPoint: new THREE.Vector3(),
      isDragging: false,
      currentHover: null,
      anchored: new Map() // Map of anchored dioramas to user's diorama
    };
    
    // Event handling flag
    this.eventListenersInitialized = false;
    this.postButtonHandlersInitialized = false;
    
    // Add model loaders
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    
    // Store loaded model
    this.bedroomModel = null;
    this.isModelLoaded = false;
    
    // Add user and post management
    this.allUsers = [];
    this.userPosts = new Map();
    this.currentUser = null;
    this.socket = null; // Initialize socket to null
    
    // Add diorama editing system
    this.dioramaEditing = {
      isActive: false,
      selectedObject: null,
      originalMaterials: new Map(),
      variations: new Map(), // Add variations Map
      highlightMaterial: new THREE.MeshPhysicalMaterial({
        color: 0x4a90e2,
        transparent: true,
        opacity: 0.8,
        metalness: 0.5,
        roughness: 0.2,
        envMapIntensity: 1.0
      }),
      hoverMaterial: new THREE.MeshPhysicalMaterial({
        color: 0xff8c00,
        transparent: true,
        opacity: 0.6,
        metalness: 0.3,
        roughness: 0.4,
        envMapIntensity: 0.8
      }),
      isDragging: false,
      dragStartPosition: new THREE.Vector3(),
      dragPlane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      dragOffset: new THREE.Vector3(),
      gridSize: 0.5,
      snapToGrid: true,
      hoveredObject: null
    };
    
    // Bind methods
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.animate = this.animate.bind(this);
    this.checkAuth = this.checkAuth.bind(this);
    
    // Save bound methods for event listener cleanup
    this.handleMouseMoveBound = this.handleMouseMove;
    this.handleMouseDownBound = this.handleMouseDown;
    this.handleMouseUpBound = this.handleMouseUp;
    this.handleClickBound = this.handleClick;
    this.handleScrollBound = this.handleScroll;
    
    // Add a bound resize handler
    this.handleResizeBound = () => {
      if (this.isActive) {
        this.updateAllPermanentConnections();
      }
    };
    
    // Setup post canvas
    this.setupPostCanvas();
    
    // Hide dioramas initially
    this.scene.add(this.dioramas);
    this.scene.add(this.posts);
    this.scene.remove(this.dioramas);
    this.scene.remove(this.posts);
    
    // Setup raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredBubble = null;
    
    // Add sound effects
    this.hoverSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    this.reactionSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3');
    
    // Set volume
    this.hoverSound.volume = 0.1;
    this.reactionSound.volume = 0.3;
    
    // Preload sounds
    this.hoverSound.load();
    this.reactionSound.load();
    
    // Track hover state
    this.lastHoveredPost = null;
    
    // Track if user has interacted
    this.hasUserInteracted = false;
    
    // Add initial interaction listener
    document.addEventListener('click', () => {
      this.hasUserInteracted = true;
    }, { once: true });
    
    // Initialize WebSocket connection (but don't connect yet)
    this.initWebSocket();

    this.REACTION_TYPES = {
      '👍': 'like',
      '❤️': 'love',
      '😂': 'haha',
      '😮': 'wow',
      '😢': 'sad',
      '😠': 'angry'
    };
    
    // Create confetti container
    this.confettiContainer = new THREE.Group();
    this.scene.add(this.confettiContainer);
    
    // Create particle materials with different colors
    this.particleMaterials = [
      new THREE.PointsMaterial({ color: 0xff0000, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0x00ff00, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0x0000ff, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0xffff00, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0xff00ff, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0x00ffff, size: 0.1, transparent: true })
    ];
    
    // Store active confetti particles
    this.activeConfetti = [];
    
    // Initialize variations map with default objects
    this.initializeVariations();
  }

  // Initialize WebSocket connection
  initWebSocket() {
    try {
      // Check if we've exceeded max reconnection attempts
      if (this.reconnectAttempts && this.reconnectAttempts >= 5) {
        console.log('Maximum WebSocket reconnection attempts reached. Disabling WebSocket functionality.');
        return;
      }
      
      // Only initialize socket if authenticated
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('Not initializing WebSocket - no authentication token');
        return;
      }
      
      // Use hardcoded WebSocket URL
      const wsUrl = 'wss://threedsocbackend.onrender.com';

      if (!wsUrl) {
        console.error('WebSocket URL is not set. WebSocket will not connect.');
        return;
      }

      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
      
      // Set a timeout to prevent hanging on connection
      this.wsConnectTimeout = setTimeout(() => {
        console.log('WebSocket connection timeout - continuing without WebSocket functionality');
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close();
          this.socket = null;
        }
      }, 3000);
      
      // Handle potential socket creation error (browser might throw if WebSocket is not supported)
      try {
        this.socket = new WebSocket(wsUrl);
      } catch (socketError) {
        console.error('Failed to create WebSocket connection:', socketError);
        clearTimeout(this.wsConnectTimeout);
        console.log('Continuing without WebSocket functionality');
        return;
      }
      
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        clearTimeout(this.wsConnectTimeout);
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
        
        // Send authentication token
        if (token) {
          this.socket.send(JSON.stringify({ type: 'auth', token }));
        }
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          if (data.type === 'reaction') {
            this.handleReactionUpdate(data);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error - WebSocket functionality will be unavailable');
        clearTimeout(this.wsConnectTimeout);
        
        // We'll just proceed without WebSocket functionality
        console.log('Continuing without WebSocket real-time updates');
        this.socket = null;
      };
      
      this.socket.onclose = (event) => {
        console.log('WebSocket connection closed - real-time updates disabled');
        clearTimeout(this.wsConnectTimeout);
        this.socket = null;
        
        // Only try to reconnect if actively using the app
        if (this.isActive) {
          // Try to reconnect after a delay, but with backing off
          this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
          
          if (this.reconnectAttempts >= 5) {
            console.log('Maximum WebSocket reconnection attempts reached. Disabling WebSocket functionality.');
            return;
          }
          
          const delay = Math.min(5000 + this.reconnectAttempts * 1000, 30000);
          console.log(`Will attempt to reconnect in ${delay/1000} seconds (attempt ${this.reconnectAttempts} of 5)`);
          
          this.reconnectTimeout = setTimeout(() => {
            if (this.isActive) {
              this.initWebSocket();
            }
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      clearTimeout(this.wsConnectTimeout);
      console.log('Continuing without WebSocket functionality - app will work but without real-time updates');
      // Continue without WebSocket - we'll try again later if needed
    }
  }

  async show() {
    console.log('Showing Home page');
    
    // Clear internal caches to ensure we reload fresh data
    this.characterCache = null;
    this.allUsers = [];
    this.userPosts.clear();
    
    // Check authentication first
    const isAuthenticated = await this.checkAuth();
    if (!isAuthenticated) {
      console.log('Not authenticated, showing auth modal');
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.style.display = 'flex';
      }
      return;
    }

    this.isActive = true;
    
    // Initialize WebSocket if not already connected
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.initWebSocket();
    }
    
    // Set up starry background
    this.setupBackground();
    
    // Initialize the scene
    await this.init();
    
    // Add containers to scene
    this.scene.add(this.dioramas);
    this.scene.add(this.posts);
    
    // Clear any existing dioramas before creating new ones
    while (this.dioramas.children.length > 0) {
      this.dioramas.remove(this.dioramas.children[0]);
    }
    this.visibleDioramas = [];
    
    // Create edit mode toggle button
    this.createEditModeButton();
    
    // Get fresh character data directly from the character API endpoint
    let freshCharacterData = null;
    try {
      const characterResponse = await makeAuthenticatedRequest(`https://threedsocbackend.onrender.com/api/users/character`);
      if (characterResponse.ok) {
        const responseData = await characterResponse.json();
        console.log('Successfully loaded character response from API:', responseData);
        
        // Handle the case where character data is nested under 'character' property
        if (responseData.character) {
          this.freshCharacterData = responseData.character;
          console.log('Character data was nested, extracted:', this.freshCharacterData);
        } else {
          this.freshCharacterData = responseData;
          console.log('Using direct character data from API:', this.freshCharacterData);
        }
        
        // Ensure variations and colors are complete
        if (!this.freshCharacterData.variations) this.freshCharacterData.variations = {};
        if (!this.freshCharacterData.colors) this.freshCharacterData.colors = {};
        
        // Ensure all character parts have values
        const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
        parts.forEach(part => {
          if (this.freshCharacterData.variations[part] === undefined) {
            this.freshCharacterData.variations[part] = 0;
          }
          if (this.freshCharacterData.colors[part] === undefined) {
            const defaultColors = {
              head: 0xffcc99,
              teeth: 0xffffff,
              shirt: 0x0000ff,
              belt: 0x000000,
              pants: 0x000080,
              shoes: 0x222222
            };
            this.freshCharacterData.colors[part] = defaultColors[part];
          }
        });
      } else {
        console.error('Failed to load character data from API:', await characterResponse.text());
        // Fallback to default if API fails
        this.freshCharacterData = null;
        console.log('Using default character data due to API failure.');
      }
    } catch (error) {
      console.error('Error fetching character data:', error);
      this.freshCharacterData = null;
      console.log('Using default character data due to error.');
    }

    // Set initial current user with dummy data if not authenticated, to prevent errors
    // during character loading before full authentication flow
    if (!localStorage.getItem('currentUser')) {
      localStorage.setItem('currentUser', JSON.stringify({ _id: 'guest', username: 'Guest' }));
    }

    // Get all users
    try {
      const response = await makeAuthenticatedRequest(`https://threedsocbackend.onrender.com/api/users`);
      if (response.ok) {
        this.allUsers = await response.json();
        console.log('All users loaded:', this.allUsers);
      } else {
        console.error('Failed to load all users:', await response.text());
        this.allUsers = [];
      }
    } catch (error) {
      console.error('Error loading all users:', error);
      this.allUsers = [];
    }

    // Load initial posts
    await this.loadPosts();

    // Setup post canvas and creation
    this.setupPostCanvas();
    this.setupPostCreation();

    // Set up event listeners (including for mouse interactions and post creation)
    this.setupEventListeners();
  }

  // Helper to load user's posts
  async loadUserPosts(userId) {
    try {
      const response = await makeAuthenticatedRequest(`https://threedsocbackend.onrender.com/api/posts/user/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to load posts for user');
      }
      const data = await response.json();
      this.userPosts.set(userId, data);
      return data;
    } catch (error) {
      console.error('Error loading user posts:', error);
      return [];
    }
  }

  handleReactionUpdate(data) {
    const { postId, reactionType, userId, action } = data;
    const postContainer = document.querySelector(`.post[data-post-id="${postId}"]`);
    if (!postContainer) {
      console.log('Post container not found for reaction update:', postId);
      return;
    }

    // Update reaction counts locally
    let reactions = JSON.parse(postContainer.getAttribute('data-reactions') || '{}');
    if (action === 'add') {
      reactions[reactionType] = (reactions[reactionType] || 0) + 1;
    } else if (action === 'remove') {
      reactions[reactionType] = Math.max(0, (reactions[reactionType] || 0) - 1);
    }
    postContainer.setAttribute('data-reactions', JSON.stringify(reactions));
    this.updateReactionCounts(reactions, postContainer); // Update visual counts

    console.log(`Reaction ${action}ed for post ${postId}, type ${reactionType} by user ${userId}. Current reactions:`, reactions);
  }

  async handleReaction(postId, reactionType) {
    try {
      const response = await makeAuthenticatedRequest(
        `https://threedsocbackend.onrender.com/api/posts/${postId}/react`,
        'POST',
        { reactionType }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to react to post');
      }
      const updatedPost = await response.json();
      console.log('Reaction success, updated post:', updatedPost);

      // Update the reactions on the specific post element
      const postContainer = document.querySelector(`.post[data-post-id="${postId}"]`);
      if (postContainer) {
        postContainer.setAttribute('data-reactions', JSON.stringify(updatedPost.reactions));
        this.updateReactionCounts(updatedPost.reactions, postContainer);
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      alert('Failed to react to post. Please try again.');
    }
  }

  updateReactionCounts(reactions, container = document) {
    // Clear existing counts before updating
    const likeCountSpan = container.querySelector('.like-count');
    const loveCountSpan = container.querySelector('.love-count');
    const clapCountSpan = container.querySelector('.clap-count');

    if (likeCountSpan) likeCountSpan.textContent = reactions.like || '';
    if (loveCountSpan) loveCountSpan.textContent = reactions.love || '';
    if (clapCountSpan) clapCountSpan.textContent = reactions.clap || '';
  }

  async loadPosts() {
    this.isLoadingPosts = true;
    try {
      const response = await makeAuthenticatedRequest(`https://threedsocbackend.onrender.com/api/posts`);
      if (!response.ok) {
        throw new Error('Failed to load posts');
      }
      const data = await response.json();
      this.postsData = Array.isArray(data) ? data : [];
      console.log('Posts loaded:', this.postsData);

      // Clear existing posts
      while (this.posts.children.length > 0) {
        const mesh = this.posts.children[0];
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
        this.posts.remove(mesh);
      }
      this.postMeshes = [];

      // Create 3D posts for each post
      this.postsData.forEach((post, index) => {
        const diorama = this.visibleDioramas[index % this.visibleDioramas.length];
        if (diorama) {
          const postMesh = this.createVisualPost(post, diorama);
          this.posts.add(postMesh);
          this.postMeshes.push(postMesh);
        }
      });
      // Sort posts visually by createdAt
      this.posts.children.sort((a, b) => {
        const postA = this.postsData.find(p => p._id === a.userData.postId);
        const postB = this.postsData.find(p => p._id === b.userData.postId);
        return new Date(postA.createdAt) - new Date(postB.createdAt);
      });
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      this.isLoadingPosts = false;
    }
  }

  // Add confetti creation method
  createConfetti(position) {
    // Create 100 particles
    for (let i = 0; i < 100; i++) {
      const geometry = new THREE.BufferGeometry();
      const vertices = [];
      
      // Single vertex for each particle
      vertices.push(0, 0, 0);
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      
      // Pick a random material color
      const material = this.particleMaterials[Math.floor(Math.random() * this.particleMaterials.length)];
      
      // Create the particle system
      const particles = new THREE.Points(geometry, material);
      
      // Position at the character position with some random offset
      particles.position.set(
        position.x + (Math.random() - 0.5) * 1,
        position.y + (Math.random() - 0.5) * 1,
        position.z + (Math.random() - 0.5) * 1
      );
      
      // Random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        Math.random() * 0.1,
        (Math.random() - 0.5) * 0.1
      );
      
      // Add to scene
      this.confettiContainer.add(particles);
      
      // Store particle data for animation
      this.activeConfetti.push({
        particle: particles,
        velocity: velocity,
        life: 100 + Math.random() * 100, // Random lifespan
        gravity: 0.001 + Math.random() * 0.003 // Random gravity
      });
    }
    
    // Play a sound when confetti is created
    const confettiSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    confettiSound.volume = 0.2;
    confettiSound.play().catch(e => console.log('Error playing confetti sound:', e));
  }

  updateConfetti() {
    // Update each confetti particle
    for (let i = this.activeConfetti.length - 1; i >= 0; i--) {
      const confetti = this.activeConfetti[i];
      
      // Apply velocity and gravity
      confetti.particle.position.add(confetti.velocity);
      confetti.velocity.y -= confetti.gravity;
      
      // Add a slight spin
      confetti.particle.rotation.x += 0.01;
      confetti.particle.rotation.y += 0.01;
      
      // Decrease life
      confetti.life -= 1;
      
      // If particle is dead, remove it
      if (confetti.life <= 0) {
        this.confettiContainer.remove(confetti.particle);
        this.activeConfetti.splice(i, 1);
      } else {
        // Fade out as life decreases
        confetti.particle.material.opacity = confetti.life / 100;
      }
    }
  }

  // Add notification display method
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Create inner container like Notifications.js - transparent with only border
    // Create inner container similar to notifications page style
    const innerContainer = document.createElement('div');
    innerContainer.style.cssText = `
      background-color: transparent;
      backdrop-filter: none;
      border-radius: 15px;
      padding: 20px;
      border: 2px solid ${
        type === 'success' ? 'rgba(40, 167, 69, 0.8)' : 
        type === 'error' ? 'rgba(220, 53, 69, 0.8)' : 
        '#4a90e2'
      };
      box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
      color: white;
    `;
    
    innerContainer.textContent = message;
    notification.appendChild(innerContainer);
    
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      font-family: 'Roboto', sans-serif;
      font-weight: bold;
      z-index: 2000;
    `;
    
    // Add notification to body
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s ease';
      
      // Remove from DOM after fade out
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 3000);
  }

  // Method to rearrange posts in a diorama to fill empty spaces
  rearrangeDioramaPosts(diorama) {
    if (!diorama || !diorama.mesh || !diorama.mesh.userData.posts || diorama.mesh.userData.posts.length === 0) {
      return;
    }
    
    console.log(`Rearranging ${diorama.mesh.userData.posts.length} posts in diorama`);
    
    // Get all post meshes from the diorama
    const postMeshes = diorama.mesh.children.filter(child => 
      child.userData && child.userData.isPost
    );
    
    if (postMeshes.length === 0) {
      console.log('No post meshes found to rearrange');
      return;
    }
    
    // Set up grid parameters
    const gridCols = 4;
    
    // Recalculate positions for all posts
    postMeshes.forEach((postMesh, index) => {
      const gridX = index % gridCols;
      const gridY = Math.floor(index / gridCols);
      
      // Calculate new position
      const newPosition = new THREE.Vector3(
        -3 + (gridX * 1.7),
        2 - (gridY * 0.95),
        -this.dioramaDepth + 0.3
      );
      
      // Log position change
      console.log(`Moving post ${postMesh.userData.postId} from ${postMesh.position.x.toFixed(2)},${postMesh.position.y.toFixed(2)} to ${newPosition.x.toFixed(2)},${newPosition.y.toFixed(2)}`);
      
      // Animate the position change
      const originalPosition = postMesh.position.clone();
      const targetPosition = newPosition;
      
      // Store the target position
      postMesh.userData.originalPosition = newPosition.clone();
      
      // Create animation
      const duration = 0.5; // seconds
      const startTime = Date.now();
      
      const animatePosition = () => {
        if (!this.isActive) return;
        
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for smooth animation
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
        
        // Interpolate position
        postMesh.position.lerpVectors(originalPosition, targetPosition, easeProgress);
        
        // Continue animation if not complete
        if (progress < 1) {
          requestAnimationFrame(animatePosition);
        }
      };
      
      animatePosition();
    });
  }

  // Handle permanent connections for dioramas
  updatePermanentConnection(cord) {
    if (!this.isActive) return;

    if (!cord) {
      console.error('Cord object is null, cannot update permanent connection.');
      return;
    }

    if (!cord.userData.sourceDiorama || !cord.userData.targetDiorama) {
      console.error('Source or target diorama missing from cord userData.');
      return;
    }

    const sourcePos = cord.userData.sourceDiorama.mesh.position.clone();
    const targetPos = cord.userData.targetDiorama.mesh.position.clone();

    // Adjust for camera movement if applicable, though typically not needed for fixed connections
    // Example: sourcePos.add(this.camera.position.clone().negate());

    const distance = sourcePos.distanceTo(targetPos);
    const midPoint = new THREE.Vector3().addVectors(sourcePos, targetPos).divideScalar(2);

    // Position the cord between the dioramas
    cord.position.copy(midPoint);

    // Make the cord always face the camera
    cord.lookAt(this.camera.position);

    // Stretch the cord to span the distance
    const scaleFactor = distance / cord.geometry.parameters.height; // Assuming cord is a cylinder along Y-axis
    cord.scale.set(1, scaleFactor, 1);

    // Rotate to align with the vector between dioramas
    const direction = new THREE.Vector3().subVectors(targetPos, sourcePos).normalize();
    const axis = new THREE.Vector3(0, 1, 0); // Original axis of the cylinder
    cord.quaternion.setFromUnitVectors(axis, direction);

    cord.rotation.x += Math.PI / 2; // Adjust for cylinder default orientation
  }

  // Update all permanent connections
  updateAllPermanentConnections() {
    this.cordSystem.anchored.forEach(cord => {
      this.updatePermanentConnection(cord);
    });
  }

  // Initialize variations (example with default objects)
  initializeVariations() {
    // These should be loaded from external files or configurations
  }

  handleObjectSelection(object) {
    if (this.dioramaEditing.selectedObject) {
      this.clearObjectHighlight();
    }
    this.dioramaEditing.selectedObject = object;
    this.highlightObject(object);
  }

  highlightObject(object) {
    if (object.material) {
      if (!this.dioramaEditing.originalMaterials.has(object)) {
        this.dioramaEditing.originalMaterials.set(object, object.material);
      }
      object.material = this.dioramaEditing.highlightMaterial;
    }
  }

  // Clear highlight from object
  clearObjectHighlight() {
    if (this.dioramaEditing.selectedObject && this.dioramaEditing.originalMaterials.has(this.dioramaEditing.selectedObject)) {
      this.dioramaEditing.selectedObject.material = this.dioramaEditing.originalMaterials.get(this.dioramaEditing.selectedObject);
      this.dioramaEditing.originalMaterials.delete(this.dioramaEditing.selectedObject);
    }
    this.dioramaEditing.selectedObject = null;
  }

  handleObjectDrag(event) {
    if (!this.dioramaEditing.isDragging || !this.dioramaEditing.selectedObject) return;

    // Update the raycaster with the new mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Intersect with the drag plane
    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.dioramaEditing.dragPlane, intersection)) {
    // Find intersection with drag plane
    const intersects = this.raycaster.ray.intersectPlane(this.dioramaEditing.dragPlane, new THREE.Vector3());
    
    if (intersects) {
      // Calculate new position
      const newPosition = intersects.add(this.dioramaEditing.dragOffset);
      
      // Snap to grid if enabled
      if (this.dioramaEditing.snapToGrid) {
        newPosition.x = Math.round(newPosition.x / this.dioramaEditing.gridSize) * this.dioramaEditing.gridSize;
        newPosition.y = Math.round(newPosition.y / this.dioramaEditing.gridSize) * this.dioramaEditing.gridSize;
        newPosition.z = Math.round(newPosition.z / this.dioramaEditing.gridSize) * this.dioramaEditing.gridSize;
      }
      
      // Update object position
      object.position.copy(newPosition);
    }
  }

  // Add method to start object drag
  startObjectDrag(event) {
    if (!this.dioramaEditing.isActive || !this.dioramaEditing.selectedObject) return;
    
    const object = this.dioramaEditing.selectedObject;
    
    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Find intersection with drag plane
    const intersects = this.raycaster.ray.intersectPlane(this.dioramaEditing.dragPlane, new THREE.Vector3());
    
    if (intersects) {
      this.dioramaEditing.isDragging = true;
      this.dioramaEditing.dragStartPosition.copy(intersects);
      this.dioramaEditing.dragOffset.copy(object.position).sub(intersects);
      
      // Add event listeners for drag
      window.addEventListener('mousemove', this.handleObjectDrag.bind(this));
      window.addEventListener('mouseup', this.stopObjectDrag.bind(this));
    }
  }

  // Add method to stop object drag
  stopObjectDrag() {
    if (!this.dioramaEditing.isDragging) return;
    
    this.dioramaEditing.isDragging = false;
    
    // Remove event listeners
    window.removeEventListener('mousemove', this.handleObjectDrag.bind(this));
    window.removeEventListener('mouseup', this.stopObjectDrag.bind(this));
    
    // Save object position to server
    this.saveObjectPosition(this.dioramaEditing.selectedObject);
  }

  // Add method to save object position
  async saveObjectPosition(object) {
    if (!object || !object.userData || !object.userData.id) {
      console.warn('Attempted to save object position for an invalid object.');
      return;
    }
    
    const objectId = object.userData.id;
    const objectType = object.userData.type;

    try {
      const response = await makeAuthenticatedRequest(
        `https://threedsocbackend.onrender.com/api/users/character`,
        'PUT',
        {
          type: objectType,
          id: objectId,
          position: object.position,
          rotation: object.rotation
        }
      );
      
      if (response.ok) {
        console.log('Diorama position saved successfully.');
      } else {
        console.error('Failed to save diorama position:', response.statusText);
        const errorData = await response.json();
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('Error saving diorama position:', error);
    }
  }

  // Add method to toggle diorama editing mode
  toggleDioramaEditing() {
    this.dioramaEditing.isActive = !this.dioramaEditing.isActive;
    
    // Clear any existing selection
    if (!this.dioramaEditing.isActive) {
      this.clearObjectHighlight();
      this.dioramaEditing.selectedObject = null;
    }
    
    // Show notification
    this.showNotification(
      this.dioramaEditing.isActive ? 
      'Diorama editing mode enabled - Click on furniture to edit' : 
      'Diorama editing mode disabled',
      'info'
    );
  }

  setupBackground() {
    // Create a dense starfield background
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.8
    });
    
    const starsVertices = [];
    for (let i = 0; i < 2000; i++) {
      const x = (Math.random() - 0.5) * 150;
      const y = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    this.stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(this.stars);
    
    // Add some colored stars
    const coloredStarsGeometry = new THREE.BufferGeometry();
    const coloredStarsVertices = [];
    
    for (let i = 0; i < 300; i++) {
      const x = (Math.random() - 0.5) * 150;
      const y = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      coloredStarsVertices.push(x, y, z);
    }
    
    coloredStarsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coloredStarsVertices, 3));
    
    // Create multiple colored star systems
    const coloredStarMaterials = [
      new THREE.PointsMaterial({ color: 0x4a90e2, size: 0.2, transparent: true }),
      new THREE.PointsMaterial({ color: 0xff9966, size: 0.25, transparent: true }),
      new THREE.PointsMaterial({ color: 0x66ffcc, size: 0.2, transparent: true })
    ];
    
    coloredStarMaterials.forEach(material => {
      const coloredStars = new THREE.Points(coloredStarsGeometry.clone(), material);
      this.scene.add(coloredStars);
      
      // Add some random rotation
      coloredStars.rotation.x = Math.random() * Math.PI;
      coloredStars.rotation.y = Math.random() * Math.PI;
    });
  }

  // Add method to create edit mode toggle button
  createEditModeButton() {
    // Remove existing button if it exists
    const existingButton = document.getElementById('edit-mode-toggle');
    if (existingButton) {
      existingButton.remove();
    }
    
    // Create button
    const button = document.createElement('button');
    button.id = 'edit-mode-toggle';
    button.textContent = 'Edit Diorama';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 20px;
      background-color: rgba(74, 144, 226, 0.8);
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      z-index: 1000;
      transition: all 0.3s ease;
    `;
    
    // Add hover effect
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = 'rgba(53, 122, 189, 0.8)';
      button.style.transform = 'scale(1.05)';
    });
    
    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = 'rgba(74, 144, 226, 0.8)';
      button.style.transform = 'scale(1)';
    });
    
    // Add click handler
    button.addEventListener('click', () => {
      this.toggleDioramaEditing();
      
      // Update button appearance
      if (this.dioramaEditing.isActive) {
        button.textContent = 'Exit Edit Mode';
        button.style.backgroundColor = 'rgba(220, 53, 69, 0.8)';
      } else {
        button.textContent = 'Edit Diorama';
        button.style.backgroundColor = 'rgba(74, 144, 226, 0.8)';
      }
    });
    
    // Add to body
    document.body.appendChild(button);
  }

  // Add method to show variation selector UI
  showVariationSelector(object) {
    if (!object || !object.userData) return;
    
    // Create container for variation controls
    const container = document.createElement('div');
    container.className = 'variation-controls';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    container.style.padding = '15px';
    container.style.borderRadius = '10px';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.gap = '10px';
    container.style.alignItems = 'center';
    
    // Create color picker
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = '#' + object.material.color.getHexString();
    colorPicker.style.width = '50px';
    colorPicker.style.height = '50px';
    colorPicker.style.border = 'none';
    colorPicker.style.borderRadius = '5px';
    colorPicker.style.cursor = 'pointer';
    
    // Create variation buttons
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '←';
    prevButton.style.padding = '10px 15px';
    prevButton.style.border = 'none';
    prevButton.style.borderRadius = '5px';
    prevButton.style.backgroundColor = '#4CAF50';
    prevButton.style.color = 'white';
    prevButton.style.cursor = 'pointer';
    
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '→';
    nextButton.style.padding = '10px 15px';
    nextButton.style.border = 'none';
    nextButton.style.borderRadius = '5px';
    nextButton.style.backgroundColor = '#4CAF50';
    nextButton.style.color = 'white';
    nextButton.style.cursor = 'pointer';
    
    // Add event listeners
    colorPicker.addEventListener('change', (e) => {
      object.material.color.set(e.target.value);
    });
    
    prevButton.addEventListener('click', () => {
      // Handle previous variation
      if (object.userData.variationIndex > 0) {
        object.userData.variationIndex--;
        this.updateObjectVariation(object);
      }
    });
    
    nextButton.addEventListener('click', () => {
      // Handle next variation
      if (object.userData.variationIndex < (object.userData.variations?.length - 1 || 0)) {
        object.userData.variationIndex++;
        this.updateObjectVariation(object);
      }
    });
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '5px';
    closeButton.style.border = 'none';
    closeButton.style.background = 'none';
    closeButton.style.color = 'white';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    
    closeButton.addEventListener('click', () => {
      document.body.removeChild(container);
      this.clearObjectHighlight();
    });
    
    // Add elements to container
    container.appendChild(prevButton);
    container.appendChild(colorPicker);
    container.appendChild(nextButton);
    container.appendChild(closeButton);
    
    // Add container to document
    document.body.appendChild(container);
  }
  
  // Add method to update object variation
  updateObjectVariation(object) {
    if (!object.userData.variations) return;
    
    const variation = object.userData.variations[object.userData.variationIndex];
    if (variation) {
      // Update object geometry or material based on variation
      if (variation.geometry) {
        object.geometry.dispose();
        object.geometry = variation.geometry.clone();
      }
      if (variation.material) {
        object.material.dispose();
        object.material = variation.material.clone();
      }
    }
  }
}
