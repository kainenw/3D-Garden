import * as THREE from 'three';

// Simple soil bed composed of a grid of tiles marking plantable areas.
export class Soil {
  constructor(scene, width = 10, depth = 10, tileSize = 1) {
    this.scene = scene;
    this.width = width;
    this.depth = depth;
    this.tileSize = tileSize;
    this.tiles = [];
    this.meshes = [];

    const geom = new THREE.PlaneGeometry(tileSize, tileSize);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

    const halfW = (width * tileSize) / 2;
    const halfD = (depth * tileSize) / 2;

    for (let x = 0; x < width; x++) {
      this.tiles[x] = [];
      for (let z = 0; z < depth; z++) {
        const mesh = new THREE.Mesh(geom, mat.clone());
        mesh.rotation.x = -Math.PI / 2;
        const posX = -halfW + x * tileSize + tileSize / 2;
        const posZ = -halfD + z * tileSize + tileSize / 2;
        mesh.position.set(posX, 0.01, posZ);
        scene.add(mesh);

        const tile = {
          x,
          z,
          mesh,
          plantable: true,
          occupied: false,
          position: mesh.position.clone(),
        };
        mesh.userData.tile = tile;
        this.tiles[x][z] = tile;
        this.meshes.push(mesh);
      }
    }
  }

  // Get all tile meshes for raycasting
  getMeshes() {
    return this.meshes;
  }

  // Find the tile under a given world position
  getTileAt(position) {
    const halfW = (this.width * this.tileSize) / 2;
    const halfD = (this.depth * this.tileSize) / 2;
    const xIndex = Math.floor((position.x + halfW) / this.tileSize);
    const zIndex = Math.floor((position.z + halfD) / this.tileSize);
    if (
      xIndex < 0 ||
      zIndex < 0 ||
      xIndex >= this.width ||
      zIndex >= this.depth
    ) {
      return null;
    }
    return this.tiles[xIndex][zIndex];
  }
}

