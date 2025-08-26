import * as THREE from 'three';
import createStore from 'zustand/vanilla';
import { PlayerController } from '../player/playerController.js';
import { SceneManager } from '../render/sceneManager.js';
import { Physics } from '../physics/physics.js';
import { PlantManager } from '../plants/plantManager.js';
import { InventoryUI } from '../ui/inventory.js';
import { PauseMenu } from '../ui/pauseMenu.js';
import { useStore } from '../state/store.js';
import { savePlants, loadPlants } from '../state/persistence.js';

export class App {
  constructor(root) {
    this.root = root;
    this.clock = new THREE.Clock();
    this.store = createStore(() => ({}));
    this.plantsDirty = false;
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
    this.sceneManager = new SceneManager(this.scene, this.renderer, this.physics);
    this.plantManager = new PlantManager(
      this.scene,
      this.sceneManager.ground,
      this.sceneManager
    );
    this.player = new PlayerController(
      this.camera,
      this.renderer.domElement,
      this.physics,
      this.plantManager,
      this.sceneManager.ground
    );
    this.inventoryUI = new InventoryUI();
    this.pauseMenu = new PauseMenu();

    this.plantManager.subscribe(() => {
      this.plantsDirty = true;
    });

    loadPlants().then(plants => {
      for (const data of plants) {
        const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        const plant = this.plantManager.plantAt(position, data.speciesId);
        if (plant) {
          plant.stageIndex = data.stageIndex;
          plant.growthPoints = data.growthPoints;
          plant.hydration = data.hydration;
          plant.fertility = data.fertility ?? plant.fertility;
          this.plantManager.soil.set(plant.soilKey, plant.fertility);
          this.scene.remove(plant.mesh);
          plant.mesh = this.plantManager.createMesh(plant.species, plant.stageIndex);
          plant.mesh.position.copy(plant.position);
          this.scene.add(plant.mesh);
        }
      }
    });

    setInterval(() => {
      if (this.plantsDirty) {
        const data = this.plantManager.plants.map(p => ({
          speciesId: p.speciesId,
          position: { x: p.position.x, y: p.position.y, z: p.position.z },
          stageIndex: p.stageIndex,
          hydration: p.hydration,
          growthPoints: p.growthPoints,
          fertility: p.fertility,
        }));
        savePlants(data);
        this.plantsDirty = false;
      }
    }, 3000);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('beforeunload', () => this.dispose());

    this.loop();
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.033);
    if (!useStore.getState().isPaused) {
      this.physics.step(dt);
      this.player.update(dt);
      this.plantManager.update(dt);
      this.sceneManager.update(dt);
    } else {
      this.player.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.player.dispose();
  }
}
