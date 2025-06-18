import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export class SceneEditor {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.isActive = false;
    this.selectedObject = null;
    this.transformControls = null;
    this.objectList = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Create DOM elements
    this.createUI();
    
    // Bind methods
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleModeChange = this.handleModeChange.bind(this);
    this.update = this.update.bind(this);
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
    this.refreshObjectList = this.refreshObjectList.bind(this);
  }
  
  createUI() {
    // Create editor container
    this.editorContainer = document.createElement('div');
    this.editorContainer.id = 'scene-editor';
    this.editorContainer.style.position = 'fixed';
    this.editorContainer.style.top = '10px';
    this.editorContainer.style.right = '10px';
    this.editorContainer.style.width = '300px';
    this.editorContainer.style.background = 'rgba(30, 30, 30, 0.8)';
    this.editorContainer.style.color = 'white';
    this.editorContainer.style.padding = '10px';
    this.editorContainer.style.borderRadius = '5px';
    this.editorContainer.style.fontFamily = 'Arial, sans-serif';
    this.editorContainer.style.zIndex = '1000';
    this.editorContainer.style.display = 'none';
    
    // Create header
    const header = document.createElement('div');
    header.style.borderBottom = '1px solid #555';
    header.style.paddingBottom = '10px';
    header.style.marginBottom = '10px';
    header.style.fontWeight = 'bold';
    header.textContent = 'Scene Editor';
    this.editorContainer.appendChild(header);
    
    // Create transform mode buttons
    const modeContainer = document.createElement('div');
    modeContainer.style.display = 'flex';
    modeContainer.style.justifyContent = 'space-between';
    modeContainer.style.marginBottom = '10px';
    
    const modes = ['translate', 'rotate', 'scale'];
    modes.forEach(mode => {
      const button = document.createElement('button');
      button.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      button.dataset.mode = mode;
      button.style.padding = '5px 10px';
      button.style.background = '#444';
      button.style.border = 'none';
      button.style.color = 'white';
      button.style.borderRadius = '3px';
      button.style.cursor = 'pointer';
      button.addEventListener('click', this.handleModeChange);
      modeContainer.appendChild(button);
    });
    
    this.editorContainer.appendChild(modeContainer);
    
    // Create object list
    const objectListHeader = document.createElement('div');
    objectListHeader.textContent = 'Scene Objects:';
    objectListHeader.style.marginBottom = '5px';
    this.editorContainer.appendChild(objectListHeader);
    
    this.objectListContainer = document.createElement('div');
    this.objectListContainer.style.maxHeight = '200px';
    this.objectListContainer.style.overflowY = 'auto';
    this.objectListContainer.style.border = '1px solid #555';
    this.objectListContainer.style.padding = '5px';
    this.objectListContainer.style.marginBottom = '10px';
    this.editorContainer.appendChild(this.objectListContainer);
    
    // Create info display
    this.infoDisplay = document.createElement('div');
    this.infoDisplay.style.fontSize = '12px';
    this.infoDisplay.style.marginTop = '10px';
    this.infoDisplay.style.color = '#aaa';
    this.infoDisplay.textContent = 'Click on an object to select it';
    this.editorContainer.appendChild(this.infoDisplay);
    
    // Add to document
    document.body.appendChild(this.editorContainer);
    
    // Initialize transform controls
    this.initTransformControls();
  }
  
  initTransformControls() {
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.addEventListener('change', () => {
      this.updateInfoDisplay();
      this.renderer.render(this.scene, this.camera);
    });
    
    this.transformControls.addEventListener('dragging-changed', (event) => {
      const dragging = event.value;
      
      // Disable orbit controls when using transform controls
      if (window.orbitControls) {
        window.orbitControls.enabled = !dragging;
      }
    });
    
    this.scene.add(this.transformControls);
  }
  
  show() {
    this.isActive = true;
    this.editorContainer.style.display = 'block';
    window.addEventListener('mousedown', this.handleMouseDown);
    this.refreshObjectList();
  }
  
  hide() {
    this.isActive = false;
    this.editorContainer.style.display = 'none';
    window.removeEventListener('mousedown', this.handleMouseDown);
    this.transformControls.detach();
    this.selectedObject = null;
  }
  
  handleModeChange(event) {
    const mode = event.target.dataset.mode;
    this.transformControls.setMode(mode);
    
    // Highlight the active button
    const buttons = event.target.parentElement.querySelectorAll('button');
    buttons.forEach(button => {
      if (button.dataset.mode === mode) {
        button.style.background = '#007bff';
      } else {
        button.style.background = '#444';
      }
    });
  }
  
  handleMouseDown(event) {
    if (!this.isActive) return;
    
    // Convert mouse position to normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Check if clicking UI
    const editorRect = this.editorContainer.getBoundingClientRect();
    if (
      event.clientX >= editorRect.left &&
      event.clientX <= editorRect.right &&
      event.clientY >= editorRect.top &&
      event.clientY <= editorRect.bottom
    ) {
      return; // Clicked on UI, don't raycast
    }
    
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Find all objects that are visible (not helpers or controls)
    const objects = [];
    this.scene.traverse(object => {
      if (object.isMesh && !(object instanceof THREE.AxesHelper)) {
        objects.push(object);
      }
    });
    
    // Find intersections
    const intersects = this.raycaster.intersectObjects(objects);
    
    if (intersects.length > 0) {
      // Get the first intersected object
      let target = intersects[0].object;
      
      // If it's a child, try to select the parent object (like a character or diorama)
      while (target.parent && !(target.parent instanceof THREE.Scene)) {
        if (target.parent.userData && (target.parent.userData.isCharacter || target.parent.userData.isDioramaCharacter)) {
          target = target.parent;
          break;
        }
        
        // For post selection, select the post mesh itself
        if (target.userData && target.userData.isPost) {
          break;
        }
        
        target = target.parent;
      }
      
      this.selectObject(target);
    } else {
      // Clicked nothing, deselect
      this.transformControls.detach();
      this.selectedObject = null;
      this.updateInfoDisplay();
    }
  }
  
  selectObject(object) {
    this.selectedObject = object;
    this.transformControls.attach(object);
    this.updateInfoDisplay();
    
    // Highlight in object list
    const items = this.objectListContainer.querySelectorAll('.object-item');
    items.forEach(item => {
      if (item.dataset.uuid === object.uuid) {
        item.style.background = '#2a5885';
      } else {
        item.style.background = 'transparent';
      }
    });
  }
  
  updateInfoDisplay() {
    if (!this.selectedObject) {
      this.infoDisplay.textContent = 'No object selected';
      return;
    }
    
    const position = this.selectedObject.position;
    const rotation = this.selectedObject.rotation;
    const scale = this.selectedObject.scale;
    
    this.infoDisplay.innerHTML = `
      <strong>Selected:</strong> ${this.selectedObject.name || this.selectedObject.type || 'Object'}<br>
      <strong>Position:</strong> X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}, Z: ${position.z.toFixed(2)}<br>
      <strong>Rotation:</strong> X: ${rotation.x.toFixed(2)}, Y: ${rotation.y.toFixed(2)}, Z: ${rotation.z.toFixed(2)}<br>
      <strong>Scale:</strong> X: ${scale.x.toFixed(2)}, Y: ${scale.y.toFixed(2)}, Z: ${scale.z.toFixed(2)}
    `;
  }
  
  refreshObjectList() {
    this.objectListContainer.innerHTML = '';
    this.objectList = [];
    
    // Find all interactive objects
    this.scene.traverse(object => {
      if ((object.isMesh || object.isGroup) && 
          (object.userData.isCharacter || 
           object.userData.isDioramaCharacter ||
           object.userData.isPost)) {
        this.objectList.push(object);
      }
    });
    
    // Create list items
    this.objectList.forEach(object => {
      const item = document.createElement('div');
      item.className = 'object-item';
      item.dataset.uuid = object.uuid;
      item.textContent = this.getObjectName(object);
      item.style.padding = '5px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = '1px solid #444';
      
      // Highlight if selected
      if (this.selectedObject && this.selectedObject.uuid === object.uuid) {
        item.style.background = '#2a5885';
      }
      
      item.addEventListener('click', () => {
        this.selectObject(object);
      });
      
      this.objectListContainer.appendChild(item);
    });
    
    if (this.objectList.length === 0) {
      const noObjects = document.createElement('div');
      noObjects.textContent = 'No objects found';
      noObjects.style.padding = '5px';
      noObjects.style.color = '#888';
      this.objectListContainer.appendChild(noObjects);
    }
  }
  
  getObjectName(object) {
    if (object.name) return object.name;
    
    if (object.userData.isCharacter || object.userData.isDioramaCharacter) {
      return `Character (${object.userData.userId ? object.userData.userId.substr(0, 6) : 'Unknown'})`;
    }
    
    if (object.userData.isPost) {
      return `Post (${object.userData.content ? object.userData.content.substr(0, 15) + '...' : 'Unknown'})`;
    }
    
    return object.type || 'Unknown Object';
  }
  
  update() {
    if (!this.isActive) return;
    
    // Periodically refresh object list
    if (Math.random() < 0.01) { // Refresh occasionally
      this.refreshObjectList();
    }
  }
} 