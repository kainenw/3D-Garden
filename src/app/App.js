import * as THREE from 'three';
import { PlayerController } from '../player/playerController.js';
import { SceneManager } from '../render/sceneManager.js';
import { Physics } from '../physics/physics.js';
import { InventoryUI } from '../ui/inventory.js';

export class App {
  constructor(root) {
    this.root = root;
    this.clock = new THREE.Clock();
  }

  start() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.root.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 1.6, 5);

    this.physics = new Physics();
    this.sceneManager = new SceneManager(this.scene, this.renderer);
    this.player = new PlayerController(this.camera, this.renderer.domElement, this.physics);
    this.inventoryUI = new InventoryUI();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.loop();
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.physics.step(dt);
    this.player.update(dt);
    this.sceneManager.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
