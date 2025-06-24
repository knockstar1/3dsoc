import * as THREE from 'three';
import { makeAuthenticatedRequest } from '../utils/api.js';

export class CharacterCreator {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.character = new THREE.Group();
    this.parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
    
    // Initialize variations with empty arrays for each part
    this.variations = {
      head: [],
      teeth: [],
      shirt: [],
      belt: [],
      pants: [],
      shoes: []
    };
    
    this.currentVariations = {};
    this.colors = {
      head: 0xffcc99,
      teeth: 0xffffff,
      shirt: 0x0000ff,
      belt: 0x000000,
      pants: 0x000080,
      shoes: 0x222222
    };
    this.isActive = false;
    
    this.minZoom = 2;
    this.maxZoom = 6;
    this.currentZoom = 3;
    
    // Bind the wheel handler
    this.onWheel = this.handleWheel.bind(this);
    
    // Add notifications list
    this.notificationsList = document.createElement('div');
    this.notificationsList.id = 'notifications-list';
    this.notificationsList.style.position = 'fixed';
    this.notificationsList.style.top = '20px';
    this.notificationsList.style.left = '20px';
    this.notificationsList.style.maxWidth = '400px';
    this.notificationsList.style.maxHeight = '80vh';
    this.notificationsList.style.overflowY = 'auto';
    this.notificationsList.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    this.notificationsList.style.padding = '20px';
    this.notificationsList.style.borderRadius = '8px';
    this.notificationsList.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    this.notificationsList.style.zIndex = '1000';
    document.body.appendChild(this.notificationsList);
    
