import * as THREE from 'three';

export class CharacterEditor {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.character = new THREE.Group();
    this.variations = {
      head: [],
      teeth: [],
      shirt: [],
      belt: [],
      pants: [],
      shoes: []
    };
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
      shirt: 0x4a90e2,
      belt: 0x000000,
      pants: 0x333333,
      shoes: 0x000000
    };
    this.isActive = false;
    
    // Position camera for character view
    this.camera.position.set(0, 1.5, 2.5);
    this.camera.lookAt(0, 1, 0);
    
    this.init();
  }

  onWheel(e) {
    if (!this.isActive) return;
    
    const zoomSpeed = 0.1;
    const newZ = this.camera.position.z + e.deltaY * zoomSpeed;
    this.camera.position.z = Math.max(2, Math.min(6, newZ));
  }

  async init() {
    // Load the active user's character from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    if (users[currentUser.username]?.character) {
      const characterData = users[currentUser.username].character;
      this.loadCharacter(characterData);
    } else {
      // Create default character if none exists
      this.createDefaultCharacter();
    }
  }

  loadCharacter(characterData) {
    // Clear existing character
    this.character.children = [];
    
    // Load variations and colors from character data
    if (characterData.variations) {
      this.currentVariations = { ...characterData.variations };
    }
    
    if (characterData.colors) {
      this.colors = { ...characterData.colors };
    }
    
    // Create and add all parts
    this.createHeadVariations();
    this.createTeethVariations();
    this.createShirtVariations();
    this.createBeltVariations();
    this.createPantsVariations();
    this.createShoesVariations();
    
    // Update character with current variations and colors
    this.updateCharacter();
  }

  createDefaultCharacter() {
    this.createHeadVariations();
    this.createTeethVariations();
    this.createShirtVariations();
    this.createBeltVariations();
    this.createPantsVariations();
    this.createShoesVariations();
    
    this.updateCharacter();
  }

  createHeadVariations() {
    const variations = [
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.BoxGeometry(0.8, 1, 0.8),
      new THREE.DodecahedronGeometry(0.5, 0)
    ];
    
    variations.forEach(geometry => {
      const material = new THREE.MeshPhongMaterial({ color: this.colors.head });
      const head = new THREE.Mesh(geometry, material);
      this.variations.head.push(head);
    });
  }

  createTeethVariations() {
    const variations = [
      new THREE.ConeGeometry(0.1, 0.2, 4),
      new THREE.BoxGeometry(0.2, 0.1, 0.1),
      new THREE.SphereGeometry(0.1, 8, 8)
    ];
    
    variations.forEach(geometry => {
      const material = new THREE.MeshPhongMaterial({ color: this.colors.teeth });
      const teeth = new THREE.Mesh(geometry, material);
      this.variations.teeth.push(teeth);
    });
  }

  createShirtVariations() {
    const variations = [
      new THREE.CylinderGeometry(0.5, 0.4, 1, 8),
      new THREE.BoxGeometry(0.8, 1, 0.6),
      new THREE.SphereGeometry(0.5, 16, 16)
    ];
    
    variations.forEach(geometry => {
      const material = new THREE.MeshPhongMaterial({ color: this.colors.shirt });
      const shirt = new THREE.Mesh(geometry, material);
      this.variations.shirt.push(shirt);
    });
  }

  createBeltVariations() {
    const variations = [
      new THREE.BoxGeometry(1, 0.1, 0.3),
      new THREE.TorusGeometry(0.4, 0.05, 16, 16),
      new THREE.CylinderGeometry(0.5, 0.4, 0.1, 4)
    ];
    
    variations.forEach(geometry => {
      const material = new THREE.MeshPhongMaterial({ color: this.colors.belt });
      const belt = new THREE.Mesh(geometry, material);
      this.variations.belt.push(belt);
    });
  }

  createPantsVariations() {
    const variations = [
      new THREE.BoxGeometry(0.6, 1.2, 0.6),
      new THREE.CylinderGeometry(0.4, 0.3, 1.2, 8),
      new THREE.SphereGeometry(0.5, 16, 16)
    ];
    
    variations.forEach(geometry => {
      const material = new THREE.MeshPhongMaterial({ color: this.colors.pants });
      const pants = new THREE.Mesh(geometry, material);
      this.variations.pants.push(pants);
    });
  }

  createShoesVariations() {
    const variations = [
      new THREE.BoxGeometry(0.4, 0.2, 0.8),
      new THREE.CylinderGeometry(0.3, 0.2, 0.6, 8),
      new THREE.SphereGeometry(0.3, 16, 16)
    ];
    
    variations.forEach(geometry => {
      const material = new THREE.MeshPhongMaterial({ color: this.colors.shoes });
      const shoes = new THREE.Mesh(geometry, material);
      this.variations.shoes.push(shoes);
    });
  }

  updateCharacter() {
    // Clear existing character
    this.character.children = [];
    
    // Add each part with current variation and color
    Object.entries(this.variations).forEach(([part, variations]) => {
      const currentIndex = this.currentVariations[part];
      const currentVariation = variations[currentIndex];
      
      if (currentVariation) {
        const mesh = currentVariation.clone();
        
        // Update material color
        if (mesh.material) {
          mesh.material = mesh.material.clone();
          mesh.material.color.setHex(this.colors[part]);
        }
        
        // Position each part relative to the character's center
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
            mesh.position.y = 0;
            break;
          case 'pants':
            mesh.position.y = -0.8;
            break;
          case 'shoes':
            mesh.position.y = -1.4;
            break;
        }
        
        this.character.add(mesh);
      }
    });

    // Set character orientation
    this.character.rotation.y = Math.PI / 4; // 45 degrees to face the camera
  }

  saveCharacter() {
    const characterData = {
      variations: { ...this.currentVariations },
      colors: { ...this.colors }
    };

    // Save to localStorage
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    if (currentUser.username) {
      users[currentUser.username] = users[currentUser.username] || {};
      users[currentUser.username].character = characterData;
      localStorage.setItem('users', JSON.stringify(users));
    }
  }
} 