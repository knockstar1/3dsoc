import * as THREE from 'three';
import { PostManager } from '../components/PostManager';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class PostTest {
  constructor() {
    this.init();
    this.animate();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 10;

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(ambientLight, directionalLight);

    // Add controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Create PostManager
    this.postManager = new PostManager(this.scene, this.camera);

    // Add some test posts
    const testPosts = [
      {
        _id: '1',
        content: 'Hello World!',
        position: { x: 0, y: 0, z: 0 }
      },
      {
        _id: '2',
        content: 'Another post',
        position: { x: 3, y: 2, z: -2 }
      },
      {
        _id: '3',
        content: 'Third post',
        position: { x: -3, y: -2, z: 1 }
      }
    ];

    testPosts.forEach(post => this.postManager.addPost(post));

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.postManager.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the test
window.addEventListener('DOMContentLoaded', () => {
  new PostTest();
}); 