    this.initializeVariations();
    this.setupControls();
    this.updateColorBoxes();
  }

  handleWheel(e) {
    if (!this.isActive) return;
    
    const zoomSpeed = 0.001;
    this.currentZoom = Math.max(this.minZoom, 
                              Math.min(this.maxZoom, 
                                      this.currentZoom + e.deltaY * zoomSpeed));
    
    this.camera.position.z = this.currentZoom;
  }

  initializeVariations() {
    // Create variations for each part
    this.createHeadVariations();
    this.createTeethVariations();
    this.createShirtVariations();
    this.createBeltVariations();
    this.createPantsVariations();
    this.createShoesVariations();

    // Position camera for character creation - higher look target
    this.camera.position.set(0, 1, this.currentZoom);
    this.camera.lookAt(0, 1, 0);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(ambientLight, directionalLight);

    // Set initial variation indices
    Object.keys(this.variations).forEach(part => {
      this.currentVariations[part] = 0;
    });
  }

  createHeadVariations() {
    // Different head shapes
    const variations = [
      // Round head
      new THREE.SphereGeometry(0.5, 32, 32),
      // Square head
      new THREE.BoxGeometry(0.8, 1, 0.8),
      // Diamond head
      new THREE.OctahedronGeometry(0.5),
      // Hexagonal head
      new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
      // Star head
      new THREE.TetrahedronGeometry(0.5)
    ];
    
    variations.forEach(geometry => {
      const material = new THREE.MeshPhongMaterial({ color: 0xffcc99 });
      const head = new THREE.Mesh(geometry, material);
      this.variations.head.push(head);
    });
  }

  createTeethVariations() {
    // Different teeth shapes
    const variations = [
      // Sharp teeth
      new THREE.ConeGeometry(0.1, 0.2, 4),
      // Square teeth
      new THREE.BoxGeometry(0.2, 0.1, 0.1),
      // Round teeth
      new THREE.SphereGeometry(0.1, 8, 8),
      // Pointy teeth
      new THREE.ConeGeometry(0.15, 0.25, 6),
      // Flat teeth
      new THREE.BoxGeometry(0.25, 0.05, 0.1)
    ];
    
    variations.forEach(geometry => {
      const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
      const teeth = new THREE.Mesh(geometry, material);
      this.variations.teeth.push(teeth);
    });
  }

  createShirtVariations() {
    // Different shirt styles
    const variations = [
      // T-shirt
      new THREE.CylinderGeometry(0.5, 0.4, 1, 8),
      // V-neck shirt
      new THREE.CylinderGeometry(0.5, 0.4, 1, 8),
      // Triangle shirt
      new THREE.ConeGeometry(0.5, 1, 3),
      // Bubble coat
      new THREE.SphereGeometry(0.5, 8, 8),
      // Crop top
      new THREE.CylinderGeometry(0.5, 0.4, 0.5, 8)
    ];
    
    variations.forEach((geometry, index) => {
      const material = new THREE.MeshPhongMaterial({ color: 0x0000ff });
      const shirt = new THREE.Mesh(geometry, material);
      
      // Add different details based on shirt type
      switch(index) {
        case 1: // V-neck shirt
          const vNeck = new THREE.ConeGeometry(0.3, 0.4, 4);
          const vNeckMesh = new THREE.Mesh(vNeck, material);
          vNeckMesh.position.y = 0.5;
          vNeckMesh.rotation.x = Math.PI;
          shirt.add(vNeckMesh);
          break;
        case 2: // Triangle shirt
          shirt.rotation.x = Math.PI;
          shirt.position.y = 0.5;
          break;
        case 3: // Bubble coat
          // Create bubble effect with smaller spheres
          for(let i = 0; i < 8; i++) {
            const bubble = new THREE.Mesh(
              new THREE.SphereGeometry(0.1, 8, 8),
              material
            );
            bubble.position.set(
              Math.cos(i * Math.PI / 4) * 0.3,
              -0.3 + (i % 2) * 0.6,
              Math.sin(i * Math.PI / 4) * 0.3
            );
            shirt.add(bubble);
          }
          break;
        case 4: // Crop top
          // Add trapezoid shape on top
          const trapezoid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.6, 0.5, 0.2, 8),
            material
          );
          trapezoid.position.y = 0.35;
          shirt.add(trapezoid);
          break;
      }
      
      // Position all shirts to extend to mid-legs
      shirt.position.y = 0.5;
      
      this.variations.shirt.push(shirt);
    });
  }

  createBeltVariations() {
    // Different belt styles with different shapes
    const variations = [
      // Triangle belt
      new THREE.TorusGeometry(0.4, 0.05, 16, 16),
      // Rectangle belt
      new THREE.TorusGeometry(0.4, 0.05, 16, 16),
      // Octagon belt
      new THREE.TorusGeometry(0.4, 0.05, 16, 16),
      // Hexagon belt
      new THREE.TorusGeometry(0.4, 0.05, 16, 16),
      // Pentagon belt
      new THREE.TorusGeometry(0.4, 0.05, 16, 16)
    ];
    
    variations.forEach((geometry, index) => {
      const material = new THREE.MeshPhongMaterial({ color: 0x000000 });
      const belt = new THREE.Mesh(geometry, material);
      belt.rotation.x = Math.PI / 2;
      
      // Position belt closer to character
      belt.position.y = -0.05;
      
      // Add different details based on belt type
      switch(index) {
        case 0: // Triangle belt with triangle elements
          const triangleGroup = new THREE.Group();
          for(let i = 0; i < 3; i++) {
            const triangle = new THREE.Mesh(
              new THREE.ConeGeometry(0.1, 0.2, 3),
              new THREE.MeshPhongMaterial({ color: 0x000000 })
            );
            triangle.rotation.x = Math.PI / 2;
            triangle.rotation.y = Math.PI / 2;
            triangle.position.x = Math.cos(i * Math.PI * 2 / 3) * 0.4;
            triangle.position.z = Math.sin(i * Math.PI * 2 / 3) * 0.4;
            triangleGroup.add(triangle);
          }
          triangleGroup.rotation.x = Math.PI / 2;
          belt.add(triangleGroup);
          break;
        case 1: // Rectangle belt with rectangular elements
          const rectangleGroup = new THREE.Group();
          for(let i = 0; i < 4; i++) {
            const rectangle = new THREE.Mesh(
              new THREE.BoxGeometry(0.1, 0.1, 0.2),
              new THREE.MeshPhongMaterial({ color: 0x000000 })
            );
            rectangle.rotation.x = Math.PI / 2;
            rectangle.rotation.y = Math.PI / 2;
            rectangle.position.x = Math.cos(i * Math.PI / 2) * 0.4;
            rectangle.position.z = Math.sin(i * Math.PI / 2) * 0.4;
            rectangleGroup.add(rectangle);
          }
          rectangleGroup.rotation.x = Math.PI / 2;
          belt.add(rectangleGroup);
          break;
        case 2: // Octagon belt with torus elements
          const torusGroup = new THREE.Group();
          for(let i = 0; i < 8; i++) {
            const torus = new THREE.Mesh(
              new THREE.TorusGeometry(0.1, 0.02, 8, 8),
              new THREE.MeshPhongMaterial({ color: 0x000000 })
            );
            torus.rotation.x = Math.PI / 2;
            torus.rotation.y = Math.PI / 2;
            torus.position.x = Math.cos(i * Math.PI / 4) * 0.4;
            torus.position.z = Math.sin(i * Math.PI / 4) * 0.4;
            torusGroup.add(torus);
          }
          torusGroup.rotation.x = Math.PI / 2;
          belt.add(torusGroup);
          break;
        case 3: // Hexagon belt with hexagonal elements
          const hexagonGroup = new THREE.Group();
          for(let i = 0; i < 6; i++) {
            const hexagon = new THREE.Mesh(
              new THREE.CylinderGeometry(0.1, 0.1, 0.1, 6),
              new THREE.MeshPhongMaterial({ color: 0x000000 })
            );
            hexagon.rotation.x = Math.PI / 2;
            hexagon.rotation.y = Math.PI / 2;
            hexagon.position.x = Math.cos(i * Math.PI / 3) * 0.4;
            hexagon.position.z = Math.sin(i * Math.PI / 3) * 0.4;
            hexagonGroup.add(hexagon);
          }
          hexagonGroup.rotation.x = Math.PI / 2;
          belt.add(hexagonGroup);
          break;
        case 4: // Pentagon belt with pentagonal elements
          const pentagonGroup = new THREE.Group();
          for(let i = 0; i < 5; i++) {
            const pentagon = new THREE.Mesh(
              new THREE.CylinderGeometry(0.1, 0.1, 0.1, 5),
              new THREE.MeshPhongMaterial({ color: 0x000000 })
            );
            pentagon.rotation.x = Math.PI / 2;
            pentagon.rotation.y = Math.PI / 2;
            pentagon.position.x = Math.cos(i * Math.PI * 2 / 5) * 0.4;
            pentagon.position.z = Math.sin(i * Math.PI * 2 / 5) * 0.4;
            pentagonGroup.add(pentagon);
          }
          pentagonGroup.rotation.x = Math.PI / 2;
          belt.add(pentagonGroup);
          break;
      }
      
      this.variations.belt.push(belt);
    });
  }

  createPantsVariations() {
    // Different pants patterns
    const patterns = [
      { rings: 12, radius: 0.15, bubbles: false },
      { rings: 12, radius: 0.2, bubbles: true },
      { rings: 12, radius: 0.25, bubbles: false }
    ];
    
    patterns.forEach(({ rings, radius, bubbles }) => {
      const pants = new THREE.Group();
      // Create two rows of rings
      for (let row = 0; row < 2; row++) {
        // Main rings
        for (let i = 0; i < rings; i++) {
          const geometry = new THREE.TorusGeometry(radius, 0.05, 16, 16);
          const material = new THREE.MeshPhongMaterial({ color: 0x000080 });
          const torus = new THREE.Mesh(geometry, material);
          torus.rotation.x = Math.PI / 2;
          // Position in a grid pattern
          torus.position.y = i * 0.08;
          torus.position.x = row === 0 ? -0.2 : 0.2;
          pants.add(torus);
          
          // Add bubbles for bubble variation
          if (bubbles && Math.random() > 0.7) {
            const bubbleGeom = new THREE.SphereGeometry(0.08, 8, 8);
            const bubbleMat = new THREE.MeshPhongMaterial({ 
              color: 0x4040FF,
              transparent: true,
              opacity: 0.6
            });
            const bubble = new THREE.Mesh(bubbleGeom, bubbleMat);
            bubble.position.set(
              torus.position.x + (Math.random() * 0.2 - 0.1),
              torus.position.y,
              (Math.random() * 0.2 - 0.1)
            );
            pants.add(bubble);
          }
        }

        // Add descending rings at the bottom
        const bottomY = (rings - 1) * 0.08;
        for (let i = 0; i < 3; i++) {
          const descRadius = radius * (1 - (i * 0.2)); // Decrease radius by 20% each time
          const geometry = new THREE.TorusGeometry(descRadius, 0.05, 16, 16);
          const material = new THREE.MeshPhongMaterial({ color: 0x000080 });
          const torus = new THREE.Mesh(geometry, material);
          torus.rotation.x = Math.PI / 2;
          torus.position.y = bottomY + ((i + 1) * 0.08); // Add rings below
          torus.position.x = row === 0 ? -0.2 : 0.2;
          pants.add(torus);
        }
      }
      this.variations.pants.push(pants);
    });
  }

  createShoesVariations() {
    // Different shoe shapes
    const variations = [
      // Pyramid shoes
      {
        base: new THREE.ConeGeometry(0.2, 0.4, 4),
        height: 0.15,
        rotation: Math.PI
      },
      // Round shoes
      {
        base: new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8),
        height: 0.2,
        rotation: 0
      },
      // Spiked sphere shoes
      {
        base: new THREE.SphereGeometry(0.2, 8, 8),
        height: 0.2,
        rotation: 0,
        spikes: true
      }
    ];
    
    variations.forEach(({ base: baseGeom, height, rotation, spikes }) => {
      const shoeGroup = new THREE.Group();
      
      // Create left and right shoes
      [-0.3, 0.3].forEach(xOffset => {
        const shoe = new THREE.Group();
        
        // Base of the shoe
        const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const base = new THREE.Mesh(baseGeom, baseMaterial);
        base.rotation.x = -Math.PI * 0.1; // Tilt down slightly
        if (rotation) {
          base.rotation.x += rotation;
        }
        
        shoe.add(base);
        
        // Add spikes for spiked variation
        if (spikes) {
          const spikePositions = [
            [0, 0.2, 0],    // top
            [0.2, 0, 0],    // right
            [-0.2, 0, 0],   // left
            [0, 0, 0.2],    // front
            [0, 0, -0.2],   // back
          ];
          
          spikePositions.forEach(pos => {
            const spikeGeom = new THREE.ConeGeometry(0.05, 0.15, 4);
            const spikeMat = new THREE.MeshStandardMaterial({
              color: 0x333333,
              metalness: 0.8,
              roughness: 0.2
            });
            const spike = new THREE.Mesh(spikeGeom, spikeMat);
            spike.position.set(...pos);
            
            // Point spike outward from center
            spike.lookAt(
              spike.position.x * 2,
              spike.position.y * 2,
              spike.position.z * 2
            );
            
            shoe.add(spike);
          });
        }
        
        shoe.position.set(xOffset, 0, 0);
        shoeGroup.add(shoe);
      });
      
      this.variations.shoes.push(shoeGroup);
    });
  }

  setupControls() {
    // Arrow controls for parts
    document.querySelectorAll('.arrow').forEach(button => {
      button.addEventListener('click', (e) => {
        const part = e.target.dataset.part;
        const direction = e.target.classList.contains('left') ? -1 : 1;
        this.cycleVariation(part, direction);
      });
    });
    
    // Color box controls
    document.querySelectorAll('.color-box').forEach(box => {
      box.addEventListener('click', (e) => {
        const part = e.target.dataset.part;
        this.cycleColor(part);
      });
    });
  }

  cycleColor(part) {
    const colorSets = {
      head: [0xffcc99, 0xe6b89c, 0xffe0bd, 0xd1a579, 0x8d5524],
      teeth: [0xffffff, 0xfffafa, 0xf0f8ff, 0xf5f5f5],
      shirt: [0x0000ff, 0xff0000, 0x00ff00, 0xffff00, 0xff00ff],
      belt: [0x000000, 0x696969, 0x808080, 0xa9a9a9],
      pants: [0x000080, 0x404040, 0x808080, 0x4169e1, 0x800000],
      shoes: [0x222222, 0x3d3d3d, 0x595959, 0x666666]
    };

    const colors = colorSets[part];
    const currentIndex = colors.indexOf(this.colors[part]);
    const nextIndex = (currentIndex + 1) % colors.length;
    this.colors[part] = colors[nextIndex];

    this.updateColorBoxes();
    this.updateCharacter();
  }

  updateColorBoxes() {
    document.querySelectorAll('.color-box').forEach(box => {
      const part = box.dataset.part;
      box.style.backgroundColor = '#' + this.colors[part].toString(16).padStart(6, '0');
    });
  }

  cycleVariation(part, direction) {
    if (this.variations[part]) {
      const count = this.variations[part].length;
      const current = this.currentVariations[part] || 0;
      
      // Calculate new index
      let newIndex = (current + direction) % count;
      if (newIndex < 0) newIndex = count - 1;
      
      // Store new index
      this.currentVariations[part] = newIndex;
      console.log(`Cycling ${part} to variation ${newIndex}`);
      
      // Update character immediately
      this.updateCharacter();
    }
  }

  updateCharacter() {
    // Clear existing character
    while(this.character.children.length > 0) {
      this.character.remove(this.character.children[0]);
    }
    
    // Add each part with current variation and color
    this.parts.forEach(part => {
      if (this.variations[part]) {
        const currentIndex = this.currentVariations[part] || 0;
        const currentVariation = this.variations[part][currentIndex];
        
        if (currentVariation) {
          const mesh = currentVariation.clone();
          
          // Update material color
          if (mesh.material) {
            mesh.material = mesh.material.clone();
            mesh.material.color.setHex(this.colors[part]);
          } else if (mesh instanceof THREE.Group) {
            mesh.traverse(child => {
              if (child.material) {
                child.material = child.material.clone();
                child.material.color.setHex(this.colors[part]);
              }
            });
          }
          
          // Position each part
          switch(part) {
            case 'head':
              mesh.position.y = 1.5;
              break;
            case 'teeth':
              mesh.position.set(0, 1.3, 0.4);
              break;
            case 'shirt':
              mesh.position.y = 0.5;
              break;
            case 'belt':
              mesh.position.y = -0.1;
              mesh.position.z = -0.1; // Move belt slightly back
              break;
            case 'pants':
              mesh.position.y = -1.2;
              break;
            case 'shoes':
              mesh.position.y = -1.8;
              break;
          }
          
          this.character.add(mesh);
        }
      }
    });
  }

  show() {
    // Only show character in character editor page
    if (window.location.pathname.includes('character.html')) {
      console.log('Showing character creator');
      this.isActive = true;
      document.querySelector('.character-creation').classList.add('active');
      
      // Add wheel event listener
      window.addEventListener('wheel', this.onWheel);
      
      // Position camera for character creation
      this.camera.position.set(0, 1, this.currentZoom);
      this.camera.lookAt(0, 1, 0);
      
      // Force update character to ensure all parts are visible
      this.updateCharacter();
      
      // Make sure all variations are initialized
      if (this.variations.head.length === 0) {
        console.log('Reinitializing variations');
        this.initializeVariations();
      }

      // Show notifications
      this.notificationsList.style.display = 'block';
    }
  }

  hide() {
    console.log('Hiding character creator');
    this.isActive = false;
    document.querySelector('.character-creation').classList.remove('active');
    
    // Remove wheel event listener
    window.removeEventListener('wheel', this.onWheel);

    // Hide notifications
    this.notificationsList.style.display = 'none';

    // Remove character from scene if not in character editor
    if (!window.location.pathname.includes('character.html')) {
      this.scene.remove(this.character);
    }
  }

  update() {
    // No spinning animation
  }

  async loadCharacter(characterData) {
    try {
      // If characterData is provided directly, use it (for other users' characters)
      if (characterData) {
        console.log('Using provided character data:', 
          (characterData.variations || (characterData.character && characterData.character.variations)) ? 'has variations' : 'no variations', 
          (characterData.colors || (characterData.character && characterData.character.colors)) ? 'has colors' : 'no colors'
        );
        this.applyCharacterData(characterData);
        
        // If we're on the character page, update the bio field
        if (window.location.pathname.includes('character.html')) {
          const bioElement = document.getElementById('character-bio');
          if (bioElement) {
            const bio = characterData.bio || (characterData.character && characterData.character.bio) || '';
            bioElement.value = bio;
            console.log('Bio loaded from provided character data:', bio);
          }
        }
        return;
      }

      // Load current user's character from database
      console.log('Fetching character from API...');
      const response = await makeAuthenticatedRequest('/api/users/character');
      
      if (!response.ok) {
        throw new Error(`Failed to load character from API: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('API response for character:', responseData);
      
      // Handle nested character data structure 
      let extractedData;
      if (responseData.character && typeof responseData.character === 'object') {
        console.log('Character data is nested under character property');
        extractedData = responseData.character;
        
        // Add bio from top level if not in character object
        if (responseData.bio && !extractedData.bio) {
          extractedData.bio = responseData.bio;
        }
      } else {
        extractedData = responseData;
      }
      
      // Normalize the data structure - handle all possible formats
      let normalizedData = {
        variations: {},
        colors: {},
        bio: ''
      };
      
      // Check various possible data structures
      if (extractedData && typeof extractedData === 'object') {
        // Case 1: Direct variations and colors at top level
        if (extractedData.variations && typeof extractedData.variations === 'object') {
          normalizedData.variations = {...extractedData.variations};
          console.log('Found variations at top level');
        }
        
        if (extractedData.colors && typeof extractedData.colors === 'object') {
          normalizedData.colors = {...extractedData.colors};
          console.log('Found colors at top level');
        }
        
        if (extractedData.bio) {
          normalizedData.bio = extractedData.bio;
          console.log('Found bio at top level');
        }
      }
      
      // Ensure all required properties exist with defaults
      const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
      for (const part of parts) {
        if (normalizedData.variations[part] === undefined) {
          normalizedData.variations[part] = 0;
        }
        
        if (normalizedData.colors[part] === undefined) {
          normalizedData.colors[part] = this.getDefaultColor(part);
        }
      }
      
      // If we have any valid character data, apply it
      if (Object.keys(normalizedData.variations).length > 0 || 
          Object.keys(normalizedData.colors).length > 0) {
        console.log('Applying normalized character data:', normalizedData);
        this.applyCharacterData(normalizedData);
        
        // If we're on the character page, update the bio field
        if (window.location.pathname.includes('character.html')) {
          const bioElement = document.getElementById('character-bio');
          if (bioElement) {
            bioElement.value = normalizedData.bio || '';
            console.log('Bio loaded from API:', normalizedData.bio);
          }
        }
      } else {
        console.log('No usable character data found, creating default character');
        this.createDefaultCharacter();
      }
    } catch (error) {
      console.error('Error loading character from API:', error);
      
      // Only use localStorage as a last resort
      try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUser?.character) {
          console.log('Falling back to localStorage character data');
          
          // Extract character data - handle nested structure
          let localData = currentUser.character;
          if (localData.character && typeof localData.character === 'object') {
            localData = localData.character;
          }
          
          // Normalize localStorage data
          let normalizedData = {
            variations: {},
            colors: {},
            bio: ''
          };
          
          if (localData.variations) {
            normalizedData.variations = {...localData.variations};
          }
          
          if (localData.colors) {
            normalizedData.colors = {...localData.colors};
          }
          
          if (localData.bio) {
            normalizedData.bio = localData.bio;
          } else if (currentUser.bio) {
            normalizedData.bio = currentUser.bio;
          }
          
          // Ensure all parts have valid values
          const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
          for (const part of parts) {
            if (normalizedData.variations[part] === undefined) {
              normalizedData.variations[part] = 0;
            }
            
            if (normalizedData.colors[part] === undefined) {
              normalizedData.colors[part] = this.getDefaultColor(part);
            }
          }
          
          this.applyCharacterData(normalizedData);
          
          // If we're on the character page, update the bio field
          if (window.location.pathname.includes('character.html')) {
            const bioElement = document.getElementById('character-bio');
            if (bioElement) {
              bioElement.value = normalizedData.bio || '';
              console.log('Bio loaded from localStorage:', normalizedData.bio);
            }
          }
        } else {
          console.log('No character data available, creating default character');
          this.createDefaultCharacter();
        }
      } catch (e) {
        console.error('Error loading from localStorage:', e);
        this.createDefaultCharacter();
      }
    }
  }

  applyCharacterData(characterData) {
    // Clear existing character
    if (this.character) {
      this.scene.remove(this.character);
    }

    // Create new character group
    this.character = new THREE.Group();
    
    console.log('Applying character data:', characterData);
    
    // Handle nested character data structure
    let dataToApply = characterData;
    if (characterData.character && typeof characterData.character === 'object') {
      console.log('Character data is nested, extracting from character property');
      dataToApply = characterData.character;
    }
    
    // Apply variations and colors with proper defaults for any missing values
    const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
    
    // Reset current variations to ensure clean slate
    this.currentVariations = {};
    this.colors = {};
    
    // Process variations
    if (dataToApply.variations && typeof dataToApply.variations === 'object') {
      console.log('Setting variations:', dataToApply.variations);
      
      // Process each part with proper defaults
      for (const part of parts) {
        if (dataToApply.variations[part] !== undefined) {
          this.currentVariations[part] = dataToApply.variations[part];
        } else {
          this.currentVariations[part] = 0;
          console.log(`Missing variation for ${part}, using default`);
        }
      }
    } else {
      console.log('No variations in character data, using defaults for all parts');
      for (const part of parts) {
        this.currentVariations[part] = 0;
      }
    }
    
    // Process colors
    if (dataToApply.colors && typeof dataToApply.colors === 'object') {
      console.log('Setting colors:', dataToApply.colors);
      
      // Process each part with proper defaults
      for (const part of parts) {
        if (dataToApply.colors[part] !== undefined) {
          // Handle both hex string and number formats
          if (typeof dataToApply.colors[part] === 'string') {
            // Convert hex string to number if needed
            this.colors[part] = parseInt(dataToApply.colors[part].replace('#', '0x'));
          } else {
            this.colors[part] = dataToApply.colors[part];
          }
        } else {
          this.colors[part] = this.getDefaultColor(part);
          console.log(`Missing color for ${part}, using default`);
        }
      }
    } else {
      console.log('No colors in character data, using defaults for all parts');
      for (const part of parts) {
        this.colors[part] = this.getDefaultColor(part);
      }
    }
    
    // Store bio if it exists (check both in nested and top-level)
    this.bio = dataToApply.bio || characterData.bio || '';

    // Make sure we have all the parts created
    this.createHeadVariations();
    this.createTeethVariations();
    this.createShirtVariations();
    this.createBeltVariations();
    this.createPantsVariations();
    this.createShoesVariations();

    // Update character with current variations and colors
    this.updateCharacter();
    console.log('Character updated with data');

    // Only add character to scene in character editor
    if (window.location.pathname.includes('character.html')) {
      console.log('Adding character to scene');
      this.scene.add(this.character);
    }
  }

  async saveCharacter() {
    // Get bio text if on character page
    let bio = '';
    if (window.location.pathname.includes('character.html')) {
      const bioElement = document.getElementById('character-bio');
      if (bioElement) {
        bio = bioElement.value;
      }
    }
    
    // Ensure variations and colors are properly formatted
    const variations = {};
    const colors = {};
    
    // Ensure all variation parts are included
    const parts = ['head', 'teeth', 'shirt', 'belt', 'pants', 'shoes'];
    for (const part of parts) {
      variations[part] = this.currentVariations[part] !== undefined ? this.currentVariations[part] : 0;
      colors[part] = this.colors[part] !== undefined ? this.colors[part] : this.getDefaultColor(part);
    }
    
    // Prepare character data with properly structured data
    const characterData = {
      variations: variations,
      colors: colors,
      bio: bio
    };
    
    console.log('Saving character data:', characterData);
    
    try {
      // Save to API
      const response = await makeAuthenticatedRequest('/api/users/character', 'PUT', { character: characterData });
      
      if (response.ok) {
        console.log('Character saved to API successfully');
        
        // Also update in localStorage for redundancy
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUser) {
          // Make sure character data is structured properly in localStorage too
          currentUser.character = {
            variations: {...variations},
            colors: {...colors},
            bio: bio
          };
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          console.log('Character data also updated in localStorage');
        }
        
        // Show success message if we're on the character page
        if (window.location.pathname.includes('character.html')) {
          this.showMessage('Character saved successfully!', 'success');
        }
        
        return true;
      } else {
        console.error('API Error saving character:', await response.text());
        if (window.location.pathname.includes('character.html')) {
          this.showMessage('Failed to save character. Please try again.', 'error');
        }
        return false;
      }
    } catch (error) {
      console.error('Error saving character:', error);
      if (window.location.pathname.includes('character.html')) {
        this.showMessage('Failed to save character. Please try again.', 'error');
      }
      return false;
    }
  }
  
  // Helper method to get default color for a part
  getDefaultColor(part) {
    const defaultColors = {
      head: 0xffcc99,
      teeth: 0xffffff,
      shirt: 0x0000ff,
      belt: 0x000000,
      pants: 0x000080,
      shoes: 0x222222
    };
    return defaultColors[part] || 0xcccccc;
  }

  showMessage(message, type = 'info') {
    const messageElement = document.createElement('div');
    messageElement.className = `character-message ${type}`;
    messageElement.textContent = message;
    messageElement.style.position = 'fixed';
    messageElement.style.top = '20px';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translateX(-50%)';
    messageElement.style.padding = '10px 20px';
    messageElement.style.borderRadius = '5px';
    messageElement.style.zIndex = 10000;
    
    // Set styles based on message type
    if (type === 'success') {
      messageElement.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
    } else if (type === 'error') {
      messageElement.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
    } else if (type === 'warning') {
      messageElement.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
    } else {
      messageElement.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
    }
    
    document.body.appendChild(messageElement);
    
    // Remove after 3 seconds
    setTimeout(() => {
      messageElement.style.opacity = '0';
      messageElement.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.parentNode.removeChild(messageElement);
        }
      }, 500);
    }, 3000);
  }

  // Add a method to create a default character if none exists
  createDefaultCharacter() {
    console.log('Creating default character');
    // Reset to default variations and colors
    this.currentVariations = {
      head: 0,
      teeth: 0,
      shirt: 0,
      belt: 0,
      pants: 0,
      shoes: 0
    };
    
    this.colors = {
      head: 0xffcc99,
      teeth: 0xffffff,
      shirt: 0x0000ff,
      belt: 0x000000,
      pants: 0x000080,
      shoes: 0x222222
    };
    
    // Make sure parts are created before updating
    this.createHeadVariations();
    this.createTeethVariations();
    this.createShirtVariations();
    this.createBeltVariations();
    this.createPantsVariations();
    this.createShoesVariations();
    
    // Update character with default settings
    this.updateCharacter();
    
    // Add character to scene if in character editor
    if (window.location.pathname.includes('character.html')) {
      console.log('Adding default character to scene');
      this.scene.add(this.character);
    }
    
    // Return the character for further use
    return this.character;
  }
} 