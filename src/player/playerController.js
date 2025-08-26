import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useStore } from '../state/store.js';

// Basic first-person controller with WASD movement, jump, sprint and
// pointer-lock mouse look. Integrates with the Physics wrapper.

export class PlayerController {
  constructor(camera, domElement, physics, plantManager, ground, decorManager = null) {
    this.camera = camera;
    this.domElement = domElement;
    this.physics = physics;
    this.walkSpeed = 4;
    this.sprintMultiplier = 1.8;
    this.jumpVelocity = 5;
    this.lookSpeed = useStore.getState().mouseSensitivity;
    this.bobEnabled = useStore.getState().bobEnabled;
    this.unsubscribeSettings = useStore.subscribe((state) => {
      this.lookSpeed = state.mouseSensitivity;
      this.bobEnabled = state.bobEnabled;
    });

    this.yaw = 0;
    this.pitch = 0;

    this.keys = {};
    this.jumpRequested = false;
    this.bobTime = 0;

    this.plantManager = plantManager;
    this.ground = ground;
    this.decorManager = decorManager;
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
    this.unsubscribeInventory = useStore.subscribe((state) => {
      this.updateSeedSelection(state.inventory);
    });
    this.updateToolHud();

    // Crosshair element in the center of the screen
    const style = document.createElement('style');
    style.textContent = `
      #crosshair {
        position: fixed;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 1000;
      }
      #crosshair .horizontal, #crosshair .vertical {
        position: absolute;
        background: white;
      }
      #crosshair .horizontal {
        top: 9px;
        left: 0;
        height: 2px;
        width: 100%;
      }
      #crosshair .vertical {
        left: 9px;
        top: 0;
        width: 2px;
        height: 100%;
      }
      #crosshair.active .horizontal {
        background: yellow;
        height: 4px;
      }
      #crosshair.active .vertical {
        background: yellow;
        width: 4px;
      }
      #crosshair-tooltip {
        position: fixed;
        top: calc(50% + 15px);
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        font-family: sans-serif;
        font-size: 12px;
        padding: 2px 4px;
        pointer-events: none;
        z-index: 1001;
        display: none;
      }
    `;
    document.head.appendChild(style);

    this.crosshair = document.createElement('div');
    this.crosshair.id = 'crosshair';
    this.crosshair.innerHTML = '<div class="horizontal"></div><div class="vertical"></div>';
    document.body.appendChild(this.crosshair);

    this.crosshairTooltip = document.createElement('div');
    this.crosshairTooltip.id = 'crosshair-tooltip';
    document.body.appendChild(this.crosshairTooltip);

    this.handleWindowKeydown = (e) => {
      if (e.code === 'KeyE') this.interact();
    };
    window.addEventListener('keydown', this.handleWindowKeydown);

    // Setup pointer lock for mouse look
    this.handleClick = () => {
      this.domElement.requestPointerLock();
    };
    this.domElement.addEventListener('click', this.handleClick);

    this.handlePointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
    };
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.handlePointerLockChange();

