import * as THREE from 'three';
import { Body, Plane, Box, Vec3 } from 'cannon-es';

// Simple seeded RNG for deterministic scatters
function seededRandom(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Builds the world geometry and lights.
export class SceneManager {
  constructor(scene, renderer, physics) {
    this.scene = scene;
    this.renderer = renderer;
    this.physics = physics;

    this.occluders = [];
    this.raycaster = new THREE.Raycaster();

    this.seed = 12345;

    this._initSky();
    this._initLights();
    this._initGround();
    this._initWalls();
    this._initGarden();
    this._initNavMesh();
    this._scatterNature();

    this.elapsed = 0;
    this.sunIntensity = 0;
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
    this.ground = mesh;
    this.occluders.push(mesh);

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
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    const createWall = (width, x, z, rotY) => {
      const geom = new THREE.BoxGeometry(width, height, thickness);
      const wall = new THREE.Mesh(geom, material);
      wall.position.set(x, height / 2, z);
      wall.rotation.y = rotY;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.occluders.push(wall);

      if (this.physics) {
        const shape = new Box(new Vec3(width / 2, height / 2, thickness / 2));
        const body = new Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(x, height / 2, z);
        body.quaternion.setFromEuler(0, rotY, 0);
        this.physics.world.addBody(body);
      }
    };

    const gateWidth = 4;
    const segment = (60 - gateWidth) / 2;

    // back wall
    createWall(60, 0, -halfSize, 0);
    // front wall segments leaving space for gate
    createWall(segment, -(gateWidth / 2 + segment / 2), halfSize, 0);
    createWall(segment, gateWidth / 2 + segment / 2, halfSize, 0);
    // side walls
    createWall(60, -halfSize, 0, Math.PI / 2);
    createWall(60, halfSize, 0, Math.PI / 2);

    // gate placeholder
    const gateGeom = new THREE.BoxGeometry(gateWidth, height, thickness / 2);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const gate = new THREE.Mesh(gateGeom, gateMat);
    gate.position.set(0, height / 2, halfSize);
    gate.castShadow = true;
    gate.receiveShadow = true;
    this.scene.add(gate);
    this.occluders.push(gate);

    this.gate = gate;
    this.gateLocked = true;

    if (this.physics && this.gateLocked) {
      const shape = new Box(new Vec3(gateWidth / 2, height / 2, thickness / 4));
      const body = new Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(0, height / 2, halfSize);
      this.physics.world.addBody(body);
      this.gateBody = body;
    }
  }

  _initGarden() {
    // Simple path down the center
    const pathWidth = 4;
    const pathLength = 60;
    const pathHeight = 0.1;
    const pathGeom = new THREE.BoxGeometry(pathWidth, pathHeight, pathLength);
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const path = new THREE.Mesh(pathGeom, pathMat);
    path.position.set(0, pathHeight / 2, 0);
    path.receiveShadow = true;
    this.scene.add(path);
    this.occluders.push(path);

    if (this.physics) {
      const shape = new Box(
        new Vec3(pathWidth / 2, pathHeight / 2, pathLength / 2)
      );
      const body = new Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(0, pathHeight / 2, 0);
      this.physics.world.addBody(body);
    }

    // Soil beds on either side of path
    const bedWidth = 8;
    const bedLength = 20;
    const bedHeight = 0.2;
    const bedGeom = new THREE.BoxGeometry(bedWidth, bedHeight, bedLength);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24 });

    const bed1 = new THREE.Mesh(bedGeom, bedMat);
    bed1.position.set(-10, bedHeight / 2, 0);
    bed1.receiveShadow = true;
    this.scene.add(bed1);
    this.occluders.push(bed1);

    const bed2 = bed1.clone();
    bed2.position.set(10, bedHeight / 2, 0);
    this.scene.add(bed2);
    this.occluders.push(bed2);

    if (this.physics) {
      const shape = new Box(new Vec3(bedWidth / 2, bedHeight / 2, bedLength / 2));
      const body1 = new Body({ mass: 0 });
      body1.addShape(shape);
      body1.position.set(-10, bedHeight / 2, 0);
      this.physics.world.addBody(body1);

      const body2 = new Body({ mass: 0 });
      body2.addShape(shape);
      body2.position.set(10, bedHeight / 2, 0);
      this.physics.world.addBody(body2);
    }
  }

  _scatterNature() {
    const rand = seededRandom(this.seed);
    const spread = 50;

    // Grass
    const grassCount = 200;
    const grassGeom = new THREE.PlaneGeometry(0.2, 0.8);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x66aa33,
      side: THREE.DoubleSide,
    });
    const grass = new THREE.InstancedMesh(grassGeom, grassMat, grassCount);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < grassCount; i++) {
      const x = rand() * spread - spread / 2;
      const z = rand() * spread - spread / 2;
      matrix.makeRotationY(rand() * Math.PI);
      matrix.setPosition(x, 0.01, z);
      grass.setMatrixAt(i, matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
    this.scene.add(grass);

    // Rocks
    const rockCount = 30;
    const rockGeom = new THREE.DodecahedronGeometry(0.3);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const rocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);
    for (let i = 0; i < rockCount; i++) {
      const x = rand() * spread - spread / 2;
      const z = rand() * spread - spread / 2;
      const s = 0.5 + rand() * 0.5;
      matrix.makeScale(s, s, s);
      matrix.setPosition(x, 0.15, z);
      rocks.setMatrixAt(i, matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;
    this.scene.add(rocks);

    // Wildflowers
    const flowerCount = 50;
    const flowerGeom = new THREE.ConeGeometry(0.1, 0.3, 5);
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
    const flowers = new THREE.InstancedMesh(
      flowerGeom,
      flowerMat,
      flowerCount
    );
    for (let i = 0; i < flowerCount; i++) {
      const x = rand() * spread - spread / 2;
      const z = rand() * spread - spread / 2;
      matrix.identity();
      matrix.setPosition(x, 0.15, z);
      flowers.setMatrixAt(i, matrix);
    }
    flowers.instanceMatrix.needsUpdate = true;
    this.scene.add(flowers);
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
    const cycle = 600; // seconds for a full rotation
    this.elapsed += dt;
    const angle = (this.elapsed / cycle) * Math.PI * 2;
    const radius = 80;
    this.sun.position.set(
      Math.sin(angle) * radius,
      Math.cos(angle) * radius,
      Math.cos(angle) * radius
    );
    this.sun.lookAt(0, 0, 0);

    // Compute intensity over the full cycle and cache it for queries
    this.sunIntensity = Math.max(0, Math.cos(angle));
    this.sun.intensity = this.sunIntensity;
    this.ambientLight.intensity = 0.2 + 0.3 * this.sunIntensity;
  }

  sunlightAt(position) {
    if (this.sunIntensity <= 0) return 0;
    const dir = new THREE.Vector3().subVectors(this.sun.position, position).normalize();
    this.raycaster.set(position, dir);
    const dist = position.distanceTo(this.sun.position);
    const hits = this.raycaster.intersectObjects(this.occluders, true);
    const blocked = hits.some(h => h.distance > 0.01 && h.distance < dist);
    return blocked ? 0 : this.sunIntensity;
  }
}

