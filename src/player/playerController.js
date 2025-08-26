import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Basic first-person controller with WASD movement, jump, sprint and
// pointer-lock mouse look. Integrates with the Physics wrapper.
export class PlayerController {
  constructor(camera, domElement, physics) {
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
}