    this.handleMouseMove = (e) => this.onMouseMove(e);
    document.addEventListener('mousemove', this.handleMouseMove);
    this.handleKeyDown = (e) => this.onKeyDown(e);
    document.addEventListener('keydown', this.handleKeyDown);
    this.handleKeyUp = (e) => this.onKeyUp(e);
    document.addEventListener('keyup', this.handleKeyUp);

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
    if (!this.pointerLocked || useStore.getState().isPaused) return;
    this.yaw -= e.movementX * this.lookSpeed;
    this.pitch -= e.movementY * this.lookSpeed;
    const PI_2 = Math.PI / 2;
    this.pitch = Math.max(-PI_2, Math.min(PI_2, this.pitch));
  }

  onKeyDown(e) {
    const store = useStore.getState();
    if (e.code === 'Escape') {
      store.togglePause();
      const paused = useStore.getState().isPaused;
      if (paused) {
        document.exitPointerLock();
        this.keys = {};
      } else {
        this.domElement.requestPointerLock();
      }
      return;
    }
    if (store.isPaused) return;

    this.keys[e.code] = true;
    const bindings = store.keyBindings;
    if (e.code === bindings.jump) this.jumpRequested = true;
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
    if (useStore.getState().isPaused) return;

    const bindings = useStore.getState().keyBindings;

    // Movement direction in local space
    const direction = new THREE.Vector3();
    if (this.keys[bindings.forward]) direction.z -= 1;
    if (this.keys[bindings.back]) direction.z += 1;
    if (this.keys[bindings.left]) direction.x -= 1;
    if (this.keys[bindings.right]) direction.x += 1;

    const velocity = this.body.velocity;
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const speed = this.keys[bindings.sprint]
        ? this.walkSpeed * this.sprintMultiplier
        : this.walkSpeed;

      const euler = new THREE.Euler(0, this.yaw, 0, 'YXZ');
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
      const move = forward
        .multiplyScalar(direction.z)
        .add(right.multiplyScalar(direction.x));
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

    let bobOffset = 0;
    if (this.bobEnabled && direction.lengthSq() > 0) {
      this.bobTime += dt * 10;
      bobOffset = Math.sin(this.bobTime) * 0.05;
    } else {
      this.bobTime = 0;
    }

    // Sync camera position with physics body
    this.camera.position.set(
      this.body.position.x,
      this.body.position.y + (this.eyeHeight - this.radius) + bobOffset,
      this.body.position.z
    );

    this.updateCrosshair();
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

  updateCrosshair() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    let verb = null;
    if (this.currentTool === 'shears') {
      const plantHits = this.raycaster.intersectObjects(this.plantManager.getMeshes());
      if (plantHits.length > 0) verb = 'Harvest';
    } else if (this.currentTool === 'wateringCan') {
      const plantHits = this.raycaster.intersectObjects(this.plantManager.getMeshes());
      if (plantHits.length > 0) verb = 'Water';
    } else if (this.currentTool === 'shovel') {
      const groundHits = this.raycaster.intersectObject(this.ground);
      if (groundHits.length > 0) verb = 'Plant';
    }

    if (verb) {
      this.crosshair.classList.add('active');
      this.crosshairTooltip.textContent = verb;
      this.crosshairTooltip.style.display = 'block';
    } else {
      this.crosshair.classList.remove('active');
      this.crosshairTooltip.style.display = 'none';
    }
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
    if (this.decorManager && this.decorManager.getMeshes) {
      const decorHits = this.raycaster.intersectObjects(this.decorManager.getMeshes());
      if (decorHits.length > 0) {
        decorHits[0].object.rotation.y += Math.PI / 2;
        this.playTick();
        return;
      }
    }
    const plantHits = this.raycaster.intersectObjects(this.plantManager.getMeshes());
    if (plantHits.length > 0) {
      const plant = this.plantManager.getPlantByMesh(plantHits[0].object);
      if (plant.stageIndex === 0) {
        this.plantManager.removePlant(plant);
        this.playTick();
      }
      return;
    }
    const groundHits = this.raycaster.intersectObject(this.ground);
    if (groundHits.length > 0) {
      const position = groundHits[0].point;
      this.plantManager.toggleSoil(position);
      this.playTick();
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
    if (watered > 0) this.playTick();
  }

  useShears() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const plantHits = this.raycaster.intersectObjects(this.plantManager.getMeshes());
    if (plantHits.length > 0) {
      const plant = this.plantManager.getPlantByMesh(plantHits[0].object);
      this.plantManager.harvestPlant(plant);
      this.playTick();
    }
  }

  playTick() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.connect(gain).connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  dispose() {
    window.removeEventListener('keydown', this.handleWindowKeydown);
    this.domElement.removeEventListener('click', this.handleClick);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    if (this.unsubscribeSettings) this.unsubscribeSettings();
    if (this.unsubscribeInventory) this.unsubscribeInventory();
  }
}
