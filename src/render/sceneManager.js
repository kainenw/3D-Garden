import * as THREE from 'three';
import { Body, Plane, Box, Vec3 } from 'cannon-es';

// Builds the world geometry and lights.
export class SceneManager {
  constructor(scene, renderer, physics) {
    this.scene = scene;
    this.renderer = renderer;
    this.physics = physics;

    this._initSky();
    this._initLights();
    this._initGround();
    this._initWalls();
    this._initNavMesh();

    this.elapsed = 0;
  }

  _initSky() {
    // Simple solid color background to mimic a sky.
    this.scene.background = new THREE.Color(0x87ceeb);
  }

  _initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sun.castShadow = true;
    this.sun.position.set(30, 50, 30);
    this.scene.add(this.sun);
  }

  _initGround() {
    const size = 60;
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    if (this.physics) {
      const body = new Body({ mass: 0 });
      body.addShape(new Plane());
      body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      this.physics.world.addBody(body);
    }
  }

  _initWalls() {
    const halfSize = 30; // half of ground size
    const height = 2;
    const thickness = 0.5;
    const geometry = new THREE.BoxGeometry(60, height, thickness);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    const createWall = (x, z, rotY) => {
      const wall = new THREE.Mesh(geometry, material);
      wall.position.set(x, height / 2, z);
      wall.rotation.y = rotY;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);

      if (this.physics) {
        const shape = new Box(new Vec3(30, height / 2, thickness / 2));
        const body = new Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(x, height / 2, z);
        body.quaternion.setFromEuler(0, rotY, 0);
        this.physics.world.addBody(body);
      }
    };

    createWall(0, -halfSize, 0); // back
    createWall(0, halfSize, 0); // front
    createWall(-halfSize, 0, Math.PI / 2); // left
    createWall(halfSize, 0, Math.PI / 2); // right
  }

  _initNavMesh() {
    // Placeholder nav mesh visualized as a transparent green plane.
    const geom = new THREE.PlaneGeometry(60, 60);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
    });
    this.navMesh = new THREE.Mesh(geom, mat);
    this.navMesh.rotation.x = -Math.PI / 2;
    this.navMesh.position.y = 0.01;
    this.scene.add(this.navMesh);
  }

  update(dt) {
    // Rotate the sun to simulate a simple day/night cycle.
    const cycle = 60; // seconds for a full rotation
    this.elapsed += dt;
    const angle = (this.elapsed / cycle) * Math.PI * 2;
    const radius = 80;
    this.sun.position.set(Math.sin(angle) * radius, Math.cos(angle) * radius, Math.cos(angle) * radius);
    this.sun.lookAt(0, 0, 0);

    // Adjust intensity to mimic night time when below horizon
    this.sun.intensity = Math.max(0, Math.cos(angle));
    this.ambientLight.intensity = 0.2 + 0.3 * this.sun.intensity;
  }
}

