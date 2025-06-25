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
      
      // Dynamically determine WebSocket protocol and host
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host; // Use the current host to ensure it works on Render
      
      const socketUrl = `${wsProtocol}//${wsHost}`;
      console.log(`Attempting to connect to WebSocket at ${socketUrl}`);
      
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
        this.socket = new WebSocket(socketUrl);
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
      const characterResponse = await makeAuthenticatedRequest('api/users/character');
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
        
        // Also add the bio if it's at the top level
        if (responseData.bio && !this.freshCharacterData.bio) {
          this.freshCharacterData.bio = responseData.bio;
        }
        
        console.log('Processed fresh character data:', this.freshCharacterData);
      } else {
        console.log('Failed to get character data from API, will try via user data');
      }
    } catch (error) {
      console.error('Error fetching character data directly:', error);
    }
    
    // Load all users and their posts from API
    await this.loadAllUsers();
    
    // Get current user with most up-to-date data
    try {
      // Always try to get from API first to ensure fresh user data
      const response = await makeAuthenticatedRequest('api/users/verify');
      if (response.ok) {
        const userData = await response.json();
        this.currentUser = userData;
        
        // If we have fresh character data from the direct character endpoint, use it
        if (this.freshCharacterData) {
          console.log('Using freshly loaded character data for current user');
          this.currentUser.character = JSON.parse(JSON.stringify(this.freshCharacterData));
          
          // Ensure the character has all necessary parts
          if (!this.currentUser.character.variations) {
            this.currentUser.character.variations = {};
          }
          if (!this.currentUser.character.colors) {
            this.currentUser.character.colors = {};
          }
          
          // Ensure all character parts have values
          const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
          parts.forEach(part => {
            if (this.currentUser.character.variations[part] === undefined) {
              this.currentUser.character.variations[part] = 0;
            }
            if (this.currentUser.character.colors[part] === undefined) {
              const defaultColors = {
                head: 0xffcc99,
                teeth: 0xffffff,
                shirt: 0x0000ff,
                belt: 0x000000,
                pants: 0x000080,
                shoes: 0x222222
              };
              this.currentUser.character.colors[part] = defaultColors[part];
            }
          });
        }
        
        console.log('Current user loaded from API with latest character data:', this.currentUser.username);
        
        // Update localStorage with latest data including any fresh character data
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      } else {
        // Only fall back to localStorage if API fails
        console.log('API request failed, using cached user data from localStorage');
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
          this.currentUser = JSON.parse(currentUserStr);
          
          // If we have fresh character data from the direct character endpoint, use it
          if (this.freshCharacterData) {
            console.log('Using freshly loaded character data with cached user');
            this.currentUser.character = JSON.parse(JSON.stringify(this.freshCharacterData));
            
            // Ensure all character parts have values
            if (!this.currentUser.character.variations) {
              this.currentUser.character.variations = {};
            }
            if (!this.currentUser.character.colors) {
              this.currentUser.character.colors = {};
            }
            
            const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
            parts.forEach(part => {
              if (this.currentUser.character.variations[part] === undefined) {
                this.currentUser.character.variations[part] = 0;
              }
              if (this.currentUser.character.colors[part] === undefined) {
                const defaultColors = {
                  head: 0xffcc99,
                  teeth: 0xffffff,
                  shirt: 0x0000ff,
                  belt: 0x000000,
                  pants: 0x000080,
                  shoes: 0x222222
                };
                this.currentUser.character.colors[part] = defaultColors[part];
              }
            });
            
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
          }
        }
      }
    } catch (error) {
      console.error('Error getting current user data:', error);
      
      // Even if user data fails, if we have character data, we can still use it
      if (this.freshCharacterData) {
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
          try {
            this.currentUser = JSON.parse(currentUserStr);
            this.currentUser.character = JSON.parse(JSON.stringify(this.freshCharacterData));
            console.log('Merged fresh character data with cached user data');
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
          } catch (e) {
            console.error('Failed to parse cached user data:', e);
          }
        }
      }
    }
    
    // Create dioramas for all users and load their posts
    for (const user of this.allUsers) {
      const yPosition = this.allUsers.indexOf(user) * (this.dioramaHeight + this.dioramaGap);
      const dioramaIndex = this.allUsers.indexOf(user);
      const diorama = this.createDiorama(yPosition, dioramaIndex);
      
      // Store user ID and username in diorama data
      diorama.mesh.userData.userId = user._id;
      diorama.mesh.userData.username = user.username;
      
      // Find if this user is the current user
      const isCurrentUser = this.currentUser && user._id === this.currentUser._id;
      
      // If user is the current user, use the freshest character data (from API/localStorage)
      if (isCurrentUser && this.currentUser.character) {
        console.log('Using current user character data from user session');
        
        // Get freshly loaded character data from API directly
        let characterData;
        
        // If we have freshCharacterData from the direct API call, use that
        if (this.freshCharacterData) {
          console.log('Using freshCharacterData from recent API call');
          characterData = this.freshCharacterData;
        } else {
          // Ensure character data is in the correct format for processing
          if (!this.currentUser.character.variations || Object.keys(this.currentUser.character.variations).length === 0) {
            console.log('Character data needs proper structuring:', this.currentUser.character);
            characterData = {
              variations: {},
              colors: {},
              bio: this.currentUser.character.bio || this.currentUser.bio || ''
            };
            
            // Add default variations and colors if missing
            const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
            parts.forEach(part => {
              if (!characterData.variations[part]) characterData.variations[part] = 0;
              if (!characterData.colors[part]) {
                const defaultColors = {
                  head: 0xffcc99,
                  teeth: 0xffffff,
                  shirt: 0x0000ff,
                  belt: 0x000000,
                  pants: 0x000080,
                  shoes: 0x222222
                };
                characterData.colors[part] = defaultColors[part];
              }
            });
          } else {
            characterData = this.currentUser.character;
          }
        }
        
        console.log(`Loading character for current user ${user.username} with data:`, characterData);
        this.characterCreator.loadCharacter(characterData);
        const character = this.characterCreator.character.clone();
        character.position.set(-2, -2, -this.dioramaDepth/2);
        character.rotation.y = Math.PI * 0.25;
        character.userData.isCharacter = true;
        character.userData.userId = user._id;
        diorama.mesh.add(character);
      }
      // Otherwise, use character data from loaded users
      else if (user.character) {
        // Handle both nested and flat character data structures
        const characterData = user.character.variations ? user.character : { 
          variations: user.character.variations || {},
          colors: user.character.colors || {},
          bio: user.character.bio || user.bio || ''
        };
        
        console.log(`Loading character for user ${user.username}:`, characterData);
        this.characterCreator.loadCharacter(characterData);
        const character = this.characterCreator.character.clone();
        character.position.set(-2, -2, -this.dioramaDepth/2);
        character.rotation.y = Math.PI * 0.25;
        character.userData.isCharacter = true;
        character.userData.userId = user._id;
        diorama.mesh.add(character);
      } else {
        console.log(`No character data found for user ${user.username}`);
        
        // Create default character for users without character data
        const defaultCharacterData = {
          variations: {
            head: 0,
            teeth: 0,
            shirt: 0,
            belt: 0,
            pants: 0,
            shoes: 0
          },
          colors: {
            head: 0xffcc99,
            teeth: 0xffffff,
            shirt: 0x0000ff,
            belt: 0x000000,
            pants: 0x000080,
            shoes: 0x222222
          },
          bio: `Hello, I'm ${user.username}! Welcome to my space.`
        };
        
        console.log(`Creating default character for user ${user.username}`);
        this.characterCreator.loadCharacter(defaultCharacterData);
        const character = this.characterCreator.character.clone();
        character.position.set(-2, -2, -this.dioramaDepth/2);
        character.rotation.y = Math.PI * 0.25;
        character.userData.isCharacter = true;
        character.userData.userId = user._id;
        diorama.mesh.add(character);
        
        // If this is the current user, create a way to prompt them to customize their character
        if (isCurrentUser) {
          // Add a custom bubble to prompt character creation
          const bubbleGeometry = new THREE.SphereGeometry(0.5, 32, 32);
          const bubbleMaterial = new THREE.MeshBasicMaterial({
            color: 0x4a90e2,
            transparent: true,
            opacity: 0.7
          });
          const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
          bubble.position.set(-1, -1, -this.dioramaDepth/2 + 1);
          bubble.userData.isPrompt = true;
          bubble.userData.type = 'character-prompt';
          diorama.mesh.add(bubble);
          
          // Add a pulse animation to the bubble
          const pulseAnimation = () => {
            if (!this.isActive) return;
            const scale = 1 + 0.1 * Math.sin(Date.now() * 0.003);
            bubble.scale.set(scale, scale, scale);
            requestAnimationFrame(pulseAnimation);
          };
          pulseAnimation();
        }
      }
      
      // Load and display user's posts
      const userPosts = this.userPosts.get(user._id) || [];
      userPosts.forEach(post => {
        this.createVisualPost(post, diorama);
      });
    }
    
    // Start animation loop
    this.animate();
  }

  async checkAuth() {
    try {
      const response = await makeAuthenticatedRequest('api/users/verify');
      if (!response.ok) {
        console.log('Token verification failed or no token.');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        return null;
      }
      const data = await response.json();
      this.currentUser = data; // Fix: data contains user info directly, not data.user
      localStorage.setItem('currentUser', JSON.stringify(data));
      console.log('User authenticated:', this.currentUser);
      return this.currentUser;
    } catch (error) {
      console.error('Error during authentication check:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  async init() {
    console.log('Initializing Home page');
    
    // Load the bedroom model
    await this.loadBedroomModel();
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(ambientLight, directionalLight);

    // Setup scrolling
    this.setupScrolling();

    // Setup post creation
    this.setupPostCreation();

    // Setup camera
    this.camera.position.z = 8;
    
    // Create initial diorama
    this.createDiorama();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  async loadBedroomModel() {
    try {
      const response = await fetch('/models/modern-bedroom.glb');
      if (!response.ok) {
        throw new Error('Failed to load bedroom model');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      this.bedroomModel = await new Promise((resolve, reject) => {
        this.gltfLoader.load(
          url,
          (gltf) => {
            // Mark furniture objects
            gltf.scene.traverse((child) => {
              if (child.isMesh) {
                // Mark as furniture if it's not a wall or floor
                if (!child.name.toLowerCase().includes('wall') && 
                    !child.name.toLowerCase().includes('floor') &&
                    !child.name.toLowerCase().includes('ceiling')) {
                  child.userData.isFurniture = true;
                }
              }
            });
            resolve(gltf.scene);
          },
          undefined,
          reject
        );
      });
      
      this.isModelLoaded = true;
      console.log('Bedroom model loaded successfully');
    } catch (error) {
      console.error('Error loading bedroom model:', error);
      this.isModelLoaded = false;
    }
  }

  createDiorama(yPosition = 0, index = 0) {
    // Create a new diorama group
    const diorama = new THREE.Group();
    
    // Create a container for the room
    const roomContainer = new THREE.Group();
    
    if (this.isModelLoaded && this.bedroomModel) {
      // Clone the loaded model for this diorama
      const roomClone = this.bedroomModel.clone();
      
      // Ensure furniture flags are preserved in the clone
      roomClone.traverse((child) => {
        if (child.isMesh && child.userData.isFurniture) {
          child.userData.isFurniture = true;
        }
      });
      
      // Position and scale the room
      roomClone.position.set(0, 0, -this.dioramaDepth/2);
      roomClone.rotation.y = 0;
      roomClone.scale.set(0.1, 0.1, 0.1);
      
      // Add the room to the container
      roomContainer.add(roomClone);
      
      // Set up animations for this specific diorama
      if (this.mixer) {
        const mixer = new THREE.AnimationMixer(roomClone);
        this.mixer._actions.forEach(action => {
          const newAction = mixer.clipAction(action.getClip());
          newAction.play();
        });
        roomClone.userData.mixer = mixer;
      }
    } else {
      console.warn('Bedroom model not loaded, using fallback room');
      // Fallback to basic room if model isn't loaded
      const wallMaterial = new THREE.MeshPhongMaterial({
        color: 0x808080,
        side: THREE.DoubleSide
      });
      
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(8, 8, 0.5),
        wallMaterial
      );
      backWall.position.z = -this.dioramaDepth;
      
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.5, this.dioramaDepth * 2),
        wallMaterial
      );
      floor.position.y = -4;
      floor.position.z = -this.dioramaDepth/2;
      
      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 8, this.dioramaDepth * 2),
        wallMaterial
      );
      leftWall.position.x = -4;
      leftWall.position.z = -this.dioramaDepth/2;
      
      roomContainer.add(backWall, floor, leftWall);
    }
    
    // Add the room container to the diorama
    diorama.add(roomContainer);
    
    // Position the entire diorama
    diorama.position.y = yPosition;
    diorama.rotation.y = Math.PI * -0.25;
    
    // Create diorama data object
    const dioramaData = {
      mesh: diorama,
      yPosition: yPosition,
      index: index,
      roomContainer,
      posts: []
    };
    
    // Add to dioramas group
    this.dioramas.add(diorama);
    
    // Initialize userData if it doesn't exist
    diorama.userData = diorama.userData || {};
    diorama.userData.posts = [];
    
    this.visibleDioramas.push(dioramaData);
    return dioramaData;
  }

  setupScrolling() {
    // Remove any existing scroll listeners
    window.removeEventListener('wheel', this.handleScroll);
    // Add new scroll listener with passive: false to allow preventDefault
    window.addEventListener('wheel', this.handleScroll, { passive: false });
    
    // Prevent default document scrolling
    document.body.style.overflow = 'hidden';
  }

  handleScroll(event) {
    // Always prevent default scroll behavior
    event.preventDefault();
    
    if (!this.isActive) return;
    
    const scrollSpeed = 0.02;
    const previousScrollPosition = this.scrollPosition;
    this.scrollPosition += event.deltaY * scrollSpeed;
    
    // Clamp scroll position to prevent extreme values
    this.scrollPosition = Math.max(-1000, Math.min(1000, this.scrollPosition));
    
    // Only update connections if scroll position has changed significantly
    const scrollDelta = Math.abs(previousScrollPosition - this.scrollPosition);
    const needsConnectionUpdate = scrollDelta > 0.1;
    
    // Update dioramas position
    this.dioramas.position.y = -this.scrollPosition;
    
    // Check if we need to create new dioramas
    const lowestDiorama = Math.min(...this.visibleDioramas.map(d => d.yPosition));
    const highestDiorama = Math.max(...this.visibleDioramas.map(d => d.yPosition));
    const lowestIndex = Math.min(...this.visibleDioramas.map(d => d.index));
    const highestIndex = Math.max(...this.visibleDioramas.map(d => d.index));
    
    // Create new dioramas above
    if (this.scrollPosition - this.dioramaHeight < lowestDiorama) {
      this.createDiorama(lowestDiorama - (this.dioramaHeight + this.dioramaGap), lowestIndex - 1);
    }
    
    // Create new dioramas below
    if (this.scrollPosition + this.dioramaHeight > highestDiorama) {
      this.createDiorama(highestDiorama + (this.dioramaHeight + this.dioramaGap), highestIndex + 1);
    }
    
    // Hide/show dioramas based on distance instead of removing them
    const hideThreshold = this.dioramaHeight * 3;
    this.visibleDioramas.forEach(diorama => {
      const distance = Math.abs(diorama.yPosition - this.scrollPosition);
      const shouldBeVisible = distance <= hideThreshold;
      
      // Only toggle visibility if it's different from current state
      if (diorama.mesh.visible !== shouldBeVisible) {
        diorama.mesh.visible = shouldBeVisible;
        
        // Also toggle visibility of all children (including characters)
        diorama.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.visible = shouldBeVisible;
          }
        });
      }
    });
    
    // Update existing permanent connections when scrolling significantly
    if (needsConnectionUpdate) {
      this.updateAllPermanentConnections();
    }
  }

  hide() {
    console.log('Hiding Home page');
    this.isActive = false;
    this.scene.remove(this.dioramas);
    this.scene.remove(this.posts);
    
    // Remove stars
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
      this.stars = null;
    }
    
    // Clean up event listeners
    this.cleanupEventListeners();
    
    // Reset event handling flags so they can be set up fresh next time
    this.postButtonHandlersInitialized = false;
  }

  update() {
    if (!this.isActive) return;

    // Update all dioramas
    this.dioramas.children.forEach(diorama => {
      if (diorama.update) diorama.update();
      
      // Update animations if they exist
      if (diorama.userData.mixer) {
        diorama.userData.mixer.update(0.016); // Assuming 60fps
      }
    });
    
    // Update all posts
    this.posts.children.forEach(post => {
      if (post.update) post.update();
    });
  }

  setupPostCanvas() {
    // Create canvas overlay for posts
    this.postCanvas = document.createElement('canvas');
    this.postCanvas.style.position = 'fixed';
    this.postCanvas.style.top = '0';
    this.postCanvas.style.left = '0';
    this.postCanvas.style.width = '100%';
    this.postCanvas.style.height = '100%';
    this.postCanvas.style.pointerEvents = 'none';
    this.postCanvas.style.zIndex = '2';
    document.body.appendChild(this.postCanvas);
    
    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (this.postCanvas) {
      this.postCanvas.width = window.innerWidth;
      this.postCanvas.height = window.innerHeight;
    }
  }

  setupPostCreation() {
    // Check if we've already set up post handlers
    if (this.postButtonHandlersInitialized) {
      console.log('Post creation handlers already initialized, skipping');
      return;
    }
  
    // Get elements
    const createPostButton = document.getElementById('create-post');
    const postInput = document.getElementById('post-input');
    
    if (!createPostButton || !postInput) {
      console.log('Post creation UI elements not found');
      return;
    }
    
    // First remove any existing event listeners by cloning and replacing elements
    const newButton = createPostButton.cloneNode(true);
    createPostButton.parentNode.replaceChild(newButton, createPostButton);
    
    const newInput = postInput.cloneNode(true);
    postInput.parentNode.replaceChild(newInput, postInput);
    
    // Now use the new elements for our setup
    const postSubmitHandler = async () => {
      // If button is disabled, do nothing (prevents duplicate submissions)
      if (newButton.disabled) return;
      
      const content = newInput.value.trim();
      if (!content) return;
      
      // Disable UI during submission
      newButton.disabled = true;
      newButton.textContent = 'Posting...';
      console.log('Creating post:', content);
      
      try {
        const success = await this.createPost(content);
        if (success) {
          newInput.value = '';
        }
      } catch (error) {
        console.error('Error in post submission:', error);
      } finally {
        // Re-enable UI
        newButton.disabled = false;
        newButton.textContent = 'Post';
      }
    };
    
    // Set up click handler
    newButton.addEventListener('click', (event) => {
      event.preventDefault();
      postSubmitHandler();
    });
    
    // Set up enter key handler
    newInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        postSubmitHandler();
      }
    });
    
    // Mark post handlers as initialized
    this.postButtonHandlersInitialized = true;
    console.log('Post creation event handlers set up');
  }

  async createPost(content) {
    // Find the current user's diorama
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userDiorama = this.visibleDioramas.find(d => d.mesh.userData.userId === currentUser._id);

    if (!userDiorama) {
      console.error('User diorama not found!');
      return false;
    }

    try {
      // Get the current user's character data
      let characterConfig = {
        variations: {},
        colors: {}
      };
      
      // Use current user's character data from memory if available
      const userIndex = this.allUsers.findIndex(u => u._id === currentUser._id);
      if (userIndex !== -1 && this.allUsers[userIndex].character) {
        characterConfig = this.allUsers[userIndex].character;
        console.log('Using character data from allUsers:', characterConfig);
      } 
      // Fallback to characterCreator if available
      else if (this.characterCreator && 
               this.characterCreator.currentVariations && 
               this.characterCreator.colors) {
        characterConfig = {
          variations: { ...this.characterCreator.currentVariations },
          colors: { ...this.characterCreator.colors }
        };
        console.log('Using character data from characterCreator:', characterConfig);
      }
      // Last resort: use localStorage
      else {
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (storedUser.character) {
          characterConfig = storedUser.character;
          console.log('Using character data from localStorage:', characterConfig);
        }
      }
      
      // Ensure we have the minimum required data
      const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
      parts.forEach(part => {
        if (!characterConfig.variations[part]) {
          characterConfig.variations[part] = 0;
        }
        if (!characterConfig.colors[part]) {
          const defaultColors = {
            head: 0xffcc99,
            teeth: 0xffffff,
            shirt: 0x0000ff,
            belt: 0x000000,
            pants: 0x000080,
            shoes: 0x222222
          };
          characterConfig.colors[part] = defaultColors[part];
        }
      });
      
      // Create post data object
      const postData = {
        content,
        characterConfig,
        position: {
          x: 0,
          y: 0,
          z: 0
        }
      };
      
      console.log('Sending post data:', postData);
      
      // Create post in database
      const response = await makeAuthenticatedRequest('api/posts', 'POST', postData);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error creating post:', errorData);
        alert(`Failed to create post: ${errorData.message || 'Unknown error'}`);
        return false;
      }

      const result = await response.json();
      console.log('Created post:', result);

      // Check if the response has the expected format
      if (result.success && result.data) {
        // Create visual post with the data from the response
        this.createVisualPost(result.data, userDiorama);
        
        // Update the userPosts map
        const currentPosts = this.userPosts.get(currentUser._id) || [];
        this.userPosts.set(currentUser._id, [...currentPosts, result.data]);
        
        return true;
      } else {
        console.error('Invalid post response format:', result);
        alert('Failed to create post. Server returned invalid response.');
        return false;
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
      return false;
    }
  }

  createVisualPost(post, userDiorama) {
    if (!post || !post.content) {
      console.error('Invalid post data:', post);
      return;
    }

    console.log('Creating visual post with data:', post);
    
    // Check if post already exists in this diorama
    if (userDiorama.mesh.userData.posts) {
      const existingPost = userDiorama.mesh.userData.posts.find(p => p.postId === post._id);
      if (existingPost) {
        console.log('Post already exists in diorama, not creating duplicate:', post._id);
        return;
      }
    } else {
      userDiorama.mesh.userData.posts = [];
    }

    // Create canvas and context
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 256;

    // Style the text panel
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Style and add text
    ctx.fillStyle = 'white';
    ctx.font = '32px Roboto';
    
    // Word wrap
    const words = post.content.split(' ');
    let line = '';
    let y = 50;
    const maxWidth = canvas.width - 40;
    
    words.forEach(word => {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth) {
        ctx.fillText(line, 20, y);
        line = word + ' ';
        y += 40;
      } else {
        line = testLine;
      }
    });
    ctx.fillText(line, 20, y);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create post mesh
    const geometry = new THREE.PlaneGeometry(1.5, 0.75);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9
    });

    const postMesh = new THREE.Mesh(geometry, material);
    
    // Calculate grid position
    const postsCount = userDiorama.mesh.userData.posts.length;
    const gridCols = 4;
    const gridX = postsCount % gridCols;
    const gridY = Math.floor(postsCount / gridCols);
    
    // Position on wall
    postMesh.position.set(
      -3 + (gridX * 1.7),
      2 - (gridY * 0.95),
      -this.dioramaDepth + 0.3
    );
    
    // Determine the post author - check if author is an object with _id property
    let authorId;
    if (post.author && typeof post.author === 'object' && post.author._id) {
      // MongoDB populated author object
      authorId = post.author._id;
    } else if (post.author && typeof post.author === 'string') {
      // Author as string ID
      authorId = post.author;
    } else {
      // Fallback to other potential sources
      authorId = post.authorId || post.userId || userDiorama.mesh.userData.userId;
    }
    
    console.log('Determined authorId for post:', {
      authorId,
      originalAuthor: post.author,
      authorType: typeof post.author
    });
    
    // Find the author username - try different possible locations
    let authorUsername = null;
    // Check if username is directly in the post data
    if (post.authorName || post.username) {
      authorUsername = post.authorName || post.username;
    } 
    // Try to find in allUsers
    else {
      const authorUser = this.allUsers.find(user => user._id === authorId);
      if (authorUser) {
        authorUsername = authorUser.username;
      }
      // Check if diorama has the username
      else if (userDiorama.mesh.userData.username) {
        authorUsername = userDiorama.mesh.userData.username;
      }
      // Last resort: try currentUser
      else {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUser && currentUser._id === authorId) {
          authorUsername = currentUser.username;
        }
      }
    }
    
    // Store post data
    postMesh.userData.originalPosition = postMesh.position.clone();
    postMesh.userData.originalScale = postMesh.scale.clone();
    postMesh.userData.originalRotation = postMesh.rotation.clone();
    postMesh.userData.content = post.content;
    postMesh.userData.isPost = true;
    postMesh.userData.postId = post._id;
    postMesh.userData.authorId = authorId;
    postMesh.userData.authorUsername = authorUsername;
    postMesh.userData.createdAt = post.createdAt; // Store the creation date
    postMesh.userData.reactions = post.reactions || [];

    // Store post data in diorama
    userDiorama.mesh.userData.posts.push({
      mesh: postMesh,
      content: post.content,
      timestamp: post.createdAt,
      postId: post._id,
      authorId: authorId,
      authorUsername: authorUsername,
      reactions: post.reactions || []
    });
    
    console.log(`Added post to diorama for ${authorUsername || 'Unknown User'}, total posts: ${userDiorama.mesh.userData.posts.length}`);
    
    // Add to scene
    userDiorama.mesh.add(postMesh);
  }

  setupEventListeners() {
    // Add event listeners
    window.addEventListener('mousemove', this.handleMouseMoveBound);
    window.addEventListener('mousedown', this.handleMouseDownBound);
    window.addEventListener('mouseup', this.handleMouseUpBound);
    window.addEventListener('click', this.handleClickBound);
    
    // Add resize event listener to update connections
    window.addEventListener('resize', this.handleResizeBound);
    
    // Wheel event for scrolling
    window.addEventListener('wheel', this.handleScrollBound, { passive: false });
  }

  cleanupEventListeners() {
    // Remove event listeners
    window.removeEventListener('mousemove', this.handleMouseMoveBound);
    window.removeEventListener('mousedown', this.handleMouseDownBound);
    window.removeEventListener('mouseup', this.handleMouseUpBound);
    window.removeEventListener('click', this.handleClickBound);
    
    // Remove the resize event listener
    window.removeEventListener('resize', this.handleResizeBound);
    
    // Wheel event for scrolling
    window.removeEventListener('wheel', this.handleScrollBound, { passive: false });
  }

  handleMouseMove(event) {
    if (!this.isActive) return;

    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // If we're in diorama editing mode
    if (this.dioramaEditing.isActive) {
      // Get all furniture objects from visible dioramas
      const furnitureObjects = [];
      this.visibleDioramas.forEach(diorama => {
        diorama.mesh.traverse(child => {
          if (child.userData && child.userData.isFurniture) {
            furnitureObjects.push(child);
          }
        });
      });

      // Find intersections with furniture
      const intersects = this.raycaster.intersectObjects(furnitureObjects, true);

      if (intersects.length > 0) {
        const object = intersects[0].object;
        
        // If we're not already hovering this object
        if (this.dioramaEditing.hoveredObject !== object) {
          // Clear previous hover
          if (this.dioramaEditing.hoveredObject) {
            this.dioramaEditing.hoveredObject.material = this.dioramaEditing.originalMaterials.get(this.dioramaEditing.hoveredObject);
          }
          
          // Set new hover
          this.dioramaEditing.hoveredObject = object;
          this.dioramaEditing.originalMaterials.set(object, object.material);
          object.material = this.dioramaEditing.hoverMaterial.clone();
          
          // Change cursor
          document.body.style.cursor = 'pointer';
        }
      } else {
        // Clear hover if mouse is not over any furniture
        if (this.dioramaEditing.hoveredObject) {
          this.dioramaEditing.hoveredObject.material = this.dioramaEditing.originalMaterials.get(this.dioramaEditing.hoveredObject);
          this.dioramaEditing.hoveredObject = null;
          document.body.style.cursor = 'default';
        }
      }
    }

    // Handle existing cord system
    if (this.cordSystem.isDragging && this.cordSystem.cord) {
      // ... existing cord system code ...
    }
  }

  handleMouseDown(event) {
    if (!this.isActive) return;

    // Get mouse coordinates
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update raycaster
    this.raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.camera);
    
    // If we're in diorama editing mode
    if (this.dioramaEditing.isActive) {
      // Get all furniture objects from visible dioramas
      const furnitureObjects = [];
      this.visibleDioramas.forEach(diorama => {
        diorama.mesh.traverse(child => {
          if (child.userData && child.userData.isFurniture) {
            furnitureObjects.push(child);
          }
        });
      });

      // Find intersections with furniture
      const intersects = this.raycaster.intersectObjects(furnitureObjects, true);

      if (intersects.length > 0) {
        const object = intersects[0].object;
        
        // Check if this is the user's diorama
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const diorama = this.visibleDioramas.find(d => d.mesh.userData.userId === currentUser._id);
        
        if (diorama && object.parent === diorama.mesh) {
          // Handle object selection
          this.handleObjectSelection(object);
          
          // Start drag if object is already selected
          if (this.dioramaEditing.selectedObject === object) {
            this.startObjectDrag(event);
          }
        } else {
          this.showNotification('You can only edit objects in your own diorama', 'warning');
        }
      }
    }

    // Handle existing cord system
    if (!this.dioramaEditing.isActive) {
      // ... existing cord system code ...
    }
  }

  handleMouseUp(event) {
    if (!this.isActive || !this.cordSystem.isDragging) return;
    
    // Stop dragging
    this.cordSystem.isDragging = false;
    
    // Check if we're hovering over a valid target diorama
    if (this.cordSystem.currentHover && 
        this.cordSystem.currentHover !== this.cordSystem.sourceDiorama) {
      // Find the target diorama data
      const targetDiorama = this.visibleDioramas.find(d => d.mesh === this.cordSystem.currentHover);
      
      // Always get the current user's diorama as the source
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userDiorama = this.visibleDioramas.find(d => d.mesh.userData.userId === currentUser._id);
      
      if (targetDiorama && userDiorama) {
        // Anchor the diorama directly from user's diorama to target
        this.anchorDiorama(userDiorama, targetDiorama);
      }
    } else {
      // No valid target, remove the cord
      if (this.cordSystem.cord) {
        this.scene.remove(this.cordSystem.cord);
        this.cordSystem.cord = null;
      }
    }
    
    // Clear any highlight
    if (this.cordSystem.currentHover) {
      this.cordSystem.currentHover.traverse(child => {
        if (child.material && child.material.emissive) {
          child.material.emissive.setRGB(0, 0, 0);
        }
      });
      this.cordSystem.currentHover = null;
    }
    
    // Reset cord system
    this.cordSystem.isActive = false;
    this.cordSystem.sourceDiorama = null;
    
    // Re-enable scrolling
    document.body.style.overflow = 'auto';
  }

  // Add the createCord method
  createCord() {
    // Find the connector object in the source diorama
    const connector = this.cordSystem.sourceDiorama.children.find(child => 
      child.userData && child.userData.isConnector
    );
    
    if (!connector) return;
    
    // Get world position of the connector
    const startPoint = new THREE.Vector3();
    connector.getWorldPosition(startPoint);
    
    // Create a curve from the connector to the drag point
    const curve = new THREE.CatmullRomCurve3([
      startPoint,
      this.cordSystem.dragPoint
    ]);
    
    // Create geometry from the curve
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create material
    const material = new THREE.LineBasicMaterial({
      color: 0x4a90e2,
      linewidth: 3
    });
    
    // Create the line
    const cord = new THREE.Line(geometry, material);
    this.cordSystem.cord = cord;
    
    // Add to scene
    this.scene.add(cord);
  }

  // Add the updateCord method
  updateCord() {
    if (!this.cordSystem.cord || !this.cordSystem.sourceDiorama) return;
    
    // Find the connector object in the source diorama
    const connector = this.cordSystem.sourceDiorama.children.find(child => 
      child.userData && child.userData.isConnector
    );
    
    if (!connector) return;
    
    // Get world position of the connector
    const startPoint = new THREE.Vector3();
    connector.getWorldPosition(startPoint);
    
    // Create a curved path with control points
    const midPoint = new THREE.Vector3().addVectors(startPoint, this.cordSystem.dragPoint).multiplyScalar(0.5);
    midPoint.y += 2; // Add some height to the middle for a nice curve
    
    const curve = new THREE.CubicBezierCurve3(
      startPoint,
      new THREE.Vector3(startPoint.x + 1, startPoint.y + 2, startPoint.z),
      new THREE.Vector3(this.cordSystem.dragPoint.x - 1, this.cordSystem.dragPoint.y + 2, this.cordSystem.dragPoint.z),
      this.cordSystem.dragPoint
    );
    
    // Get points from the curve
    const points = curve.getPoints(50);
    
    // Update cord geometry
    this.cordSystem.cord.geometry.dispose();
    this.cordSystem.cord.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }

  // Add the anchorDiorama method
  anchorDiorama(sourceDiorama, targetDiorama) {
    console.log(`Anchoring diorama ${targetDiorama.index} to ${sourceDiorama.index}`);
    
    // Get the user diorama to ensure we're always using the user's diorama
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userDiorama = this.visibleDioramas.find(d => d.mesh.userData.userId === currentUser._id);
    
    if (!userDiorama) {
      console.error('User diorama not found');
      return;
    }
    
    // Always use the user's diorama as the source, regardless of which diorama initiated the link
    sourceDiorama = userDiorama;
    
    // Calculate new position for target diorama (to the right of the user diorama)
    const userPosition = userDiorama.mesh.position.clone();
    
    // Check how many dioramas are already anchored
    const anchoredCount = this.cordSystem.anchored.size;
    
    // Position to the right with offset based on how many are already anchored
    // Using smaller spacing (12) for the initial offset
    const newPosition = new THREE.Vector3(
      userPosition.x + 12 + (anchoredCount * 14), 
      userPosition.y,
      userPosition.z
    );
    
    // Store original position for later
    const originalPosition = targetDiorama.mesh.position.clone();
    
    // Add to anchored map
    this.cordSystem.anchored.set(targetDiorama.index, {
      diorama: targetDiorama,
      originalPosition
    });
    
    // Animate the diorama to the new position
    this.animateDioramaMove(targetDiorama, originalPosition, newPosition);
    
    // Create permanent connection cord (but don't display it initially)
    this.createPermanentConnection(userDiorama, targetDiorama, newPosition);
    
    // Update the timeline positions to fill any gaps
    this.updateTimelinePositions();
    
    // Remove the temporary cord
    if (this.cordSystem.cord) {
      this.scene.remove(this.cordSystem.cord);
      this.cordSystem.cord = null;
    }
  }

  // Add the animateDioramaMove method
  animateDioramaMove(diorama, startPosition, endPosition) {
    // Animate the diorama movement with easing
    const duration = 1.0; // seconds
    const startTime = Date.now();
    
    const animate = () => {
      if (!this.isActive) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 4); // Quartic ease out
      
      // Interpolate position
      diorama.mesh.position.lerpVectors(startPosition, endPosition, easeProgress);
      
      // Update connections during animation for smoother movement
      if (progress % 0.1 < 0.01) { // Update at 10% intervals to avoid performance issues
        this.updateAllPermanentConnections();
      }
      
      // Continue animation if not complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete, set final position
        diorama.mesh.position.copy(endPosition);
        
        // Update the diorama's stored position
        diorama.yPosition = endPosition.y;
        
        // Final update of all connections
        this.updateAllPermanentConnections();
        
        // Play a sound effect
        const anchorSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3');
        anchorSound.volume = 0.3;
        anchorSound.play().catch(e => console.log('Error playing anchor sound:', e));
        
        // Show a notification
        this.showNotification('Diorama linked successfully!', 'success');
      }
    };
    
    // Start animation
    animate();
  }

  handleClick(event) {
    if (!this.isActive) return;
    
    // Skip if we're currently dragging a cord
    if (this.cordSystem.isDragging) return;
    
    // Get mouse coordinates
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update raycaster
    this.raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.camera);
    
    // Find all interactive objects
    const allInteractiveObjects = [];
    
    // Add all posts, characters, and furniture objects
    this.visibleDioramas.forEach(diorama => {
      diorama.mesh.traverse(child => {
        if (child.userData && (
          child.userData.isPost ||
          child.userData.isCharacter ||
          child.userData.isFurniture
        )) {
          allInteractiveObjects.push(child);
        }
      });
    });
    
    // Add all connection cords
    const connectionCords = this.scene.children.filter(child => 
      child.userData && child.userData.isPermanentConnection
    );
    allInteractiveObjects.push(...connectionCords);
    
    // Find intersections
    const intersects = this.raycaster.intersectObjects(allInteractiveObjects, true);

    if (intersects.length > 0) {
      // Find the appropriate top-level object
      let clickedObject = intersects[0].object;
      
      // Handle case where we hit a part of the model, not the top level object
      while (clickedObject.parent && !(clickedObject.parent instanceof THREE.Scene)) {
        if (clickedObject.userData && (
          clickedObject.userData.isPost ||
          clickedObject.userData.isCharacter ||
          clickedObject.userData.isFurniture ||
          clickedObject.userData.isPermanentConnection
        )) {
          break;
        }
        clickedObject = clickedObject.parent;
      }
      
      // Handle different types of objects
      if (clickedObject.userData.isFurniture && this.dioramaEditing.isActive) {
        this.handleObjectSelection(clickedObject);
      } else if (clickedObject.userData.isPost) {
        // Existing post handling code
        const clickedPost = clickedObject;
        this.reactionSound.currentTime = 0;
        this.reactionSound.play().catch(e => console.log('Error playing reaction sound:', e));
        
        clickedPost.userData.isClicked = true;
        this.createPostPopup(clickedPost);
      } else if (clickedObject.userData.isCharacter) {
        // Existing character handling code
        const clickedCharacter = clickedObject;
        if (clickedCharacter.userData.isSelected) return;
        
        const diorama = this.visibleDioramas.find(d => d.mesh.children.includes(clickedCharacter));
        if (diorama) {
          const userName = this.getUserNameFromId(diorama.mesh.userData.userId) || 'Unknown User';
          this.createCharacterPopup(clickedCharacter, userName, diorama.mesh.userData.userId);
        }
      } else if (clickedObject.userData.isPermanentConnection) {
        // Existing connection handling code
        const targetDioramaIndex = clickedObject.userData.targetDioramaIndex;
        if (confirm('Do you want to unlink this diorama?')) {
          const targetDiorama = this.visibleDioramas.find(d => d.index === targetDioramaIndex);
          this.unlinkDiorama(targetDiorama);
        }
      }
    }
  }

  createPostPopup(postMesh) {
    // Get post data from mesh
    const postContent = postMesh.userData.content;
    const postId = postMesh.userData.postId;
    const authorId = postMesh.userData.authorId;
    
    console.log('Post popup data:', {
      postId,
      authorId,
      postContent: postContent.substring(0, 20) + (postContent.length > 20 ? '...' : '')
    });
    
    // Create popup HTML
    const popupContainer = document.createElement('div');
    popupContainer.id = 'post-popup';
    popupContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: transparent;
      padding: 0;
      max-width: 80%;
      width: 400px;
      color: white;
      z-index: 1000;
    `;
    
    // Create inner container with border and transparency like on notifications page
    const innerContainer = document.createElement('div');
    innerContainer.className = 'post-popup-inner';
    innerContainer.style.cssText = `
      background-color: transparent;
      backdrop-filter: none;
      border-radius: 15px;
      padding: 20px;
      border: 2px solid #4a90e2;
      box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
    `;
    
    // Create content
    const popupContent = document.createElement('div');
    popupContent.id = 'post-popup-content';
    popupContent.textContent = postContent;
    popupContent.style.cssText = `
      margin-bottom: 15px;
      font-size: 18px;
      overflow-wrap: break-word;
    `;
    
    // Get the username for this post
    const username = this.getUserNameFromId(authorId) || 'Unknown User';
    
    // Create author element
    const authorElement = document.createElement('div');
    authorElement.classList.add('post-author');
    authorElement.textContent = `Posted by: ${username}`;
    authorElement.style.cssText = `
      font-size: 14px;
      color: #4a90e2;
      margin-bottom: 10px;
      font-style: italic;
    `;
    
    // Create reaction buttons
    const reactionBar = document.createElement('div');
    reactionBar.classList.add('reaction-bar');
    reactionBar.style.cssText = `
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 15px;
    `;
    
    // Get the current user ID
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const currentUserId = currentUser?._id;
    
    console.log('User comparison for delete button:', {
      currentUserId,
      authorId,
      isMatch: currentUserId === authorId,
      currentUserType: typeof currentUserId,
      authorIdType: typeof authorId
    });
    
    // Create delete button (only if current user is author)
    let deleteButton = null;
    if (currentUserId && authorId && 
        (currentUserId === authorId || currentUserId.toString() === authorId.toString())) {
      deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete Post';
      deleteButton.classList.add('delete-button');
      deleteButton.style.cssText = `
        margin-top: 15px;
        padding: 8px 15px;
        background-color: rgba(230, 57, 70, 0.8);
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
      `;
      
      // Hover effect
      deleteButton.addEventListener('mouseover', () => {
        deleteButton.style.backgroundColor = 'rgba(193, 18, 31, 0.8)';
      });
      
      deleteButton.addEventListener('mouseout', () => {
        deleteButton.style.backgroundColor = 'rgba(230, 57, 70, 0.8)';
      });
      
      // Handle delete click
      deleteButton.addEventListener('click', async () => {
        // Ask for confirmation
        if (confirm('Are you sure you want to delete this post?')) {
          await this.deletePost(postId, postMesh);
        }
      });
    }
    
    // Add reaction buttons
    Object.keys(this.REACTION_TYPES).forEach(emoji => {
      const button = document.createElement('button');
      button.textContent = emoji;
      button.style.cssText = `
        font-size: 20px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 5px;
        transition: transform 0.2s;
      `;
      
      // Add hover effect
      button.addEventListener('mouseover', () => {
        button.style.transform = 'scale(1.2)';
      });
      
      button.addEventListener('mouseout', () => {
        button.style.transform = 'scale(1)';
      });
      
      // Handle reaction click
      button.addEventListener('click', () => {
        this.handleReaction(postId, emoji);
      });
      
      reactionBar.appendChild(button);
    });
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      z-index: 1001;
    `;
    
    // Add elements to inner container
    innerContainer.appendChild(authorElement);
    innerContainer.appendChild(popupContent);
    innerContainer.appendChild(reactionBar);
    
    // Add delete button if current user is author
    if (deleteButton) {
      innerContainer.appendChild(deleteButton);
    }
    
    // Update reaction counts if available
    if (postMesh.userData.reactions) {
      this.updateReactionCounts(postMesh.userData.reactions, innerContainer);
    }
    
    // Add inner container to popup container
    popupContainer.appendChild(innerContainer);
    popupContainer.appendChild(closeButton);
    
    // Add to body
    document.body.appendChild(popupContainer);
    
    // Handle close button click
    const closePopup = (e) => {
      e.preventDefault();
      document.body.removeChild(popupContainer);
      document.removeEventListener('keydown', escapeClose);
      
      // Reset clicked state
      postMesh.userData.isClicked = false;
    };
    
    closeButton.addEventListener('click', closePopup);
    
    // Close on ESC key
    const escapeClose = (e) => {
      if (e.key === 'Escape') {
        closePopup(e);
      }
    };
    
    document.addEventListener('keydown', escapeClose);
  }
  
  // Add createCharacterPopup method
  createCharacterPopup(character, userName, userId) {
    // Create popup for character info
    const popupContainer = document.createElement('div');
    popupContainer.id = 'character-popup';
    popupContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: transparent;
      padding: 0;
      max-width: 80%;
      width: 400px;
      color: white;
      z-index: 1000;
    `;
    
    // Create inner container with border and transparency like on notifications page
    const innerContainer = document.createElement('div');
    innerContainer.className = 'character-popup-inner';
    innerContainer.style.cssText = `
      background-color: transparent;
      backdrop-filter: none;
      border-radius: 15px;
      padding: 20px;
      border: 2px solid #4a90e2;
      box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
    `;
    
    // Add username
    const usernameElement = document.createElement('h2');
    usernameElement.textContent = userName;
    usernameElement.style.cssText = `
      color: #4a90e2;
      margin-bottom: 15px;
      font-size: 24px;
      text-shadow: 0 0 15px rgba(74, 144, 226, 0.5);
    `;
    
    // Create confetti at character's position
    this.createConfetti(character.position);
    
    // Set character as selected
    character.userData.isSelected = true;
    
    // Get user bio if available
    const userBio = this.getUserBio(userId);
    
    // Add bio
    const bioElement = document.createElement('p');
    bioElement.textContent = userBio || "This user hasn't written a bio yet.";
    bioElement.style.cssText = `
      margin-bottom: 20px;
      line-height: 1.5;
    `;
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      z-index: 1001;
    `;
    
    // Add edit button if this is the current user
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser && currentUser._id === userId) {
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit Character';
      editButton.style.cssText = `
        padding: 8px 15px;
        background-color: rgba(74, 144, 226, 0.8);
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        width: 100%;
        transition: background-color 0.2s;
      `;
      
      // Hover effect
      editButton.addEventListener('mouseover', () => {
        editButton.style.backgroundColor = 'rgba(53, 122, 189, 0.8)';
      });
      
      editButton.addEventListener('mouseout', () => {
        editButton.style.backgroundColor = 'rgba(74, 144, 226, 0.8)';
      });
      
      // Redirect to character page on click
      editButton.addEventListener('click', () => {
        window.location.href = 'character.html';
      });
      
      innerContainer.appendChild(editButton);
    }
    
    // Add elements to inner container
    innerContainer.appendChild(usernameElement);
    innerContainer.appendChild(bioElement);
    
    // Add inner container to popup container
    popupContainer.appendChild(innerContainer);
    popupContainer.appendChild(closeButton);
    
    // Add to body
    document.body.appendChild(popupContainer);
    
    // Handle close button click
    const closePopup = (e) => {
      e.preventDefault();
      document.body.removeChild(popupContainer);
      document.removeEventListener('keydown', escapeClose);
      
      // Reset character selection
      character.userData.isSelected = false;
    };
    
    closeButton.addEventListener('click', closePopup);
    
    // Close on ESC key
    const escapeClose = (e) => {
      if (e.key === 'Escape') {
        closePopup(e);
      }
    };
    
    document.addEventListener('keydown', escapeClose);
  }
  
  // Helper method to get user bio
  getUserBio(userId) {
    const user = this.allUsers.find(user => user._id === userId);
    if (user) {
      if (user.character && user.character.bio) {
        return user.character.bio;
      }
      return user.bio || '';
    }
    return '';
  }
  
  // Improved getUserNameFromId method to be more robust
  getUserNameFromId(userId) {
    if (!userId) return 'Unknown User';
    
    // First check allUsers array
    const user = this.allUsers.find(user => user._id === userId);
    if (user && user.username) {
      return user.username;
    }
    
    // If not found, check if it's the current user
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser && currentUser._id === userId && currentUser.username) {
      return currentUser.username;
    }
    
    // Try to find the diorama with this userId to get the username
    const userDiorama = this.visibleDioramas.find(d => d.mesh.userData.userId === userId);
    if (userDiorama && userDiorama.mesh.userData.username) {
      return userDiorama.mesh.userData.username;
    }
    
    // Try to find any post from this user that might have the username
    let username = null;
    this.visibleDioramas.forEach(diorama => {
      if (username) return; // Skip if already found
      
      if (diorama.mesh.userData.posts) {
        const userPost = diorama.mesh.userData.posts.find(p => p.authorId === userId);
        if (userPost && userPost.authorUsername) {
          username = userPost.authorUsername;
        }
      }
    });
    
    if (username) {
      return username;
    }
    
    // Check userPosts map for posts that might have author info
    if (this.userPosts.has(userId)) {
      const posts = this.userPosts.get(userId);
      if (posts && posts.length > 0 && posts[0].authorName) {
        return posts[0].authorName;
      }
    }
    
    // Last resort: Check all userPosts for any post by this author
    for (const [_, posts] of this.userPosts.entries()) {
      for (const post of posts) {
        if ((post.author === userId || post.authorId === userId) && post.authorName) {
          return post.authorName;
        }
      }
    }
    
    return 'Unknown User';
  }
  
  // Add a new method to delete a post with thorough logging
  async deletePost(postId, postMesh) {
    try {
      console.log(`Attempting to delete post with ID: ${postId}`);
      
      // Make API request to delete post
      const response = await makeAuthenticatedRequest(
        `api/posts/${postId}`,
        'DELETE'
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Server error deleting post: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to delete post: ${response.status} ${response.statusText}`);
      }
      
      console.log('Server confirmed post deletion, removing from UI');
      
      // Find and remove the post from the scene
      let postRemoved = false;
      let affectedDiorama = null;
      
      this.visibleDioramas.forEach(diorama => {
        const post = diorama.mesh.children.find(
          child => child.userData && child.userData.isPost && child.userData.postId === postId
        );
        
        if (post) {
          console.log(`Found post in diorama, removing: ${diorama.mesh.userData.userId}`);
          // Store diorama reference for later rearrangement
          affectedDiorama = diorama;
          
          // Remove post from diorama
          diorama.mesh.remove(post);
          postRemoved = true;
          
          // Update userData.posts array
          if (diorama.mesh.userData.posts) {
            const beforeCount = diorama.mesh.userData.posts.length;
            diorama.mesh.userData.posts = diorama.mesh.userData.posts.filter(
              p => p.postId !== postId
            );
            console.log(`Updated posts array: ${beforeCount} -> ${diorama.mesh.userData.posts.length}`);
          }
          
          // Also remove from userPosts map
          const userId = diorama.mesh.userData.userId;
          if (this.userPosts.has(userId)) {
            const posts = this.userPosts.get(userId);
            const beforeCount = posts.length;
            this.userPosts.set(
              userId,
              posts.filter(p => p._id !== postId)
            );
            console.log(`Updated userPosts map: ${beforeCount} -> ${this.userPosts.get(userId).length}`);
          }
        }
      });
      
      if (!postRemoved) {
        console.warn(`Could not find post with ID ${postId} in any diorama`);
      } else if (affectedDiorama) {
        // Rearrange remaining posts to fill the gap
        this.rearrangeDioramaPosts(affectedDiorama);
      }
      
      // Close the popup
      const popup = document.getElementById('post-popup');
      if (popup) {
        document.body.removeChild(popup);
        console.log('Removed post popup');
      } else {
        console.warn('Post popup not found to remove');
      }
      
      // Show success notification
      this.showNotification('Post deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting post:', error);
      this.showNotification('Failed to delete post: ' + error.message, 'error');
    }
  }

  updateLikesCount(likes) {
    if (!Array.isArray(likes)) {
        console.error('Invalid likes data:', likes);
        return;
    }

    const likesContainer = document.querySelector('.likes-count');
    if (likesContainer) {
        likesContainer.textContent = likes.length > 0 ? `${likes.length} likes` : 'No likes yet';
    }
  }

  createBubbles() {
    // Remove PostBubble reference and use simple mesh instead
    const userDiorama = this.visibleDioramas.find(d => d.index === this.userDioramaIndex);
    if (!userDiorama) return;
    
    // Create simple bubble meshes
    const bubbleGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const bubbleMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.8
    });
    
    // Create two example bubbles
    for (let i = 0; i < 2; i++) {
      const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
      bubble.position.set(
        -3 + (i * 1.5),
        2,
        -this.dioramaDepth + 0.3
      );
      userDiorama.mesh.add(bubble);
      this.bubbles.push(bubble);
    }
  }

  animate() {
    if (!this.isActive) return;
    
    requestAnimationFrame(this.animate.bind(this));
    
    // Update posts
    this.update();
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
    
    // Update confetti particles if there are any
    if (this.activeConfetti && this.activeConfetti.length > 0) {
      this.updateConfetti();
    }
  }

  dispose() {
    this.isActive = false;
    
    // Remove event listeners
    this.cleanupEventListeners();
    
    // Close WebSocket connection
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    
    // Clear scene
    this.scene.remove(this.dioramas);
    this.scene.remove(this.posts);
    
    // Dispose of all resources
    this.dioramas.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    
    this.posts.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    
    // Clear arrays
    this.visibleDioramas = [];
    this.bubbles = [];
    this.userPosts.clear();
    this.allUsers = [];
  }

  async loadAllUsers() {
    try {
      const response = await makeAuthenticatedRequest('api/users');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const users = await response.json();
      this.allUsers = users;
      console.log('Loaded all users:', this.allUsers.length);
    } catch (error) {
      console.error('Error loading all users:', error);
      // Optionally throw or handle the error more gracefully
    }
  }

  async loadUserPosts(userId) {
    try {
      const response = await makeAuthenticatedRequest(`api/posts/user/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const posts = await response.json();
      this.userPosts.set(userId, posts);
      console.log(`Loaded ${posts.length} posts for user ${userId}`);
    } catch (error) {
      console.error(`Error loading posts for user ${userId}:`, error);
      // Optionally throw or handle the error more gracefully
    }
  }

  handleReactionUpdate(data) {
    // Find the post in all dioramas
    this.visibleDioramas.forEach(diorama => {
      const post = diorama.mesh.children.find(child => 
        child.userData && child.userData.isPost && child.userData.postId === data.postId
      );
      
      if (post) {
        // Update post reactions
        post.userData.reactions = data.reactions;
        
        // Update reaction counts display
        this.updateReactionCounts(data.reactions);
        
        // If the post is currently in a popup, update that too
        const popup = document.getElementById('post-popup');
        if (popup) {
          const countsContainer = popup.querySelector('.reaction-counts');
          if (countsContainer) {
            this.updateReactionCounts(data.reactions, countsContainer);
          }
        }
      }
    });
  }

  async handleReaction(postId, reactionType) {
    try {
      const response = await makeAuthenticatedRequest(
        `api/posts/${postId}/react`, 
        'POST', 
        { reactionType }
      );

      if (!response.ok) {
        throw new Error('Failed to add reaction');
      }

      const updatedPost = await response.json();
      this.handleReactionUpdate(updatedPost);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }

  updateReactionCounts(reactions, container = document) {
    if (!Array.isArray(reactions)) {
      console.error('Invalid reactions data:', reactions);
      return;
    }

    // Count reactions by type
    const reactionCounts = reactions.reduce((acc, reaction) => {
      acc[reaction.type] = (acc[reaction.type] || 0) + 1;
      return acc;
    }, {});

    // Create or update reaction counts display
    let countsContainer = container.querySelector('.reaction-counts');
    if (!countsContainer) {
      countsContainer = document.createElement('div');
      countsContainer.className = 'reaction-counts';
      countsContainer.style.display = 'flex';
      countsContainer.style.gap = '10px';
      countsContainer.style.justifyContent = 'center';
      countsContainer.style.marginTop = '10px';
      container.appendChild(countsContainer);
    }

    // Clear existing counts
    countsContainer.innerHTML = '';

    // Add counts for each reaction type
    Object.entries(this.REACTION_TYPES).forEach(([emoji, type]) => {
      const count = reactionCounts[type] || 0;
      if (count > 0) {
        const countElement = document.createElement('span');
        countElement.textContent = `${emoji} ${count}`;
        countElement.style.fontSize = '14px';
        countsContainer.appendChild(countElement);
      }
    });
  }

  async loadPosts() {
    try {
      const response = await makeAuthenticatedRequest('api/posts');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const posts = await response.json();
      // Sort posts by createdAt descending
      this.allPosts = posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log('Loaded all posts:', this.allPosts.length);
    } catch (error) {
      console.error('Error loading posts:', error);
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
        } else {
          // Animation complete, set final position
          postMesh.position.copy(targetPosition);
        }
      };
      
      // Start animation
      animatePosition();
    });
  }

  // Add method to update a permanent connection cord to reflect current diorama positions
  updatePermanentConnection(cord) {
    if (!cord || !cord.userData || !cord.userData.isPermanentConnection) return;
    
    // Find source and target dioramas
    const sourceDiorama = this.visibleDioramas.find(d => d.index === cord.userData.sourceDioramaIndex);
    const targetDiorama = this.visibleDioramas.find(d => d.index === cord.userData.targetDioramaIndex);
    
    if (!sourceDiorama || !targetDiorama) {
      console.warn('Cannot update permanent connection: diorama not found');
      return;
    }
    
    // Find the connector object in source diorama
    const sourceConnector = sourceDiorama.mesh.children.find(child => 
      child.userData && child.userData.isConnector
    );
    
    if (!sourceConnector) return;
    
    // Get world position of the source connector - accounting for all parent transformations
    const startPoint = new THREE.Vector3();
    sourceConnector.getWorldPosition(startPoint);
    
    // Create an end point for the target diorama based on its current world position
    const targetPosition = new THREE.Vector3();
    targetDiorama.mesh.getWorldPosition(targetPosition);
    
    // Adjust the endpoint to connect to the left side of the target diorama
    const endPoint = new THREE.Vector3(
      targetPosition.x - 3, // Left side connection point
      targetPosition.y,
      targetPosition.z - this.dioramaDepth/2 + 0.5
    );
    
    // Create a curved path with height based on distance
    const distance = startPoint.distanceTo(endPoint);
    const heightFactor = Math.min(1, distance / 20); // Scale height based on distance, but cap it
    
    const curve = new THREE.CubicBezierCurve3(
      startPoint,
      new THREE.Vector3(startPoint.x + distance * 0.25, startPoint.y + 1 * heightFactor, startPoint.z),
      new THREE.Vector3(endPoint.x - distance * 0.25, endPoint.y + 1 * heightFactor, endPoint.z),
      endPoint
    );
    
    // Get points from the curve
    const points = curve.getPoints(50);
    
    // Update cord geometry
    cord.geometry.dispose();
    cord.geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    return cord;
  }

  // Add method to update all permanent connections
  updateAllPermanentConnections() {
    // Find all permanent connection cords
    const permanentConnections = this.scene.children.filter(child => 
      child.userData && child.userData.isPermanentConnection
    );
    
    // Update each connection
    permanentConnections.forEach(cord => {
      this.updatePermanentConnection(cord);
    });
  }

  // Add new method to initialize variations
  initializeVariations() {
    // Define variations for different furniture types
    this.dioramaEditing.variations.set('bed', [
      { name: 'Default Bed', model: '/models/modern-bedroom.glb', object: 'bed' },
      { name: 'Luxury Bed', model: '/models/variations/luxury-bed.glb' },
      { name: 'Minimalist Bed', model: '/models/variations/minimalist-bed.glb' }
    ]);
    
    this.dioramaEditing.variations.set('desk', [
      { name: 'Default Desk', model: '/models/modern-bedroom.glb', object: 'desk' },
      { name: 'Gaming Desk', model: '/models/variations/gaming-desk.glb' },
      { name: 'Study Desk', model: '/models/variations/study-desk.glb' }
    ]);
    
    this.dioramaEditing.variations.set('chair', [
      { name: 'Default Chair', model: '/models/modern-bedroom.glb', object: 'chair' },
      { name: 'Gaming Chair', model: '/models/variations/gaming-chair.glb' },
      { name: 'Office Chair', model: '/models/variations/office-chair.glb' }
    ]);
    
    // Add more furniture types as needed
  }

  // Add method to handle object selection
  handleObjectSelection(object) {
    if (!this.dioramaEditing.isActive) return;
    
    // Clear previous selection
    if (this.dioramaEditing.selectedObject) {
      this.clearObjectHighlight();
    }
    
    // Store selected object
    this.dioramaEditing.selectedObject = object;
    
    // Highlight the selected object
    this.highlightObject(object);
    
    // Show variation selection UI
    this.showVariationSelector(object);
  }

  // Add method to highlight object
  highlightObject(object) {
    if (!object) return;
    
    // Store original materials
    this.dioramaEditing.originalMaterials.set(object, object.material);
    
    // Apply highlight material
    object.material = this.dioramaEditing.highlightMaterial.clone();
    
    // Add subtle animation
    const originalScale = object.scale.clone();
    const targetScale = originalScale.multiplyScalar(1.05);
    
    // Animate scale
    const duration = 0.3;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easing function
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
      
      // Interpolate scale
      object.scale.lerpVectors(originalScale, targetScale, easeProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  // Add method to clear object highlight
  clearObjectHighlight() {
    if (!this.dioramaEditing.selectedObject) return;
    
    const object = this.dioramaEditing.selectedObject;
    
    // Restore original material
    if (this.dioramaEditing.originalMaterials.has(object)) {
      object.material = this.dioramaEditing.originalMaterials.get(object);
      this.dioramaEditing.originalMaterials.delete(object);
    }
    
    // Reset scale
    object.scale.set(1, 1, 1);
    
    // Clear selection
    this.dioramaEditing.selectedObject = null;
  }

  // Add method to handle object dragging
  handleObjectDrag(event) {
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
    const dioramaId = object.dioramaId;
    if (!dioramaId) {
      console.error('Attempted to save object position for an object without dioramaId', object);
      return;
    }

    const diorama = this.dioramas.children.find(d => d.userData.id === dioramaId);
    if (!diorama) {
      console.error('Diorama not found for ID:', dioramaId);
      return;
    }

    const userId = diorama.userData.userId;
    if (!userId) {
      console.error('User ID not found for diorama:', dioramaId);
      return;
    }

    const objectState = {
      name: object.name,
      position: object.position.toArray(),
      rotation: object.rotation.toArray(),
      scale: object.scale.toArray(),
      variation: object.userData.variation // Save selected variation
    };

    try {
      const response = await makeAuthenticatedRequest(`api/users/${userId}/character`, 'PUT', { character: { objects: [objectState] } });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const updatedUser = await response.json();
      console.log('Object position saved:', updatedUser);

      // Update the local character data in localStorage if it's the current user
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      if (currentUser && currentUser._id === userId) {
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error saving object position:', error);
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