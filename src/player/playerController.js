import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useStore } from '../state/store.js';

// Basic first-person controller with WASD movement, jump, sprint and
// pointer-lock mouse look. Integrates with the Physics wrapper.

export class PlayerController {
  constructor(camera, domElement, physics, plantManager, ground) {
    this.camera = camera;
    this.domElement = domElement;
    this.physics = physics;
    this.walkSpeed = 4;
    this.sprintMultiplier = 1.8;
    this.jumpVelocity = 5;
    this.lookSpeed = 0.002;

    this.yaw = 0;
    this.pitch = 0;

    this.keys = {};
    this.jumpRequested = false;

    this.plantManager = plantManager;
    this.ground = ground;
    this.raycaster = new THREE.Raycaster();
    this.currentTool = 'shovel';
    this.water = 1;
    this.seedIds = [];
    this.activeSeedId = null;
    this.toolHud = document.createElement('div');
    this.toolHud.id = 'tool-hud';
    Object.assign(this.toolHud.style, {
      position: 'fixed',
      top: '10px',
      left: '10px',
      padding: '4px 8px',
      background: 'rgba(0,0,0,0.5)',
      color: 'white',
      fontFamily: 'sans-serif',
      zIndex: 1000
    });
    document.body.appendChild(this.toolHud);
    this.updateSeedSelection(useStore.getState().inventory);
    useStore.subscribe((state) => {
      this.updateSeedSelection(state.inventory);
    });
    this.updateToolHud();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') this.interact();
    });

    // Setup pointer lock for mouse look
    this.domElement.addEventListener('click', () => {
      this.domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Create a simple collider body for the player
    this.radius = 0.5;
    this.eyeHeight = 1.6;
    this.body = new CANNON.Body({
      mass: 1,
      position: new CANNON.Vec3(0, this.radius, 0),
      shape: new CANNON.Sphere(this.radius),
      linearDamping: 0.9,
    });
    this.physics.addBody(this.body);
  }

  onMouseMove(e) {
    if (!this.pointerLocked) return;
    this.yaw -= e.movementX * this.lookSpeed;
    this.pitch -= e.movementY * this.lookSpeed;
    const PI_2 = Math.PI / 2;
    this.pitch = Math.max(-PI_2, Math.min(PI_2, this.pitch));
  }

  onKeyDown(e) {
    this.keys[e.code] = true;
    if (e.code === 'Space') this.jumpRequested = true;
    if (e.code === 'Digit1') this.setTool('shovel');
    if (e.code === 'Digit2') this.setTool('wateringCan');
    if (e.code === 'Digit3') this.setTool('shears');
    if (e.code === 'KeyR') this.cycleSeed();
  }

  onKeyUp(e) {
    this.keys[e.code] = false;
  }

  update(dt) {
    // Update camera rotation from accumulated yaw/pitch
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Movement direction in local space
    const direction = new THREE.Vector3();
    if (this.keys['KeyW']) direction.z -= 1;
    if (this.keys['KeyS']) direction.z += 1;
    if (this.keys['KeyA']) direction.x -= 1;
    if (this.keys['KeyD']) direction.x += 1;

    const velocity = this.body.velocity;
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const speed = this.keys['ShiftLeft'] || this.keys['ShiftRight']
        ? this.walkSpeed * this.sprintMultiplier
        : this.walkSpeed;

      const euler = new THREE.Euler(0, this.yaw, 0, 'YXZ');
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
      const move = forward.multiplyScalar(direction.z).add(right.multiplyScalar(direction.x));
      move.normalize();
      velocity.x = move.x * speed;
      velocity.z = move.z * speed;
    } else {
      velocity.x = 0;
      velocity.z = 0;
    }

    // Jumping
    if (this.jumpRequested) {
      const onGround = Math.abs(this.body.position.y - this.radius) < 0.05;
      if (onGround) {
        velocity.y = this.jumpVelocity;
      }
      this.jumpRequested = false;
    }

    // Sync camera position with physics body
    this.camera.position.set(
      this.body.position.x,
      this.body.position.y + (this.eyeHeight - this.radius),
      this.body.position.z
    );
  }

  setTool(tool) {
    this.currentTool = tool;
    this.updateToolHud();
  }

  updateToolHud() {
    const names = {
      shovel: 'Shovel',
      wateringCan: 'Watering Can',
      shears: 'Shears'
    };
    const seedName = this.activeSeedId
      ? this.activeSeedId.replace('seed_', '')
      : 'None';
    this.toolHud.textContent = `Tool: ${names[this.currentTool]} | Seed: ${seedName}`;
  }

  updateSeedSelection(inventory) {
    const seeds = inventory
      .filter((i) => i.type === 'seed' && i.count > 0)
      .map((i) => i.id);
    this.seedIds = seeds;
    if (!this.activeSeedId || !seeds.includes(this.activeSeedId)) {
      this.activeSeedId = seeds[0] || null;
    }
    this.updateToolHud();
  }

  cycleSeed() {
    if (this.seedIds.length === 0) {
      this.activeSeedId = null;
      this.updateToolHud();
      return;
    }
    const index = this.seedIds.indexOf(this.activeSeedId);
    const next = (index + 1) % this.seedIds.length;
    this.activeSeedId = this.seedIds[next];
    this.updateToolHud();
  }

  interact() {
    switch (this.currentTool) {
      case 'shovel':
        this.useShovel();
        break;
      case 'wateringCan':
        this.useWateringCan();
        break;
      case 'shears':
        this.useShears();
        break;
    }
  }

  useShovel() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const plantHits = this.raycaster.intersectObjects(this.plantManager.getMeshes());
    if (plantHits.length > 0) {
      const plant = this.plantManager.getPlantByMesh(plantHits[0].object);
      plant.mesh.rotation.y += Math.PI / 2;
      return;
    }
    const groundHits = this.raycaster.intersectObject(this.ground);
    if (groundHits.length > 0 && this.activeSeedId) {
      const position = groundHits[0].point;
      const seedId = this.activeSeedId;
      const store = useStore.getState();
      const hasSeed = store.inventory.find((i) => i.id === seedId && i.count > 0);
      if (hasSeed) {
        const speciesId = seedId.replace('seed_', '');
        this.plantManager.plantAt(position, speciesId);
        store.removeItem(seedId, 1);
      }
    }
  }

  useWateringCan() {
    if (this.water <= 0) return;
    const origin = this.camera.position.clone();
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const maxDist = 2;
    const cone = Math.PI / 12;
    let watered = 0;
    for (const plant of this.plantManager.plants) {
      const toPlant = plant.position.clone().sub(origin);
      const dist = toPlant.length();
      if (dist > maxDist) continue;
      const angle = forward.angleTo(toPlant.normalize());
      if (angle < cone) {
        this.plantManager.waterPlant(plant);
        watered++;
      }
    }
    this.water = Math.max(0, this.water - watered * 0.1);
  }

  useShears() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const plantHits = this.raycaster.intersectObjects(this.plantManager.getMeshes());
    if (plantHits.length > 0) {
      const plant = this.plantManager.getPlantByMesh(plantHits[0].object);
      this.plantManager.harvestPlant(plant);
    }
  }
}
